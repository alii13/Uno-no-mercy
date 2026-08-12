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

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('../../utils/analytics', () => ({ track }))

class FakeWebSocket {
    static OPEN = 1
    static instances: FakeWebSocket[] = []
    readyState = 1
    sent: string[] = []
    onopen: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: ((e?: { code?: number; reason?: string }) => void) | null = null
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
    // A failed connection: the error event never carries details; the close that follows has the code.
    fail(code: number) { this.readyState = 3; this.onerror?.(); this.onclose?.({ code }) }
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
    // skin rides the auth frame so the room can echo it in presence
    expect(JSON.parse(ws.sent[0]!)).toMatchObject({ t: 'auth', token: 'test-token', name: 'TESTER', skin: 'ember' })
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
    track.mockClear()
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

describe('analytics events', () => {
    it('tracks the room and game lifecycle', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        expect(track).toHaveBeenCalledWith('mp_room_joined', { method: 'code' })

        // STARTED arms the tracker; the playing snapshot fires it with real data.
        ws.receive({ t: 'event', seq: 1, ev: { t: 'STARTED' } })
        ws.receive({ t: 'snapshot', seq: 1, game: playingView() })
        expect(track).toHaveBeenCalledWith('mp_game_started', { players: 2, rules: 'official', rematch: false })

        ws.receive({ t: 'event', seq: 2, ev: { t: 'GAME_OVER', winnerId: 'me' } })
        expect(track).toHaveBeenCalledWith('mp_game_finished', expect.objectContaining({ result: 'won', players: 2 }))

        // A rematch in the same room is marked as one.
        ws.receive({ t: 'event', seq: 3, ev: { t: 'STARTED' } })
        ws.receive({ t: 'snapshot', seq: 3, game: playingView({ gameId: 'do-AB12CD-2' }) })
        expect(track).toHaveBeenCalledWith('mp_game_started', expect.objectContaining({ rematch: true }))

        await mp.leaveGame()
        expect(track).toHaveBeenCalledWith('mp_room_left', expect.objectContaining({ phase: 'playing' }))
    })

    it('a reconnect mid-game does not refire game_started', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        track.mockClear()
        // Snapshot arrives with a game already running (refresh/reconnect) — no STARTED.
        ws.receive({ t: 'snapshot', seq: 5, game: playingView() })
        expect(track).not.toHaveBeenCalledWith('mp_game_started', expect.anything())
    })
})

describe('presence skins', () => {
    it('exposes each seat\'s reported skin from the presence frame', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'presence', players: [
            { userId: 'me', name: 'TESTER', connected: true, skin: 'ember' },
            { userId: 'opp', name: 'RIVAL', connected: true, skin: 'toxic' },
        ] })
        expect(mp.presence.find(p => p.userId === 'opp')?.skin).toBe('toxic')
    })
})

describe('join failure reasons and retry', () => {
    async function startJoin(mp: ReturnType<typeof useMultiplayerStore>) {
        const joining = mp.joinGame('DEADCD')
        for (let i = 0; i < 20 && FakeWebSocket.instances.length === 0; i++) await Promise.resolve()
        return { joining, ws: FakeWebSocket.instances[FakeWebSocket.instances.length - 1]! }
    }

    async function nextSocket(n: number) {
        for (let i = 0; i < 40 && FakeWebSocket.instances.length < n; i++) await Promise.resolve()
        expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(n)
        return FakeWebSocket.instances[n - 1]!
    }

    it('reports the close code, retries once, and joins when the retry connects', async () => {
        vi.useFakeTimers()
        try {
            const mp = useMultiplayerStore()
            const { joining, ws } = await startJoin(mp)

            ws.fail(1006)
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(2_000)

            const ws2 = await nextSocket(2)
            ws2.open()
            ws2.receive({ t: 'hello', roomCode: 'DEADCD', userId: 'me', hostUserId: 'me' })
            ws2.receive({ t: 'snapshot', seq: 0, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })

            expect(await joining).not.toBeNull()
            expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'ws_closed_1006', attempt: 1 , method: 'code' })
            expect(track).toHaveBeenCalledWith('mp_room_joined', { method: 'code' })
        } finally {
            vi.useRealTimers()
        }
    })

    it('gives up after a second transient failure', async () => {
        vi.useFakeTimers()
        try {
            const mp = useMultiplayerStore()
            const { joining, ws } = await startJoin(mp)

            ws.fail(1006)
            await vi.advanceTimersByTimeAsync(0)
            await vi.advanceTimersByTimeAsync(2_000)

            const ws2 = await nextSocket(2)
            ws2.fail(1011)

            expect(await joining).toBeNull()
            expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'ws_closed_1006', attempt: 1 , method: 'code' })
            expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'ws_closed_1011', attempt: 2 , method: 'code' })
            // A transport failure has no server message — the user still needs one.
            expect(mp.error).toBe('Could not reach the game server')
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not retry when the server says the room is gone', async () => {
        const mp = useMultiplayerStore()
        const { joining, ws } = await startJoin(mp)

        ws.open()
        ws.receive({ t: 'error', code: 'room-not-found' })

        expect(await joining).toBeNull()
        expect(FakeWebSocket.instances.length).toBe(1)
        expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'Room not found', attempt: 1 , method: 'code' })
    })

    it('reports a timeout on both attempts when the socket never answers', async () => {
        vi.useFakeTimers()
        try {
            const mp = useMultiplayerStore()
            const { joining } = await startJoin(mp)

            await vi.advanceTimersByTimeAsync(10_000)
            await vi.advanceTimersByTimeAsync(2_000)
            await nextSocket(2)
            await vi.advanceTimersByTimeAsync(10_000)

            expect(await joining).toBeNull()
            expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'timeout', attempt: 1 , method: 'code' })
            expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'timeout', attempt: 2 , method: 'code' })
        } finally {
            vi.useRealTimers()
        }
    })
})

describe('join failures are tracked from every connect entry point', () => {
    // Let createRoom's fetch + connect's getSession settle so the socket appears.
    async function firstSocket() {
        for (let i = 0; i < 60 && FakeWebSocket.instances.length === 0; i++) await Promise.resolve()
        return FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
    }

    it('tracks a host who cannot reach the room they just created', async () => {
        vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ({ code: 'NEWRM1' }) }))
        const mp = useMultiplayerStore()
        const creating = mp.createGame('official')
        const ws = await firstSocket()
        ws.fail(1006)

        expect(await creating).toBeNull()
        expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'ws_closed_1006', attempt: 1, method: 'created' })
    })

    it('tracks a quick-match that hosts a public room but cannot connect', async () => {
        vi.stubGlobal('fetch', async (url: string) =>
            String(url).includes('public-rooms')
                ? { ok: true, json: async () => [] }
                : { ok: true, json: async () => ({ code: 'QMRM01' }) })
        const mp = useMultiplayerStore()
        const matching = mp.quickMatch('official')
        const ws = await firstSocket()
        ws.fail(1006)

        expect(await matching).toBeNull()
        expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'ws_closed_1006', attempt: 1, method: 'quick_match' })
    })

    it('tracks a refresh into a room that has since closed', async () => {
        fakeStorage.store['uno_mp_room'] = JSON.stringify({ code: 'DEADRM', at: Date.now() })
        const mp = useMultiplayerStore()
        const restoring = mp.restoreActiveGame()
        const ws = await firstSocket()
        ws.receive({ t: 'error', code: 'room-not-found' })

        await restoring
        expect(track).toHaveBeenCalledWith('mp_join_failed', { reason: 'Room not found', attempt: 1, method: 'restore' })
        // The dead room is forgotten so the next refresh doesn't retry it.
        expect(fakeStorage.store['uno_mp_room']).toBeUndefined()
    })
})

/**
 * A bare code with no timestamp was retried on every visit forever, so a tab
 * closed mid-game produced a "failed join" days later that no user ever saw. That
 * was 43% of all recorded join failures.
 */
describe('the stored room expires', () => {
    it('still restores a room stored moments ago', async () => {
        fakeStorage.store['uno_mp_room'] = JSON.stringify({ code: 'DEADRM', at: Date.now() - 60_000 })
        const mp = useMultiplayerStore()
        void mp.restoreActiveGame()

        // Reaching the point of opening a socket is all this needs to prove.
        for (let i = 0; i < 60 && FakeWebSocket.instances.length === 0; i++) await Promise.resolve()
        expect(FakeWebSocket.instances.length).toBeGreaterThan(0)
    })

    it('ignores a room stored hours ago, without recording a failure', async () => {
        fakeStorage.store['uno_mp_room'] = JSON.stringify({
            code: 'DEADRM',
            at: Date.now() - 3 * 60 * 60 * 1000,
        })
        const mp = useMultiplayerStore()

        await mp.restoreActiveGame()

        expect(track).not.toHaveBeenCalledWith('mp_join_failed', expect.anything())
        expect(fakeStorage.store['uno_mp_room']).toBeUndefined()
    })

    it('drops an undateable entry written by an older build', async () => {
        fakeStorage.store['uno_mp_room'] = 'DEADRM'
        const mp = useMultiplayerStore()

        await mp.restoreActiveGame()

        expect(track).not.toHaveBeenCalledWith('mp_join_failed', expect.anything())
        expect(fakeStorage.store['uno_mp_room']).toBeUndefined()
    })
})

describe('elimination and spectating', () => {
    const threePlayers = () => [
        { userId: 'me', name: 'TESTER', seat: 0, handCount: 5, isEliminated: false, connected: true, calledUno: false },
        { userId: 'opp', name: 'RIVAL', seat: 1, handCount: 7, isEliminated: false, connected: true, calledUno: false },
        { userId: 'opp2', name: 'THIRD', seat: 2, handCount: 4, isEliminated: false, connected: true, calledUno: false },
    ]

    it('tracks elimination order and derives my placement', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ players: threePlayers() }) })

        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'opp2' } })
        expect(mp.myPlacement).toBeNull() // I'm still alive

        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'me' } })
        expect(mp.myPlacement).toBe(2) // second knocked out of three = 2nd place
    })

    it('fires the KO trigger and spectate analytics only for my own elimination', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ players: threePlayers() }) })

        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'opp' } })
        expect(mp.selfEliminated).toBeNull()
        expect(track).not.toHaveBeenCalledWith('mp_spectate_start', expect.anything())

        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'me' } })
        expect(mp.selfEliminated).not.toBeNull()
        expect(track).toHaveBeenCalledWith('mp_spectate_start', expect.objectContaining({
            players_left: expect.any(Number),
        }))
    })

    it('closes the spectate clock once at game over, and on leave', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ players: threePlayers() }) })
        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'me' } })

        ws.receive({ t: 'event', seq: 9, ev: { t: 'GAME_OVER', winnerId: 'opp' } })
        expect(track).toHaveBeenCalledWith('mp_spectate_end', expect.objectContaining({ via: 'game_over' }))

        track.mockClear()
        await mp.leaveGame()
        expect(track).not.toHaveBeenCalledWith('mp_spectate_end', expect.anything())
    })

    it('closes the spectate clock when leaving mid-spectate', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ players: threePlayers() }) })
        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'me' } })

        await mp.leaveGame()
        expect(track).toHaveBeenCalledWith('mp_spectate_end', expect.objectContaining({ via: 'leave' }))
    })

    it('a rematch clears spectator state and counts the rejoin', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 1, game: playingView({ players: threePlayers() }) })
        ws.receive({ t: 'event', seq: 9, ev: { t: 'ELIMINATED', playerId: 'me' } })
        ws.receive({ t: 'event', seq: 9, ev: { t: 'GAME_OVER', winnerId: 'opp' } })

        ws.receive({ t: 'event', seq: 9, ev: { t: 'STARTED' } })
        expect(mp.selfEliminated).toBeNull()
        expect(mp.myPlacement).toBeNull()
        expect(track).toHaveBeenCalledWith('mp_spectate_rematch_joined', expect.anything())
    })

    it('a fresh game never counts a spectate rejoin', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'event', seq: 9, ev: { t: 'STARTED' } })
        expect(track).not.toHaveBeenCalledWith('mp_spectate_rematch_joined', expect.anything())
    })
})

/**
 * The insta-defeat bug: the public-rooms pool could serve a room whose game
 * had already ended. The joiner was seated with no seat in the dead game and
 * instantly rendered someone else's game-over. These tests pin every client
 * layer of the fix; the directory filter is the server layer.
 */
describe('quick match never sits down in a finished room', () => {
    function finishedGhostView(): PersonalView {
        // A finished game between two strangers — 'me' has no seat in it.
        return playingView({
            status: 'finished',
            you: null,
            currentPlayerId: null,
            winnerId: 'opp',
            players: [
                { userId: 'opp', name: 'RIVAL', seat: 0, handCount: 0, isEliminated: false, connected: true, calledUno: false },
                { userId: 'opp2', name: 'THIRD', seat: 1, handCount: 9, isEliminated: true, connected: true, calledUno: false },
            ],
        })
    }

    async function socketAt(n: number) {
        for (let i = 0; i < 60 && FakeWebSocket.instances.length < n; i++) await Promise.resolve()
        expect(FakeWebSocket.instances.length).toBeGreaterThanOrEqual(n)
        return FakeWebSocket.instances[n - 1]!
    }

    it('skips a dead room and joins the next open one', async () => {
        vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => ['DEAD01', 'OPEN02'] }))
        const mp = useMultiplayerStore()
        const matching = mp.quickMatch('official')

        // First room in the pool: game already over, I was never in it.
        const dead = await socketAt(1)
        dead.open()
        dead.receive({ t: 'hello', roomCode: 'DEAD01', userId: 'me', hostUserId: 'opp' })
        dead.receive({ t: 'snapshot', seq: 40, game: finishedGhostView() })

        // The store walks away and tries the next code.
        const open = await socketAt(2)
        open.open()
        open.receive({ t: 'hello', roomCode: 'OPEN02', userId: 'me', hostUserId: 'opp' })
        open.receive({ t: 'presence', players: [{ userId: 'me', name: 'TESTER', connected: true }] })
        open.receive({ t: 'snapshot', seq: 0, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })

        expect(await matching).toBe('OPEN02')
        expect(dead.readyState).toBe(3)
        expect(mp.roomCode).toBe('OPEN02')
        expect(mp.currentGame?.status).toBe('waiting')
        expect(JSON.parse(localStorage.getItem('uno_mp_room')!).code).toBe('OPEN02')
    })

    it('renders the waiting room, never the game-over, for a seatless joiner', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'presence', players: [
            { userId: 'me', name: 'TESTER', connected: true },
            { userId: 'opp', name: 'RIVAL', connected: true },
        ] })
        ws.receive({ t: 'snapshot', seq: 41, game: finishedGhostView() })

        // Ghost in a finished game → treat the room as its waiting room; the
        // next deal seats everyone connected, ghost included.
        expect(mp.currentGame?.status).toBe('waiting')
        expect(mp.gamePlayers.map(p => p.name).sort()).toEqual(['RIVAL', 'TESTER'])
    })

    it('a player who actually sat in the finished game still sees its result', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 42, game: playingView({ status: 'finished', winnerId: 'opp', currentPlayerId: null }) })

        expect(mp.currentGame?.status).toBe('finished')
    })

    it('a restore that lands in a finished game it never sat in forgets the room', async () => {
        fakeStorage.store['uno_mp_room'] = JSON.stringify({ code: 'DEAD01', at: Date.now() })
        const mp = useMultiplayerStore()
        const restoring = mp.restoreActiveGame()

        const ws = await socketAt(1)
        ws.open()
        ws.receive({ t: 'hello', roomCode: 'DEAD01', userId: 'me', hostUserId: 'opp' })
        ws.receive({ t: 'snapshot', seq: 40, game: finishedGhostView() })
        await restoring

        expect(mp.currentGame).toBeNull()
        expect(mp.roomCode).toBe('')
        expect(fakeStorage.store['uno_mp_room']).toBeUndefined()
        expect(ws.readyState).toBe(3)
    })

    it('frames from a superseded socket cannot poison the new room', async () => {
        const mp = useMultiplayerStore()
        const stale = await joinRoom(mp)

        // A second join supersedes the first socket entirely.
        const joining = mp.joinGame('FRESH2')
        for (let i = 0; i < 20 && FakeWebSocket.instances.length < 2; i++) await Promise.resolve()
        const fresh = FakeWebSocket.instances[1]!
        fresh.open()
        fresh.receive({ t: 'hello', roomCode: 'FRESH2', userId: 'me', hostUserId: 'me' })
        fresh.receive({ t: 'presence', players: [{ userId: 'me', name: 'TESTER', connected: true }] })
        fresh.receive({ t: 'snapshot', seq: 0, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })
        await joining

        expect(stale.readyState).toBe(3)

        // The old room's high-seq finished snapshot arrives late — it must
        // neither replace the view nor outrank the new room's low seq.
        stale.receive({ t: 'snapshot', seq: 99, game: playingView({ status: 'finished', winnerId: 'opp' }) })
        expect(mp.roomCode).toBe('FRESH2')
        expect(mp.currentGame?.status).toBe('waiting')

        fresh.receive({ t: 'snapshot', seq: 1, game: playingView({ status: 'lobby', you: null, currentPlayerId: null, players: [] }) })
        expect(mp.currentGame?.status).toBe('waiting')
    })
})

describe('lobby auto-start countdown', () => {
    const seats = [
        { userId: 'me', name: 'TESTER', connected: true },
        { userId: 'opp', name: 'RIVAL', connected: true },
    ]

    it('mirrors the countdown carried on presence frames', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)

        ws.receive({ t: 'presence', players: seats, autoStartInMs: 30_000 })
        expect(mp.autoStart?.paused).toBe(false)
        // Sent as a duration; the store anchors it to its own clock.
        expect(mp.autoStart!.deadline).toBeGreaterThan(Date.now() + 29_000)

        ws.receive({ t: 'presence', players: seats.slice(0, 1), autoStartInMs: 12_000, autoStartPaused: true })
        expect(mp.autoStart?.paused).toBe(true)

        // A frame with no countdown clears it (old worker, private room).
        ws.receive({ t: 'presence', players: seats })
        expect(mp.autoStart).toBeNull()
    })

    it('clears the countdown when the deal happens', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'presence', players: seats, autoStartInMs: 10_000 })

        ws.receive({ t: 'event', seq: 1, ev: { t: 'STARTED' } })
        expect(mp.autoStart).toBeNull()
    })
})

describe('quick chat', () => {
    it('logs a relayed phrase with the sender name resolved', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        ws.receive({ t: 'chat', userId: 'opp', phraseId: 'mercy' })

        expect(mp.lastChat).toMatchObject({ userId: 'opp', name: 'RIVAL', text: 'Mercy!' })
        expect(mp.chatLog).toHaveLength(1)
    })

    it('drops messages from muted players', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })

        mp.toggleChatMute('opp')
        ws.receive({ t: 'chat', userId: 'opp', phraseId: 'hurry' })
        expect(mp.lastChat).toBeNull()
        expect(mp.chatLog).toHaveLength(0)

        // Unmute lets them speak again.
        mp.toggleChatMute('opp')
        ws.receive({ t: 'chat', userId: 'opp', phraseId: 'hurry' })
        expect(mp.lastChat?.text).toBe('Hurry up!')
    })

    it('ignores ids outside the catalog', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'chat', userId: 'opp', phraseId: 'not-a-phrase' })
        expect(mp.lastChat).toBeNull()
    })

    it('sends the phrase id over the socket', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        mp.sendChat('gg')
        expect(ws.lastSent()).toEqual({ t: 'chat', phraseId: 'gg' })
    })

    it('leaving clears the log and mutes', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'chat', userId: 'me', phraseId: 'hi' })
        mp.toggleChatMute('opp')
        await mp.leaveGame()
        expect(mp.chatLog).toHaveLength(0)
        expect(mp.lastChat).toBeNull()
        expect(mp.mutedChatIds.size).toBe(0)
    })
})

describe('leaving', () => {
    it('clears state and the stored room', async () => {
        const mp = useMultiplayerStore()
        const ws = await joinRoom(mp)
        ws.receive({ t: 'snapshot', seq: 2, game: playingView() })
        expect(JSON.parse(localStorage.getItem('uno_mp_room')!).code).toBe('AB12CD')

        await mp.leaveGame()

        expect(mp.currentGame).toBeNull()
        expect(mp.roomCode).toBe('')
        expect(localStorage.getItem('uno_mp_room')).toBeNull()
        expect(ws.sent.some(s => JSON.parse(s).t === 'leave')).toBe(true)
    })
})
