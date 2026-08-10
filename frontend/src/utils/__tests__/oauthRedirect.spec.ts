import { describe, expect, it } from 'vitest'
import { readOAuthError, urlWithoutOAuthError } from '../oauthRedirect'

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
