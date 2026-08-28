/**
 * Personal bests off the player's own game history.
 *
 * Speed and efficiency records need the walkover guard: when every opponent
 * leaves, the game records seconds and almost no cards played, and would own
 * both records forever. `cards_played_total >= MIN_PLAYS` is the same filter
 * the points formula, the SQL definer functions, and the achievements use.
 */

import { MIN_PLAYS } from './badges'
import type { ResultRow } from './gameStats'

export interface PersonalRecords {
    /** Shortest won game in seconds, or null before the first real win. */
    fastestWinSecs: number | null
    /** Fewest cards played in a won game, or null before the first real win. */
    leanestWinCards: number | null
}

export function personalRecords(rows: ResultRow[]): PersonalRecords {
    let fastestWinSecs: number | null = null
    let leanestWinCards: number | null = null

    for (const r of rows) {
        if (r.result !== 'won' || r.cards_played_total < MIN_PLAYS) continue
        if (fastestWinSecs === null || r.game_duration_secs < fastestWinSecs) {
            fastestWinSecs = r.game_duration_secs
        }
        if (leanestWinCards === null || r.cards_played_total < leanestWinCards) {
            leanestWinCards = r.cards_played_total
        }
    }

    return { fastestWinSecs, leanestWinCards }
}
