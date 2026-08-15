import { describe, it, expect } from 'vitest'
import { relativeTime, isOnline, ONLINE_WINDOW_MS } from '../relativeTime'

const NOW = new Date('2026-08-15T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('relativeTime', () => {
    it('counts up through the units', () => {
        expect(relativeTime(ago(30_000), NOW)).toBe('30 seconds ago')
        expect(relativeTime(ago(5 * 60_000), NOW)).toBe('5 minutes ago')
        expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe('3 hours ago')
        expect(relativeTime(ago(4 * 86_400_000), NOW)).toBe('4 days ago')
        expect(relativeTime(ago(3 * 7 * 86_400_000), NOW)).toBe('3 weeks ago')
        expect(relativeTime(ago(60 * 86_400_000), NOW)).toBe('2 months ago')
        expect(relativeTime(ago(800 * 86_400_000), NOW)).toBe('2 years ago')
    })

    it('never says "yesterday", so the label stays grammatical', () => {
        // numeric: 'auto' would return "yesterday" here.
        expect(relativeTime(ago(86_400_000), NOW)).toBe('1 day ago')
    })

    it('reads a future timestamp forwards', () => {
        expect(relativeTime(new Date(NOW + 5 * 60_000), NOW)).toBe('in 5 minutes')
    })

    it('returns nothing for a missing or unusable value', () => {
        expect(relativeTime(null, NOW)).toBe('')
        expect(relativeTime(undefined, NOW)).toBe('')
        expect(relativeTime('not a date', NOW)).toBe('')
    })
})

describe('isOnline', () => {
    it('holds for one missed heartbeat, then drops', () => {
        expect(isOnline(ago(0), NOW)).toBe(true)
        expect(isOnline(ago(ONLINE_WINDOW_MS - 1_000), NOW)).toBe(true)
        expect(isOnline(ago(ONLINE_WINDOW_MS + 1_000), NOW)).toBe(false)
    })

    it('treats a player who never checked in as offline', () => {
        expect(isOnline(null, NOW)).toBe(false)
        expect(isOnline('not a date', NOW)).toBe(false)
    })
})
