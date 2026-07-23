import { describe, expect, it } from 'vitest'
import { seededRng, localDateString } from '../seededRng'

describe('seededRng', () => {
    it('produces the identical sequence for the same seed', () => {
        const a = seededRng('uno-daily-2026-07-24')
        const b = seededRng('uno-daily-2026-07-24')
        const seqA = Array.from({ length: 20 }, () => a())
        const seqB = Array.from({ length: 20 }, () => b())
        expect(seqA).toEqual(seqB)
    })

    it('produces different sequences for different seeds', () => {
        const a = seededRng('uno-daily-2026-07-24')
        const b = seededRng('uno-daily-2026-07-25')
        const seqA = Array.from({ length: 20 }, () => a())
        const seqB = Array.from({ length: 20 }, () => b())
        expect(seqA).not.toEqual(seqB)
    })

    it('stays in [0, 1)', () => {
        const r = seededRng('bounds')
        for (let i = 0; i < 1000; i++) {
            const v = r()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })
})

describe('localDateString', () => {
    it('formats as YYYY-MM-DD', () => {
        expect(localDateString(new Date(2026, 6, 24))).toBe('2026-07-24')
        expect(localDateString(new Date(2026, 0, 3))).toBe('2026-01-03')
    })
})
