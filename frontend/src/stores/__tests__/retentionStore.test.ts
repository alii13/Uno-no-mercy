/**
 * Day-streak rules: the streak survives a played-yesterday gap, dies at 2+
 * days, and playedToday drives the lobby's "play today to keep it" nudge.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const fakeStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null },
    setItem(k: string, v: string) { this.store[k] = v },
    removeItem(k: string) { delete this.store[k] },
}
vi.stubGlobal('localStorage', fakeStorage)

import { useRetentionStore } from '../retentionStore'

function seed(lastPlayedDate: string, currentStreak: number) {
    fakeStorage.store['uno_retention_v1'] = JSON.stringify({
        gamesPlayed: 5, gamesWon: 2, totalCardsPlayed: 50, totalUnos: 3,
        biggestStackEver: 8, peakHandEver: 12, currentStreak,
        longestStreak: currentStreak, lastPlayedDate,
    })
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-24T12:00:00'))
    fakeStorage.store = {}
})

afterEach(() => {
    vi.useRealTimers()
})

describe('day streak', () => {
    it('is alive and secured when the player already played today', () => {
        seed('2026-07-24', 3)
        setActivePinia(createPinia())
        const r = useRetentionStore()
        expect(r.effectiveStreak).toBe(3)
        expect(r.playedToday).toBe(true)
    })

    it('is alive but at risk when the last game was yesterday', () => {
        seed('2026-07-23', 3)
        setActivePinia(createPinia())
        const r = useRetentionStore()
        expect(r.effectiveStreak).toBe(3)
        expect(r.playedToday).toBe(false)
    })

    it('is dead after two missed days', () => {
        seed('2026-07-22', 3)
        setActivePinia(createPinia())
        const r = useRetentionStore()
        expect(r.effectiveStreak).toBe(0)
    })

    it('continues when a game is recorded the day after the last one', () => {
        seed('2026-07-23', 3)
        setActivePinia(createPinia())
        const r = useRetentionStore()
        r.recordGameResult({ won: true, cardsPlayed: 10, biggestStackSurvived: 4, unoCalls: 1, peakHand: 9, mode: 'sp' })
        expect(r.currentStreak).toBe(4)
        expect(r.playedToday).toBe(true)
    })
})
