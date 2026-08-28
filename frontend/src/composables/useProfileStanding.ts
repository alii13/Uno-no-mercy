/**
 * The player's own place on the all-time board — globally, and inside their
 * country. Reuses `alltime_my_rank`, the same definer function the leaderboard
 * pins its "you are here" row with, rather than reading the whole board just to
 * find one row.
 *
 * Feature-detected like every other definer call: leaderboards-alltime.sql may
 * not have run, and a profile that hides its standing beats one that shows a
 * broken rank.
 */

import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { AlltimeContext } from './useLeaderboard'

export interface Standing {
    rank: number | null
    total: number
}

function firstRow(res: { data: unknown; error: unknown }): AlltimeContext | null {
    if (res.error) return null
    return (res.data as AlltimeContext[] | null)?.[0] ?? null
}

function toStanding(ctx: AlltimeContext | null): Standing | null {
    if (!ctx || ctx.my_rank == null) return null
    return { rank: ctx.my_rank, total: ctx.total_players }
}

export function useProfileStanding() {
    const authStore = useAuthStore()
    const available = ref(false)
    const loading = ref(false)
    const globalRank = ref<Standing | null>(null)
    const countryRank = ref<Standing | null>(null)

    let lastKey = ''

    async function fetchStanding() {
        const userId = authStore.user?.id
        if (!userId) return
        const iso = authStore.profile?.country ?? null
        const key = `${userId}:${iso ?? ''}`
        if (key === lastKey) return
        lastKey = key

        loading.value = true
        try {
            const [g, c] = await Promise.all([
                supabase.rpc('alltime_my_rank', { p_country: null }),
                iso
                    ? supabase.rpc('alltime_my_rank', { p_country: iso })
                    : Promise.resolve({ data: null, error: null }),
            ])
            if (g.error) {
                available.value = false
                return
            }
            available.value = true
            globalRank.value = toStanding(firstRow(g))
            countryRank.value = toStanding(firstRow(c))
        } catch {
            // Offline or a missing function — hide the surface, never block the page.
            available.value = false
        } finally {
            loading.value = false
        }
    }

    // The profile (and so the country) can land after mount, which is why this
    // watches rather than firing once.
    watch(
        () => [authStore.user?.id, authStore.profile?.country],
        () => { void fetchStanding() },
        { immediate: true },
    )

    return { available, loading, globalRank, countryRank, fetchStanding }
}
