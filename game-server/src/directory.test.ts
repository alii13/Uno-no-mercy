import { describe, expect, it } from 'vitest'
import { normalizeDir, dirCodes, liveTables, DIR_STALE_MS } from './directory'

const NOW = 1_700_000_000_000

describe('normalizeDir', () => {
    it('reads entries written before snapshots existed', () => {
        expect(normalizeDir({ AAAA: NOW })).toEqual({ AAAA: { at: NOW } })
    })

    it('passes through entries that already carry a snapshot', () => {
        const e = { at: NOW, players: 3, seatsFree: 17 }
        expect(normalizeDir({ AAAA: e })).toEqual({ AAAA: e })
    })

    it('copes with a missing directory', () => {
        expect(normalizeDir(undefined)).toEqual({})
    })
})

describe('dirCodes', () => {
    it('orders oldest first among equally-full rooms', () => {
        const codes = dirCodes({ NEW: NOW + 5000, OLD: NOW, MID: NOW + 1000 })
        expect(codes).toEqual(['OLD', 'MID', 'NEW'])
    })

    it('fills the fullest room first so players concentrate', () => {
        // One player per room is the failure mode: three lonely lobbies
        // instead of one game about to start.
        const codes = dirCodes({
            LONELY: { at: NOW, players: 1, status: 'lobby' as const },
            ALMOST: { at: NOW + 5000, players: 3, status: 'lobby' as const },
            PAIR: { at: NOW + 1000, players: 2, status: 'lobby' as const },
        })
        expect(codes).toEqual(['ALMOST', 'PAIR', 'LONELY'])
    })

    it('still works on a directory of bare timestamps', () => {
        expect(dirCodes({ B: NOW + 10, A: NOW })).toEqual(['A', 'B'])
    })

    it('never offers a started room to quick match', () => {
        // Started rooms stay listed so the landing strip can show them, so
        // this filter is the only thing stopping quick match from dropping
        // someone into a game already under way.
        const dir = {
            RUNNING: { at: NOW, players: 4, inProgress: true },
            OPEN: { at: NOW + 10, players: 1, inProgress: false },
        }
        expect(dirCodes(dir)).toEqual(['OPEN'])
    })

    it('never offers a finished room to quick match', () => {
        // A finished game reports inProgress: false, so before `status`
        // existed the room re-entered the pool at the head of the list and
        // every quick-matcher landed in someone else's game-over.
        const dir = {
            DEAD: { at: NOW, players: 2, inProgress: false, status: 'finished' as const },
            OPEN: { at: NOW + 10, players: 1, inProgress: false, status: 'lobby' as const },
        }
        expect(dirCodes(dir)).toEqual(['OPEN'])
    })

    it('filters a playing room by status even when inProgress lags', () => {
        const dir = {
            RUNNING: { at: NOW, players: 4, inProgress: false, status: 'playing' as const },
        }
        expect(dirCodes(dir)).toEqual([])
    })

    it('treats a legacy entry with no flag as joinable', () => {
        expect(dirCodes({ OLD: NOW })).toEqual(['OLD'])
    })
})

describe('liveTables', () => {
    const room = (over: Record<string, unknown> = {}) => ({
        at: NOW, updatedAt: NOW, players: 2, seatsFree: 18, inProgress: false, mode: 'official', ...over,
    })

    it('hides empty rooms — a dead table is a worse advert than none', () => {
        const out = liveTables({ EMPTY: room({ players: 0 }), LIVE: room() }, NOW)
        expect(out.map((t) => t.code)).toEqual(['LIVE'])
    })

    it('hides rooms whose DO died without unregistering', () => {
        const stale = room({ updatedAt: NOW - DIR_STALE_MS - 1 })
        expect(liveTables({ ZOMBIE: stale }, NOW)).toEqual([])
    })

    it('keeps a room that simply has not changed recently', () => {
        const quiet = room({ updatedAt: NOW - 10 * 60 * 1000 })
        expect(liveTables({ QUIET: quiet }, NOW).map((t) => t.code)).toEqual(['QUIET'])
    })

    it('puts the fullest table first', () => {
        const out = liveTables({
            ONE: room({ players: 1 }),
            FOUR: room({ players: 4 }),
            TWO: room({ players: 2 }),
        }, NOW)
        expect(out.map((t) => t.code)).toEqual(['FOUR', 'TWO', 'ONE'])
    })

    it('caps how many it returns', () => {
        const dir = Object.fromEntries(
            Array.from({ length: 10 }, (_, i) => [`R${i}`, room({ players: i + 1 })]),
        )
        expect(liveTables(dir, NOW).length).toBe(3)
        expect(liveTables(dir, NOW, 5).length).toBe(5)
    })

    it('never exposes anything that identifies a player', () => {
        const out = liveTables({ AAAA: room({ skins: ['neon'] }) }, NOW)
        const keys = Object.keys(out[0]!)
        expect(keys.sort()).toEqual(
            ['code', 'inProgress', 'mode', 'players', 'seatsFree', 'skins', 'status'].sort(),
        )
        // 'players' is a legitimate key, so match only the words that would
        // actually mean a leak. No /i with a [A-Z] class — the flag cancels it.
        expect(JSON.stringify(out)).not.toMatch(/name|user/i)
    })

    it('fills defaults for a legacy entry that has no snapshot yet', () => {
        // Bare-number entries have no player count, so they are not "live"
        // until their room reports one. Better an empty strip than a lie.
        expect(liveTables({ OLD: NOW }, NOW)).toEqual([])
    })

    it('hides finished rooms — a dead game is not an invitation', () => {
        const out = liveTables({
            DEAD: room({ status: 'finished' as const }),
            LIVE: room({ status: 'lobby' as const }),
        }, NOW)
        expect(out.map((t) => t.code)).toEqual(['LIVE'])
    })

    it('derives status for a legacy entry that predates the field', () => {
        const out = liveTables({
            WAITING: room(),
            RUNNING: room({ players: 4, inProgress: true }),
        }, NOW)
        expect(out.find((t) => t.code === 'WAITING')?.status).toBe('lobby')
        expect(out.find((t) => t.code === 'RUNNING')?.status).toBe('playing')
    })
})
