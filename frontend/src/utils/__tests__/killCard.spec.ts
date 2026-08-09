import { describe, expect, it } from 'vitest'
import { KILL_TIERS, killTier, isBragworthy, buildKillMeta, newKillCode, MIN_BRAG_STACK } from '../killCard'

describe('killTier', () => {
    it('maps each stack size to the largest tier it clears', () => {
        expect(killTier(2)).toBe('2')
        expect(killTier(4)).toBe('4')
        expect(killTier(6)).toBe('6')
        expect(killTier(10)).toBe('10')
        expect(killTier(12)).toBe('12')
        expect(killTier(16)).toBe('16')
        expect(killTier(20)).toBe('20')
        expect(killTier(26)).toBe('26plus')
    })

    it('rounds down to the nearest tier between thresholds', () => {
        expect(killTier(3)).toBe('2')
        expect(killTier(9)).toBe('6')
        expect(killTier(15)).toBe('12')
        expect(killTier(19)).toBe('16')
    })

    it('clamps anything past the top tier', () => {
        expect(killTier(40)).toBe('26plus')
        expect(killTier(999)).toBe('26plus')
    })

    it('clamps below the smallest tier rather than returning undefined', () => {
        expect(killTier(0)).toBe('2')
        expect(killTier(1)).toBe('2')
        expect(killTier(-5)).toBe('2')
    })

    it('only ever returns a slug from the published tier list', () => {
        for (let n = -5; n <= 60; n++) {
            expect(KILL_TIERS).toContain(killTier(n))
        }
    })
})

describe('isBragworthy', () => {
    it('rejects stacks nobody would post about', () => {
        expect(isBragworthy(2)).toBe(false)
        expect(isBragworthy(4)).toBe(false)
    })

    it('accepts from the brag threshold up', () => {
        expect(isBragworthy(MIN_BRAG_STACK)).toBe(true)
        expect(isBragworthy(26)).toBe(true)
    })
})

describe('buildKillMeta', () => {
    const base = { dealer: 'shekh', victim: 'Priya', amount: 26, cardsPlayed: 31 }

    it('leads the title with the brag, not the brand', () => {
        const { title } = buildKillMeta(base)
        expect(title.startsWith('shekh stacked +26 on Priya')).toBe(true)
    })

    it('names the game somewhere in the title for context', () => {
        expect(buildKillMeta(base).title).toContain('Open Mercy')
    })

    it('puts the call to action in the description', () => {
        const { description } = buildKillMeta(base)
        expect(description).toContain('31 cards')
        expect(description.toLowerCase()).toContain('free')
    })

    it('truncates absurd usernames so the unfurl stays readable', () => {
        const { title } = buildKillMeta({ ...base, dealer: 'x'.repeat(200) })
        expect(title.length).toBeLessThan(120)
    })

    it('falls back to a neutral noun when a name is blank', () => {
        const { title } = buildKillMeta({ ...base, victim: '   ' })
        expect(title).toContain('someone')
    })

    it('strips control characters out of names', () => {
        const LF = String.fromCharCode(10)
        const TAB = String.fromCharCode(9)
        const { title } = buildKillMeta({ ...base, dealer: `ev${LF}il${TAB}one` })
        expect(title).toContain('evilone')
        expect([...title].every((ch) => ch.charCodeAt(0) >= 32)).toBe(true)
    })
})

describe('newKillCode', () => {
    it('produces a code the /k/ route will accept', () => {
        for (let i = 0; i < 50; i++) {
            expect(newKillCode()).toMatch(/^[a-f0-9]{12}$/)
        }
    })

    it('does not repeat across a large batch', () => {
        const codes = new Set(Array.from({ length: 2000 }, () => newKillCode()))
        expect(codes.size).toBe(2000)
    })
})
