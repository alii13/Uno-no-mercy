/**
 * Bot personalities.
 *
 * The old bot was one flat policy: pick a random playable card, prefer a
 * special if one is available, catch a missed MERCY 70% of the time. Every
 * opponent in the game played identically, so solo had no progression and no
 * reason to come back.
 *
 * A profile is four dials rather than a subclass, because the interesting
 * differences are tendencies, not rules. Two bots with the same dials at
 * different settings feel genuinely unlike each other across a whole game
 * without either playing "wrong".
 *
 * Everything here is a pure function of (state, profile, rng). That is what
 * lets the daily challenge stay reproducible: same seed plus same pinned
 * profile gives the same game on every device, forever.
 */

import type { Card, CardColor, Player } from './types'
import { getDrawValue } from './rules'

export interface BotProfile {
    id: string
    name: string
    /** Leans on draw and skip cards rather than shedding numbers. */
    aggression: number
    /** Holds wilds back for when they are needed instead of dumping them. */
    wildDiscipline: number
    /** Chance of catching an opponent who forgot to call MERCY. */
    catchRate: number
    /** Chance of aiming a swap or a stack at the player who is winning. */
    targeting: number
}

/**
 * Eight rungs. The dials climb together but not in lockstep — a ladder where
 * every opponent is strictly "the last one but better" is a difficulty slider
 * wearing eight names.
 */
export const BOT_LADDER: BotProfile[] = [
    { id: 'scrap',      name: 'Scrap',      aggression: 0.15, wildDiscipline: 0.05, catchRate: 0.15, targeting: 0.0 },
    { id: 'pilot',      name: 'Pilot',      aggression: 0.30, wildDiscipline: 0.20, catchRate: 0.35, targeting: 0.0 },
    { id: 'vera',       name: 'Vera',       aggression: 0.20, wildDiscipline: 0.65, catchRate: 0.50, targeting: 0.2 },
    { id: 'rook',       name: 'Rook',       aggression: 0.55, wildDiscipline: 0.45, catchRate: 0.55, targeting: 0.5 },
    { id: 'marla',      name: 'Marla',      aggression: 0.75, wildDiscipline: 0.35, catchRate: 0.65, targeting: 0.6 },
    { id: 'kobra',      name: 'Kobra',      aggression: 0.85, wildDiscipline: 0.60, catchRate: 0.75, targeting: 0.75 },
    { id: 'zenith',     name: 'Zenith',     aggression: 0.70, wildDiscipline: 0.90, catchRate: 0.85, targeting: 0.85 },
    { id: 'terminator', name: 'Terminator', aggression: 0.90, wildDiscipline: 0.85, catchRate: 0.95, targeting: 1.0 },
]

/**
 * The daily challenge pins this one by id, never by ladder position. Everyone
 * in the world must face the same opponent on the same deal, so it can never
 * depend on what a given player has unlocked, and reordering the ladder must
 * not silently change the daily.
 */
export const DAILY_BOT_ID = 'terminator'

export function botById(id: string): BotProfile {
    return BOT_LADDER.find(b => b.id === id) ?? BOT_LADDER[0]!
}

export function dailyBot(): BotProfile {
    return botById(DAILY_BOT_ID)
}

export interface BotContext {
    /** Cards the bot may legally play right now. */
    playable: Card[]
    /** Live draw stack — non-zero means a chain is landing on someone. */
    drawStack: number
    /** Opponents still in the game, for targeting decisions. */
    opponents: Player[]
}

/**
 * Which card to play. Returns null when the bot should draw instead.
 *
 * With a stack live, everything wants to pass it on, so the only question is
 * which card does it. Otherwise the profile decides whether to press with a
 * special or shed a number.
 */
export function chooseCard(ctx: BotContext, profile: BotProfile, rng: () => number): Card | null {
    const { playable, drawStack } = ctx
    if (!playable.length) return null

    if (drawStack > 0) {
        // Pass the stack on, and an aggressive bot escalates with the biggest
        // draw it holds rather than the cheapest that happens to be legal.
        const byDraw = [...playable].sort((a, b) => getDrawValue(b) - getDrawValue(a))
        return (rng() < profile.aggression ? byDraw[0] : byDraw[byDraw.length - 1]) ?? playable[0]!
    }

    const specials = playable.filter(c => c.color !== 'wild' && c.type !== 'number')
    const numbers = playable.filter(c => c.type === 'number')

    // Discipline is the chance of NOT spending a wild while a coloured option
    // exists. A disciplined bot keeps them for when it is genuinely stuck.
    const holdWild = rng() < profile.wildDiscipline
    const coloured = [...specials, ...numbers]
    const pool = holdWild && coloured.length ? coloured : playable

    const poolSpecials = pool.filter(c => c.type !== 'number')
    const poolNumbers = pool.filter(c => c.type === 'number')

    if (poolSpecials.length && rng() < profile.aggression) return pick(poolSpecials, rng)
    if (poolNumbers.length) return pick(poolNumbers, rng)
    return pick(pool, rng)
}

/** Who to hit with a swap. Sharper bots aim at whoever is closest to winning. */
export function chooseSwapTarget(ctx: BotContext, profile: BotProfile, rng: () => number): Player | null {
    const alive = ctx.opponents.filter(p => !p.isEliminated)
    if (!alive.length) return null
    if (rng() < profile.targeting) {
        return [...alive].sort((a, b) => a.hand.length - b.hand.length)[0]!
    }
    return pick(alive, rng)
}

/** Whether this bot notices an opponent who failed to call MERCY. */
export function willCatchMercy(profile: BotProfile, rng: () => number): boolean {
    return rng() < profile.catchRate
}

/**
 * Wild colour. A targeting bot picks the colour it holds most of; the rest
 * pick from what they hold at random, which is the old behaviour.
 */
export function chooseWildColor(hand: Card[], profile: BotProfile, rng: () => number): CardColor {
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']
    const counts = colors.map(c => ({ c, n: hand.filter(card => card.color === c).length }))
    const held = counts.filter(x => x.n > 0)
    if (!held.length) return colors[Math.floor(rng() * colors.length)]!
    if (rng() < profile.targeting) {
        return [...held].sort((a, b) => b.n - a.n)[0]!.c
    }
    return held[Math.floor(rng() * held.length)]!.c
}

function pick<T>(list: T[], rng: () => number): T {
    return list[Math.floor(rng() * list.length)]!
}
