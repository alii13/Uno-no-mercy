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

export function useSoundEffects() {
    const isMuted = ref(false)
    const volume = ref(0.5)

    /**
     * Play a card throwing/whoosh sound
     */
    function playCardThrow() {
        if (isMuted.value) return

        const ctx = getAudioContext()
        const now = ctx.currentTime

        // Create noise for whoosh effect
        const bufferSize = ctx.sampleRate * 0.15
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)

        for (let i = 0; i < bufferSize; i++) {
            // Filtered noise with envelope
            const t = i / bufferSize
            const envelope = Math.sin(t * Math.PI) * (1 - t * 0.5)
            data[i] = (Math.random() * 2 - 1) * envelope * 0.3
        }

        const noiseSource = ctx.createBufferSource()
        noiseSource.buffer = buffer

        // Bandpass filter for "swoosh" character
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.setValueAtTime(2000, now)
        filter.frequency.exponentialRampToValueAtTime(500, now + 0.15)
        filter.Q.value = 1

        // Gain envelope
        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(volume.value * 0.4, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15)

        noiseSource.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        noiseSource.start(now)
        noiseSource.stop(now + 0.15)
    }

    /**
     * Play a card pickup sound
     */
    function playCardPick() {
        if (isMuted.value) return

        const ctx = getAudioContext()
        const now = ctx.currentTime

        // Soft "pick" sound - quick high frequency blip
        const osc = ctx.createOscillator()
        osc.frequency.setValueAtTime(800, now)
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.08)
        osc.type = 'sine'

        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(volume.value * 0.2, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08)

        osc.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.08)
    }

    /**
     * Play a card landing/slap sound
     */
    function playCardLand() {
        if (isMuted.value) return

        const ctx = getAudioContext()
        const now = ctx.currentTime

        // "Slap" sound - low thud with some high frequency attack
        const bufferSize = ctx.sampleRate * 0.12
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)

        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize
            // Sharp attack, quick decay
            const envelope = Math.exp(-t * 30) + Math.exp(-t * 5) * 0.3
            data[i] = (Math.random() * 2 - 1) * envelope * 0.5
        }

        const source = ctx.createBufferSource()
        source.buffer = buffer

        // Low pass filter for thud character
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(1500, now)
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.1)

        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(volume.value * 0.6, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12)

        source.connect(filter)
        filter.connect(gainNode)
        gainNode.connect(ctx.destination)

        source.start(now)
    }

    /**
     * Play a shuffle sound
     */
    function playCardShuffle() {
        if (isMuted.value) return

        const ctx = getAudioContext()
        const now = ctx.currentTime

        // Multiple quick "flicking" sounds
        for (let i = 0; i < 5; i++) {
            const time = now + i * 0.05

            const bufferSize = ctx.sampleRate * 0.03
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
            const data = buffer.getChannelData(0)

            for (let j = 0; j < bufferSize; j++) {
                const t = j / bufferSize
                data[j] = (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.2
            }

            const source = ctx.createBufferSource()
            source.buffer = buffer

            const gainNode = ctx.createGain()
            gainNode.gain.value = volume.value * 0.3

            source.connect(gainNode)
            gainNode.connect(ctx.destination)

            source.start(time)
        }
    }

    /**
     * Play a special card sound (for wild cards, +4, etc.)
     */
    function playSpecialCard() {
        if (isMuted.value) return

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

        const gainNode = ctx.createGain()
        gainNode.gain.setValueAtTime(volume.value * 0.15, now)
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2)

        osc.connect(gainNode)
        osc2.connect(gainNode)
        gainNode.connect(ctx.destination)

        osc.start(now)
        osc2.start(now)
        osc.stop(now + 0.2)
        osc2.stop(now + 0.2)
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

    /**
     * Announce text using TTS
     */
    function announceTurn(text: string) {
        if (isMuted.value) return

        // Cancel any current speech
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.volume = volume.value * 1.5 // slightly louder than sfx
        utterance.rate = 1.0
        utterance.pitch = 1.1 // slightly higher pitch

        // Try to find a female voice
        const voices = window.speechSynthesis.getVoices()
        // Prefer Google US English Female, or similar
        const femaleVoice = voices.find(v =>
            v.name.includes('Google US English') ||
            v.name.includes('Samantha') || // macOS
            v.name.includes('Female') ||
            v.name.includes('Zira') // Windows
        )

        if (femaleVoice) {
            utterance.voice = femaleVoice
        }

        window.speechSynthesis.speak(utterance)
    }

    return {
        isMuted,
        volume,
        playCardThrow,
        playCardPick,
        playCardLand,
        playCardShuffle,
        playSpecialCard,
        announceTurn,
        toggleMute,
        setVolume
    }
}

// Export singleton for consistent state across components
export const soundEffects = useSoundEffects()
