import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const { rpc, auth, doc } = vi.hoisted(() => ({
    rpc: vi.fn(async () => ({ error: null as { code?: string } | null })),
    auth: { isAuthenticated: true, user: { id: 'u1' } },
    doc: {
        visibilityState: 'visible',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    },
}))

vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../stores/authStore', () => ({ useAuthStore: () => auth }))

import { usePresenceHeartbeat } from '../usePresenceHeartbeat'

/** The composable starts itself on an authenticated store, so every test
 *  begins from a known beat count. */
async function fresh() {
    rpc.mockClear()
    const hb = usePresenceHeartbeat()
    await vi.waitFor(() => expect(rpc).toHaveBeenCalled())
    rpc.mockClear()
    return hb
}

describe('presence heartbeat', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('document', doc)
        doc.visibilityState = 'visible'
        auth.isAuthenticated = true
        rpc.mockReset()
        rpc.mockResolvedValue({ error: null })
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('checks in through the server-stamped function, sending no time of its own', async () => {
        const hb = usePresenceHeartbeat()
        // The composable beats on start, so wait for that one rather than
        // racing it with a second call the in-flight guard would drop.
        await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('touch_presence'))
        hb.stop()
    })

    it('keeps beating once a minute', async () => {
        const hb = await fresh()
        await vi.advanceTimersByTimeAsync(60_000)
        expect(rpc).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(60_000)
        expect(rpc).toHaveBeenCalledTimes(2)
        hb.stop()
    })

    it('stays quiet while the tab is hidden', async () => {
        const hb = await fresh()
        doc.visibilityState = 'hidden'
        await vi.advanceTimersByTimeAsync(180_000)
        expect(rpc).not.toHaveBeenCalled()
        hb.stop()
    })

    it('gives up for the session when the function is missing', async () => {
        const hb = await fresh()
        rpc.mockResolvedValue({ error: { code: 'PGRST202' } })
        await hb.beat()
        expect(rpc).toHaveBeenCalledTimes(1)
        // Until presence.sql runs, every later beat would fail identically.
        rpc.mockResolvedValue({ error: null })
        await vi.advanceTimersByTimeAsync(300_000)
        expect(rpc).toHaveBeenCalledTimes(1)
        hb.stop()
    })

    it('keeps trying after a dropped request', async () => {
        const hb = await fresh()
        rpc.mockRejectedValueOnce(new Error('offline'))
        await hb.beat()
        rpc.mockResolvedValue({ error: null })
        await hb.beat()
        // Two attempts, not one: a network blip must not kill presence.
        expect(rpc).toHaveBeenCalledTimes(2)
        hb.stop()
    })

    it('stops the clock and the listener when told to', async () => {
        const hb = await fresh()
        hb.stop()
        await vi.advanceTimersByTimeAsync(300_000)
        expect(rpc).not.toHaveBeenCalled()
        expect(doc.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    })

    it('does not check in for a signed-out visitor', async () => {
        auth.isAuthenticated = false
        const hb = usePresenceHeartbeat()
        await hb.beat()
        expect(rpc).not.toHaveBeenCalled()
    })
})
