/**
 * Room invites, receiving side: the live channel, the list, and dismissing.
 *
 * Sending lives in multiplayerStore, on the room socket. Only the room can
 * confirm the sender is sitting in it, and an invite nobody can vouch for is
 * a claim rather than a fact - see game-server/src/invites.ts.
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

export const useInviteStore = defineStore('invites', () => {
    const invites = ref<RoomInvite[]>([])
    const unavailable = ref(false)
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

    /** Take it off screen first: an answered invite that lingers reads as a
     *  tap that did nothing. */
    async function dismiss(id: string): Promise<void> {
        invites.value = invites.value.filter(i => i.id !== id)
        if (unavailable.value) return
        try {
            await supabase.rpc('dismiss_invite', { p_id: id })
        } catch { /* it is already gone from the screen */ }
    }

    function onVisible(): void {
        if (document.visibilityState === 'visible') void refresh()
    }

    function stop(): void {
        channel?.unsubscribe()
        channel = null
        invites.value = []
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible)
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
            // Read again on a successful join: a row inserted while the socket
            // was down is never replayed, and a channel that fails to join at
            // all would otherwise look exactly like a quiet one.
            .subscribe((status: string) => { if (status === 'SUBSCRIBED') void refresh() })

        // The same reason the heartbeat listens: a phone that slept through an
        // invite has ten minutes to notice it, and a reload should not be the
        // only way.
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    }

    watch(() => useAuthStore().user?.id, (id) => {
        if (id) start(id)
        else stop()
    }, { immediate: true })

    return { invites, current, unavailable, refresh, dismiss, start, stop }
})
