import { describe, expect, it } from 'vitest'
import {
    AUTO_START_MS, AUTO_START_CUT_MS, AUTO_START_FLOOR_MS, AUTO_START_FULL_MS,
    AUTO_START_BUMP_MS, AUTO_START_MAX_BUMPS,
    autoStartTick, autoStartBump, autoStartBumpsLeft,
} from './autoStart'

const NOW = 1_700_000_000_000
const lobby = { isPublic: true, phase: 'lobby' as const, seatsFree: 18, now: NOW }

describe('autoStartTick', () => {
    it('arms a one-minute clock when the second player arrives', () => {
        const s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        expect(s.at).toBe(NOW + AUTO_START_MS)
    })

    it('does nothing for a solo waiter', () => {
        expect(autoStartTick(undefined, { ...lobby, connectedIds: ['a'] })).toEqual({})
        expect(autoStartTick(undefined, { ...lobby, connectedIds: [] })).toEqual({})
    })

    it('never runs in a private room or outside the lobby', () => {
        expect(autoStartTick(undefined, { ...lobby, isPublic: false, connectedIds: ['a', 'b', 'c', 'd'] })).toEqual({})
        expect(autoStartTick({ at: NOW + 20_000 }, { ...lobby, phase: 'playing', connectedIds: ['a', 'b', 'c', 'd'] })).toEqual({})
        expect(autoStartTick({ at: NOW + 20_000 }, { ...lobby, phase: 'finished', connectedIds: ['a', 'b', 'c', 'd'] })).toEqual({})
    })

    it('each extra join cuts 5s off the clock', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c'], now: NOW + 1_000 })
        // A second of the minute had gone; the join takes five more.
        expect(s.at).toBe(NOW + AUTO_START_MS - AUTO_START_CUT_MS)
    })

    it('join cuts never push the clock below the 10s floor', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        // 12s remaining; a join cuts to the floor, not to 7s.
        const late = NOW + AUTO_START_MS - 12_000
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c'], now: late })
        expect(s.at).toBe(late + AUTO_START_FLOOR_MS)
        // 8s remaining, already under the floor; a join must not EXTEND it.
        const later = NOW + AUTO_START_MS - 8_000
        let t = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        t = autoStartTick(t, { ...lobby, connectedIds: ['a', 'b', 'c'], now: later })
        expect(t.at).toBe(later + 8_000)
    })

    it('a reconnect flap never cuts the clock', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b', 'c'] })
        // One player's socket drops (still above the minimum)...
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b'], now: NOW + 2_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS)
        // ...and comes back. Same person - not a join, no cut.
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c'], now: NOW + 4_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS)
        // A genuinely new fourth player still cuts.
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c', 'd'], now: NOW + 5_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS - AUTO_START_CUT_MS)
    })

    it('new joins still cut after other players left', () => {
        // `seen` tracks identity, so departures cannot mask later arrivals.
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b', 'c', 'd'] })
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b'], now: NOW + 1_000 })
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'e'], now: NOW + 2_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS - AUTO_START_CUT_MS)
    })

    it('a flap through a pause still costs nothing on resume', () => {
        // 2-player room: any drop pauses. The same player returning must
        // resume with the raw remainder - no cut, no floor extension.
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        const drop = NOW + AUTO_START_MS - 8_000
        s = autoStartTick(s, { ...lobby, connectedIds: ['a'], now: drop })
        expect(s.leftMs).toBe(8_000)
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b'], now: drop + 1_000 })
        expect(s.at).toBe(drop + 1_000 + 8_000)
    })

    it('a presence change that is not a join does not cut', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b', 'c'] })
        // Same people again (a rename, a skin change) - clock untouched.
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c'], now: NOW + 2_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS)
    })

    it('a full room cuts to 5 seconds', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b', 'c'], seatsFree: 0, now: NOW + 1_000 })
        expect(s.at).toBe(NOW + 1_000 + AUTO_START_FULL_MS)
    })

    it('dropping below two pauses at the current value, not zero', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        s = autoStartTick(s, { ...lobby, connectedIds: ['a'], now: NOW + 12_000 })
        expect(s.at).toBeUndefined()
        expect(s.leftMs).toBe(AUTO_START_MS - 12_000)
    })

    it('a genuine newcomer resuming a paused clock gets the readable-lobby floor', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        // Paused with 2s left...
        s = autoStartTick(s, { ...lobby, connectedIds: ['a'], now: NOW + AUTO_START_MS - 2_000 })
        expect(s.leftMs).toBe(2_000)
        // ...a stranger five minutes later still gets a readable lobby.
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'z'], now: NOW + 300_000 })
        expect(s.at).toBe(NOW + 300_000 + AUTO_START_FLOOR_MS)
    })

    it('a room that empties loses the clock entirely', () => {
        let s = autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })
        s = autoStartTick(s, { ...lobby, connectedIds: [], now: NOW + 5_000 })
        s = autoStartTick(s, { ...lobby, connectedIds: [], now: NOW + 6_000 })
        // Paused remainder survives a brief empty dip…
        expect(s.leftMs).toBe(AUTO_START_MS - 5_000)
        // …but a game phase change wipes it.
        expect(autoStartTick(s, { ...lobby, phase: 'playing', connectedIds: ['a', 'b'] })).toEqual({})
    })
})

describe('buying more time', () => {
    const armed = () => autoStartTick(undefined, { ...lobby, connectedIds: ['a', 'b'] })

    it('adds a minute, once, then refuses', () => {
        const a = armed()
        expect(autoStartBumpsLeft(a)).toBe(AUTO_START_MAX_BUMPS)

        const b = autoStartBump(a, NOW + 50_000)
        expect(b.at).toBe(NOW + AUTO_START_MS + AUTO_START_BUMP_MS)
        expect(autoStartBumpsLeft(b)).toBe(0)

        // The wait is bounded at two minutes, whoever presses.
        expect(autoStartBump(b, NOW + 70_000)).toEqual(b)
    })

    it('extends from the deadline, so pressing early costs nothing', () => {
        expect(autoStartBump(armed(), NOW + 1_000).at).toBe(NOW + AUTO_START_MS + AUTO_START_BUMP_MS)
    })

    it('extends from now when the deadline has already passed', () => {
        const late = NOW + AUTO_START_MS + 3_000
        expect(autoStartBump(armed(), late).at).toBe(late + AUTO_START_BUMP_MS)
    })

    it('is a no-op with no clock running', () => {
        expect(autoStartBump(undefined, NOW)).toEqual({})
        // Paused below the minimum: nothing to extend, nothing to offer.
        expect(autoStartBump({ leftMs: 8_000 }, NOW)).toEqual({ leftMs: 8_000 })
        expect(autoStartBumpsLeft(undefined)).toBe(0)
        expect(autoStartBumpsLeft({ leftMs: 8_000 })).toBe(0)
    })

    it('keeps the spent allowance across joins, pauses and resumes', () => {
        const bumped = autoStartBump(armed(), NOW + 1_000)
        let s = autoStartTick(bumped, { ...lobby, connectedIds: ['a', 'b', 'c'], now: NOW + 2_000 })
        expect(autoStartBumpsLeft(s)).toBe(0)
        // Pause…
        s = autoStartTick(s, { ...lobby, connectedIds: ['a'], now: NOW + 3_000 })
        expect(s.bumps).toBe(1)
        // …and resume: still spent, so the button never comes back.
        s = autoStartTick(s, { ...lobby, connectedIds: ['a', 'b'], now: NOW + 4_000 })
        expect(autoStartBumpsLeft(s)).toBe(0)
    })
})
