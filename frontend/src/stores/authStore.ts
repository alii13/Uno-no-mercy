import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type UserProfile } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null)
    const profile = ref<UserProfile | null>(null)
    const accessToken = ref<string | null>(null)
    const loading = ref(true)
    const error = ref<string | null>(null)

    const isAuthenticated = computed(() => !!user.value)
    const username = computed(() => profile.value?.username || 'Player')

    // Initialize auth state
    async function initialize() {
        loading.value = true

        // Get current session
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
            user.value = session.user
            accessToken.value = session.access_token
            await fetchProfile()
        }

        // Listen for auth changes
        // IMPORTANT: Per Supabase docs, avoid await inside this callback!
        // Use setTimeout to defer Supabase calls to avoid deadlocks
        supabase.auth.onAuthStateChange((event, session) => {

            // Always sync user and token state immediately (non-async)
            user.value = session?.user || null
            accessToken.value = session?.access_token || null

            // Handle specific events
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                // Defer profile fetch to avoid blocking
                if (session?.user) {
                    setTimeout(async () => {
                        await fetchProfile()
                    }, 0)
                }
            } else if (event === 'SIGNED_OUT') {
                profile.value = null
            }
            // INITIAL_SESSION is handled by initialize() directly
        })

        loading.value = false
    }

    async function fetchProfile() {
        if (!user.value) return

        const { data, error: err } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.value.id)
            .single()

        if (err && err.code !== 'PGRST116') {
            console.error('Error fetching profile:', err)
        }

        profile.value = data
    }

    async function signUp(email: string, password: string, username: string) {
        loading.value = true
        error.value = null

        try {
            // Sign up the user - pass username in metadata
            // The database trigger will create the profile when email is confirmed
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username: username
                    }
                }
            })

            if (authError) throw authError
            if (!authData.user) throw new Error('No user returned')

            user.value = authData.user

            // Profile will be created by database trigger after email confirmation
            // Try to fetch it (will be null until confirmed)
            await fetchProfile()

            return { success: true, needsConfirmation: !authData.session }
        } catch (err: any) {
            error.value = err.message
            return { success: false, error: err.message }
        } finally {
            loading.value = false
        }
    }

    async function signIn(email: string, password: string) {
        loading.value = true
        error.value = null

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (authError) throw authError

            user.value = data.user
            await fetchProfile()

            return { success: true }
        } catch (err: any) {
            error.value = err.message
            return { success: false, error: err.message }
        } finally {
            loading.value = false
        }
    }

    async function signInAnonymously() {
        loading.value = true
        error.value = null

        try {
            const guestName = 'Guest_' + Math.random().toString(36).substring(2, 6).toUpperCase()

            const { data, error: authError } = await supabase.auth.signInAnonymously({
                options: {
                    data: {
                        username: guestName
                    }
                }
            })

            if (authError) throw authError
            if (!data.user) throw new Error('Anonymous sign-in failed')

            user.value = data.user

            // Create profile for anonymous user (trigger may not fire for anon)
            const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', data.user.id)
                .single()

            if (!existing) {
                await supabase
                    .from('profiles')
                    .insert({
                        id: data.user.id,
                        username: guestName
                    })
            }

            await fetchProfile()
            return { success: true }
        } catch (err: any) {
            error.value = err.message
            return { success: false, error: err.message }
        } finally {
            loading.value = false
        }
    }

    const isAnonymous = computed(() => user.value?.is_anonymous === true)

    async function sendPasswordReset(email: string) {
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            })
            if (resetError) throw resetError
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }

    async function updatePassword(newPassword: string) {
        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })
            if (updateError) throw updateError
            return { success: true }
        } catch (err: any) {
            return { success: false, error: err.message }
        }
    }

    async function signOut() {
        try {
            await supabase.auth.signOut()
            user.value = null
            profile.value = null
        } catch (err: any) {
            console.error('signOut error:', err)
        }
    }

    return {
        user,
        profile,
        accessToken,
        loading,
        error,
        isAuthenticated,
        isAnonymous,
        username,
        initialize,
        signUp,
        signIn,
        signInAnonymously,
        signOut,
        sendPasswordReset,
        updatePassword
    }
})
