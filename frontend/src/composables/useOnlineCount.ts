/**
 * How many players are on the site right now, read from online_now() in
 * supabase/presence.sql.
 *
 * The surface hides itself below a floor. A true small number is worse than
 * no number: "2 playing now" tells a new player to leave, and the same
 * reasoning already keeps the live-tables strip off the landing page (see
 * useLiveTables.ts). The count returns as soon as there is a crowd to report.
 *
 * Feature-detects like every other definer function: until the SQL is run the
 * rpc errors, `show` stays false, and nothing renders.
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isFatalSchemaError } from '../utils/supabaseErrors'

/** Below this the number discourages more than it invites. */
export const ONLINE_FLOOR = 5

/** The window in presence.sql is two minutes, so a faster poll would only
 *  redraw the same number. */
const POLL_MS = 60_000

export function useOnlineCount() {
    const count = ref(0)
    let timer: ReturnType<typeof setInterval> | null = null
    let disabled = false

    async function refresh() {
        if (disabled) return
        try {
            const { supabase } = await import('../lib/supabase')
            const { data, error } = await supabase.rpc('online_now')
            // Only a missing function is worth giving up on; a dropped
            // request gets another go next poll.
            if (error) { if (isFatalSchemaError(error)) disabled = true; return }
            count.value = typeof data === 'number' ? data : 0
        } catch {
            /* transient - leave the last known number on screen */
        }
    }

    onMounted(() => {
        void refresh()
        // A lobby left open in a background tab asks for a number nobody can
        // see. The heartbeat skips hidden tabs for the same reason.
        timer = setInterval(() => {
            if (document.visibilityState === 'visible') void refresh()
        }, POLL_MS)
    })

    onUnmounted(() => {
        if (timer) clearInterval(timer)
    })

    return {
        count,
        show: computed(() => count.value >= ONLINE_FLOOR),
    }
}
