/**
 * The three dossier sections a public profile cannot derive for itself.
 *
 * public_profile() returns one row of aggregates, which covers the badge and
 * the personal bests. Standing, the promotion history and the per-game activity
 * all need data that owner-only RLS keeps out of the client, so they come from
 * the definer functions in supabase/profile-dossier.sql.
 *
 * Each is feature-detected independently: a profile missing one section is far
 * better than a profile that fails to render because one function has not been
 * created yet. Running the SQL and shipping the frontend can happen in either
 * order.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { BADGES, type Badge } from '../utils/badges'

export interface ProfileStanding {
    globalRank: number | null
    globalTotal: number
    countryRank: number | null
    countryTotal: number
}

export interface ProfilePromotion {
    badge: Badge
    at: string
}

export interface ProfileGame {
    played_at: string
    result: 'won' | 'lost' | 'eliminated' | 'abandoned'
    is_bot_game: boolean
    opponent_count: number
    cards_played_total: number
    cards_remaining: number
    peak_cards: number
    biggest_stack_survived: number
    points: number
}

interface RankRow {
    global_rank: number | null
    global_total: number
    country_rank: number | null
    country_total: number
}

interface PromotionRow {
    tier: number
    at: string
}

const badgeByTier = new Map(BADGES.map(b => [b.tier, b]))

export function useProfileDossier() {
    const standing = ref<ProfileStanding | null>(null)
    const promotions = ref<ProfilePromotion[]>([])
    const games = ref<ProfileGame[]>([])
    const loading = ref(false)

    function reset() {
        standing.value = null
        promotions.value = []
        games.value = []
    }

    async function fetchDossier(shareCode: string) {
        if (!shareCode) return
        loading.value = true
        reset()
        try {
            const [r, pr, g] = await Promise.all([
                supabase.rpc('profile_rank', { p_share_code: shareCode }),
                supabase.rpc('profile_promotions', { p_share_code: shareCode }),
                supabase.rpc('profile_recent_games', { p_share_code: shareCode, max_rows: 10 }),
            ])

            if (!r.error) {
                const row = (r.data as RankRow[] | null)?.[0]
                // A player with no games ranks nowhere; that is a hidden panel,
                // not an error.
                if (row?.global_rank != null) {
                    standing.value = {
                        globalRank: row.global_rank,
                        globalTotal: row.global_total ?? 0,
                        countryRank: row.country_rank ?? null,
                        countryTotal: row.country_total ?? 0,
                    }
                }
            }

            if (!pr.error) {
                promotions.value = ((pr.data as PromotionRow[] | null) ?? [])
                    .map(row => ({ badge: badgeByTier.get(row.tier), at: row.at }))
                    .filter((p): p is ProfilePromotion => !!p.badge)
            }

            if (!g.error) games.value = (g.data as ProfileGame[] | null) ?? []
        } catch {
            // Offline, or the SQL has not been run — the page still renders
            // everything public_profile already gave it.
            reset()
        } finally {
            loading.value = false
        }
    }

    return { standing, promotions, games, loading, fetchDossier }
}
