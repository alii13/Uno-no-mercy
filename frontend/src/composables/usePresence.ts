/**
 * Presence for a list of names on screen, via players_presence in
 * supabase/presence.sql.
 *
 * Mirrors useBadges: one batched call for the ids a screen is about to render,
 * cached per id, and a `broken` latch so a missing function costs one request
 * per session rather than one per screen.
 *
 * Unlike a badge, presence goes stale - and it goes stale in both directions.
 * The clock alone can only decay a dot, green to amber to grey; nothing but a
 * fresh read brings it back when the player returns. So the ids a screen asked
 * about are re-read while that screen is open and visible.
 *
 * The cache holds each id for a minute - shorter and a scrolling leaderboard
 * would re-ask constantly, longer and the dot starts lying.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { usePoll } from './useClock'
import { isFatalSchemaError } from '../utils/supabaseErrors'

const CACHE_MS = 60_000

const cache = new Map<string, { lastSeenAt: string | null; at: number }>()
let broken = false

export function usePresence() {
    const presence = ref<Record<string, string | null>>({})
    /** Whatever this screen last asked about, so the poll knows its subject. */
    let watched: string[] = []

    function publish(ids: string[]) {
        const out = { ...presence.value }
        for (const id of ids) {
            const hit = cache.get(id)
            if (hit) out[id] = hit.lastSeenAt
        }
        presence.value = out
    }

    async function fetchPresence(userIds: string[]): Promise<void> {
        if (broken) return
        const now = Date.now()
        const ids = [...new Set(userIds.filter(Boolean))]
        watched = ids
        const stale = ids.filter(id => {
            const hit = cache.get(id)
            return !hit || now - hit.at > CACHE_MS
        })

        if (stale.length) {
            try {
                const { data, error } = await supabase.rpc('players_presence', { ids: stale })
                if (error) {
                    if (isFatalSchemaError(error)) broken = true
                    return
                }
                const rows = (data ?? []) as { user_id: string; last_seen_at: string | null }[]
                const byId = new Map(rows.map(r => [r.user_id, r.last_seen_at]))
                // An id with no row has never checked in - cache that too, or
                // every render asks about the same silent player again.
                for (const id of stale) cache.set(id, { lastSeenAt: byId.get(id) ?? null, at: now })
            } catch {
                return
            }
        }
        publish(ids)
    }

    // Slightly under the cache window, so a poll always does real work.
    usePoll(() => { if (watched.length) void fetchPresence(watched) }, 45_000)

    return { presence, fetchPresence }
}
