/**
 * Badge lookup for visible seats and rows, via the SECURITY DEFINER function
 * in supabase/badges.sql (game_results RLS is owner-select-only).
 *
 * Mirrors useRanks: feature-detects until the SQL exists, then lookups fail
 * quietly and callers render no chip. The definer returns raw points +
 * days_idle; the floored inactivity decay is applied here so the tier table
 * lives only in utils/badges.ts. Cached per user id for the session.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { badgeFor, applyDecay, progressToNext, type Badge, type Progress } from '../utils/badges'

export interface BadgeInfo {
    badge: Badge
    points: number
    progress: Progress
}

const cache = new Map<string, BadgeInfo>()
let broken = false

function infoFor(earned: number, daysIdle: number): BadgeInfo {
    const points = applyDecay(earned, daysIdle)
    return { badge: badgeFor(points), points, progress: progressToNext(points) }
}

export function useBadges() {
    const badges = ref<Record<string, BadgeInfo>>({})

    async function fetchBadges(userIds: string[]) {
        if (broken) return
        const missing = userIds.filter(id => id && !cache.has(id))
        if (missing.length) {
            const { data, error } = await supabase.rpc('player_points', { ids: missing })
            if (error) {
                // Function not installed yet — stop asking this session.
                broken = true
                return
            }
            const rows = (data ?? []) as { user_id: string; points: number; days_idle: number }[]
            const byId = new Map(rows.map(r => [r.user_id, r]))
            // Ids with no rows have no recorded games — still a Recruit badge.
            for (const id of missing) {
                const r = byId.get(id)
                cache.set(id, infoFor(Number(r?.points ?? 0), Number(r?.days_idle ?? 0)))
            }
        }
        const next: Record<string, BadgeInfo> = {}
        for (const id of userIds) {
            const info = cache.get(id)
            if (info) next[id] = info
        }
        badges.value = next
    }

    return { badges, fetchBadges }
}
