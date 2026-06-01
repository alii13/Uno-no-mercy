/**
 * Sound Effects for UNO No Mercy.
 *
 * Tries sampled audio first (real card snaps, slides, thuds — drop the .mp3s
 * into /audio/sfx/). Falls back to oscillator-based Web Audio synthesis when
 * a sample is missing, so the code can land before any audio assets exist —
 * just adding a file to public/audio/sfx/ upgrades the sound with no code
 * change.
 *
 * Public API is stable (playCardThrow / playCardPick / playCardLand /
 * playCardShuffle / playSpecialCard / toggleMute / setVolume / isMuted /
 * volume). Call sites don't change.
 */

import { ref, watch } from 'vue'

// ============================================================
// Audio context for the synthesis fallback path
// ============================================================
let audioContext: AudioContext | null = null
function getAudioContext(): AudioContext {
    if (!audioContext) audioContext = new AudioContext()
    return audioContext
}

interface GainEnvelopeOptions {
    startVolume: number
    endVolume?: number
    duration: number
}

function createGainEnvelope(
    ctx: AudioContext, now: number, baseVolume: number, options: GainEnvelopeOptions
): GainNode {
    const g = ctx.createGain()
    g.gain.setValueAtTime(baseVolume * options.startVolume, now)
    g.gain.exponentialRampToValueAtTime(options.endVolume ?? 0.01, now + options.duration)
    return g
}

interface NoiseBufferOptions {
    duration: number
    envelopeFn: (t: number) => number
    amplitude?: number
}

function createNoiseBuffer(ctx: AudioContext, options: NoiseBufferOptions): AudioBuffer {
    const bufferSize = ctx.sampleRate * options.duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const amp = options.amplitude ?? 1
    for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        data[i] = (Math.random() * 2 - 1) * options.envelopeFn(t) * amp
    }
    return buffer
}

// ============================================================
// Sampled audio pool
// ============================================================
type SfxName = 'cardThrow' | 'cardPick' | 'cardLand' | 'cardShuffle' | 'specialCard'

// File mapping. Sourced from Kenney's CC0 casino-audio pack. .ogg works in
// every modern browser (Vorbis support has been universal since ~2010) and
// the files are noticeably smaller than mp3 at the same quality.
const SFX_FILES: Record<SfxName, string> = {
    cardThrow: '/audio/sfx/card-throw.ogg',
    cardPick: '/audio/sfx/card-pick.ogg',
    cardLand: '/audio/sfx/card-land.ogg',
    cardShuffle: '/audio/sfx/card-shuffle.ogg',
    specialCard: '/audio/sfx/special-card.ogg',
}

// Cache of "did this sample load successfully?" — three states:
//   undefined: not yet probed
//   HTMLAudioElement: loaded, ready to clone-and-play
//   null: failed to load (file missing or decoding error) — synthesis fallback
const sfxPool = new Map<SfxName, HTMLAudioElement | null>()

function probeSample(name: SfxName): void {
    if (sfxPool.has(name)) return
    const audio = new Audio(SFX_FILES[name])
    audio.preload = 'auto'
    // canplaythrough fires once the browser thinks it can play start-to-end
    // without buffering. error fires for 404 or decode failure.
    audio.addEventListener('canplaythrough', () => sfxPool.set(name, audio), { once: true })
    audio.addEventListener('error', () => sfxPool.set(name, null), { once: true })
    // Kick off the load.
    audio.load()
}

function playSample(name: SfxName, volume: number): boolean {
    const cached = sfxPool.get(name)
    if (!cached) return false
    const clone = cached.cloneNode() as HTMLAudioElement
    clone.volume = Math.max(0, Math.min(1, volume))
    const p = clone.play()
    if (p && typeof p.catch === 'function') {
        p.catch(() => { /* autoplay block or decode race — silent */ })
    }
    return true
}

// Probe all samples on module load so the cache is populated by the time the
// first play call fires.
for (const name of Object.keys(SFX_FILES) as SfxName[]) probeSample(name)

// ============================================================
// LocalStorage persistence for volume + mute
// ============================================================
const STORAGE_KEY = 'uno_sfx_settings_v1'

interface PersistedSettings {
    volume: number
    isMuted: boolean
}

function loadSettings(): PersistedSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return { volume: 0.5, isMuted: false }
        const parsed = JSON.parse(raw) as Partial<PersistedSettings>
        return {
            volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.5,
            isMuted: !!parsed.isMuted,
        }
    } catch {
        return { volume: 0.5, isMuted: false }
    }
}

function saveSettings(s: PersistedSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { /* localStorage disabled or quota — ignore */ }
}

// ============================================================
// Composable
// ============================================================
function withMuteCheck(isMuted: { value: boolean }, fn: () => void): void {
    if (!isMuted.value) fn()
}

export function useSoundEffects() {
    const initial = loadSettings()
    const isMuted = ref(initial.isMuted)
    const volume = ref(initial.volume)

    watch([volume, isMuted], () => {
        saveSettings({ volume: volume.value, isMuted: isMuted.value })
    })

    function playCardThrow() {
        withMuteCheck(isMuted, () => {
            if (playSample('cardThrow', volume.value)) return
            // Synthesis fallback — bandpassed noise burst, "whoosh"
            const ctx = getAudioContext()
            const now = ctx.currentTime
            const buffer = createNoiseBuffer(ctx, {
                duration: 0.15,
                envelopeFn: (t) => Math.sin(t * Math.PI) * (1 - t * 0.5),
                amplitude: 0.3,
            })
            const noise = ctx.createBufferSource()
            noise.buffer = buffer
            const filter = ctx.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(2000, now)
            filter.frequency.exponentialRampToValueAtTime(500, now + 0.15)
            filter.Q.value = 1
            const gain = createGainEnvelope(ctx, now, volume.value, { startVolume: 0.4, duration: 0.15 })
            noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
            noise.start(now); noise.stop(now + 0.15)
        })
    }

    function playCardPick() {
        withMuteCheck(isMuted, () => {
            if (playSample('cardPick', volume.value)) return
            const ctx = getAudioContext()
            const now = ctx.currentTime
            const osc = ctx.createOscillator()
            osc.frequency.setValueAtTime(800, now)
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
            osc.type = 'sine'
            const gain = createGainEnvelope(ctx, now, volume.value, { startVolume: 0.2, duration: 0.08 })
            osc.connect(gain); gain.connect(ctx.destination)
            osc.start(now); osc.stop(now + 0.08)
        })
    }

    function playCardLand() {
        withMuteCheck(isMuted, () => {
            if (playSample('cardLand', volume.value)) return
            const ctx = getAudioContext()
            const now = ctx.currentTime
            const buffer = createNoiseBuffer(ctx, {
                duration: 0.12,
                envelopeFn: (t) => Math.exp(-t * 30) + Math.exp(-t * 5) * 0.3,
                amplitude: 0.5,
            })
            const source = ctx.createBufferSource()
            source.buffer = buffer
            const filter = ctx.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(1500, now)
            filter.frequency.exponentialRampToValueAtTime(200, now + 0.1)
            const gain = createGainEnvelope(ctx, now, volume.value, { startVolume: 0.6, duration: 0.12 })
            source.connect(filter); filter.connect(gain); gain.connect(ctx.destination)
            source.start(now)
        })
    }

    function playCardShuffle() {
        withMuteCheck(isMuted, () => {
            if (playSample('cardShuffle', volume.value)) return
            const ctx = getAudioContext()
            const now = ctx.currentTime
            for (let i = 0; i < 5; i++) {
                const time = now + i * 0.05
                const buffer = createNoiseBuffer(ctx, {
                    duration: 0.03,
                    envelopeFn: (t) => Math.exp(-t * 50),
                    amplitude: 0.2,
                })
                const source = ctx.createBufferSource()
                source.buffer = buffer
                const gain = ctx.createGain()
                gain.gain.value = volume.value * 0.3
                source.connect(gain); gain.connect(ctx.destination)
                source.start(time)
            }
        })
    }

    function playSpecialCard() {
        withMuteCheck(isMuted, () => {
            if (playSample('specialCard', volume.value)) return
            const ctx = getAudioContext()
            const now = ctx.currentTime
            const osc = ctx.createOscillator()
            osc.frequency.setValueAtTime(300, now)
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15)
            osc.type = 'triangle'
            const osc2 = ctx.createOscillator()
            osc2.frequency.setValueAtTime(450, now)
            osc2.frequency.exponentialRampToValueAtTime(900, now + 0.15)
            osc2.type = 'sine'
            const gain = createGainEnvelope(ctx, now, volume.value, { startVolume: 0.15, duration: 0.2 })
            osc.connect(gain); osc2.connect(gain); gain.connect(ctx.destination)
            osc.start(now); osc2.start(now); osc.stop(now + 0.2); osc2.stop(now + 0.2)
        })
    }

    function toggleMute() {
        isMuted.value = !isMuted.value
    }

    function setVolume(v: number) {
        volume.value = Math.max(0, Math.min(1, v))
    }

    return {
        isMuted,
        volume,
        playCardThrow,
        playCardPick,
        playCardLand,
        playCardShuffle,
        playSpecialCard,
        toggleMute,
        setVolume,
    }
}

export const soundEffects = useSoundEffects()
