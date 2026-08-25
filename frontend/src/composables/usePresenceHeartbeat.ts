/**
 * The presence heartbeat: this player checks in so other screens can say
 * "online now" or "last seen 3 hours ago".
 *
 * The check-in goes through touch_presence(), which stamps now() on the
 * server. The client never sends a time: a browser clock can be wrong, and it
 * can be set on purpose, and either one would decide who looks online.
 *
 * A hidden tab does not beat. A tab left open behind a browser window is not
 * a player anyone can invite, and counting it inflates the live number.
 *
 * Silent and best-effort - presence is a garnish and must never surface an
 * error over the game. A missing function disables the loop for the session;
 * a dropped request does not (see utils/supabaseErrors.ts).
 *
 * start/stop/beat are returned so the rules above can be tested without
 * mounting a component, the same shape useLiveTables uses.
 */

import { watch, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { isFatalSchemaError } from '../utils/supabaseErrors'
import { hasLiveSession } from '../utils/liveSession'

/** One beat a minute. The online window in presence.sql is two, so a single
 *  missed beat never flips a present player to offline. */
const BEAT_MS = 60_000

export function usePresenceHeartbeat() {
    const auth = useAuthStore()
    let timer: ReturnType<typeof setInterval> | null = null
    let disabled = false
    let inFlight = false

    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'

    async function beat() {
        if (disabled || inFlight || !visible() || !auth.isAuthenticated) return
        inFlight = true
        try {
            // touch_presence is granted to `authenticated` only. A beat sent on
            // a stale token runs as `anon` and answers 42501 every minute for
            // as long as the tab stays open.
            if (!(await hasLiveSession())) return
            const { supabase } = await import('../lib/supabase')
            const { error } = await supabase.rpc('touch_presence')
            // Until presence.sql runs, the function does not exist and every
            // beat would fail the same way. Anything else - offline, a 503 -
            // gets another go next minute.
            if (isFatalSchemaError(error)) disabled = true
        } catch {
            /* transient by definition: a thrown fetch says nothing about the schema */
        } finally {
            inFlight = false
        }
    }

    function onVisibility() {
        // Coming back is itself a heartbeat: the player is here again, and
        // waiting up to a minute to say so leaves them looking away.
        if (visible()) void beat()
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

    return { beat, start, stop }
}
