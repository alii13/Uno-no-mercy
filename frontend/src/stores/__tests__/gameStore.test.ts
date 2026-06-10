/**
 * Regression tests for single-player engine soft-locks and rematch leaks.
 * Each test pins a specific bug fixed in the 2026-06 bug sweep so a future
 * refactor can't silently reintroduce it.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../lib/supabase', () => ({
    supabase: {
        auth: { getUser: async () => ({ data: { user: null } }) },
        from: () => {
            throw new Error('unexpected supabase call in single-player test')
        },
    },
}))

vi.mock('../../composables/useSoundEffects', () => ({
    soundEffects: new Proxy({}, { get: () => () => undefined }),
}))

import { useGameStore } from '../gameStore'
import type { Card, Player } from '../../types/card'

function makePlayer(id: string, name: string, hand: Card[] = []): Player {
    return { id, name, hand, isEliminated: false, isBot: false, score: 0 }
}

const red5: Card = { id: 'c-red-5', color: 'red', type: 'number', value: 5 }

beforeEach(() => {
    setActivePinia(createPinia())
})

afterEach(() => {
    vi.useRealTimers()
})

describe('roulette draw with an exhausted deck', () => {
    it('ends the turn instead of spinning forever when nothing can be drawn', () => {
        vi.useFakeTimers()
        const store = useGameStore()
        store.players = [makePlayer('p-0', 'You'), makePlayer('p-1', 'Friend')]
        store.gameState = 'PLAYING'
        // Deck empty + single-card discard means reshuffleDeck refuses, so
        // every draw returns undefined — the pre-fix loop respawned itself
        // via setTimeout forever in ROULETTE_DRAWING.
        store.deck = []
        store.discardPile = [red5]
        store.currentPlayerIndex = 1
        store.turnState = 'ROULETTE_DRAWING'
        store.rouletteTargetColor = 'blue'
        store.actionInProgress = true

        store.executeRouletteDraw()

        expect(store.turnState).toBe('WAITING_FOR_ACTION')
        expect(store.currentPlayerIndex).toBe(0)
        expect(store.actionInProgress).toBe(false)
        // No respawned roulette tick waiting to fire.
        expect(vi.getTimerCount()).toBe(0)
    })
})

describe('initializeGame', () => {
    it('clears in-flight flags leaked from the previous game', () => {
        const store = useGameStore()
        store.actionInProgress = true
        store.suppressDiscardSlam = true
        store.pendingDealCard = { playerId: 'p-0', card: red5 }
        store.pendingDiscardAllCards = [red5]
        store.pendingDrawnWildCard = red5

        store.initializeGame(['You', 'Bot'])

        expect(store.actionInProgress).toBe(false)
        expect(store.suppressDiscardSlam).toBe(false)
        expect(store.pendingDealCard).toBeNull()
        expect(store.pendingDiscardAllCards).toEqual([])
        expect(store.pendingDrawnWildCard).toBeNull()
    })
})

describe('dealInitialCards generation guard', () => {
    it('stops an abandoned deal loop from mutating the next game', async () => {
        const store = useGameStore()
        store.initializeGame(['You', 'Friend'])

        let dealt = 0
        await store.dealInitialCards(async () => {
            dealt++
            // Rematch fired while the first card's animation was awaiting —
            // the old loop must bail without touching the new game's state.
            if (dealt === 1) store.initializeGame(['You', 'Friend'])
        })

        expect(dealt).toBe(1)
        expect(store.pendingDealCard).toBeNull()
        expect(store.players.every(p => p.hand.length === 0)).toBe(true)
        // The old loop's tail must not flip the new game out of DEALING.
        expect(store.turnState).toBe('DEALING')
        expect(store.isDealing).toBe(true)
    })
})
