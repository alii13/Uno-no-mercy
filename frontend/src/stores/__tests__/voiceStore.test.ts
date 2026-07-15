/**
 * The voice store drives a lazily-imported RealtimeKit client with a token
 * minted over the game socket. These tests run the real multiplayer store
 * against the scripted fake WebSocket (same pattern as multiplayerStore.test)
 * and a fake SDK, pinning the join flow, mute, speaking decay, the
 * voice-unavailable posture, and leave-room-leaves-voice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PersonalView, ServerMsg } from '@protocol'

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

// --- Fake RealtimeKit SDK ---

type Handler = (...args: unknown[]) => void

function emitter() {
    const handlers: Record<string, Handler[]> = {}
    return {
        on(ev: string, cb: Handler) { (handlers[ev] ??= []).push(cb) },
        emit(ev: string, ...args: unknown[]) { for (const h of handlers[ev] ?? []) h(...args) },
    }
}

function makeFakeMeeting() {
    const self = Object.assign(emitter(), {
        id: 'peer-self',
        customParticipantId: 'me',
        audioEnabled: true,
        enableAudio: vi.fn(async () => { self.audioEnabled = true; self.emit('audioUpdate', { audioEnabled: true }) }),
        disableAudio: vi.fn(() => { self.audioEnabled = false; self.emit('audioUpdate', { audioEnabled: false }) }),
    })
    const joined = Object.assign(new Map<string, { id: string; customParticipantId?: string }>(), emitter())
    const participants = Object.assign(emitter(), { joined })
    return {
        join: vi.fn(async () => {}),
        leave: vi.fn(async () => { self.emit('roomLeft', { state: 'left' }) }),
        self,
        participants,
    }
}

let fakeMeeting = makeFakeMeeting()
const init = vi.fn(async (_opts: { authToken: string }) => fakeMeeting)

vi.mock('@cloudflare/realtimekit', () => ({ default: { init } }))

// --- Fake game socket (multiplayerStore.test pattern) ---

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
    constructor(url: string) { this.url = url; FakeWebSocket.instances.push(this) }
    send(data: string) { this.sent.push(data) }
    close() { this.readyState = 3; this.onclose?.() }
    open() { this.onopen?.() }
    receive(msg: ServerMsg) { this.onmessage?.({ data: JSON.stringify(msg) }) }
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
import { useVoiceStore } from '../voiceStore'

function lobbyView(): PersonalView {
    return {
        status: 'lobby', gameId: null, hostUserId: 'me', players: [], you: null,
        currentPlayerId: null, turnState: 'WAITING_FOR_ACTION', direction: 1, drawStack: 0,
        currentColor: 'red', discardTop: null, deckCount: 0, discardCount: 0,
        rouletteTargetColor: null, pendingDiscardAllCards: null, pendingDrawnWildCard: null,
        stackingMode: 'official', winnerId: null,
    }
}

async function joinRoom(mp: ReturnType<typeof useMultiplayerStore>) {
    const joining = mp.joinGame('AB12CD')
    for (let i = 0; i < 20 && FakeWebSocket.instances.length === 0; i++) await Promise.resolve()
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]!
    ws.open()
    ws.receive({ t: 'hello', roomCode: 'AB12CD', userId: 'me', hostUserId: 'me' })
    ws.receive({ t: 'snapshot', seq: 0, game: lobbyView() })
    await joining
    return ws
}

/** joinVoice → server answers with a token → SDK connects. */
async function goLive(ws: FakeWebSocket, voice: ReturnType<typeof useVoiceStore>) {
    await voice.joinVoice()
    expect(JSON.parse(ws.sent[ws.sent.length - 1]!)).toEqual({ t: 'voice-join' })
    ws.receive({ t: 'voice-token', token: 'rtk-token', meetingId: 'meet-1' })
    // onVoiceToken awaits the (mocked) dynamic import and join.
    for (let i = 0; i < 20 && voice.state !== 'live'; i++) await Promise.resolve()
}

beforeEach(() => {
    setActivePinia(createPinia())
    FakeWebSocket.instances = []
    fakeStorage.store = {}
    fakeMeeting = makeFakeMeeting()
    init.mockClear()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('joining voice', () => {
    it('sends voice-join, connects the SDK with the token, and goes live unmuted', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)

        await goLive(ws, voice)

        expect(init).toHaveBeenCalledWith(expect.objectContaining({
            authToken: 'rtk-token',
            defaults: { audio: true, video: false },
        }))
        expect(fakeMeeting.join).toHaveBeenCalled()
        expect(voice.state).toBe('live')
        expect(voice.muted).toBe(false)
        expect(voice.voiceUserIds.has('me')).toBe(true)
    })

    it('hides the feature when the server answers voice-unavailable', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)

        await voice.joinVoice()
        ws.receive({ t: 'error', code: 'voice-unavailable' })

        expect(voice.available).toBe(false)
        expect(voice.state).toBe('off')
        expect(init).not.toHaveBeenCalled()
    })

    it('errors with RETRY when the SDK cannot connect', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)
        fakeMeeting.join.mockRejectedValueOnce(new Error('no mic'))

        await goLive(ws, voice)

        expect(voice.state).toBe('error')
        expect(voice.errorText).toContain('retry')
        // The retry path is allowed to run again.
        await voice.joinVoice()
        expect(voice.state).toBe('requesting-token')
    })
})

describe('live controls', () => {
    it('toggles mute through the SDK and follows audioUpdate', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)
        await goLive(ws, voice)

        await voice.toggleMute()
        expect(fakeMeeting.self.disableAudio).toHaveBeenCalled()
        expect(voice.muted).toBe(true)

        await voice.toggleMute()
        expect(fakeMeeting.self.enableAudio).toHaveBeenCalled()
        expect(voice.muted).toBe(false)
    })

    it('maps activeSpeaker peers to game userIds and decays after the hold', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)
        await goLive(ws, voice)

        fakeMeeting.participants.joined.set('peer-2', { id: 'peer-2', customParticipantId: 'opp' })
        fakeMeeting.participants.joined.emit('participantJoined', fakeMeeting.participants.joined.get('peer-2'))
        expect(voice.voiceUserIds.has('opp')).toBe(true)

        vi.useFakeTimers()
        fakeMeeting.participants.emit('activeSpeaker', { peerId: 'peer-2', volume: 40 })
        expect(voice.speakingUserIds.has('opp')).toBe(true)

        vi.advanceTimersByTime(1500)
        expect(voice.speakingUserIds.has('opp')).toBe(false)
    })
})

describe('leaving', () => {
    it('leaving the room leaves voice too', async () => {
        const mp = useMultiplayerStore()
        const voice = useVoiceStore()
        const ws = await joinRoom(mp)
        await goLive(ws, voice)

        await mp.leaveGame()

        expect(fakeMeeting.leave).toHaveBeenCalled()
        expect(voice.state).toBe('off')
        expect(voice.voiceUserIds.size).toBe(0)
    })
})
