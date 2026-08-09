import { describe, expect, it } from 'vitest'
import {
    BOT_LADDER, DAILY_BOT_ID, botById, dailyBot,
    chooseCard, chooseSwapTarget, chooseWildColor, willCatchMercy,
    type BotProfile,
} from '../bot'
import type { Card, Player } from '../types'

const card = (id: string, over: Partial<Card> = {}): Card =>
    ({ id, color: 'red', type: 'number', value: 5, ...over })

const player = (id: string, hand: number, over: Partial<Player> = {}): Player =>
    ({ id, name: id, hand: Array.from({ length: hand }, (_, i) => card(`${id}-${i}`)), isEliminated: false, ...over })

/** Deterministic rng returning a fixed value, for testing a single branch. */
const fixed = (v: number) => () => v

const profile = (over: Partial<BotProfile> = {}): BotProfile =>
    ({ id: 't', name: 'T', aggression: 0.5, wildDiscipline: 0.5, catchRate: 0.5, targeting: 0.5, ...over })

describe('BOT_LADDER', () => {
    it('has eight rungs with unique ids and names', () => {
        expect(BOT_LADDER).toHaveLength(8)
        expect(new Set(BOT_LADDER.map(b => b.id)).size).toBe(8)
        expect(new Set(BOT_LADDER.map(b => b.name)).size).toBe(8)
    })

    it('keeps every dial in range', () => {
        for (const b of BOT_LADDER) {
            for (const k of ['aggression', 'wildDiscipline', 'catchRate', 'targeting'] as const) {
                expect(b[k]).toBeGreaterThanOrEqual(0)
                expect(b[k]).toBeLessThanOrEqual(1)
            }
        }
    })

    it('gets harder to catch out as the ladder climbs', () => {
        const rates = BOT_LADDER.map(b => b.catchRate)
        expect([...rates].sort((a, b) => a - b)).toEqual(rates)
    })
})

describe('the daily bot', () => {
    it('is pinned by id, not by ladder position', () => {
        // Reordering the ladder must never silently change the daily's
        // opponent — everyone in the world plays the same deal.
        expect(dailyBot().id).toBe(DAILY_BOT_ID)
        expect(BOT_LADDER.some(b => b.id === DAILY_BOT_ID)).toBe(true)
    })

    it('falls back to a real profile for an unknown id', () => {
        expect(botById('nope')).toBe(BOT_LADDER[0])
    })
})

describe('chooseCard', () => {
    const ctx = (playable: Card[], drawStack = 0) => ({ playable, drawStack, opponents: [] })

    it('draws when nothing is playable', () => {
        expect(chooseCard(ctx([]), profile(), fixed(0.5))).toBeNull()
    })

    it('escalates a live stack with its biggest draw when aggressive', () => {
        const two = card('d2', { type: 'draw2' })
        const ten = card('d10', { color: 'wild', type: 'draw10' })
        const chosen = chooseCard(ctx([two, ten], 2), profile({ aggression: 1 }), fixed(0.1))
        expect(chosen).toBe(ten)
    })

    it('passes a stack on with its smallest draw when passive', () => {
        const two = card('d2', { type: 'draw2' })
        const ten = card('d10', { color: 'wild', type: 'draw10' })
        const chosen = chooseCard(ctx([two, ten], 2), profile({ aggression: 0 }), fixed(0.9))
        expect(chosen).toBe(two)
    })

    it('holds a wild while a coloured card exists when disciplined', () => {
        const wild = card('w', { color: 'wild', type: 'wild' })
        const num = card('n', { type: 'number', value: 3 })
        const chosen = chooseCard(ctx([wild, num]), profile({ wildDiscipline: 1, aggression: 0 }), fixed(0))
        expect(chosen).toBe(num)
    })

    it('spends a wild when it is the only legal card, discipline regardless', () => {
        const wild = card('w', { color: 'wild', type: 'wild' })
        const chosen = chooseCard(ctx([wild]), profile({ wildDiscipline: 1 }), fixed(0))
        expect(chosen).toBe(wild)
    })

    it('prefers a special over a number when aggressive', () => {
        const skip = card('s', { type: 'skip' })
        const num = card('n', { type: 'number', value: 3 })
        const chosen = chooseCard(ctx([skip, num]), profile({ aggression: 1, wildDiscipline: 0 }), fixed(0))
        expect(chosen).toBe(skip)
    })

    it('sheds a number over a special when passive', () => {
        const skip = card('s', { type: 'skip' })
        const num = card('n', { type: 'number', value: 3 })
        const chosen = chooseCard(ctx([skip, num]), profile({ aggression: 0, wildDiscipline: 0 }), fixed(0.99))
        expect(chosen).toBe(num)
    })

    it('always returns a card from the playable set', () => {
        const hand = [
            card('a', { type: 'skip' }),
            card('b', { color: 'wild', type: 'wild' }),
            card('c', { type: 'number', value: 1 }),
        ]
        for (const p of BOT_LADDER) {
            for (let i = 0; i < 40; i++) {
                const chosen = chooseCard(ctx(hand), p, () => i / 40)
                expect(hand).toContain(chosen)
            }
        }
    })
})

describe('chooseSwapTarget', () => {
    const opponents = [player('big', 9), player('small', 1), player('mid', 4)]

    it('aims at whoever is closest to winning when targeting', () => {
        const t = chooseSwapTarget({ playable: [], drawStack: 0, opponents }, profile({ targeting: 1 }), fixed(0))
        expect(t?.id).toBe('small')
    })

    it('ignores eliminated players', () => {
        const withDead = [player('dead', 0, { isEliminated: true }), player('live', 5)]
        const t = chooseSwapTarget({ playable: [], drawStack: 0, opponents: withDead }, profile({ targeting: 1 }), fixed(0))
        expect(t?.id).toBe('live')
    })

    it('returns null when there is nobody left to hit', () => {
        expect(chooseSwapTarget({ playable: [], drawStack: 0, opponents: [] }, profile(), fixed(0))).toBeNull()
    })
})

describe('chooseWildColor', () => {
    it('picks the colour it holds most of when targeting', () => {
        const hand = [card('a', { color: 'blue' }), card('b', { color: 'blue' }), card('c', { color: 'red' })]
        expect(chooseWildColor(hand, profile({ targeting: 1 }), fixed(0))).toBe('blue')
    })

    it('still returns a real colour from an empty hand', () => {
        expect(['red', 'blue', 'green', 'yellow']).toContain(chooseWildColor([], profile(), fixed(0)))
    })

    it('never returns wild', () => {
        const hand = [card('w', { color: 'wild' })]
        for (let i = 0; i < 20; i++) {
            expect(chooseWildColor(hand, profile(), () => i / 20)).not.toBe('wild')
        }
    })
})

describe('willCatchMercy', () => {
    it('tracks the profile rate', () => {
        expect(willCatchMercy(profile({ catchRate: 0 }), fixed(0.5))).toBe(false)
        expect(willCatchMercy(profile({ catchRate: 1 }), fixed(0.5))).toBe(true)
    })
})

describe('determinism', () => {
    it('gives the identical sequence for the same seed and profile', () => {
        const hand = [
            card('a', { type: 'skip' }),
            card('b', { color: 'wild', type: 'wild' }),
            card('c', { type: 'number', value: 1 }),
            card('d', { type: 'draw2' }),
        ]
        const run = () => {
            let n = 0
            const rng = () => { n = (n * 9301 + 49297) % 233280; return n / 233280 }
            return Array.from({ length: 30 }, () =>
                chooseCard({ playable: hand, drawStack: 0, opponents: [] }, dailyBot(), rng)?.id)
        }
        expect(run()).toEqual(run())
    })
})
