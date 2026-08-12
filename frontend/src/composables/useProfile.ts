/**
 * Public profile read via public_profile() in supabase/profile-pages.sql —
 * one row of aggregates per share code, never row-level history.
 *
 * Feature-detects like the boards: until the SQL is run, the rpc errors and
 * `unavailable` is true — the page shows a warming-up state, not a break.
 */

import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import type { ProfileAggregates } from '../utils/achievements'
import type { ActivityDay } from '../utils/activity'

export interface PublicProfile extends ProfileAggregates {
    user_id: string | null
    username: string
    country: string | null
    skin: string | null
    member_since: string
    recent_form: string[]
}

export function useProfile() {
    const loading = ref(true)
    const notFound = ref(false)
    const unavailable = ref(false)
    const profile = ref<PublicProfile | null>(null)
    // Empty until profile-activity.sql is run — the heatmap hides itself.
    const activity = ref<ActivityDay[]>([])

    async function fetchProfile(code: string) {
        loading.value = true
        notFound.value = false
        unavailable.value = false
        activity.value = []
        try {
            const [{ data, error }, act] = await Promise.all([
                supabase.rpc('public_profile', { p_share_code: code }),
                supabase.rpc('profile_activity', {
                    p_share_code: code,
                    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            ])
            if (error) {
                unavailable.value = true
                return
            }
            activity.value = act.error ? [] : ((act.data || []) as ActivityDay[])
            const row = (data as PublicProfile[] | null)?.[0]
            if (!row) {
                notFound.value = true
                return
            }
            profile.value = row
        } catch {
            unavailable.value = true
        } finally {
            loading.value = false
        }
    }

    return { loading, notFound, unavailable, profile, activity, fetchProfile }
}
