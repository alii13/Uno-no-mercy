/**
 * Leaderboard reads via the SECURITY DEFINER functions in
 * supabase/leaderboards.sql / leaderboards-v2.sql (game_results RLS is
 * owner-select-only, so public boards go through a definer read).
 *
 * Feature-detects: until the SQL has been run on the project, the rpc
 * errors and `available` stays false — callers hide the board entirely.
 * The v2 columns (share_code, country, skin, lifetime_wins) and the
 * my-rank context are optional the same way: absent until v2 is run.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { localDateString } from '../utils/seededRng'

export interface DailyRow {
    rank: number
    username: string
    share_code?: string | null
    country?: string | null
    skin?: string | null
    lifetime_wins?: number
    result: 'won' | 'lost' | 'eliminated'
    effort: number
    duration_secs: number
    is_me: boolean
}

export interface WeeklyRow {
    rank: number
    username: string
    share_code?: string | null
    country?: string | null
    skin?: string | null
    lifetime_wins?: number
    wins: number
    games: number
    is_me: boolean
}

/** The viewer's own position — even when they're far below the top rows. */
export interface BoardContext {
    my_rank: number | null
    total_players: number
}

/** One weekly spotlight: a skill archetype's holder this week. */
export interface Spotlight {
    kind: 'fastest_win' | 'biggest_stack' | 'most_wins'
    username: string
    share_code: string | null
    country: string | null
    value: number
}

export function useLeaderboard() {
    // Guilty until proven installed: the link renders only after a probe
    // succeeds, so there's no flash of a dead feature.
    const available = ref(false)
    const loading = ref(false)
    const daily = ref<DailyRow[]>([])
    const weekly = ref<WeeklyRow[]>([])
    const dailyContext = ref<BoardContext | null>(null)
    const weeklyContext = ref<BoardContext | null>(null)
    const spotlights = ref<Spotlight[]>([])

    async function fetchBoards() {
        loading.value = true
        try {
            const [d, w, dc, wc, sp] = await Promise.all([
                supabase.rpc('daily_leaderboard', { challenge_date: localDateString() }),
                supabase.rpc('weekly_wins_leaderboard'),
                supabase.rpc('daily_my_rank', { challenge_date: localDateString() }),
                supabase.rpc('weekly_my_rank'),
                supabase.rpc('weekly_spotlights'),
            ])
            if (d.error && w.error) {
                // Functions not installed yet — hide the feature.
                available.value = false
                return
            }
            available.value = true
            daily.value = (d.data || []) as DailyRow[]
            weekly.value = (w.data || []) as WeeklyRow[]
            // v2-only context functions: errors just mean v2 isn't installed.
            dailyContext.value = dc.error ? null : ((dc.data as BoardContext[] | null)?.[0] ?? null)
            weeklyContext.value = wc.error ? null : ((wc.data as BoardContext[] | null)?.[0] ?? null)
            spotlights.value = sp.error ? [] : ((sp.data || []) as Spotlight[])
        } catch {
            available.value = false
        } finally {
            loading.value = false
        }
    }

    return { available, loading, daily, weekly, dailyContext, weeklyContext, spotlights, fetchBoards }
}
