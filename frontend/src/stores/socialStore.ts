/**
 * Friends: the list, the two pending directions, and the people you blocked.
 *
 * A store rather than a composable because three unrelated screens read the
 * same state - the dashboard, a profile page, and the game-over modal, where
 * "add the person who just beat you" is the highest-intent moment in the app.
 *
 * Feature-detects like every other definer surface: until friends.sql runs,
 * `unavailable` is true and each screen hides its friends section rather than
 * showing a broken one.
 *
 * No realtime here. Requests arrive on a load, not a push - the socket for
 * that lands with invites.
 */

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { isFatalSchemaError } from '../utils/supabaseErrors'
import { hasLiveSession } from '../utils/liveSession'

export interface FriendRow {
    user_id: string
    username: string
    share_code: string | null
    skin: string | null
    last_seen_at: string | null
    status: 'accepted' | 'pending' | 'blocked'
    /** True when they asked you. False when you asked them. */
    incoming: boolean
    created_at: string
}

/** What send_friend_request answers. Every one is a normal outcome, not an
 *  error: two people can press ADD at the same moment. */
export type SendResult =
    | 'sent' | 'accepted' | 'already' | 'blocked' | 'declined' | 'self'
    | 'rate_limited' | 'not_found' | 'unauthorized' | 'failed'

export const useSocialStore = defineStore('social', () => {
    const rows = ref<FriendRow[]>([])
    const loading = ref(false)
    /** True once the SQL is known to be missing - hides every friends surface. */
    const unavailable = ref(false)
    /** User ids with a request in flight, so a button can disable itself. */
    const pendingIds = ref<Set<string>>(new Set())

    const friends = computed(() => rows.value.filter(r => r.status === 'accepted'))
    const incoming = computed(() => rows.value.filter(r => r.status === 'pending' && r.incoming))
    const outgoing = computed(() => rows.value.filter(r => r.status === 'pending' && !r.incoming))
    const blocked = computed(() => rows.value.filter(r => r.status === 'blocked'))

    /** Everyone already connected to you in some way - one lookup for the
     *  buttons that must not offer ADD twice. */
    const knownIds = computed(() => new Set(rows.value.map(r => r.user_id)))

    async function refresh(): Promise<void> {
        if (unavailable.value) return
        loading.value = true
        try {
            if (!(await hasLiveSession())) return
            const { data, error } = await supabase.rpc('my_friends')
            if (error) {
                if (isFatalSchemaError(error)) unavailable.value = true
                return
            }
            rows.value = (data ?? []) as FriendRow[]
        } catch {
            /* transient - keep whatever list is on screen */
        } finally {
            loading.value = false
        }
    }

    async function call(fn: string, args: Record<string, unknown>): Promise<string> {
        const { data, error } = await supabase.rpc(fn, args)
        if (error) {
            if (isFatalSchemaError(error)) unavailable.value = true
            return 'failed'
        }
        return typeof data === 'string' ? data : 'failed'
    }

    async function sendRequest(userId: string): Promise<SendResult> {
        if (unavailable.value || pendingIds.value.has(userId)) return 'failed'
        pendingIds.value = new Set(pendingIds.value).add(userId)
        try {
            const result = await call('send_friend_request', { p_user: userId }) as SendResult
            // The server decides the outcome - a simultaneous ADD from the
            // other side comes back as 'accepted', not 'sent' - so re-read
            // rather than guessing the new row.
            if (result === 'sent' || result === 'accepted') await refresh()
            return result
        } finally {
            const next = new Set(pendingIds.value)
            next.delete(userId)
            pendingIds.value = next
        }
    }

    async function respond(userId: string, accept: boolean): Promise<void> {
        // Drop the row first: an answered request must leave the screen at
        // once, and the refresh below settles the truth.
        rows.value = rows.value.filter(r => !(r.user_id === userId && r.status === 'pending'))
        await call('respond_friend_request', { p_user: userId, p_accept: accept })
        await refresh()
    }

    /** Unfriend. Blocking was the only exit, and it says something much
     *  stronger than "we do not play any more". */
    async function remove(userId: string): Promise<void> {
        rows.value = rows.value.filter(r => r.user_id !== userId)
        await call('remove_friend', { p_user: userId })
        await refresh()
    }

    async function block(userId: string): Promise<void> {
        await call('block_player', { p_user: userId })
        await refresh()
    }

    async function unblock(userId: string): Promise<void> {
        await call('unblock_player', { p_user: userId })
        await refresh()
    }

    function reset(): void {
        rows.value = []
        pendingIds.value = new Set()
    }

    // A Pinia store outlives a sign-out, because nothing reloads the page.
    // Without this, signing in as someone else on the same device shows the
    // previous account's friends, requests and block list until a read
    // returns - another person's social graph on a stranger's screen.
    watch(() => useAuthStore().user?.id, reset)

    return {
        rows, loading, unavailable, pendingIds,
        friends, incoming, outgoing, blocked, knownIds,
        refresh, sendRequest, respond, remove, block, unblock, reset,
    }
})
