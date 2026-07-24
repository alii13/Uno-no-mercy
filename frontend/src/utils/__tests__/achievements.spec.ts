import { describe, expect, it } from 'vitest'
import { earnedAchievements, type ResultRow } from '../achievements'

function row(over: Partial<ResultRow> = {}): ResultRow {
    return {
        result: 'lost', game_id: 'bot-1', cards_remaining: 3, peak_cards: 8,
        draw_cards_played: 2, wild_cards_played: 1, cards_played_total: 25,
        skips_dealt: 1, swaps_made: 0, draws_taken: 10, biggest_stack_survived: 4,
        uno_calls: 1, uno_penalties: 0, game_duration_secs: 300,
        is_bot_game: true, played_at: '2026-07-24T00:00:00Z',
        ...over,
    }
}

const ids = (rows: ResultRow[]) => earnedAchievements(rows).map(a => a.id)

describe('achievements', () => {
    it('a single loss earns only First Blood', () => {
        expect(ids([row()])).toEqual(['first_blood'])
    })

    it('single-game feats trigger on their thresholds', () => {
        const earned = ids([row({ result: 'won', biggest_stack_survived: 16, peak_cards: 20, cards_played_total: 18, game_duration_secs: 80 })])
        expect(earned).toContain('first_win')
        expect(earned).toContain('stack_16')
        expect(earned).toContain('hoarder')
        expect(earned).toContain('comeback')
        expect(earned).toContain('clean_win')
        expect(earned).toContain('speed_demon')
        expect(earned).not.toContain('stack_24')
        expect(earned).not.toContain('dragon')
    })

    it('win streaks count consecutively from oldest to newest', () => {
        // Newest-first order (fetch order): W W L W W W
        const rows = [
            row({ result: 'won' }), row({ result: 'won' }), row({ result: 'lost' }),
            row({ result: 'won' }), row({ result: 'won' }), row({ result: 'won' }),
        ]
        expect(ids(rows)).toContain('hat_trick')
        expect(ids(rows)).not.toContain('pentakill')
    })

    it('lifetime accumulators sum across games', () => {
        const rows = Array.from({ length: 10 }, () => row({ draw_cards_played: 10, skips_dealt: 5, uno_calls: 3 }))
        const earned = ids(rows)
        expect(earned).toContain('sadist')
        expect(earned).toContain('executioner')
        expect(earned).toContain('town_crier')
    })

    it('daily devotee counts only daily games', () => {
        const rows = [
            ...Array.from({ length: 5 }, (_, i) => row({ game_id: `daily-2026-07-${10 + i}` })),
            ...Array.from({ length: 5 }, () => row({ game_id: 'bot-99' })),
        ]
        expect(ids(rows)).toContain('daily_devotee')
        expect(ids(rows.slice(1))).not.toContain('daily_devotee')
    })

    it('zero-duration rows never earn Speed Demon', () => {
        expect(ids([row({ result: 'won', game_duration_secs: 0 })])).not.toContain('speed_demon')
    })
})
