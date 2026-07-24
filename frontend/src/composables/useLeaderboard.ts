/**
 * Leaderboard reads via the SECURITY DEFINER functions in
 * supabase/leaderboards.sql (game_results RLS is owner-select-only, so
 * public boards go through a definer read).
 *
 * Feature-detects: until the SQL has been run on the project, the rpc
 * errors and `available` stays false — callers hide the board entirely.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { localDateString } from '../utils/seededRng'

export interface DailyRow {
    rank: number
    username: string
    result: 'won' | 'lost' | 'eliminated'
    effort: number
    duration_secs: number
    is_me: boolean
}

export interface WeeklyRow {
    rank: number
    username: string
    wins: number
    games: number
    is_me: boolean
}

export function useLeaderboard() {
    // Guilty until proven installed: the link renders only after a probe
    // succeeds, so there's no flash of a dead feature.
    const available = ref(false)
    const loading = ref(false)
    const daily = ref<DailyRow[]>([])
    const weekly = ref<WeeklyRow[]>([])

    async function fetchBoards() {
        loading.value = true
        try {
            const [d, w] = await Promise.all([
                supabase.rpc('daily_leaderboard', { challenge_date: localDateString() }),
                supabase.rpc('weekly_wins_leaderboard'),
            ])
            if (d.error && w.error) {
                // Functions not installed yet — hide the feature.
                available.value = false
                return
            }
            available.value = true
            daily.value = (d.data || []) as DailyRow[]
            weekly.value = (w.data || []) as WeeklyRow[]
        } catch {
            available.value = false
        } finally {
            loading.value = false
        }
    }

    return { available, loading, daily, weekly, fetchBoards }
}
