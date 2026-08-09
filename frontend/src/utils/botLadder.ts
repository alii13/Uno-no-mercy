/**
 * Solo progression: beat a bot to unlock the next one.
 *
 * Stored locally, not on the server. A ladder position is a private thing —
 * it drives what the Play-vs-bot button offers and nothing else. There is no
 * leaderboard on it, so there is nothing to cheat and no reason to spend a
 * table on it.
 *
 * The stored value is a set of beaten ids rather than a high-water index, so
 * reordering or inserting a rung later does not silently mark opponents as
 * beaten that the player never faced.
 */

import { BOT_LADDER, type BotProfile } from '@engine/bot'

const KEY = 'uno_bot_ladder_v1'

export function beatenBotIds(): string[] {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
        return []
    }
}

export function recordBotWin(botId: string): void {
    try {
        const beaten = new Set(beatenBotIds())
        beaten.add(botId)
        localStorage.setItem(KEY, JSON.stringify([...beaten]))
    } catch { /* localStorage disabled or quota */ }
}

/**
 * Unlocked through the first rung the player has NOT beaten. Gaps do not
 * unlock anything past them: beating rung 5 by some other route still leaves
 * rung 3 as the wall if rung 2 is unbeaten.
 */
export function unlockedBots(beaten: string[] = beatenBotIds()): BotProfile[] {
    const done = new Set(beaten)
    const out: BotProfile[] = []
    for (const bot of BOT_LADDER) {
        out.push(bot)
        if (!done.has(bot.id)) break
    }
    return out
}

/** The opponent the Play-vs-bot button should offer. */
export function nextBot(beaten: string[] = beatenBotIds()): BotProfile {
    const done = new Set(beaten)
    return BOT_LADDER.find(b => !done.has(b.id)) ?? BOT_LADDER[BOT_LADDER.length - 1]!
}

export function ladderProgress(beaten: string[] = beatenBotIds()): { beaten: number; total: number } {
    const done = new Set(beaten)
    return { beaten: BOT_LADDER.filter(b => done.has(b.id)).length, total: BOT_LADDER.length }
}

export function isLadderComplete(beaten: string[] = beatenBotIds()): boolean {
    const done = new Set(beaten)
    return BOT_LADDER.every(b => done.has(b.id))
}
