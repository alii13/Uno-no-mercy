/**
 * Rank lookup for visible seats, via the SECURITY DEFINER function in
 * supabase/ranks.sql (game_results RLS is owner-select-only).
 *
 * Feature-detects like useLeaderboard: until the SQL exists, lookups fail
 * quietly and callers render no chips. Results are cached per user id for
 * the session — ranks move slowly.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { rankFor, type Rank } from '../utils/ranks'

const cache = new Map<string, Rank>()
let broken = false

export function useRanks() {
    const ranks = ref<Record<string, Rank>>({})

    async function fetchRanks(userIds: string[]) {
        if (broken) return
        const missing = userIds.filter(id => id && !cache.has(id))
        if (missing.length) {
            const { data, error } = await supabase.rpc('player_ranks', { ids: missing })
            if (error) {
                // Function not installed yet — stop asking this session.
                broken = true
                return
            }
            const rows = (data ?? []) as { user_id: string; wins: number }[]
            const winsById = new Map<string, number>(rows.map(r => [r.user_id, Number(r.wins)]))
            // Ids with no rows have zero recorded wins — still rankable.
            for (const id of missing) cache.set(id, rankFor(winsById.get(id) ?? 0))
        }
        const next: Record<string, Rank> = {}
        for (const id of userIds) {
            const r = cache.get(id)
            if (r) next[id] = r
        }
        ranks.value = next
    }

    return { ranks, fetchRanks }
}
