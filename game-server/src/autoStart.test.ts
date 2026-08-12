import { describe, expect, it } from 'vitest'
import {
    AUTO_START_MS, AUTO_START_CUT_MS, AUTO_START_FLOOR_MS, AUTO_START_FULL_MS,
    autoStartTick,
} from './autoStart'

const NOW = 1_700_000_000_000
const lobby = { isPublic: true, phase: 'lobby' as const, seatsFree: 18, now: NOW }

describe('autoStartTick', () => {
    it('arms a 30s clock when the second player arrives', () => {
        const s = autoStartTick(undefined, { ...lobby, connected: 2 })
        expect(s.at).toBe(NOW + AUTO_START_MS)
    })

    it('does nothing for a solo waiter', () => {
        expect(autoStartTick(undefined, { ...lobby, connected: 1 })).toEqual({})
        expect(autoStartTick(undefined, { ...lobby, connected: 0 })).toEqual({})
    })

    it('never runs in a private room or outside the lobby', () => {
        expect(autoStartTick(undefined, { ...lobby, isPublic: false, connected: 4 })).toEqual({})
        expect(autoStartTick({ at: NOW + 20_000 }, { ...lobby, phase: 'playing', connected: 4 })).toEqual({})
        expect(autoStartTick({ at: NOW + 20_000 }, { ...lobby, phase: 'finished', connected: 4 })).toEqual({})
    })

    it('each extra join cuts 5s off the clock', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        s = autoStartTick(s, { ...lobby, connected: 3, now: NOW + 1_000 })
        // 29s remained; the join cuts it to 24s.
        expect(s.at).toBe(NOW + 1_000 + 29_000 - AUTO_START_CUT_MS)
    })

    it('join cuts never push the clock below the 10s floor', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        // 12s remaining; a join cuts to the floor, not to 7s.
        s = autoStartTick(s, { ...lobby, connected: 3, now: NOW + 18_000 })
        expect(s.at).toBe(NOW + 18_000 + AUTO_START_FLOOR_MS)
        // 8s remaining, already under the floor; a join must not EXTEND it.
        let t = autoStartTick(undefined, { ...lobby, connected: 2 })
        t = autoStartTick(t, { ...lobby, connected: 3, now: NOW + 22_000 })
        expect(t.at).toBe(NOW + 22_000 + 8_000)
    })

    it('a presence change that is not a join does not cut', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 3 })
        // Same count again (a rename, a skin change) — clock untouched.
        s = autoStartTick(s, { ...lobby, connected: 3, now: NOW + 2_000 })
        expect(s.at).toBe(NOW + AUTO_START_MS)
    })

    it('a full room cuts to 5 seconds', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        s = autoStartTick(s, { ...lobby, connected: 3, seatsFree: 0, now: NOW + 1_000 })
        expect(s.at).toBe(NOW + 1_000 + AUTO_START_FULL_MS)
    })

    it('dropping below two pauses at the current value, not zero', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        s = autoStartTick(s, { ...lobby, connected: 1, now: NOW + 12_000 })
        expect(s.at).toBeUndefined()
        expect(s.leftMs).toBe(AUTO_START_MS - 12_000)
    })

    it('resumes from the paused remainder when back above two', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        s = autoStartTick(s, { ...lobby, connected: 1, now: NOW + 12_000 })
        s = autoStartTick(s, { ...lobby, connected: 2, now: NOW + 60_000 })
        expect(s.at).toBe(NOW + 60_000 + AUTO_START_MS - 12_000)
        expect(s.leftMs).toBeUndefined()
    })

    it('a room that empties loses the clock entirely', () => {
        let s = autoStartTick(undefined, { ...lobby, connected: 2 })
        s = autoStartTick(s, { ...lobby, connected: 0, now: NOW + 5_000 })
        s = autoStartTick(s, { ...lobby, connected: 0, now: NOW + 6_000 })
        // Paused remainder survives a brief empty dip…
        expect(s.leftMs).toBe(AUTO_START_MS - 5_000)
        // …but a game phase change wipes it.
        expect(autoStartTick(s, { ...lobby, phase: 'playing', connected: 2 })).toEqual({})
    })
})
