/**
 * Sound Effects Composable for UNO No Mercy
 * Uses Web Audio API to generate game sounds
 */

import { ref } from 'vue'

// Audio context singleton
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext()
    }
    return audioContext
}

// ============================================================
// Helper functions to reduce duplication
// ============================================================

interface GainEnvelopeOptions {
    startVolume: number
    endVolume?: number
    duration: number
}

/**
 * Create a gain node with envelope (attack/decay)
 */
function createGainEnvelope(
    ctx: AudioContext,
    now: number,
    baseVolume: number,
    options: GainEnvelopeOptions
): GainNode {
    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(baseVolume * options.startVolume, now)
    gainNode.gain.exponentialRampToValueAtTime(
        options.endVolume ?? 0.01,
        now + options.duration
    )
    return gainNode
}

interface NoiseBufferOptions {
    duration: number
    envelopeFn: (t: number) => number
    amplitude?: number
}

/**
 * Create a noise buffer with custom envelope
 */
function createNoiseBuffer(
    ctx: AudioContext,
    options: NoiseBufferOptions
): AudioBuffer {
    const bufferSize = ctx.sampleRate * options.duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    const amp = options.amplitude ?? 1

    for (let i = 0; i < bufferSize; i++) {
        const t = i / bufferSize
        const envelope = options.envelopeFn(t)
        data[i] = (Math.random() * 2 - 1) * envelope * amp
    }

    return buffer
}

/**
 * Wrapper that checks mute state before executing sound function
 */
function withMuteCheck(
    isMuted: { value: boolean },
    fn: () => void
): void {
    if (!isMuted.value) {
        fn()
    }
}

// ============================================================
// Main composable
// ============================================================

export function useSoundEffects() {
    const isMuted = ref(false)
    const volume = ref(0.5)

    /**
     * Play a card throwing/whoosh sound
     */
    function playCardThrow() {
        withMuteCheck(isMuted, () => {
            const ctx = getAudioContext()
            const now = ctx.currentTime

            // Create noise for whoosh effect
            const buffer = createNoiseBuffer(ctx, {
                duration: 0.15,
                envelopeFn: (t) => Math.sin(t * Math.PI) * (1 - t * 0.5),
                amplitude: 0.3
            })

            const noiseSource = ctx.createBufferSource()
            noiseSource.buffer = buffer

            // Bandpass filter for "swoosh" character
            const filter = ctx.createBiquadFilter()
            filter.type = 'bandpass'
            filter.frequency.setValueAtTime(2000, now)
            filter.frequency.exponentialRampToValueAtTime(500, now + 0.15)
            filter.Q.value = 1

            const gainNode = createGainEnvelope(ctx, now, volume.value, {
                startVolume: 0.4,
                duration: 0.15
            })

            noiseSource.connect(filter)
            filter.connect(gainNode)
            gainNode.connect(ctx.destination)

            noiseSource.start(now)
            noiseSource.stop(now + 0.15)
        })
    }

    /**
     * Play a card pickup sound
     */
    function playCardPick() {
        withMuteCheck(isMuted, () => {
            const ctx = getAudioContext()
            const now = ctx.currentTime

            // Soft "pick" sound - quick high frequency blip
            const osc = ctx.createOscillator()
            osc.frequency.setValueAtTime(800, now)
            osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
            osc.type = 'sine'

            const gainNode = createGainEnvelope(ctx, now, volume.value, {
                startVolume: 0.2,
                duration: 0.08
            })

            osc.connect(gainNode)
            gainNode.connect(ctx.destination)

            osc.start(now)
            osc.stop(now + 0.08)
        })
    }

    /**
     * Play a card landing/slap sound
     */
    function playCardLand() {
        withMuteCheck(isMuted, () => {
            const ctx = getAudioContext()
            const now = ctx.currentTime

            // "Slap" sound - low thud with some high frequency attack
            const buffer = createNoiseBuffer(ctx, {
                duration: 0.12,
                envelopeFn: (t) => Math.exp(-t * 30) + Math.exp(-t * 5) * 0.3,
                amplitude: 0.5
            })

            const source = ctx.createBufferSource()
            source.buffer = buffer

            // Low pass filter for thud character
            const filter = ctx.createBiquadFilter()
            filter.type = 'lowpass'
            filter.frequency.setValueAtTime(1500, now)
            filter.frequency.exponentialRampToValueAtTime(200, now + 0.1)

            const gainNode = createGainEnvelope(ctx, now, volume.value, {
                startVolume: 0.6,
                duration: 0.12
            })

            source.connect(filter)
            filter.connect(gainNode)
            gainNode.connect(ctx.destination)

            source.start(now)
        })
    }

    /**
     * Play a shuffle sound
     */
    function playCardShuffle() {
        withMuteCheck(isMuted, () => {
            const ctx = getAudioContext()
            const now = ctx.currentTime

            // Multiple quick "flicking" sounds
            for (let i = 0; i < 5; i++) {
                const time = now + i * 0.05

                const buffer = createNoiseBuffer(ctx, {
                    duration: 0.03,
                    envelopeFn: (t) => Math.exp(-t * 50),
                    amplitude: 0.2
                })

                const source = ctx.createBufferSource()
                source.buffer = buffer

                const gainNode = ctx.createGain()
                gainNode.gain.value = volume.value * 0.3

                source.connect(gainNode)
                gainNode.connect(ctx.destination)

                source.start(time)
            }
        })
    }

    /**
     * Play a special card sound (for wild cards, +4, etc.)
     */
    function playSpecialCard() {
        withMuteCheck(isMuted, () => {
            const ctx = getAudioContext()
            const now = ctx.currentTime

            // Rising tone for special cards
            const osc = ctx.createOscillator()
            osc.frequency.setValueAtTime(300, now)
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.15)
            osc.type = 'triangle'

            const osc2 = ctx.createOscillator()
            osc2.frequency.setValueAtTime(450, now)
            osc2.frequency.exponentialRampToValueAtTime(900, now + 0.15)
            osc2.type = 'sine'

            const gainNode = createGainEnvelope(ctx, now, volume.value, {
                startVolume: 0.15,
                duration: 0.2
            })

            osc.connect(gainNode)
            osc2.connect(gainNode)
            gainNode.connect(ctx.destination)

            osc.start(now)
            osc2.start(now)
            osc.stop(now + 0.2)
            osc2.stop(now + 0.2)
        })
    }

    /**
     * Toggle mute state
     */
    function toggleMute() {
        isMuted.value = !isMuted.value
    }

    /**
     * Set volume (0-1)
     */
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
        setVolume
    }
}

// Export singleton for consistent state across components
export const soundEffects = useSoundEffects()
