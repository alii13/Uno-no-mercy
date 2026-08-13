import { describe, expect, it } from 'vitest'
import { chatAllowed, CHAT_MIN_GAP_MS, CHAT_BURST, CHAT_WINDOW_MS } from './chatLimit'

const NOW = 1_700_000_000_000

describe('chatAllowed', () => {
    it('lets a first message through and records it', () => {
        const times: number[] = []
        expect(chatAllowed(times, NOW)).toBe(true)
        expect(times).toEqual([NOW])
    })

    it('blocks a message inside the minimum gap', () => {
        const times: number[] = []
        chatAllowed(times, NOW)
        expect(chatAllowed(times, NOW + CHAT_MIN_GAP_MS - 1)).toBe(false)
        expect(chatAllowed(times, NOW + CHAT_MIN_GAP_MS)).toBe(true)
    })

    it('blocks the burst cap inside the window', () => {
        const times: number[] = []
        for (let i = 0; i < CHAT_BURST; i++) {
            expect(chatAllowed(times, NOW + i * CHAT_MIN_GAP_MS)).toBe(true)
        }
        expect(chatAllowed(times, NOW + CHAT_BURST * CHAT_MIN_GAP_MS)).toBe(false)
    })

    it('forgets messages older than the window', () => {
        const times: number[] = []
        for (let i = 0; i < CHAT_BURST; i++) chatAllowed(times, NOW + i * CHAT_MIN_GAP_MS)
        expect(chatAllowed(times, NOW + CHAT_WINDOW_MS)).toBe(true)
    })

    it('a blocked message does not count toward the limit', () => {
        const times: number[] = []
        chatAllowed(times, NOW)
        chatAllowed(times, NOW + 10) // blocked spam attempt
        expect(times.length).toBe(1)
    })
})
