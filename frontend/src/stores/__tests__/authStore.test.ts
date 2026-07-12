/**
 * Regression tests for the auth store's guest/init robustness:
 *  - initialize() must release the `loading` gate even if getSession throws,
 *    or the whole app (gated on it) hangs on the splash forever.
 *  - signInAnonymously must reuse an existing session instead of minting a new
 *    anon user (which orphans the prior one's stats), and must ensure the
 *    profile row via an idempotent upsert.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '../../lib/supabase'

const h = vi.hoisted(() => {
    const state = {
        getSession: async (): Promise<{ data: { session: unknown } }> => ({ data: { session: null } }),
        signInAnonymouslyCalls: 0,
        anonResult: { data: { user: { id: 'anon-1', is_anonymous: true } }, error: null } as unknown,
        profileRow: null as unknown,
        upsertCalls: [] as { row: unknown; opts: unknown }[],
        reset() {
            state.getSession = async () => ({ data: { session: null } })
            state.signInAnonymouslyCalls = 0
            state.profileRow = null
            state.upsertCalls = []
        },
    }
    return { state }
})

vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: () => h.state.getSession(),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
            signInAnonymously: async () => { h.state.signInAnonymouslyCalls++; return h.state.anonResult },
            updateUser: async () => ({ error: null }),
        },
        from: () => {
            const b: Record<string, unknown> = {}
            b.select = () => b
            b.eq = () => b
            b.maybeSingle = async () => ({ data: h.state.profileRow, error: null })
            b.upsert = async (row: unknown, opts: unknown) => { h.state.upsertCalls.push({ row, opts }); return { error: null } }
            return b
        },
    },
}))

import { useAuthStore } from '../authStore'

beforeEach(() => {
    setActivePinia(createPinia())
    h.state.reset()
})

describe('authStore init + guest robustness', () => {
    it('releases the loading gate even when getSession rejects', async () => {
        h.state.getSession = async () => { throw new Error('network down / expired token') }
        const auth = useAuthStore()

        await auth.initialize()

        // App.vue is gated on this — it must never stay true after init.
        expect(auth.loading).toBe(false)
    })

    it('reuses an existing session instead of minting a new anonymous user', async () => {
        const auth = useAuthStore()
        // Simulate an already-signed-in (reused) session.
        auth.user = { id: 'existing' } as User
        auth.profile = { id: 'existing', username: 'KeepMe', created_at: '' } as UserProfile

        const res = await auth.signInAnonymously()

        expect(res.success).toBe(true)
        expect(h.state.signInAnonymouslyCalls).toBe(0) // no new anon user minted
        expect(auth.user?.id).toBe('existing')
    })

    it('ensures the guest profile via an idempotent upsert on a fresh sign-in', async () => {
        const auth = useAuthStore()

        const res = await auth.signInAnonymously('Bob')

        expect(res.success).toBe(true)
        expect(h.state.signInAnonymouslyCalls).toBe(1)
        expect(h.state.upsertCalls).toHaveLength(1)
        expect(h.state.upsertCalls[0]!.row).toMatchObject({ id: 'anon-1', username: 'Bob' })
        expect(h.state.upsertCalls[0]!.opts).toMatchObject({ onConflict: 'id', ignoreDuplicates: true })
    })
})
