/**
 * The two awkward parts of the Google OAuth round-trip.
 *
 * Both are pure so they can be tested without touching the Supabase client
 * (which throws at import time when env is unset — see CLAUDE.md "Tests").
 */

/**
 * Point the authorize navigation at Supabase directly, never at the proxy.
 *
 * `supabase-proxy` forwards with `redirect: 'follow'`, so a top-level navigation
 * to its /auth/v1/authorize makes the worker chase Supabase's 302 to Google and
 * return Google's sign-in HTML from the worker's own origin — a login that can
 * never complete. Swapping the origin back keeps that one hop off the proxy;
 * the PKCE token exchange afterwards still runs on the client's configured URL.
 *
 * A no-op when no proxy is configured, since the two origins are then identical.
 */
export function directAuthorizeUrl(authorizeUrl: string, directSupabaseUrl?: string): string {
    if (!directSupabaseUrl) return authorizeUrl
    try {
        const direct = new URL(directSupabaseUrl)
        const target = new URL(authorizeUrl)
        target.protocol = direct.protocol
        target.host = direct.host
        return target.toString()
    } catch {
        // A malformed env value must not cost us the login — the proxied URL at
        // least reaches Supabase for anyone not behind an ISP block.
        return authorizeUrl
    }
}

export interface OAuthRedirectError {
    /** `identity_already_exists` is the one we act on: that Google account is already a player. */
    code: string
    message: string
}

/**
 * Read an OAuth failure off the URL we were sent back to.
 *
 * `linkIdentity()` navigates away, so a collision never surfaces as a rejected
 * promise at the call site — it comes back as error params on the return trip.
 * GoTrue puts them in the query string for the PKCE flow and in the fragment for
 * the implicit one, so check both.
 */
export function readOAuthError(search: string, hash: string): OAuthRedirectError | null {
    for (const raw of [search, hash]) {
        const params = new URLSearchParams(raw.replace(/^[?#]/, ''))
        const code = params.get('error_code') || params.get('error')
        if (!code) continue
        return { code, message: params.get('error_description') || code }
    }
    return null
}

const ERROR_PARAMS = ['error', 'error_code', 'error_description']

/**
 * The same URL with only the OAuth error params removed.
 *
 * Deliberately surgical rather than resetting to the bare path: `?join=<code>`
 * carries multiplayer invites (read in App.vue), so blanking the query string to
 * tidy up an error would silently eat someone's invite link.
 */
export function urlWithoutOAuthError(loc: { pathname: string; search: string }): string {
    const params = new URLSearchParams(loc.search.replace(/^\?/, ''))
    for (const key of ERROR_PARAMS) params.delete(key)
    const query = params.toString()
    return query ? `${loc.pathname}?${query}` : loc.pathname
}
