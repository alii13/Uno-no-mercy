import { describe, it, expect } from 'vitest'
import { flagEmoji, usableCountry } from '../country'

describe('flagEmoji', () => {
    it('renders ISO alpha-2 as regional-indicator flags', () => {
        expect(flagEmoji('IN')).toBe('🇮🇳')
        expect(flagEmoji('us')).toBe('🇺🇸')
        expect(flagEmoji('Br')).toBe('🇧🇷')
    })

    it('returns empty for missing or malformed codes', () => {
        expect(flagEmoji(null)).toBe('')
        expect(flagEmoji(undefined)).toBe('')
        expect(flagEmoji('')).toBe('')
        expect(flagEmoji('IND')).toBe('')
        expect(flagEmoji('1N')).toBe('')
    })
})

describe('usableCountry', () => {
    it('accepts real alpha-2 codes uppercased', () => {
        expect(usableCountry('in')).toBe('IN')
        expect(usableCountry('US')).toBe('US')
    })

    it("rejects Cloudflare's non-country sentinels and junk", () => {
        expect(usableCountry('XX')).toBeNull()
        expect(usableCountry('T1')).toBeNull()
        expect(usableCountry('USA')).toBeNull()
        expect(usableCountry(null)).toBeNull()
        expect(usableCountry(undefined)).toBeNull()
    })
})
