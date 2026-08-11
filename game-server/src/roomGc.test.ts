import { describe, it, expect } from 'vitest'
import { ROOM_GC_MS, PRIVATE_ROOM_GC_MS, gcWindowMs } from './roomGc'

describe('room GC window', () => {
    it('collects public rooms promptly so quick-match never serves a dead room', () => {
        expect(gcWindowMs(true)).toBe(ROOM_GC_MS)
        expect(ROOM_GC_MS).toBe(10 * 60 * 1000)
    })

    it('lets a private (invite-link) room linger so a shared link survives a join-later gap', () => {
        expect(gcWindowMs(false)).toBe(PRIVATE_ROOM_GC_MS)
        expect(PRIVATE_ROOM_GC_MS).toBe(6 * 60 * 60 * 1000)
    })

    it('keeps a private room alive long enough to span a working day gap', () => {
        // An hour was shorter than the way links actually get shared, which showed
        // up as invite links failing with "Room not found".
        expect(PRIVATE_ROOM_GC_MS).toBeGreaterThanOrEqual(4 * 60 * 60 * 1000)
    })

    it('always keeps a private room alive at least as long as a public one', () => {
        expect(gcWindowMs(false)).toBeGreaterThan(gcWindowMs(true))
    })
})
