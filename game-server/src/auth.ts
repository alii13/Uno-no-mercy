/// <reference types="@cloudflare/workers-types" />

export interface AuthEnv {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
}

/**
 * Verify a Supabase access token by introspection against the auth server.
 * The project signs tokens with the legacy HS256 scheme (no public JWKS), so
 * asking Supabase is the zero-secret, revocation-aware way to validate. Joins
 * are rare enough that one HTTP round trip per auth frame is fine.
 */
export async function verifySupabaseToken(token: string, env: AuthEnv): Promise<{ userId: string } | null> {
    if (!token) return null
    const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
            Authorization: `Bearer ${token}`,
            apikey: env.SUPABASE_ANON_KEY,
        },
    })
    if (!res.ok) return null
    const user = await res.json<{ id?: string }>()
    return user?.id ? { userId: user.id } : null
}
