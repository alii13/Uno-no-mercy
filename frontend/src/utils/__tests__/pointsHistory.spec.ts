import { describe, it, expect } from 'vitest'
import { pointsTimeline, bucketTimeline, type HistoryRow } from '../pointsHistory'

function row(over: Partial<HistoryRow>): HistoryRow {
    return {
        result: 'lost',
        cards_played_total: 20,
        draw_cards_played: 0,
        biggest_stack_survived: 0,
        uno_calls: 0,
        played_at: '2026-07-01T10:00:00Z',
        ...over,
    }
}

describe('pointsTimeline', () => {
    it('accumulates monotonically, oldest first', () => {
        const tl = pointsTimeline([
            row({ result: 'won', played_at: '2026-07-02T10:00:00Z' }),
            row({ result: 'lost', played_at: '2026-07-01T10:00:00Z' }),
        ])
        expect(tl).toHaveLength(2)
        expect(tl[0]!.time).toBeLessThan(tl[1]!.time)
        expect(tl[1]!.points).toBeGreaterThan(tl[0]!.points)
    })

    it('final cumulative matches the weighted sum incl. the distinct-day bonus', () => {
        const rows = [
            row({ result: 'won', cards_played_total: 20, draw_cards_played: 3, biggest_stack_survived: 8, uno_calls: 1, played_at: '2026-07-01T10:00:00Z' }),
            row({ result: 'lost', cards_played_total: 12, played_at: '2026-07-01T22:00:00Z' }), // same day → no new day bonus
            row({ result: 'won', cards_played_total: 20, played_at: '2026-07-03T09:00:00Z' }), // new day
        ]
        // win(100)+3draw(6)+8stack(24)+1mercy(4)+day(25) = 159
        // loss(12) = 12  → 171 (same day, no bonus)
        // win(100)+day(25) = 125 → 296
        const tl = pointsTimeline(rows)
        expect(tl[tl.length - 1]!.points).toBe(296)
    })

    it('walkover games (< 5 cards) add no win/loss points', () => {
        const tl = pointsTimeline([row({ result: 'won', cards_played_total: 2, played_at: '2026-07-01T10:00:00Z' })])
        // no win points, but the day still counts (+25)
        expect(tl[0]!.points).toBe(25)
    })
})

describe('bucketTimeline', () => {
    const tl = [
        { time: Date.parse('2026-07-01T10:00:00Z'), points: 100 },
        { time: Date.parse('2026-07-01T20:00:00Z'), points: 180 }, // same day, higher
        { time: Date.parse('2026-07-08T10:00:00Z'), points: 300 },
    ]

    it('collapses a day to its end value', () => {
        const daily = bucketTimeline(tl, 'day', 30)
        expect(daily).toHaveLength(2)
        expect(daily[0]!.points).toBe(180) // the day's final cumulative
        expect(daily[1]!.points).toBe(300)
    })

    it('groups by week', () => {
        // 2026-07-01 (Wed) and 2026-07-08 (Wed) are different ISO weeks.
        expect(bucketTimeline(tl, 'week', 30)).toHaveLength(2)
    })

    it('keeps only the most recent maxBuckets', () => {
        expect(bucketTimeline(tl, 'day', 1)).toHaveLength(1)
        expect(bucketTimeline(tl, 'day', 1)[0]!.points).toBe(300)
    })
})
