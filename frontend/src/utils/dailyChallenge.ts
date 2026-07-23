/**
 * Daily challenge local record — one scored attempt per local day.
 * The server-side row rides the normal game_results insert with
 * game_id = daily-YYYY-MM-DD; this module only remembers whether TODAY's
 * attempt happened on this device so the lobby card can gate and display it.
 */

import { localDateString } from './seededRng'

const KEY = 'uno_daily_v1'

export interface DailyRecord {
    date: string
    result: 'won' | 'lost' | 'eliminated'
    turns: number
}

/** Today's record, or null if the player hasn't played today's deal here. */
export function getDailyRecord(): DailyRecord | null {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return null
        const rec = JSON.parse(raw) as DailyRecord
        return rec.date === localDateString() ? rec : null
    } catch {
        return null
    }
}

export function markDailyDone(rec: DailyRecord): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(rec))
    } catch { /* localStorage disabled or quota */ }
}
