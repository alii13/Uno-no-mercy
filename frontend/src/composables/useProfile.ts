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

export interface PublicProfile extends ProfileAggregates {
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

    async function fetchProfile(code: string) {
        loading.value = true
        notFound.value = false
        unavailable.value = false
        try {
            const { data, error } = await supabase.rpc('public_profile', { p_share_code: code })
            if (error) {
                unavailable.value = true
                return
            }
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

    return { loading, notFound, unavailable, profile, fetchProfile }
}
