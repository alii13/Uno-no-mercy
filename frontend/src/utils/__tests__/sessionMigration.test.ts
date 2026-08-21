import { describe, expect, it } from 'vitest'
import { migrateLegacySession } from '../sessionMigration'

const LEGACY = 'sb-uno-supabase-proxy-auth-token'
const CURRENT = 'sb-djzqoccutacfueuadflw-auth-token'

function fakeStorage(init: Record<string, string> = {}) {
    const m = new Map(Object.entries(init))
    return {
        getItem: (k: string) => m.get(k) ?? null,
        setItem: (k: string, v: string) => { m.set(k, v) },
        has: (k: string) => m.has(k),
        get: (k: string) => m.get(k),
    }
}

describe('legacy session migration', () => {
    it('copies the proxy-era session when the direct key is empty', () => {
        const s = fakeStorage({ [LEGACY]: '{"access_token":"t"}' })
        migrateLegacySession(s)
        expect(s.get(CURRENT)).toBe('{"access_token":"t"}')
    })

    it('never overwrites an existing direct-key session', () => {
        const s = fakeStorage({ [LEGACY]: 'old', [CURRENT]: 'new' })
        migrateLegacySession(s)
        expect(s.get(CURRENT)).toBe('new')
    })

    it('does nothing when there is no legacy session', () => {
        const s = fakeStorage()
        migrateLegacySession(s)
        expect(s.has(CURRENT)).toBe(false)
    })

    it('swallows storage errors', () => {
        const s = { getItem: () => { throw new Error('private mode') }, setItem: () => {} }
        expect(() => migrateLegacySession(s as never)).not.toThrow()
    })
})
