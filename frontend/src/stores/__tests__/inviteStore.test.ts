import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const { rpc, channelFor, unsubscribe } = vi.hoisted(() => {
    const unsubscribe = vi.fn()
    const channelFor = vi.fn()
    return { rpc: vi.fn(), channelFor, unsubscribe }
})

// One fake channel per name, so a test can fire the row event the way
// Realtime would and assert the subscription is torn down.
vi.mock('../../lib/supabase', () => ({
    supabase: {
        rpc,
        channel: (name: string) => {
            const handlers: ((payload: unknown) => void)[] = []
            const ch = {
                name,
                handlers,
                on: (_e: string, _cfg: unknown, cb: (p: unknown) => void) => { handlers.push(cb); return ch },
                // Realtime reports the join through this callback; the store
                // reads again on success.
                subscribe: (cb?: (status: string) => void) => { cb?.('SUBSCRIBED'); return ch },
                unsubscribe,
            }
            channelFor(ch)
            return ch
        },
    },
}))

import { useInviteStore, type RoomInvite } from '../inviteStore'
import { useAuthStore } from '../authStore'

const invite = (over: Partial<RoomInvite> = {}): RoomInvite => ({
    id: 'i1',
    from_user: 'u2',
    from_username: 'RIVAL',
    room_code: 'ABC123',
    created_at: '2026-08-15T12:00:00Z',
    ...over,
})

function rpcReturns(rows: RoomInvite[], sendResult = 'sent') {
    rpc.mockImplementation(async (fn: string) =>
        fn === 'my_invites' ? { data: rows, error: null } : { data: sendResult, error: null })
}

describe('invite store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        rpc.mockReset()
        channelFor.mockReset()
        unsubscribe.mockReset()
    })

    it('opens a channel for the signed-in player and reads on start', async () => {
        rpcReturns([invite()])
        const store = useInviteStore()
        const auth = useAuthStore()
        auth.user = { id: 'me' } as never
        await nextTick()

        expect(channelFor).toHaveBeenCalledWith(expect.objectContaining({ name: 'invites:me' }))
        await vi.waitFor(() => expect(store.current?.from_username).toBe('RIVAL'))
    })

    it('re-reads when a row arrives, because the payload carries no name', async () => {
        rpcReturns([])
        const store = useInviteStore()
        const auth = useAuthStore()
        auth.user = { id: 'me' } as never
        await nextTick()
        await vi.waitFor(() => expect(rpc).toHaveBeenCalledWith('my_invites'))
        expect(store.current).toBeNull()

        rpcReturns([invite({ id: 'i2', from_username: 'NEWCOMER' })])
        const ch = channelFor.mock.calls[0]![0] as { handlers: ((p: unknown) => void)[] }
        ch.handlers[0]!({ new: { id: 'i2' } })
        await vi.waitFor(() => expect(store.current?.from_username).toBe('NEWCOMER'))
    })

    it('drops the invite from the screen before the server confirms', async () => {
        rpcReturns([invite()])
        const store = useInviteStore()
        await store.refresh()
        expect(store.current).not.toBeNull()

        // Never resolves: the toast must still clear.
        rpc.mockImplementation(() => new Promise(() => {}))
        void store.dismiss('i1')
        expect(store.current).toBeNull()
    })

    it('hides itself and opens no channel until the SQL is run', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
        const store = useInviteStore()
        await store.refresh()
        expect(store.unavailable).toBe(true)

        store.start('me')
        expect(channelFor).not.toHaveBeenCalled()
    })

    it('reads again when the tab comes back', async () => {
        const listeners: Record<string, () => void> = {}
        vi.stubGlobal('document', {
            visibilityState: 'visible',
            addEventListener: (e: string, cb: () => void) => { listeners[e] = cb },
            removeEventListener: () => { delete listeners.visibilitychange },
        })
        rpcReturns([])
        const store = useInviteStore()
        store.start('me')
        await vi.waitFor(() => expect(rpc).toHaveBeenCalled())

        // An invite inserted while the socket was down is never replayed, so
        // waking up has to re-read.
        rpc.mockClear()
        rpcReturns([invite({ from_username: 'ARRIVED WHILE ASLEEP' })])
        listeners.visibilitychange!()
        await vi.waitFor(() => expect(store.current?.from_username).toBe('ARRIVED WHILE ASLEEP'))

        store.stop()
        expect(listeners.visibilitychange).toBeUndefined()
        vi.unstubAllGlobals()
    })

    it('tears the channel down on sign-out and keeps no invites', async () => {
        rpcReturns([invite()])
        const store = useInviteStore()
        const auth = useAuthStore()
        auth.user = { id: 'me' } as never
        await nextTick()
        await vi.waitFor(() => expect(store.current).not.toBeNull())

        auth.user = null
        await nextTick()
        expect(unsubscribe).toHaveBeenCalled()
        expect(store.invites).toHaveLength(0)
    })
})
