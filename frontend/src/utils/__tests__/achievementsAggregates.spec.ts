import { describe, it, expect } from 'vitest'
import {
    ACHIEVEMENTS,
    earnedAchievements,
    earnedFromAggregates,
    type ResultRow,
    type ProfileAggregates,
} from '../achievements'

function row(overrides: Partial<ResultRow>): ResultRow {
    return {
        result: 'lost',
        game_id: 'bot-1',
        cards_remaining: 3,
        peak_cards: 9,
        draw_cards_played: 1,
        wild_cards_played: 1,
        cards_played_total: 25,
        skips_dealt: 1,
        swaps_made: 0,
        draws_taken: 4,
        biggest_stack_survived: 2,
        uno_calls: 1,
        uno_penalties: 0,
        game_duration_secs: 200,
        is_bot_game: true,
        played_at: '2026-07-01T00:00:00Z',
        ...overrides,
    }
}

/** Mirror of the SQL aggregation in supabase/profile-pages.sql — the point
 *  of the agreement test is that rows → aggregates → badges matches
 *  rows → badges for every achievement. Rows must be newest-first. */
function aggregate(rows: ResultRow[]): ProfileAggregates {
    const wonRows = rows.filter(r => r.result === 'won')
    // SQL filters speed/efficiency records to wins with >= 5 cards played
    // (walkover wins aren't records).
    const realWins = wonRows.filter(r => r.cards_played_total >= 5)
    let best = 0
    let cur = 0
    for (const r of [...rows].reverse()) {
        if (r.result === 'won') { cur++; if (cur > best) best = cur } else cur = 0
    }
    const min = (xs: number[]) => (xs.length ? Math.min(...xs) : null)
    const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
    return {
        games: rows.length,
        wins: wonRows.length,
        best_win_streak: best,
        max_stack_survived: max(rows.map(r => r.biggest_stack_survived)),
        max_peak_cards: max(rows.map(r => r.peak_cards)),
        max_peak_cards_won: max(wonRows.map(r => r.peak_cards)),
        min_cards_won: min(realWins.map(r => r.cards_played_total)),
        min_duration_won: min(realWins.filter(r => r.game_duration_secs > 0).map(r => r.game_duration_secs)),
        max_duration: max(rows.map(r => r.game_duration_secs)),
        sum_skips: rows.reduce((s, r) => s + r.skips_dealt, 0),
        sum_draw_cards: rows.reduce((s, r) => s + r.draw_cards_played, 0),
        sum_wild_cards: rows.reduce((s, r) => s + r.wild_cards_played, 0),
        sum_uno_calls: rows.reduce((s, r) => s + r.uno_calls, 0),
        sum_swaps: rows.reduce((s, r) => s + r.swaps_made, 0),
        daily_played: rows.filter(r => r.game_id.startsWith('daily-')).length,
    }
}

function expectAgreement(rows: ResultRow[]) {
    const fromRows = new Set(earnedAchievements(rows).map(a => a.id))
    const fromAgg = new Set(earnedFromAggregates(aggregate(rows)).map(a => a.id))
    expect([...fromAgg].sort()).toEqual([...fromRows].sort())
}

describe('earnedFromAggregates agrees with the row evaluator', () => {
    it('on an empty history', () => {
        expectAgreement([])
    })

    it('on a single loss', () => {
        expectAgreement([row({})])
    })

    it('on a history that earns most badges', () => {
        // newest-first, mirroring the fetch order
        const rows: ResultRow[] = [
            row({ result: 'won', game_id: 'daily-2026-07-10', cards_played_total: 18, game_duration_secs: 80 }),
            row({ result: 'won', peak_cards: 31, biggest_stack_survived: 24 }),
            row({ result: 'won', peak_cards: 16 }),
            row({ result: 'lost', game_duration_secs: 950 }),
            row({ result: 'won', skips_dealt: 50, draw_cards_played: 100, wild_cards_played: 50, uno_calls: 25, swaps_made: 10 }),
            row({ game_id: 'daily-2026-07-05' }),
            row({ game_id: 'daily-2026-07-04' }),
            row({ game_id: 'daily-2026-07-03' }),
            row({ game_id: 'daily-2026-07-02' }),
        ]
        expectAgreement(rows)
    })

    it('on threshold edges (win streak, clean win, speed demon)', () => {
        const rows: ResultRow[] = [
            row({ result: 'won', cards_played_total: 20, game_duration_secs: 89 }),
            row({ result: 'won' }),
            row({ result: 'won' }),
            row({ result: 'lost' }),
            row({ result: 'won' }),
        ]
        expectAgreement(rows)
        // sanity: hat trick earned, pentakill not
        const ids = new Set(earnedFromAggregates(aggregate(rows)).map(a => a.id))
        expect(ids.has('hat_trick')).toBe(true)
        expect(ids.has('pentakill')).toBe(false)
        expect(ids.has('clean_win')).toBe(true)
        expect(ids.has('speed_demon')).toBe(true)
    })

    it('ignores zero-duration wins for speed demon', () => {
        const rows = [row({ result: 'won', game_duration_secs: 0 })]
        expectAgreement(rows)
        const ids = new Set(earnedFromAggregates(aggregate(rows)).map(a => a.id))
        expect(ids.has('speed_demon')).toBe(false)
    })

    it('walkover wins (near-zero cards played) earn no speed or efficiency records', () => {
        // Every opponent left: 4-second "win" with 0 cards played.
        const rows = [row({ result: 'won', cards_played_total: 0, game_duration_secs: 4 })]
        expectAgreement(rows)
        const ids = new Set(earnedFromAggregates(aggregate(rows)).map(a => a.id))
        expect(ids.has('speed_demon')).toBe(false)
        expect(ids.has('clean_win')).toBe(false)
        // The win itself still counts — only the records are gated.
        expect(ids.has('first_win')).toBe(true)
    })

    it('covers every achievement id with at least one earnable path', () => {
        // A maximal history: every badge must be earnable from aggregates.
        const wins = Array.from({ length: 100 }, (_, i) =>
            row({
                result: 'won',
                game_id: i < 5 ? `daily-2026-06-${String(i + 1).padStart(2, '0')}` : `bot-${i}`,
                peak_cards: 31,
                biggest_stack_survived: 24,
                cards_played_total: 18,
                game_duration_secs: i === 0 ? 80 : 1000,
                skips_dealt: 1,
                draw_cards_played: 1,
                wild_cards_played: 1,
                uno_calls: 1,
                swaps_made: 1,
            }))
        const ids = new Set(earnedFromAggregates(aggregate(wins)).map(a => a.id))
        expect(ids.size).toBe(ACHIEVEMENTS.length)
        expectAgreement(wins)
    })
})
