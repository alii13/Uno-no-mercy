/**
 * The multiplayer store is a thin client of the authoritative game server:
 * it sends intents and renders personalized snapshots. These tests drive the
 * public API through a scripted fake WebSocket and pin the adapter contract
 * the views rely on, the optimistic echo, and the rollback-on-rejection path.
 * Game RULES are not tested here — they live in shared/engine and the
 * game-server's own gate.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PersonalView, ServerMsg } from '@protocol'
import type { Card } from '../../types/card'

vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
        },
    },
}))

vi.mock('../authStore', () => ({
    useAuthStore: () => ({ username: 'TESTER', user: { id: 'me' } }),
}))

class FakeWebSocket {
    static OPEN = 1
    static instances: FakeWebSocket[] = []
    readyState = 1
    sent: string[] = []
    onopen: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: (() => void) | null = null
    url: string
    constructor(url: string) {
        this.url = url
        FakeWebSocket.instances.push(this)
    }
    send(data: string) { this.sent.push(data) }
    close() { this.readyState = 3; this.onclose?.() }
    // test helpers
    open() { this.onopen?.() }
    receive(msg: ServerMsg) { this.onmessage?.({ data: JSON.stringify(msg) }) }
    lastSent<T = unknown>(): T { return JSON.parse(this.sent[this.sent.length - 1]!) }
}

vi.stubGlobal('WebSocket', FakeWebSocket)
const fakeStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null },
    setItem(k: string, v: string) { this.store[k] = v },
    removeItem(k: string) { delete this.store[k] },
}
vi.stubGlobal('localStorage', fakeStorage)

import { useMultiplayerStore } from '../multiplayerStore'

const card = (id: string, color: Card['color'], type: Card['type'], value?: number): Card => ({ id, color, type, value })
const red5 = card('c-r5', 'red', 'number', 5)
const blue3 = card('c-b3', 'blue', 'number', 3)

function playingView(overrides: Partial<PersonalView> = {}): PersonalView {
    return {
        status: 'playing',
        gameId: 'do-AB12CD-1',
        hostUserId: 'me',
        players: [
            { userId: 'me', name: 'TESTER', seat: 0, handCount: 2, isEliminated: false, connected: true, calledUno: false },
            { userId: 'opp', name: 'RIVAL', seat: 1, handCount: 7, isEliminated: false, connected: true, calledUno: false },
        ],
        you: { userId: 'me', seat: 0, hand: [red5, blue3] },
        currentPlayerId: 'me',
        turnState: 'WAITING_FOR_ACTION',
        direction: 1,
        drawStack: 0,
        currentColor: 'red',
        discardTop: card('c-top', 'red', 'number', 9),
        deckCount: 100,
        discardCount: 12,
        rouletteTargetColor: null,
        pendingDiscardAllCards: null,
        pendingDrawnWildCard: null,
        stackingMode: 'official',
        winnerId: null,
        ...overrides,
    }
}

async function joinRoom(mp: ReturnType<typeof useMultiplayerStore>) {
    const joining = mp.joinGame('AB12CD')
    // connect() awaits the auth token before opening the socket.
    for (let i = 0; i < 20 && FakeWebSocket.instances.length === 0; i++) await Promise.resolve()
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
    ws.open()
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({ t: 'auth', token: 'test-token', name: 'TESTER' })
    ws.receive({ t: 'hello', roomCode: 'AB12CD', userId: 'me', hostUserId: 'me' })
    ws.receive({ t: 'presence', players: [{ userId: 'me', name: 'TESTER', connected: true }] })
    // connect() resolves on the first snapshot (callers read currentGame off it).
    ws.receive({ t: 'snapshot', seq: 0, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })
    await joining
    return ws
}

beforeEach(() => {
    setActivePinia(createPinia())
    FakeWebSocket.instances = []
    fakeStorage.store = {}
})

describe('joining and the lobby adapter', () => {
    it('authenticates, exposes the waiting room from presence, and knows the host', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })

        expect(mp.roomCode).toBe('AB12CD')
        expect(mp.currentGame?.status).toBe('waiting')
        expect(mp.isHost).toBe(true)
        expect(mp.gamePlayers.map(p => p.name)).toEqual(['TESTER'])
        expect(mp.realtimeStatus).toBe('SUBSCRIBED')
    })
})

describe('the playing snapshot adapter', () => {
    it('maps the personalized view onto the legacy row shapes', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        const g = mp.currentGame!
        expect(g.status).toBe('playing')
        expect(g.current_player_id).toBe('me')
        expect(g.draw_stack).toBe(0)
        expect(g.deck.length).toBe(100)
        expect(g.discard_pile[g.discard_pile.length - 1]).toMatchObject({ id: 'c-top' })

        expect(mp.myPlayer?.hand.map(c => c.id)).toEqual(['c-r5', 'c-b3'])
        const opp = mp.opponents[0]!
        expect(opp.hand.length).toBe(7)
        // Opponent cards are placeholders — the server never sent their hand.
        expect(opp.hand.every((c: Card) => c.id.startsWith('hidden-'))).toBe(true)
        expect(mp.isMyTurn).toBe(true)
    })

    it('derives eliminatedIds from the snapshot', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        const v = playingView()
        v.players[1]!.isEliminated = true
        ws.receive({ t: 'snapshot', seq: 2, game: v })

        expect(mp.eliminatedIds.has('opp')).toBe(true)
        expect(mp.currentGame?.eliminated_user_ids).toEqual(['opp'])
    })
})

describe('optimistic play', () => {
    it('echoes the card to the pile immediately and the snapshot confirms', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        await mp.playCard(red5)

        // Local echo before any server frame:
        expect(mp.myPlayer?.hand.map(c => c.id)).toEqual(['c-b3'])
        expect(mp.currentGame?.discard_pile.pop()).toMatchObject({ id: 'c-r5' })
        expect(mp.actionInProgress).toBe(true)
        expect(ws.lastSent()).toMatchObject({ t: 'intent', action: { kind: 'PLAY_CARD', cardId: 'c-r5' } })

        // Authoritative confirmation releases the guard.
        const confirmed = playingView({ currentPlayerId: 'opp', discardTop: red5 })
        confirmed.you!.hand = [blue3]
        confirmed.players[0]!.handCount = 1
        ws.receive({ t: 'snapshot', seq: 3, game: confirmed })
        expect(mp.actionInProgress).toBe(false)
        expect(mp.isMyTurn).toBe(false)
    })

    it('rolls the render back when the server rejects the intent', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        await mp.playCard(red5)
        const intentId = ws.lastSent<{ id: string }>().id
        expect(mp.myPlayer?.hand.length).toBe(1)

        ws.receive({ t: 'error', code: 'invalid-intent', intentId })

        expect(mp.myPlayer?.hand.map(c => c.id)).toEqual(['c-r5', 'c-b3'])
        expect(mp.actionInProgress).toBe(false)
    })
})

describe('remote events', () => {
    it('sets lastRemotePlay for an opponent throw before the snapshot lands', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView({ currentPlayerId: 'opp' }) })

        const played = card('c-opp-play', 'red', 'skip')
        ws.receive({ t: 'event', seq: 3, ev: { t: 'CARD_PLAYED', by: 'opp', card: played } })

        // Action-before-state: the throw is known while the pile still shows the old top.
        expect(mp.lastRemotePlay).toMatchObject({ userId: 'opp', card: { id: 'c-opp-play' } })
        expect(mp.currentGame?.discard_pile.pop()).toMatchObject({ id: 'c-top' })

        ws.receive({ t: 'snapshot', seq: 3, game: playingView({ discardTop: played }) })
        expect(mp.currentGame?.discard_pile.pop()).toMatchObject({ id: 'c-opp-play' })
    })

    it('shouts eliminations into the action feed', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        ws.receive({ t: 'event', seq: 3, ev: { t: 'ELIMINATED', playerId: 'opp' } })

        expect(mp.lastAction?.text).toBe('RIVAL is ELIMINATED')
    })
})

describe('UNO catch windows', () => {
    it('tracks the catchable player from window events and sends the catch intent', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        ws.receive({ t: 'event', seq: 3, ev: { t: 'UNO_WINDOW_OPEN', playerId: 'opp' } })
        expect(mp.catchableUserId).toBe('opp')

        await mp.catchPlayer('opp')
        expect(ws.lastSent()).toMatchObject({ t: 'intent', action: { kind: 'CATCH_UNO', targetUserId: 'opp' } })

        ws.receive({ t: 'event', seq: 4, ev: { t: 'UNO_WINDOW_CLOSED', playerId: 'opp' } })
        expect(mp.catchableUserId).toBeNull()

        // Catching nobody in particular is a no-op.
        const sentBefore = ws.sent.length
        await mp.catchPlayer('opp')
        expect(ws.sent.length).toBe(sentBefore)
    })
})

describe('leaving', () => {
    it('clears state and the stored room', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })
        expect(localStorage.getItem('uno_mp_room')).toBe('AB12CD')

        await mp.leaveGame()

        expect(mp.currentGame).toBeNull()
        expect(mp.roomCode).toBe('')
        expect(localStorage.getItem('uno_mp_room')).toBeNull()
        expect(ws.sent.some(s => JSON.parse(s).t === 'leave')).toBe(true)
    })
})
