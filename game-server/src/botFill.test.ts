import { describe, it, expect } from 'vitest'
import {
    botFillTick, botFillBump, botFillBumpsLeft,
    BOT_FILL_MS, BOT_FILL_BUMP_MS, BOT_FILL_MAX_BUMPS,
} from './botFill'

const T0 = 1_700_000_000_000

function lobby(humanCount: number, now = T0) {
    return { isPublic: true, phase: 'lobby' as const, humanCount, now }
}

describe('bot-fill clock', () => {
    it('starts a full minute for a player waiting alone', () => {
        expect(botFillTick(undefined, lobby(1))).toEqual({ at: T0 + BOT_FILL_MS, bumps: 0 })
    })

    it('does not restart while it is already counting', () => {
        const started = botFillTick(undefined, lobby(1))
        expect(botFillTick(started, lobby(1, T0 + 20_000))).toEqual(started)
    })

    it('stands down as soon as a second human is seated', () => {
        const started = botFillTick(undefined, lobby(1))
        // Auto-start owns the room from here; two clocks must never race.
        expect(botFillTick(started, lobby(2, T0 + 10_000))).toEqual({})
    })

    it('runs again from the top when the room empties back to one', () => {
        const started = botFillTick(undefined, lobby(1))
        const paired = botFillTick(started, lobby(2, T0 + 10_000))
        const alone = botFillTick(paired, lobby(1, T0 + 15_000))
        expect(alone).toEqual({ at: T0 + 15_000 + BOT_FILL_MS, bumps: 0 })
    })

    it('never runs in a private room, outside the lobby, or with nobody there', () => {
        expect(botFillTick(undefined, { ...lobby(1), isPublic: false })).toEqual({})
        expect(botFillTick(undefined, { ...lobby(1), phase: 'playing' })).toEqual({})
        expect(botFillTick(undefined, lobby(0))).toEqual({})
    })
})

describe('buying more time', () => {
    it('adds thirty seconds, twice, then stops', () => {
        const a = botFillTick(undefined, lobby(1))
        expect(botFillBumpsLeft(a)).toBe(BOT_FILL_MAX_BUMPS)

        const b = botFillBump(a, T0 + 50_000)
        expect(b.at).toBe(T0 + BOT_FILL_MS + BOT_FILL_BUMP_MS)
        expect(botFillBumpsLeft(b)).toBe(1)

        const c = botFillBump(b, T0 + 80_000)
        expect(c.at).toBe(T0 + BOT_FILL_MS + BOT_FILL_BUMP_MS * 2)
        expect(botFillBumpsLeft(c)).toBe(0)

        // Third press is refused, so the wait is bounded at two minutes.
        expect(botFillBump(c, T0 + 100_000)).toEqual(c)
    })

    it('extends from the deadline, so pressing early costs nothing', () => {
        const a = botFillTick(undefined, lobby(1))
        const early = botFillBump(a, T0 + 1_000)
        expect(early.at).toBe(T0 + BOT_FILL_MS + BOT_FILL_BUMP_MS)
    })

    it('extends from now when the deadline has already passed', () => {
        const a = botFillTick(undefined, lobby(1))
        const late = botFillBump(a, T0 + BOT_FILL_MS + 5_000)
        expect(late.at).toBe(T0 + BOT_FILL_MS + 5_000 + BOT_FILL_BUMP_MS)
    })

    it('is a no-op when no clock is running', () => {
        expect(botFillBump(undefined, T0)).toEqual({})
        expect(botFillBumpsLeft(undefined)).toBe(0)
        expect(botFillBumpsLeft({})).toBe(0)
    })
})
