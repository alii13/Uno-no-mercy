/**
 * The presence heartbeat: this player stamps their own profile row so other
 * screens can say "online now" or "last seen 3 hours ago".
 *
 * Owner-update RLS already allows the write, so there is no function to call.
 * The write is silent and best-effort - presence is a garnish, and it must
 * never surface an error over the game.
 *
 * A hidden tab does not beat. A tab left open behind a browser window is not
 * a player anyone can invite, and counting it inflates the live number.
 *
 * The first failure stops the loop for the session. Until presence.sql runs,
 * every write fails on a missing column, and a doomed write per minute helps
 * nobody.
 */

import { watch, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'

/** One beat a minute. The online window in presence.sql is two, so a single
 *  missed beat never flips a present player to offline. */
const BEAT_MS = 60_000

export function usePresenceHeartbeat() {
    const auth = useAuthStore()
    let timer: ReturnType<typeof setInterval> | null = null
    let disabled = false
    let inFlight = false

    async function beat() {
        if (disabled || inFlight || document.visibilityState !== 'visible') return
        const userId = auth.user?.id
        if (!userId) return
        inFlight = true
        try {
            const { supabase } = await import('../lib/supabase')
            const { error } = await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId)
            // A missing column or a revoked policy fails the same way every
            // minute. Stop asking.
            if (error) disabled = true
        } catch {
            disabled = true
        } finally {
            inFlight = false
        }
    }

    function onVisibility() {
        // Coming back is itself a heartbeat: the player is here again, and
        // waiting up to a minute to say so leaves them looking away.
        if (document.visibilityState === 'visible') void beat()
    }

    function start() {
        if (timer) return
        void beat()
        timer = setInterval(() => void beat(), BEAT_MS)
        document.addEventListener('visibilitychange', onVisibility)
    }

    function stop() {
        if (timer) { clearInterval(timer); timer = null }
        document.removeEventListener('visibilitychange', onVisibility)
    }

    watch(() => auth.isAuthenticated, (is) => {
        if (is) start()
        else stop()
    }, { immediate: true })

    onUnmounted(stop)
}
