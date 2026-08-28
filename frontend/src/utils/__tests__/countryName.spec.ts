import { describe, it, expect } from 'vitest'
import { countryName } from '../countryName'

describe('countryName', () => {
    it('names a country from its ISO alpha-2 code', () => {
        expect(countryName('IN')).toBe('India')
        expect(countryName('BR')).toBe('Brazil')
    })

    it('accepts lower case', () => {
        expect(countryName('ph')).toBe('Philippines')
    })

    it('falls back to the code itself when it names nothing', () => {
        // QQ and ZX are unassigned. ZZ is not — CLDR names it "Unknown
        // Region" — so it is not a fallback case.
        expect(countryName('QQ')).toBe('QQ')
        expect(countryName('ZX')).toBe('ZX')
    })

    it('returns an empty string for a missing or malformed code', () => {
        expect(countryName(null)).toBe('')
        expect(countryName(undefined)).toBe('')
        expect(countryName('')).toBe('')
        expect(countryName('IND')).toBe('')
        expect(countryName('1N')).toBe('')
    })
})
