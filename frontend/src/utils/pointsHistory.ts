/**
 * Cumulative points over time for the climb chart. Same weights as the badge
 * ladder (POINT_WEIGHTS), including the per-distinct-day bonus, so the final
 * cumulative equals the player's badge points.
 *
 * Kept self-contained (its own minimal row shape) so it never has to chase the
 * ResultRow type between modules.
 */

import { POINT_WEIGHTS } from './badges'

export interface HistoryRow {
    result: 'won' | 'lost' | 'eliminated' | 'abandoned'
    cards_played_total: number
    draw_cards_played: number
    biggest_stack_survived: number
    uno_calls: number
    played_at: string
}

export interface TimePoint {
    time: number
    points: number
}

export type Bucket = 'day' | 'week' | 'month'

export interface ChartPoint {
    label: string
    points: number
}

const MIN_PLAYS = 5

/** Cumulative points after each game, oldest first. */
export function pointsTimeline(rows: HistoryRow[]): TimePoint[] {
    const sorted = rows
        .map(r => ({ r, t: r.played_at ? Date.parse(r.played_at) : NaN }))
        .filter(x => !Number.isNaN(x.t))
        .sort((a, b) => a.t - b.t)

    const days = new Set<string>()
    let cum = 0
    const out: TimePoint[] = []
    for (const { r, t } of sorted) {
        const real = r.cards_played_total >= MIN_PLAYS
        let add = 0
        if (r.result === 'won' && real) add += POINT_WEIGHTS.win
        else if ((r.result === 'lost' || r.result === 'eliminated') && real) add += POINT_WEIGHTS.completedLoss
        add += Math.max(0, r.draw_cards_played) * POINT_WEIGHTS.drawCard
        add += Math.max(0, r.biggest_stack_survived) * POINT_WEIGHTS.stackSurvived
        add += Math.max(0, r.uno_calls) * POINT_WEIGHTS.unoCall
        const day = r.played_at.slice(0, 10)
        if (!days.has(day)) {
            days.add(day)
            add += POINT_WEIGHTS.dayPlayed
        }
        cum += add
        out.push({ time: t, points: cum })
    }
    return out
}

function bucketKey(time: number, bucket: Bucket): string {
    const d = new Date(time)
    if (bucket === 'day') return d.toISOString().slice(0, 10)
    if (bucket === 'month') return d.toISOString().slice(0, 7)
    // Week keyed to its Monday (UTC), matching the UTC dates used elsewhere.
    const mondayOffset = (d.getUTCDay() + 6) % 7
    const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset))
    return monday.toISOString().slice(0, 10)
}

function labelFor(key: string, bucket: Bucket): string {
    if (bucket === 'month') {
        return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    }
    return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Collapse the cumulative timeline into one point per bucket (its end value),
 *  keeping the most recent `maxBuckets`. The series stays monotonic. */
export function bucketTimeline(timeline: TimePoint[], bucket: Bucket, maxBuckets: number): ChartPoint[] {
    const byBucket = new Map<string, number>()
    for (const p of timeline) {
        // Timeline is sorted ascending, so a later game overwrites with the
        // higher cumulative while the Map keeps the bucket's first position.
        byBucket.set(bucketKey(p.time, bucket), p.points)
    }
    const entries = [...byBucket.entries()].slice(-maxBuckets)
    return entries.map(([key, points]) => ({ label: labelFor(key, bucket), points }))
}
