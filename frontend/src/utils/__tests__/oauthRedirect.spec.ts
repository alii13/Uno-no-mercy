import { describe, expect, it } from 'vitest'
import { directAuthorizeUrl, readOAuthError, urlWithoutOAuthError } from '../oauthRedirect'

const PROXY = 'https://uno-supabase-proxy.shekhaliul44.workers.dev'
const DIRECT = 'https://djzqoccutacfueuadflw.supabase.co'

describe('directAuthorizeUrl', () => {
    it('moves the authorize hop off the proxy onto the real Supabase host', () => {
        const out = directAuthorizeUrl(`${PROXY}/auth/v1/authorize?provider=google`, DIRECT)
        expect(out).toBe(`${DIRECT}/auth/v1/authorize?provider=google`)
    })

    it('preserves the path and every query param', () => {
        const query = 'provider=google&code_challenge=abc123&code_challenge_method=s256&redirect_to=https%3A%2F%2Fopen-mercy.com'
        const out = new URL(directAuthorizeUrl(`${PROXY}/auth/v1/authorize?${query}`, DIRECT))
        expect(out.pathname).toBe('/auth/v1/authorize')
        expect(out.searchParams.get('provider')).toBe('google')
        expect(out.searchParams.get('code_challenge')).toBe('abc123')
        expect(out.searchParams.get('redirect_to')).toBe('https://open-mercy.com')
    })

    it('is a no-op when no proxy is configured and the URL is already direct', () => {
        const url = `${DIRECT}/auth/v1/authorize?provider=google`
        expect(directAuthorizeUrl(url, DIRECT)).toBe(url)
    })

    it('leaves the URL alone when the direct host is unknown', () => {
        const url = `${PROXY}/auth/v1/authorize?provider=google`
        expect(directAuthorizeUrl(url, undefined)).toBe(url)
        expect(directAuthorizeUrl(url, '')).toBe(url)
    })

    it('falls back to the given URL rather than throwing on a malformed env value', () => {
        const url = `${PROXY}/auth/v1/authorize?provider=google`
        expect(directAuthorizeUrl(url, 'not a url')).toBe(url)
    })
})

describe('readOAuthError', () => {
    it('finds the identity collision in the query string (PKCE flow)', () => {
        const err = readOAuthError(
            '?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user',
            '',
        )
        expect(err?.code).toBe('identity_already_exists')
        expect(err?.message).toBe('Identity is already linked to another user')
    })

    it('finds it in the fragment too (implicit flow)', () => {
        const err = readOAuthError('', '#error_code=identity_already_exists&error_description=nope')
        expect(err?.code).toBe('identity_already_exists')
    })

    it('returns null for a clean return trip', () => {
        expect(readOAuthError('?code=abc123', '')).toBeNull()
        expect(readOAuthError('', '')).toBeNull()
    })

    it('still reports unrecognised failures so they are not swallowed', () => {
        const err = readOAuthError('?error=access_denied', '')
        expect(err?.code).toBe('access_denied')
        // No description supplied — fall back to the code rather than an empty string.
        expect(err?.message).toBe('access_denied')
    })
})

describe('urlWithoutOAuthError', () => {
    it('strips the error params', () => {
        const out = urlWithoutOAuthError({
            pathname: '/',
            search: '?error=server_error&error_code=identity_already_exists&error_description=nope',
        })
        expect(out).toBe('/')
    })

    it('keeps a multiplayer invite code that shares the query string', () => {
        const out = urlWithoutOAuthError({
            pathname: '/',
            search: '?join=ABCD&error_code=identity_already_exists',
        })
        expect(out).toBe('/?join=ABCD')
    })

    it('leaves a clean URL untouched', () => {
        expect(urlWithoutOAuthError({ pathname: '/leaderboard', search: '' })).toBe('/leaderboard')
    })
})
