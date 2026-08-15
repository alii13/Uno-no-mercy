import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))

import { useSocialStore, type FriendRow } from '../socialStore'
import { useAuthStore } from '../authStore'

const row = (over: Partial<FriendRow> = {}): FriendRow => ({
    user_id: 'u2',
    username: 'RIVAL',
    share_code: 'abc123',
    skin: null,
    last_seen_at: null,
    status: 'accepted',
    incoming: false,
    created_at: '2026-08-15T10:00:00Z',
    ...over,
})

function listReturns(rows: FriendRow[]) {
    rpc.mockImplementation(async (fn: string) =>
        fn === 'my_friends' ? { data: rows, error: null } : { data: 'sent', error: null })
}

describe('social store', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        rpc.mockReset()
    })

    it('splits one list into friends, requests received and requests sent', async () => {
        listReturns([
            row({ user_id: 'friend', status: 'accepted' }),
            row({ user_id: 'asked-me', status: 'pending', incoming: true }),
            row({ user_id: 'i-asked', status: 'pending', incoming: false }),
            row({ user_id: 'blocked', status: 'blocked' }),
        ])
        const social = useSocialStore()
        await social.refresh()

        expect(social.friends.map(r => r.user_id)).toEqual(['friend'])
        expect(social.incoming.map(r => r.user_id)).toEqual(['asked-me'])
        expect(social.outgoing.map(r => r.user_id)).toEqual(['i-asked'])
        expect(social.blocked.map(r => r.user_id)).toEqual(['blocked'])
        // One lookup for every "should this button offer ADD?" question.
        expect([...social.knownIds].sort()).toEqual(['asked-me', 'blocked', 'friend', 'i-asked'])
    })

    it('hides every friends surface until the SQL is run', async () => {
        rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } })
        const social = useSocialStore()
        await social.refresh()
        expect(social.unavailable).toBe(true)

        // And stops asking, so a missing function costs one request, not one
        // per screen for the rest of the session.
        rpc.mockClear()
        await social.refresh()
        expect(rpc).not.toHaveBeenCalled()
    })

    it('keeps the list on screen through a dropped request', async () => {
        listReturns([row({ user_id: 'friend' })])
        const social = useSocialStore()
        await social.refresh()

        rpc.mockRejectedValueOnce(new Error('offline'))
        await social.refresh()
        expect(social.friends).toHaveLength(1)
        expect(social.unavailable).toBe(false)
    })

    it('re-reads after a request, because the server may have made you friends', async () => {
        // Both sides pressing ADD at once: the second call accepts the first.
        rpc.mockImplementation(async (fn: string) =>
            fn === 'send_friend_request'
                ? { data: 'accepted', error: null }
                : { data: [row({ user_id: 'u2', status: 'accepted' })], error: null })

        const social = useSocialStore()
        const result = await social.sendRequest('u2')

        expect(result).toBe('accepted')
        expect(rpc).toHaveBeenCalledWith('send_friend_request', { p_user: 'u2' })
        expect(social.friends.map(r => r.user_id)).toEqual(['u2'])
    })

    it('refuses a second press while one is in flight', async () => {
        let release: (v: unknown) => void = () => {}
        // Only the send hangs; the refresh it triggers on release answers
        // normally, or the test would wait on its own mock.
        rpc.mockImplementationOnce(() => new Promise(res => { release = res }))
            .mockResolvedValue({ data: [], error: null })

        const social = useSocialStore()
        const first = social.sendRequest('u2')
        expect(social.pendingIds.has('u2')).toBe(true)
        expect(await social.sendRequest('u2')).toBe('failed')

        release({ data: 'sent', error: null })
        expect(await first).toBe('sent')
        expect(social.pendingIds.has('u2')).toBe(false)
    })

    it('drops one account\'s list when another signs in on the same device', async () => {
        listReturns([row({ user_id: 'friend' })])
        const social = useSocialStore()
        const auth = useAuthStore()
        auth.user = { id: 'first' } as never
        await social.refresh()
        expect(social.friends).toHaveLength(1)

        // A store outlives a sign-out; nothing reloads the page.
        auth.user = { id: 'second' } as never
        await nextTick()
        expect(social.rows).toHaveLength(0)
    })

    it('unfriends without blocking, and the row goes at once', async () => {
        listReturns([row({ user_id: 'friend', status: 'accepted' })])
        const social = useSocialStore()
        await social.refresh()
        expect(social.friends).toHaveLength(1)

        listReturns([])
        await social.remove('friend')
        expect(rpc).toHaveBeenCalledWith('remove_friend', { p_user: 'friend' })
        // Blocking is a different, heavier thing and must not be involved.
        expect(rpc).not.toHaveBeenCalledWith('block_player', expect.anything())
        expect(social.friends).toHaveLength(0)
    })

    it('drops an answered request from the list immediately', async () => {
        listReturns([row({ user_id: 'asked-me', status: 'pending', incoming: true })])
        const social = useSocialStore()
        await social.refresh()
        expect(social.incoming).toHaveLength(1)

        // The row must leave the screen on the tap, not a round trip later.
        listReturns([])
        await social.respond('asked-me', false)
        expect(social.incoming).toHaveLength(0)
    })
})
