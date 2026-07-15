import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useMultiplayerStore } from './multiplayerStore'
import { music } from '../composables/useMusic'

// Voice channel for a game room, on Cloudflare RealtimeKit. The token comes
// over the game socket (voice-join → voice-token), so only seated roster
// members get in. The SDK is loaded lazily on the first join — it never
// touches the entry chunk. Voice failures never affect the game.

// The slice of the RealtimeKit client this store drives. Structural typing
// keeps the SDK's own types out of the static import graph.
interface RtkParticipant {
    id: string
    customParticipantId?: string
    audioEnabled?: boolean
    audioTrack?: MediaStreamTrack | null
    /** Moderation — permission-gated by the caller's preset (room host). */
    disableAudio?(): Promise<void>
    kick?(): Promise<void>
}
interface RtkMeeting {
    join(): Promise<void>
    leave(): Promise<void>
    self: {
        id: string
        customParticipantId?: string
        audioEnabled: boolean
        enableAudio(): Promise<void>
        disableAudio(): unknown
        on(ev: string, cb: (...args: never[]) => void): unknown
    }
    participants: {
        joined: Map<string, RtkParticipant> & { on(ev: string, cb: (...args: never[]) => void): unknown }
        disableAllAudio?(allowUnmute: boolean): Promise<void>
        on(ev: string, cb: (...args: never[]) => void): unknown
    }
}

export type VoiceState = 'off' | 'requesting-token' | 'connecting' | 'live' | 'error'

const TOKEN_TIMEOUT_MS = 10_000
// activeSpeaker has no "stopped" counterpart — a speaker stays lit this long
// after their last event.
const SPEAKING_HOLD_MS = 1200

export const useVoiceStore = defineStore('voice', () => {
    const state = ref<VoiceState>('off')
    const muted = ref(false)
    /** false once the server answers voice-unavailable — the UI hides the feature. */
    const available = ref(true)
    const errorText = ref<string | null>(null)
    /** Supabase userIds currently in the voice channel (including me when live). */
    const voiceUserIds = ref(new Set<string>())
    const speakingUserIds = ref(new Set<string>())
    /** Remote participants whose mic is currently on. */
    const unmutedUserIds = ref(new Set<string>())
    /** Players I've silenced locally — only my ears, survives their re-join. */
    const localMutedUserIds = ref(new Set<string>())
    const selfUserId = ref<string | null>(null)

    let meeting: RtkMeeting | null = null
    let tokenTimer: ReturnType<typeof setTimeout> | null = null
    const speakingTimers = new Map<string, ReturnType<typeof setTimeout>>()

    function clearTokenTimer() {
        if (tokenTimer) { clearTimeout(tokenTimer); tokenTimer = null }
    }

    function fail(text: string) {
        state.value = 'error'
        errorText.value = text
    }

    async function joinVoice() {
        if (!available.value) return
        if (state.value !== 'off' && state.value !== 'error') return
        errorText.value = null
        state.value = 'requesting-token'
        useMultiplayerStore().requestVoiceJoin()
        tokenTimer = setTimeout(() => {
            if (state.value === 'requesting-token') fail('No answer from the game server')
        }, TOKEN_TIMEOUT_MS)
    }

    /** Called by the multiplayer store when the server answers voice-join. */
    async function onVoiceToken(token: string) {
        if (state.value !== 'requesting-token') return
        clearTokenTimer()
        state.value = 'connecting'
        try {
            const { default: RealtimeKitClient } = await import('@cloudflare/realtimekit')
            const m = (await RealtimeKitClient.init({
                authToken: token,
                // Joining is an explicit click — come in talking. No camera.
                defaults: { audio: true, video: false },
            })) as unknown as RtkMeeting
            meeting = m
            wireMeeting(m)
            await m.join()
            state.value = 'live'
            muted.value = !m.self.audioEnabled
            selfUserId.value = m.self.customParticipantId ?? null
            syncRoster()
            // Anyone already talking before we joined has a live track now.
            for (const p of m.participants.joined.values()) playParticipantAudio(p)
            // Drop the background music while the call is live.
            music.setVoiceDucking(true)
        } catch (err) {
            console.error('voice connect failed:', err)
            await teardown()
            fail('Could not connect to voice — check mic permission and retry')
        }
    }

    /** Called by the multiplayer store on the voice-unavailable error frame. */
    function onVoiceUnavailable() {
        clearTokenTimer()
        available.value = false
        state.value = 'off'
    }

    function participantUserId(peerId: string): string | null {
        if (!meeting) return null
        if (meeting.self.id === peerId) return meeting.self.customParticipantId ?? null
        return meeting.participants.joined.get(peerId)?.customParticipantId ?? null
    }

    function syncRoster() {
        const ids = new Set<string>()
        const unmuted = new Set<string>()
        if (meeting) {
            if (meeting.self.customParticipantId) ids.add(meeting.self.customParticipantId)
            for (const p of meeting.participants.joined.values()) {
                if (!p.customParticipantId) continue
                ids.add(p.customParticipantId)
                if (p.audioEnabled) unmuted.add(p.customParticipantId)
            }
        }
        voiceUserIds.value = ids
        unmutedUserIds.value = unmuted
    }

    function findParticipant(userId: string): RtkParticipant | null {
        if (!meeting) return null
        for (const p of meeting.participants.joined.values()) {
            if (p.customParticipantId === userId) return p
        }
        return null
    }

    // --- Remote audio playback ---
    // The core SDK hands over raw MediaStreamTracks and plays NOTHING itself
    // (that's the UI kits' job). One hidden <audio> element per remote
    // participant: attached when their audio flows, removed when it stops.
    const audioEls = new Map<string, HTMLAudioElement>()
    let gestureRetryArmed = false

    function playParticipantAudio(p: RtkParticipant) {
        const existing = audioEls.get(p.id)
        if (!p.audioEnabled || !p.audioTrack) {
            if (existing) {
                existing.srcObject = null
                existing.remove()
                audioEls.delete(p.id)
            }
            return
        }
        const el = existing ?? document.createElement('audio')
        el.autoplay = true
        el.srcObject = new MediaStream([p.audioTrack])
        el.muted = !!p.customParticipantId && localMutedUserIds.value.has(p.customParticipantId)
        if (!existing) {
            document.body.appendChild(el)
            audioEls.set(p.id, el)
        }
        el.play().catch(() => armGestureRetry())
    }

    /** Autoplay refused — retry every element on the next tap anywhere. */
    function armGestureRetry() {
        if (gestureRetryArmed) return
        gestureRetryArmed = true
        window.addEventListener('pointerdown', () => {
            gestureRetryArmed = false
            for (const el of audioEls.values()) el.play().catch(() => { /* still blocked */ })
        }, { once: true })
    }

    function removeParticipantAudio(id: string) {
        const el = audioEls.get(id)
        if (el) {
            el.srcObject = null
            el.remove()
            audioEls.delete(id)
        }
    }

    function clearAudio() {
        for (const id of [...audioEls.keys()]) removeParticipantAudio(id)
    }

    function markSpeaking(userId: string) {
        const next = new Set(speakingUserIds.value)
        next.add(userId)
        speakingUserIds.value = next
        const prev = speakingTimers.get(userId)
        if (prev) clearTimeout(prev)
        speakingTimers.set(userId, setTimeout(() => {
            speakingTimers.delete(userId)
            const after = new Set(speakingUserIds.value)
            after.delete(userId)
            speakingUserIds.value = after
        }, SPEAKING_HOLD_MS))
    }

    function wireMeeting(m: RtkMeeting) {
        m.self.on('audioUpdate', (payload: { audioEnabled: boolean }) => {
            muted.value = !payload.audioEnabled
        })
        m.self.on('mediaPermissionError', () => {
            fail('Microphone permission denied')
        })
        m.self.on('roomLeft', () => {
            // Our own leave or a server-side end — either way, voice is over.
            void teardown()
            if (state.value === 'live' || state.value === 'connecting') state.value = 'off'
        })
        m.participants.joined.on('participantJoined', (p: RtkParticipant) => {
            syncRoster()
            playParticipantAudio(p)
        })
        m.participants.joined.on('participantLeft', (p: RtkParticipant) => {
            syncRoster()
            removeParticipantAudio(p.id)
        })
        m.participants.joined.on('audioUpdate', (p: RtkParticipant) => {
            playParticipantAudio(p)
            syncRoster()
        })
        m.participants.on('activeSpeaker', (payload: { peerId: string }) => {
            const userId = participantUserId(payload.peerId)
            if (userId) markSpeaking(userId)
        })
    }

    async function teardown() {
        const m = meeting
        meeting = null
        music.setVoiceDucking(false)
        clearAudio()
        for (const t of speakingTimers.values()) clearTimeout(t)
        speakingTimers.clear()
        speakingUserIds.value = new Set()
        voiceUserIds.value = new Set()
        selfUserId.value = null
        muted.value = false
        if (m) { try { await m.leave() } catch { /* already gone */ } }
    }

    async function toggleMute() {
        if (!meeting || state.value !== 'live') return
        if (meeting.self.audioEnabled) {
            muted.value = true
            meeting.self.disableAudio()
        } else {
            muted.value = false
            await meeting.self.enableAudio()
        }
    }

    async function leaveVoice() {
        clearTokenTimer()
        state.value = 'off'
        errorText.value = null
        await teardown()
    }

    // --- Moderation ---

    /** Silence a player for my ears only. They stay audible to everyone else. */
    function toggleMuteForMe(userId: string) {
        const next = new Set(localMutedUserIds.value)
        if (next.has(userId)) next.delete(userId)
        else next.add(userId)
        localMutedUserIds.value = next
        const p = findParticipant(userId)
        const el = p ? audioEls.get(p.id) : undefined
        if (el) el.muted = next.has(userId)
    }

    /** Host: cut a player's mic for the whole room. They may unmute themselves. */
    async function muteParticipant(userId: string) {
        await findParticipant(userId)?.disableAudio?.().catch(err => {
            console.error('force mute failed:', err)
        })
    }

    /** Host: cut every mic in the room (players may unmute themselves). */
    async function muteEveryone() {
        await meeting?.participants.disableAllAudio?.(true).catch(err => {
            console.error('mute everyone failed:', err)
        })
    }

    /** Host: eject a player from the voice channel (rides the game kick). */
    async function kickFromVoice(userId: string) {
        await findParticipant(userId)?.kick?.().catch(() => { /* not in voice or no permission */ })
    }

    return {
        state,
        muted,
        available,
        errorText,
        voiceUserIds,
        speakingUserIds,
        unmutedUserIds,
        localMutedUserIds,
        selfUserId,
        joinVoice,
        toggleMute,
        leaveVoice,
        toggleMuteForMe,
        muteParticipant,
        muteEveryone,
        kickFromVoice,
        onVoiceToken,
        onVoiceUnavailable,
    }
})
