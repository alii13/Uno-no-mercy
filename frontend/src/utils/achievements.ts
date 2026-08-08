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

/** Speed/efficiency records require a real game: walkover wins (every
 *  opponent left) record near-zero plays and seconds-long durations.
 *  Mirrored by the filters in supabase/profile-pages.sql. */
const MIN_PLAYS_FOR_RECORD = 5
const realWin = (r: ResultRow) => r.result === 'won' && r.cards_played_total >= MIN_PLAYS_FOR_RECORD

/** Longest run of consecutive wins; rows must be newest-first (the fetch order). */
function bestWinStreak(rows: ResultRow[]): number {
    let best = 0
    let cur = 0
    for (const r of [...rows].reverse()) {
        if (r.result === 'won') { cur++; if (cur > best) best = cur } else cur = 0
    }
    return best
}

/** Tier ladders: one threshold table drives BOTH the row evaluator and the
 *  aggregate mirror, so the two evaluators can't disagree by construction.
 *  Most badges are locked for most players — that's the motivation loop. */
const LADDER_ACHIEVEMENTS: Achievement[] = []
const LADDER_CHECKS: Record<string, (a: ProfileAggregates) => boolean> = {}

function ladder(
    rowStat: (rows: ResultRow[]) => number,
    aggStat: (a: ProfileAggregates) => number,
    tiers: Array<[id: string, title: string, desc: string, threshold: number]>,
): void {
    for (const [id, title, desc, t] of tiers) {
        LADDER_ACHIEVEMENTS.push({ id, title, desc, earned: rows => rowStat(rows) >= t })
        LADDER_CHECKS[id] = a => aggStat(a) >= t
    }
}

const maxOf = (rows: ResultRow[], f: (r: ResultRow) => number) =>
    rows.reduce((m, r) => Math.max(m, f(r)), 0)

ladder(r => wins(r).length, a => a.wins, [
    ['wins_5', 'Blooded', 'Win 5 games', 5],
    ['wins_25', 'Head Taker', 'Win 25 games', 25],
    ['wins_75', 'Feared', 'Win 75 games', 75],
    ['wins_150', 'Tyrant', 'Win 150 games', 150],
    ['wins_200', 'Dread Lord', 'Win 200 games', 200],
    ['wins_250', 'Conqueror', 'Win 250 games', 250],
    ['wins_300', 'Annihilator', 'Win 300 games', 300],
    ['wins_400', 'Immortal', 'Win 400 games', 400],
    ['wins_500', 'God of the Deck', 'Win 500 games', 500],
])

ladder(r => r.length, a => a.games, [
    ['games_10', 'Regular', 'Play 10 games', 10],
    ['games_25', 'Table Fixture', 'Play 25 games', 25],
    ['games_50', 'Veteran', 'Play 50 games', 50],
    ['games_100', 'Century Club', 'Play 100 games', 100],
    ['games_250', 'Grinder', 'Play 250 games', 250],
    ['games_500', 'Lifer', 'Play 500 games', 500],
    ['games_750', 'Obsessed', 'Play 750 games', 750],
    ['games_1000', 'No Life, No Mercy', 'Play 1,000 games', 1000],
])

ladder(bestWinStreak, a => a.best_win_streak, [
    ['streak_7', 'Lucky Seven', 'Win 7 games in a row', 7],
    ['streak_10', 'Unstoppable', 'Win 10 games in a row', 10],
    ['streak_12', 'Dirty Dozen', 'Win 12 games in a row', 12],
    ['streak_15', 'Rampage', 'Win 15 games in a row', 15],
    ['streak_20', 'Untouchable', 'Win 20 games in a row', 20],
    ['streak_25', 'Perfect Storm', 'Win 25 games in a row', 25],
])

ladder(r => maxOf(r, x => x.biggest_stack_survived), a => a.max_stack_survived, [
    ['stack_8', 'Thick Skin', 'Survive a +8 draw stack', 8],
    ['stack_32', 'Iron Wall', 'Survive a +32 draw stack', 32],
    ['stack_40', 'Absorber', 'Survive a +40 draw stack', 40],
    ['stack_48', 'Black Hole', 'Survive a +48 draw stack', 48],
])

ladder(r => maxOf(r, x => x.peak_cards), a => a.max_peak_cards, [
    ['peak_15', 'Heavy Hands', 'Hold 15+ cards in one game', 15],
    ['peak_25', 'Pack Mule', 'Hold 25+ cards in one game', 25],
    ['peak_35', 'Librarian', 'Hold 35+ cards in one game', 35],
    ['peak_40', 'Warehouse', 'Hold 40+ cards in one game', 40],
    ['peak_45', 'Bottomless', 'Hold 45+ cards in one game', 45],
    ['peak_50', 'Half the Deck', 'Hold 50+ cards in one game', 50],
])

ladder(r => maxOf(wins(r), x => x.peak_cards), a => a.max_peak_cards_won, [
    ['comeback_20', 'Lazarus', 'Win after holding 20+ cards', 20],
    ['comeback_25', 'Back from the Dead', 'Win after holding 25+ cards', 25],
    ['comeback_30', 'Miracle Run', 'Win after holding 30+ cards', 30],
])

ladder(r => sum(r, x => x.skips_dealt), a => a.sum_skips, [
    ['skips_100', 'Gatekeeper', 'Deal 100 skips lifetime', 100],
    ['skips_250', 'Traffic Control', 'Deal 250 skips lifetime', 250],
    ['skips_500', 'Time Thief', 'Deal 500 skips lifetime', 500],
    ['skips_1000', 'Denied', 'Deal 1,000 skips lifetime', 1000],
    ['skips_2500', 'Nobody Moves', 'Deal 2,500 skips lifetime', 2500],
])

ladder(r => sum(r, x => x.draw_cards_played), a => a.sum_draw_cards, [
    ['draw_250', 'Dealer of Pain', 'Play 250 draw cards lifetime', 250],
    ['draw_500', 'Card Cannon', 'Play 500 draw cards lifetime', 500],
    ['draw_1000', 'Artillery', 'Play 1,000 draw cards lifetime', 1000],
    ['draw_2500', 'Carpet Bomber', 'Play 2,500 draw cards lifetime', 2500],
    ['draw_5000', 'Avalanche Maker', 'Play 5,000 draw cards lifetime', 5000],
])

ladder(r => sum(r, x => x.wild_cards_played), a => a.sum_wild_cards, [
    ['wild_100', 'Color Bender', 'Play 100 wild cards lifetime', 100],
    ['wild_250', 'Chaos Agent', 'Play 250 wild cards lifetime', 250],
    ['wild_500', 'Reality Bender', 'Play 500 wild cards lifetime', 500],
    ['wild_1000', 'Kaleidoscope', 'Play 1,000 wild cards lifetime', 1000],
    ['wild_2500', 'Rainbow Reaper', 'Play 2,500 wild cards lifetime', 2500],
])

ladder(r => sum(r, x => x.uno_calls), a => a.sum_uno_calls, [
    ['uno_50', 'Loudmouth', 'Call MERCY 50 times lifetime', 50],
    ['uno_100', 'Siren', 'Call MERCY 100 times lifetime', 100],
    ['uno_250', 'Herald', 'Call MERCY 250 times lifetime', 250],
    ['uno_500', 'Battle Cry', 'Call MERCY 500 times lifetime', 500],
    ['uno_1000', 'Voice of War', 'Call MERCY 1,000 times lifetime', 1000],
])

ladder(r => sum(r, x => x.swaps_made), a => a.sum_swaps, [
    ['swap_25', 'Pickpocket', 'Swap hands 25 times lifetime', 25],
    ['swap_50', 'Con Artist', 'Swap hands 50 times lifetime', 50],
    ['swap_100', 'Identity Thief', 'Swap hands 100 times lifetime', 100],
    ['swap_250', 'Grand Swindler', 'Swap hands 250 times lifetime', 250],
    ['swap_500', 'Black Market', 'Swap hands 500 times lifetime', 500],
])

ladder(r => r.filter(x => x.game_id.startsWith('daily-')).length, a => a.daily_played, [
    ['daily_10', 'Habit Forming', 'Play 10 daily challenges', 10],
    ['daily_25', 'Clockwork', 'Play 25 daily challenges', 25],
    ['daily_50', 'Ritualist', 'Play 50 daily challenges', 50],
    ['daily_100', 'Devout', 'Play 100 daily challenges', 100],
    ['daily_200', 'Iron Routine', 'Play 200 daily challenges', 200],
    ['daily_365', 'Year of No Mercy', 'Play 365 daily challenges', 365],
])

ladder(r => maxOf(r, x => x.game_duration_secs), a => a.max_duration, [
    ['marathon_25', 'Siege', 'Finish a 25+ minute game', 1500],
    ['marathon_40', 'Trench War', 'Finish a 40+ minute game', 2400],
    ['marathon_60', 'Forever War', 'Finish a 60+ minute game', 3600],
])

/** Min-stat and two-variable badges need null handling the ladder helper
 *  can't express — each is a hand-written pair, mirrored in LADDER_CHECKS. */
const EXTRA_ACHIEVEMENTS: Achievement[] = [
    { id: 'eff_15', title: 'Scalpel', desc: 'Win playing 15 cards or fewer', earned: r => r.some(x => realWin(x) && x.cards_played_total <= 15) },
    { id: 'eff_10', title: 'Minimalist', desc: 'Win playing 10 cards or fewer', earned: r => r.some(x => realWin(x) && x.cards_played_total <= 10) },
    { id: 'eff_6', title: 'Ghost Hand', desc: 'Win playing 6 cards or fewer', earned: r => r.some(x => realWin(x) && x.cards_played_total <= 6) },
    { id: 'speed_60', title: 'Blitzkrieg', desc: 'Win in under 60 seconds', earned: r => r.some(x => realWin(x) && x.game_duration_secs > 0 && x.game_duration_secs < 60) },
    { id: 'speed_45', title: 'Lightning Round', desc: 'Win in under 45 seconds', earned: r => r.some(x => realWin(x) && x.game_duration_secs > 0 && x.game_duration_secs < 45) },
    { id: 'speed_30', title: 'Blink and Lose', desc: 'Win in under 30 seconds', earned: r => r.some(x => realWin(x) && x.game_duration_secs > 0 && x.game_duration_secs < 30) },
    { id: 'rate_50', title: 'Positive Record', desc: '50%+ win rate over 50 games', earned: r => r.length >= 50 && wins(r).length / r.length >= 0.5 },
    { id: 'rate_60', title: 'Dominant', desc: '60%+ win rate over 100 games', earned: r => r.length >= 100 && wins(r).length / r.length >= 0.6 },
    { id: 'rate_70', title: 'Apex Predator', desc: '70%+ win rate over 100 games', earned: r => r.length >= 100 && wins(r).length / r.length >= 0.7 },
]

Object.assign(LADDER_CHECKS, {
    eff_15: (a: ProfileAggregates) => a.min_cards_won !== null && a.min_cards_won <= 15,
    eff_10: (a: ProfileAggregates) => a.min_cards_won !== null && a.min_cards_won <= 10,
    eff_6: (a: ProfileAggregates) => a.min_cards_won !== null && a.min_cards_won <= 6,
    speed_60: (a: ProfileAggregates) => a.min_duration_won !== null && a.min_duration_won > 0 && a.min_duration_won < 60,
    speed_45: (a: ProfileAggregates) => a.min_duration_won !== null && a.min_duration_won > 0 && a.min_duration_won < 45,
    speed_30: (a: ProfileAggregates) => a.min_duration_won !== null && a.min_duration_won > 0 && a.min_duration_won < 30,
    rate_50: (a: ProfileAggregates) => a.games >= 50 && a.wins / a.games >= 0.5,
    rate_60: (a: ProfileAggregates) => a.games >= 100 && a.wins / a.games >= 0.6,
    rate_70: (a: ProfileAggregates) => a.games >= 100 && a.wins / a.games >= 0.7,
})

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
    { id: 'town_crier', title: 'Town Crier', desc: 'Call MERCY 25 times lifetime', earned: r => sum(r, x => x.uno_calls) >= 25 },
    { id: 'clean_win', title: 'Surgical', desc: 'Win playing 20 cards or fewer', earned: r => r.some(x => realWin(x) && x.cards_played_total <= 20) },
    { id: 'speed_demon', title: 'Speed Demon', desc: 'Win in under 90 seconds', earned: r => r.some(x => realWin(x) && x.game_duration_secs > 0 && x.game_duration_secs < 90) },
    { id: 'marathon', title: 'War of Attrition', desc: 'Finish a 15+ minute game', earned: r => r.some(x => x.game_duration_secs >= 900) },
    { id: 'swap_meet', title: 'Swap Meet', desc: 'Swap hands 10 times lifetime', earned: r => sum(r, x => x.swaps_made) >= 10 },
    { id: 'daily_devotee', title: 'Daily Devotee', desc: 'Play 5 daily challenges', earned: r => r.filter(x => x.game_id.startsWith('daily-')).length >= 5 },
    ...LADDER_ACHIEVEMENTS,
    ...EXTRA_ACHIEVEMENTS,
]

export function earnedAchievements(rows: ResultRow[]): Achievement[] {
    return ACHIEVEMENTS.filter(a => a.earned(rows))
}

/** One row of profile aggregates — the shape public_profile() returns.
 *  Every achievement is expressible from these, so a public badge case
 *  never needs row-level access to someone else's history. */
export interface ProfileAggregates {
    games: number
    wins: number
    best_win_streak: number
    max_stack_survived: number
    max_peak_cards: number
    max_peak_cards_won: number
    min_cards_won: number | null
    min_duration_won: number | null
    max_duration: number
    sum_skips: number
    sum_draw_cards: number
    sum_wild_cards: number
    sum_uno_calls: number
    sum_swaps: number
    daily_played: number
}

const AGGREGATE_CHECKS: Record<string, (a: ProfileAggregates) => boolean> = {
    first_blood: a => a.games >= 1,
    first_win: a => a.wins >= 1,
    hat_trick: a => a.best_win_streak >= 3,
    pentakill: a => a.best_win_streak >= 5,
    ten_wins: a => a.wins >= 10,
    fifty_wins: a => a.wins >= 50,
    hundred_wins: a => a.wins >= 100,
    stack_16: a => a.max_stack_survived >= 16,
    stack_24: a => a.max_stack_survived >= 24,
    hoarder: a => a.max_peak_cards >= 20,
    dragon: a => a.max_peak_cards >= 30,
    comeback: a => a.max_peak_cards_won >= 15,
    executioner: a => a.sum_skips >= 50,
    sadist: a => a.sum_draw_cards >= 100,
    wild_thing: a => a.sum_wild_cards >= 50,
    town_crier: a => a.sum_uno_calls >= 25,
    clean_win: a => a.min_cards_won !== null && a.min_cards_won <= 20,
    speed_demon: a => a.min_duration_won !== null && a.min_duration_won > 0 && a.min_duration_won < 90,
    marathon: a => a.max_duration >= 900,
    swap_meet: a => a.sum_swaps >= 10,
    daily_devotee: a => a.daily_played >= 5,
    ...LADDER_CHECKS,
}

/** Aggregate twin of earnedAchievements — unit-tested to agree with it. */
export function earnedFromAggregates(agg: ProfileAggregates): Achievement[] {
    return ACHIEVEMENTS.filter(a => AGGREGATE_CHECKS[a.id]?.(agg))
}
