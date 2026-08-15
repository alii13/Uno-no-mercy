import { describe, it, expect } from 'vitest'
import {
    relativeTime, isOnline, presenceState, presenceLabel, byPresence,
    ONLINE_WINDOW_MS, RECENT_WINDOW_MS,
} from '../relativeTime'

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

describe('presenceState', () => {
    it('separates here, just left, and gone', () => {
        expect(presenceState(ago(0), NOW)).toBe('online')
        expect(presenceState(ago(ONLINE_WINDOW_MS - 1_000), NOW)).toBe('online')
        // The middle state is the point: five minutes ago is still worth an invite.
        expect(presenceState(ago(5 * 60_000), NOW)).toBe('recent')
        expect(presenceState(ago(RECENT_WINDOW_MS - 1_000), NOW)).toBe('recent')
        expect(presenceState(ago(RECENT_WINDOW_MS + 1_000), NOW)).toBe('offline')
    })

    it('treats a player who never checked in as offline', () => {
        expect(presenceState(null, NOW)).toBe('offline')
        expect(presenceState('not a date', NOW)).toBe('offline')
    })
})

describe('presenceLabel', () => {
    it('says one word when they are here, and when otherwise', () => {
        expect(presenceLabel(ago(30_000), NOW)).toBe('Online')
        expect(presenceLabel(ago(6 * 60_000), NOW)).toBe('Last seen 6 minutes ago')
        expect(presenceLabel(ago(3 * 3_600_000), NOW)).toBe('Last seen 3 hours ago')
    })

    it('does not invent a time for a player who never checked in', () => {
        expect(presenceLabel(null, NOW)).toBe('Offline')
    })
})

describe('byPresence', () => {
    const row = (username: string, ms: number | null) =>
        ({ username, last_seen_at: ms === null ? null : ago(ms) })

    it('puts whoever can play now at the top', () => {
        const ordered = byPresence([
            row('GONE', 3 * 86_400_000),
            row('NEVER', null),
            row('HERE', 10_000),
            row('JUST LEFT', 6 * 60_000),
        ], NOW)
        expect(ordered.map(r => r.username)).toEqual(['HERE', 'JUST LEFT', 'GONE', 'NEVER'])
    })

    it('breaks ties on who was seen most recently', () => {
        const ordered = byPresence([
            row('OLDER', 4 * 86_400_000),
            row('NEWER', 1 * 86_400_000),
        ], NOW)
        expect(ordered.map(r => r.username)).toEqual(['NEWER', 'OLDER'])
    })

    it('leaves the caller\'s array alone', () => {
        const rows = [row('HERE', 10_000), row('GONE', 86_400_000)]
        const before = rows.map(r => r.username)
        byPresence(rows, NOW)
        expect(rows.map(r => r.username)).toEqual(before)
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
