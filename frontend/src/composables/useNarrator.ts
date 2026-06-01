/**
 * Narrator composable — replaces window.speechSynthesis (generic OS TTS) with
 * a pool of pre-recorded "no mercy" voice clips. Public API matches the old
 * announceTurn(text) so call sites don't change.
 *
 * Clips live at /audio/narrator/*.mp3 and are mapped from the exact strings
 * passed today. Unmapped strings (e.g. dynamic player-name greetings) fall
 * back to speechSynthesis and are logged in dev so we know what to record next.
 */

import { ref } from 'vue'

const NARRATOR_BASE = '/audio/narrator'

// Exact strings passed to announceTurn() across the codebase, mapped to clips.
// Keep keys lowercased + trimmed for case-insensitive matching.
const CLIP_MAP: Record<string, string> = {
    'uno!': 'uno.mp3',
    'caught! draw 2': 'caught.mp3',
    'safe!': 'safe.mp3',
    'your turn': 'your-turn.mp3',
    // Add as more events are wired (stack lands, swap, mercy, win, etc.)
    'stack!': 'stack.mp3',
    'skip everyone!': 'skip-everyone.mp3',
    'rotate!': 'rotate.mp3',
    'swap!': 'swap.mp3',
    'mercy!': 'mercy.mp3',
    'no mercy!': 'no-mercy.mp3',
    'winner!': 'winner.mp3',
}

// Pool of preloaded Audio elements so each play doesn't pay decode latency.
const pool = new Map<string, HTMLAudioElement>()
let preloaded = false

// Track which dynamic strings hit the TTS fallback — surfaces gaps in the clip set.
const unmappedSeen = new Set<string>()
const isDev = import.meta.env?.DEV ?? false

function getClipUrl(file: string): string {
    return `${NARRATOR_BASE}/${file}`
}

function preloadAll(): void {
    if (preloaded) return
    preloaded = true
    for (const file of new Set(Object.values(CLIP_MAP))) {
        const audio = new Audio(getClipUrl(file))
        audio.preload = 'auto'
        // Browsers swallow load errors silently when the file doesn't exist;
        // that's fine — playClip will fall through to TTS in that case.
        pool.set(file, audio)
    }
}

function playClip(file: string, volume: number): boolean {
    const cached = pool.get(file)
    const audio = cached
        ? (cached.cloneNode() as HTMLAudioElement)
        : new Audio(getClipUrl(file))
    audio.volume = Math.max(0, Math.min(1, volume))
    const p = audio.play()
    if (p && typeof p.then === 'function') {
        p.catch(() => {
            // Autoplay block or missing file — let caller fall back to TTS.
        })
    }
    return true
}

function speakFallback(text: string, volume: number): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.volume = Math.max(0, Math.min(1, volume))
    u.rate = 1.0
    u.pitch = 1.1
    window.speechSynthesis.speak(u)
}

export function useNarrator() {
    preloadAll()
    return {
        announce(text: string, volume = 0.9) {
            const key = text.trim().toLowerCase()
            const clip = CLIP_MAP[key]
            if (clip) {
                playClip(clip, volume)
                return
            }
            if (isDev && !unmappedSeen.has(key)) {
                unmappedSeen.add(key)
                // eslint-disable-next-line no-console
                console.info('[narrator] unmapped string — record a clip for:', text)
            }
            speakFallback(text, volume)
        },
        // Exposed for testing / dev tooling.
        _unmappedSeen: unmappedSeen as ReadonlySet<string>,
    }
}

// Module-level singleton so all components share the same preload + dedup state.
export const narrator = useNarrator()

// Re-export the clip map shape so the audio README and tests can reference it.
export const NARRATOR_CLIPS = CLIP_MAP

// Stash a ref for any UI that wants to surface unmapped strings (debug panel etc).
export const unmappedNarratorStrings = ref<string[]>([])
