import { describe, expect, it, vi, beforeEach } from 'vitest'

// lib/supabase throws at import time without env vars and CI passes none, so
// the client is mocked rather than loaded - see CLAUDE.md, Tests.
const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('../../lib/supabase', () => ({
    supabase: { auth: { getSession } },
}))

import { hasLiveSession } from '../liveSession'

describe('hasLiveSession', () => {
    beforeEach(() => getSession.mockReset())

    it('is true when a session came back', async () => {
        getSession.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null })
        expect(await hasLiveSession()).toBe(true)
    })

    it('is false when the refresh token is dead, so the caller stops polling', async () => {
        getSession.mockResolvedValue({
            data: { session: null },
            error: { message: 'refresh_token_not_found' },
        })
        expect(await hasLiveSession()).toBe(false)
    })

    it('is false when there is no session at all', async () => {
        getSession.mockResolvedValue({ data: { session: null }, error: null })
        expect(await hasLiveSession()).toBe(false)
    })

    it('is false rather than throwing when the call misbehaves', async () => {
        // A malformed resolution rather than a rejection: the spy tracks settled
        // results by chaining onto the promise it returns, so a rejecting mock
        // surfaces as an unhandled rejection regardless of the caller catching
        // it. Destructuring undefined throws inside the same try, which is the
        // path under test.
        getSession.mockResolvedValue(undefined)
        expect(await hasLiveSession()).toBe(false)
    })
})
