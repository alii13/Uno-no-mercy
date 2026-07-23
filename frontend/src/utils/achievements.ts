/**
 * Achievements — computed from the player's own game_results rows (the same
 * rows the stats dashboard already fetches). No server state: earning is a
 * pure function of history, so badges can never drift from the record.
 */

export interface ResultRow {
    result: 'won' | 'lost' | 'eliminated' | 'abandoned'
    game_id: string
    cards_remaining: number
    peak_cards: number
    draw_cards_played: number
    wild_cards_played: number
    cards_played_total: number
    skips_dealt: number
    swaps_made: number
    draws_taken: number
    biggest_stack_survived: number
    uno_calls: number
    uno_penalties: number
    game_duration_secs: number
    is_bot_game: boolean
    played_at: string
}

export interface Achievement {
    id: string
    title: string
    desc: string
    earned: (rows: ResultRow[]) => boolean
}

const wins = (rows: ResultRow[]) => rows.filter(r => r.result === 'won')
const sum = (rows: ResultRow[], f: (r: ResultRow) => number) => rows.reduce((s, r) => s + f(r), 0)

/** Longest run of consecutive wins; rows must be newest-first (the fetch order). */
function bestWinStreak(rows: ResultRow[]): number {
    let best = 0
    let cur = 0
    for (const r of [...rows].reverse()) {
        if (r.result === 'won') { cur++; if (cur > best) best = cur } else cur = 0
    }
    return best
}

export const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_blood', title: 'First Blood', desc: 'Finish your first game', earned: r => r.length >= 1 },
    { id: 'first_win', title: 'On the Board', desc: 'Win a game', earned: r => wins(r).length >= 1 },
    { id: 'hat_trick', title: 'Hat Trick', desc: 'Win 3 games in a row', earned: r => bestWinStreak(r) >= 3 },
    { id: 'pentakill', title: 'Pentakill', desc: 'Win 5 games in a row', earned: r => bestWinStreak(r) >= 5 },
    { id: 'ten_wins', title: 'Enforcer Material', desc: 'Win 10 games', earned: r => wins(r).length >= 10 },
    { id: 'fifty_wins', title: 'Warlord Rising', desc: 'Win 50 games', earned: r => wins(r).length >= 50 },
    { id: 'hundred_wins', title: 'Overlord', desc: 'Win 100 games', earned: r => wins(r).length >= 100 },
    { id: 'stack_16', title: 'Stack Survivor', desc: 'Survive a +16 draw stack', earned: r => r.some(x => x.biggest_stack_survived >= 16) },
    { id: 'stack_24', title: 'Unbreakable', desc: 'Survive a +24 draw stack', earned: r => r.some(x => x.biggest_stack_survived >= 24) },
    { id: 'hoarder', title: 'Card Hoarder', desc: 'Hold 20+ cards in one game', earned: r => r.some(x => x.peak_cards >= 20) },
    { id: 'dragon', title: 'Dragon\'s Nest', desc: 'Hold 30+ cards in one game', earned: r => r.some(x => x.peak_cards >= 30) },
    { id: 'comeback', title: 'Comeback Kid', desc: 'Win after holding 15+ cards', earned: r => r.some(x => x.result === 'won' && x.peak_cards >= 15) },
    { id: 'executioner', title: 'Executioner', desc: 'Deal 50 skips lifetime', earned: r => sum(r, x => x.skips_dealt) >= 50 },
    { id: 'sadist', title: 'No Mercy Indeed', desc: 'Play 100 draw cards lifetime', earned: r => sum(r, x => x.draw_cards_played) >= 100 },
    { id: 'wild_thing', title: 'Wild Thing', desc: 'Play 50 wild cards lifetime', earned: r => sum(r, x => x.wild_cards_played) >= 50 },
    { id: 'town_crier', title: 'Town Crier', desc: 'Call UNO 25 times lifetime', earned: r => sum(r, x => x.uno_calls) >= 25 },
    { id: 'clean_win', title: 'Surgical', desc: 'Win playing 20 cards or fewer', earned: r => r.some(x => x.result === 'won' && x.cards_played_total <= 20) },
    { id: 'speed_demon', title: 'Speed Demon', desc: 'Win in under 90 seconds', earned: r => r.some(x => x.result === 'won' && x.game_duration_secs > 0 && x.game_duration_secs < 90) },
    { id: 'marathon', title: 'War of Attrition', desc: 'Finish a 15+ minute game', earned: r => r.some(x => x.game_duration_secs >= 900) },
    { id: 'swap_meet', title: 'Swap Meet', desc: 'Swap hands 10 times lifetime', earned: r => sum(r, x => x.swaps_made) >= 10 },
    { id: 'daily_devotee', title: 'Daily Devotee', desc: 'Play 5 daily challenges', earned: r => r.filter(x => x.game_id.startsWith('daily-')).length >= 5 },
]

export function earnedAchievements(rows: ResultRow[]): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.earned(rows))
}
