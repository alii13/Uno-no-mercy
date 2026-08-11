import { describe, expect, it } from 'vitest'
import {
    ROOM_CODE_ALPHABET,
    isRoomCode,
    normalizeRoomCode,
    roomCodeProblem,
} from '../roomCode'

describe('room code alphabet', () => {
    it('omits every ambiguous glyph', () => {
        for (const ch of ['I', 'L', 'O', '0', '1']) {
            expect(ROOM_CODE_ALPHABET).not.toContain(ch)
        }
    })

    it('accepts a code built from the alphabet itself', () => {
        expect(isRoomCode(ROOM_CODE_ALPHABET.slice(0, 6))).toBe(true)
    })
})

describe('isRoomCode', () => {
    it('accepts a real code, case-insensitively and with stray whitespace', () => {
        expect(isRoomCode('BQ7K2M')).toBe(true)
        expect(isRoomCode('bq7k2m')).toBe(true)
        expect(isRoomCode('  BQ7K2M  ')).toBe(true)
    })

    /** The whole point: these used to pass, then die as an anonymous 1006. */
    it('rejects the digits the server route silently drops', () => {
        expect(isRoomCode('B0OK7Z')).toBe(false)
        expect(isRoomCode('B1QK7Z')).toBe(false)
    })

    it('rejects the letters the alphabet never mints, L included', () => {
        expect(isRoomCode('BQLK7Z')).toBe(false)
        expect(isRoomCode('BQIK7Z')).toBe(false)
        expect(isRoomCode('BQOK7Z')).toBe(false)
    })

    it('rejects the wrong length and junk', () => {
        expect(isRoomCode('BQ7')).toBe(false)
        expect(isRoomCode('BQ7K2M9XY')).toBe(false)
        expect(isRoomCode('BQ7-2M')).toBe(false)
        expect(isRoomCode('')).toBe(false)
    })
})

describe('normalizeRoomCode', () => {
    it('upper-cases and trims', () => {
        expect(normalizeRoomCode('  bq7k2m ')).toBe('BQ7K2M')
    })
})

describe('roomCodeProblem', () => {
    it('names the offending glyph rather than saying "invalid"', () => {
        const msg = roomCodeProblem('B0OK7Z')!
        expect(msg).toContain('0')
        expect(msg).toContain('O')
    })

    it('explains an empty entry', () => {
        expect(roomCodeProblem('')).toBe('Enter a room code.')
    })

    it('explains a length problem separately', () => {
        expect(roomCodeProblem('BQ7')).toContain('characters')
    })

    it('returns null for a good code', () => {
        expect(roomCodeProblem('BQ7K2M')).toBeNull()
    })
})
