/**
 * One-time session-key migration for the proxy retirement (PR #162).
 *
 * supabase-js derives its localStorage key from the client URL's first
 * hostname label. The proxy-era client stored sessions under the proxy's
 * name; the direct client looks under the project ref and finds nothing,
 * which signs every pre-cutover player out - guests permanently, since a
 * guest identity cannot be signed back into. The stored token is valid
 * either way (the proxy was a pass-through to the same project), so copying
 * it across resumes the session as if nothing happened.
 *
 * The copy only fills an empty slot: a player who already minted a new
 * identity after the cutover keeps it, so no post-cutover games are ever
 * stranded. The legacy key is left in place as the rollback artifact.
 */

const LEGACY_KEY = 'sb-uno-supabase-proxy-auth-token'
const CURRENT_KEY = 'sb-djzqoccutacfueuadflw-auth-token'

interface KeyValueStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export function migrateLegacySession(storage: KeyValueStorage): void {
    try {
        if (storage.getItem(CURRENT_KEY) !== null) return
        const legacy = storage.getItem(LEGACY_KEY)
        if (legacy !== null) storage.setItem(CURRENT_KEY, legacy)
    } catch { /* private mode or blocked storage - nothing to migrate */ }
}
