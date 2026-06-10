/**
 * Regression tests for the background-music races: a stop() must reset the
 * duck level for the next game, and any play() promise that resolves after a
 * stop() (start OR unmute) must not resurrect audio on the lobby.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeAudio {
    static instances: FakeAudio[] = []
    src: string
    loop = false
    preload = ''
    volume = 1
    paused = true
    private resolvers: Array<() => void> = []
    constructor(src: string) {
        this.src = src
        FakeAudio.instances.push(this)
    }
    addEventListener() { /* canplaythrough/error probes — not needed */ }
    play(): Promise<void> {
        this.paused = false
        return new Promise<void>((res) => this.resolvers.push(res))
    }
    pause() {
        this.paused = true
    }
    resolvePlay() {
        this.resolvers.splice(0).forEach((r) => r())
    }
}

async function flush() {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

beforeEach(() => {
    vi.resetModules()
    FakeAudio.instances = []
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('window', {
        setInterval: globalThis.setInterval.bind(globalThis),
        clearInterval: globalThis.clearInterval.bind(globalThis),
    })
    vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => undefined,
    })
})

describe('useMusic', () => {
    it('stop() resets ducking so the next game starts at full volume', async () => {
        const { useMusic } = await import('../useMusic')
        const m = useMusic()

        m.duck()
        expect(m.isDucked.value).toBe(true)

        m.stop()
        expect(m.isDucked.value).toBe(false)
    })

    it('an unmute whose play() resolves after stop() does not resurrect playback', async () => {
        const { useMusic } = await import('../useMusic')
        const m = useMusic()

        m.start()
        const el = FakeAudio.instances[0]!
        el.resolvePlay()
        await flush()
        expect(m.isPlaying.value).toBe(true)

        m.toggleMute() // mute
        m.toggleMute() // unmute — its play() promise is now pending

        m.stop() // user exits to the lobby while the unmute is in flight
        el.resolvePlay()
        await flush()

        expect(el.paused).toBe(true)
        expect(m.isPlaying.value).toBe(false)
    })

    it('a start() whose play() resolves after stop() stays silent', async () => {
        const { useMusic } = await import('../useMusic')
        const m = useMusic()

        m.start()
        const el = FakeAudio.instances[0]!
        m.stop()
        el.resolvePlay()
        await flush()

        expect(el.paused).toBe(true)
        expect(m.isPlaying.value).toBe(false)
    })
})
