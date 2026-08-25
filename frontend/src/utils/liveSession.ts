/**
 * Whether the client holds a session good for the request about to go out.
 *
 * supabase-js populates `user` from persisted storage before it has proven the
 * access token still works, so an `auth.uid()`-scoped RPC can leave carrying an
 * expired JWT. PostgREST then runs it as `anon`, the function is granted only to
 * `authenticated`, and Postgres answers 42501. It reads like a permissions bug
 * and is really a timing one.
 *
 * `getSession()` is the fix rather than a `user` check because it does the work:
 * `__loadSession()` in auth-js refreshes when the token is within
 * `EXPIRY_MARGIN_MS` of expiry, and returns `{ session: null, error }` when the
 * refresh token itself is dead. So one call collapses both cases -
 *
 *   - token merely stale: refreshed here, the RPC then succeeds and no error is
 *     ever logged.
 *   - refresh token dead: returns false, and the caller stops instead of
 *     re-issuing a request every 60 s that can only ever fail. Bursts of 22-25
 *     of those an hour are what a tab left open in this state produces.
 *
 * Going quiet is the whole remedy for the dead case, deliberately. There is no
 * useful re-auth to offer a guest: an anonymous identity cannot sign back in, so
 * prompting would only mint a new one and orphan their stats, share code and
 * history - the #162 failure, re-created on purpose.
 *
 * The supabase import stays dynamic so callers that deliberately keep the client
 * out of their chunk (usePresenceHeartbeat) are not forced to load it eagerly.
 * The module is cached after the first call.
 */
export async function hasLiveSession(): Promise<boolean> {
    try {
        const { supabase } = await import('../lib/supabase')
        const { data, error } = await supabase.auth.getSession()
        return !error && !!data.session
    } catch {
        // A thrown fetch says nothing about the session; the caller treats this
        // the same as "not now" and tries again on its own schedule.
        return false
    }
}
