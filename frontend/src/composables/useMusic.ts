/**
 * Background music for UNO No Mercy.
 *
 * - Single track looped, located at /audio/music/loop.mp3
 * - Doesn't autoplay (browsers block it without user gesture). play() is
 *   called when the user enters an active game; the gesture chain (PLAY NOW
 *   click -> game start) unlocks playback.
 * - Independent volume + mute from SFX, both persisted to localStorage.
 * - Fades in on start and out on stop. Ducks (lowers volume) on win/loss
 *   so SFX stings cut through.
 * - Silent-no-throw if the file is missing — like SFX, ship the code first
 *   and add the asset later.
 */

import { ref, watch } from 'vue'

const MUSIC_URL = '/audio/music/loop.mp3'
const STORAGE_KEY = 'uno_music_settings_v1'

interface PersistedMusicSettings {
    volume: number
    isMuted: boolean
}

function loadSettings(): PersistedMusicSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { volume: 0.35, isMuted: false }
        const parsed = JSON.parse(raw) as Partial<PersistedMusicSettings>
        return {
            volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.35,
            isMuted: !!parsed.isMuted,
        }
    } catch {
        return { volume: 0.35, isMuted: false }
    }
}

function saveSettings(s: PersistedMusicSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { /* localStorage disabled */ }
}

// Single module-level Audio element. Loop attribute set so it repeats forever.
let audio: HTMLAudioElement | null = null
// Track if the file was probed and found available — null = available,
// 'missing' = 404/decode error so play() is a no-op silently.
let fileState: 'unknown' | 'ready' | 'missing' = 'unknown'

function ensureAudio(): HTMLAudioElement | null {
    if (audio) return audio
    if (fileState === 'missing') return null
    audio = new Audio(MUSIC_URL)
    audio.loop = true
    audio.preload = 'auto'
    audio.addEventListener('canplaythrough', () => { fileState = 'ready' }, { once: true })
    audio.addEventListener('error', () => {
        fileState = 'missing'
        audio = null
    }, { once: true })
    return audio
}

// Simple linear fade helper. Cancels any in-flight fade for the same element.
const fadeTimers = new WeakMap<HTMLAudioElement, number>()

function fadeTo(el: HTMLAudioElement, target: number, durationMs: number): void {
    const existing = fadeTimers.get(el)
    if (existing) window.clearInterval(existing)
    const start = el.volume
    const startTime = performance.now()
    const id = window.setInterval(() => {
        const elapsed = performance.now() - startTime
        const t = Math.min(1, elapsed / durationMs)
        el.volume = Math.max(0, Math.min(1, start + (target - start) * t))
        if (t >= 1) {
            window.clearInterval(id)
            fadeTimers.delete(el)
            if (target === 0) el.pause()
        }
    }, 30)
    fadeTimers.set(el, id)
}

const initial = loadSettings()
const volume = ref(initial.volume)
const isMuted = ref(initial.isMuted)
const isPlaying = ref(false)
const isDucked = ref(false)
// Increments every time stop() is called. Any in-flight start() captures
// the value at call time; if the value differs when its play() promise
// resolves, the start was cancelled while async and must NOT fade up.
// Without this guard the user can see music keep playing on the lobby
// after exiting a game, because the play() promise resolves after unmount.
let stopGeneration = 0

watch([volume, isMuted], () => {
    saveSettings({ volume: volume.value, isMuted: isMuted.value })
    // Reflect mute/volume changes live on the audio element.
    const el = audio
    if (!el) return
    const target = effectiveVolume()
    el.volume = target
})

function effectiveVolume(): number {
    if (isMuted.value) return 0
    return isDucked.value ? volume.value * 0.35 : volume.value
}

export function useMusic() {
    function start(): void {
        const el = ensureAudio()
        if (!el || isMuted.value) return
        // Capture the stop generation at call time. If stop() runs while
        // the play() promise is pending, the captured value will be stale
        // and we'll bail out of the fade-up instead of resurrecting paused
        // audio after the user has already navigated away.
        const myGen = stopGeneration
        el.volume = 0
        const p = el.play()
        if (p && typeof p.then === 'function') {
            p.then(() => {
                if (myGen !== stopGeneration) {
                    // We were cancelled mid-play(). Pause again in case the
                    // browser un-paused us, and don't fade up.
                    el.pause()
                    return
                }
                isPlaying.value = true
                fadeTo(el, effectiveVolume(), 1200)
            }).catch(() => { /* autoplay blocked — stay silent */ })
        }
    }

    function stop(): void {
        // Bump generation FIRST so any in-flight start() sees the change.
        stopGeneration++
        isPlaying.value = false
        if (!audio) return
        // Pause synchronously so even if a stale play().then() fires before
        // fadeTo finishes its 600ms interval, the audio is already silent.
        audio.pause()
        // Then fade volume to 0 for the next start() to begin from zero.
        fadeTo(audio, 0, 600)
    }

    function duck(): void {
        // Lower the music so a sting / announcement can cut through.
        isDucked.value = true
        if (audio) fadeTo(audio, effectiveVolume(), 250)
    }

    function unduck(): void {
        isDucked.value = false
        if (audio) fadeTo(audio, effectiveVolume(), 400)
    }

    function toggleMute(): void {
        isMuted.value = !isMuted.value
        // If we just muted, fade out; if unmuted while playing, fade in.
        if (!audio) return
        if (isMuted.value) {
            fadeTo(audio, 0, 300)
        } else if (isPlaying.value) {
            const p = audio.play()
            if (p && typeof p.catch === 'function') p.catch(() => {})
            fadeTo(audio, effectiveVolume(), 400)
        }
    }

    function setVolume(v: number): void {
        volume.value = Math.max(0, Math.min(1, v))
    }

    return {
        volume,
        isMuted,
        isPlaying,
        isDucked,
        start,
        stop,
        duck,
        unduck,
        toggleMute,
        setVolume,
    }
}

export const music = useMusic()
