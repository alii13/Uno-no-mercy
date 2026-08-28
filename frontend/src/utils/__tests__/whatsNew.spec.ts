import { describe, it, expect } from 'vitest'
import { newestId, unreadEntries, unreadCount, pendingLoud } from '../whatsNew'
import type { ChangelogEntry } from '../../data/changelog'

function entry(id: string, level: ChangelogEntry['level'] = 'quiet'): ChangelogEntry {
    return { id, level, tag: 'NEW', title: `t-${id}`, body: `b-${id}` }
}

// Newest first, the order changelog.ts is written in.
const ENTRIES: ChangelogEntry[] = [
    entry('2026-08-26', 'loud'),
    entry('2026-08-19'),
    entry('2026-08-12'),
    entry('2026-08-04', 'loud'),
]

describe('newestId', () => {
    it('returns the highest id whatever the array order', () => {
        expect(newestId(ENTRIES)).toBe('2026-08-26')
        expect(newestId([...ENTRIES].reverse())).toBe('2026-08-26')
    })

    it('returns null for an empty changelog', () => {
        expect(newestId([])).toBeNull()
    })
})

describe('unreadEntries', () => {
    it('returns only entries newer than the last seen id', () => {
        expect(unreadEntries(ENTRIES, '2026-08-12').map(e => e.id))
            .toEqual(['2026-08-26', '2026-08-19'])
    })

    it('returns nothing once the newest id has been seen', () => {
        expect(unreadEntries(ENTRIES, '2026-08-26')).toEqual([])
    })

    it('treats a first visit as caught up, not as everything unread', () => {
        // No stored id means the player has never been here. They have no
        // "before" to catch up on, so nothing is new to them.
        expect(unreadEntries(ENTRIES, null)).toEqual([])
    })

    it('handles an id that is older than every entry', () => {
        expect(unreadEntries(ENTRIES, '2026-01-01')).toHaveLength(4)
    })
})

describe('unreadCount', () => {
    it('counts the unread entries', () => {
        expect(unreadCount(ENTRIES, '2026-08-12')).toBe(2)
        expect(unreadCount(ENTRIES, '2026-08-26')).toBe(0)
        expect(unreadCount(ENTRIES, null)).toBe(0)
        expect(unreadCount([], '2026-08-12')).toBe(0)
    })
})

describe('pendingLoud', () => {
    it('returns the newest unread loud entry', () => {
        expect(pendingLoud(ENTRIES, '2026-08-12', [])?.id).toBe('2026-08-26')
    })

    it('ignores quiet entries however new they are', () => {
        const quietOnly = [entry('2026-09-01'), entry('2026-08-30')]
        expect(pendingLoud(quietOnly, '2026-08-01', [])).toBeNull()
    })

    it('returns null once the card has been dismissed', () => {
        expect(pendingLoud(ENTRIES, '2026-08-12', ['2026-08-26'])).toBeNull()
    })

    it('does not fall back to an older loud entry when the newest is dismissed', () => {
        // 2026-08-04 is loud and unread here, but showing a stale card after
        // the player dismissed the current one is nagging, not announcing.
        expect(pendingLoud(ENTRIES, '2026-01-01', ['2026-08-26'])).toBeNull()
    })

    it('shows nothing on a first visit', () => {
        expect(pendingLoud(ENTRIES, null, [])).toBeNull()
    })

    it('shows nothing when everything is read', () => {
        expect(pendingLoud(ENTRIES, '2026-08-26', [])).toBeNull()
    })
})
