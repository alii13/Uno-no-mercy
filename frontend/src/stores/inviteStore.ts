/**
 * Room invites: the live channel, the list, and sending one.
 *
 * Separate from socialStore because this owns a subscription. A player on the
 * home screen holds no game socket, so the invite arrives over Supabase
 * Realtime instead - the one place in the app that uses it, and the reason
 * the invites table has a SELECT policy while friendships has none.
 *
 * The realtime payload carries the row, not the sender's name, so an event is
 * a nudge to re-read rather than data to render.
 *
 * Feature-detects like every definer surface: until invites.sql runs, the
 * first read fails, `unavailable` latches, and no channel is opened.
 */

import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { isFatalSchemaError } from '../utils/supabaseErrors'

export interface RoomInvite {
    id: string
    from_user: string
    from_username: string
    room_code: string
    created_at: string
}

export type InviteResult =
    | 'sent' | 'blocked' | 'self' | 'too_soon' | 'rate_limited'
    | 'not_found' | 'bad_code' | 'unauthorized' | 'failed'

export const useInviteStore = defineStore('invites', () => {
    const invites = ref<RoomInvite[]>([])
    const unavailable = ref(false)
    /** Recipients with a send in flight, so a row can disable its button. */
    const sending = ref<Set<string>>(new Set())

    let channel: { unsubscribe: () => void } | null = null

    /** The one the toast shows: newest first, and only one at a time. */
    const current = computed<RoomInvite | null>(() => invites.value[0] ?? null)

    async function refresh(): Promise<void> {
        if (unavailable.value) return
        try {
            const { data, error } = await supabase.rpc('my_invites')
            if (error) {
                if (isFatalSchemaError(error)) unavailable.value = true
                return
            }
            invites.value = (data ?? []) as RoomInvite[]
        } catch {
            /* transient - keep whatever is on screen */
        }
    }

    async function send(userId: string, roomCode: string): Promise<InviteResult> {
        if (unavailable.value || sending.value.has(userId)) return 'failed'
        sending.value = new Set(sending.value).add(userId)
        try {
            const { data, error } = await supabase.rpc('send_room_invite', { p_user: userId, p_code: roomCode })
            if (error) {
                if (isFatalSchemaError(error)) unavailable.value = true
                return 'failed'
            }
            return (typeof data === 'string' ? data : 'failed') as InviteResult
        } catch {
            return 'failed'
        } finally {
            const next = new Set(sending.value)
            next.delete(userId)
            sending.value = next
        }
    }

    /** Take it off screen first: an answered invite that lingers reads as a
     *  tap that did nothing. */
    async function dismiss(id: string): Promise<void> {
        invites.value = invites.value.filter(i => i.id !== id)
        if (unavailable.value) return
        try {
            await supabase.rpc('dismiss_invite', { p_id: id })
        } catch { /* it is already gone from the screen */ }
    }

    function stop(): void {
        channel?.unsubscribe()
        channel = null
        invites.value = []
    }

    function start(userId: string): void {
        stop()
        if (unavailable.value) return
        void refresh()
        channel = supabase
            .channel(`invites:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'room_invites', filter: `to_user=eq.${userId}` },
                () => { void refresh() },
            )
            .subscribe()
    }

    watch(() => useAuthStore().user?.id, (id) => {
        if (id) start(id)
        else stop()
    }, { immediate: true })

    return { invites, current, unavailable, sending, refresh, send, dismiss, start, stop }
})
