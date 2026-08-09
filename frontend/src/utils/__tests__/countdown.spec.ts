import { describe, expect, it } from 'vitest'
import { formatCountdown, msUntilLocalMidnight } from '../countdown'

describe('formatCountdown', () => {
    it('zero-pads every field so the width never jumps as it ticks', () => {
        expect(formatCountdown((5 * 3600 + 6 * 60 + 3) * 1000)).toBe('05:06:03')
    })

    it('renders a full countdown', () => {
        expect(formatCountdown((5 * 3600 + 46 * 60 + 12) * 1000)).toBe('05:46:12')
    })

    it('shows zeroes rather than going negative past midnight', () => {
        expect(formatCountdown(-5000)).toBe('00:00:00')
    })

    it('floors partial seconds instead of rounding up past the hour', () => {
        expect(formatCountdown(3599_999)).toBe('00:59:59')
    })

    it('handles a full day', () => {
        expect(formatCountdown(24 * 3600 * 1000)).toBe('24:00:00')
    })
})

describe('msUntilLocalMidnight', () => {
    it('counts to the next local midnight, not UTC', () => {
        const noon = new Date(2026, 7, 9, 12, 0, 0)
        expect(msUntilLocalMidnight(noon)).toBe(12 * 3600 * 1000)
    })

    it('is a full day at exactly midnight, never zero', () => {
        // Zero would flash "00:00:00" for a whole second at the rollover.
        const midnight = new Date(2026, 7, 9, 0, 0, 0)
        expect(msUntilLocalMidnight(midnight)).toBe(24 * 3600 * 1000)
    })

    it('is always positive', () => {
        for (const h of [0, 1, 11, 12, 23]) {
            expect(msUntilLocalMidnight(new Date(2026, 7, 9, h, 30, 0))).toBeGreaterThan(0)
        }
    })
})
