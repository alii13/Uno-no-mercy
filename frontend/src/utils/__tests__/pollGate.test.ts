import { describe, expect, it, beforeEach, vi } from 'vitest'
import { isEligible, isDismissed, markDismissed, type Poll } from '../pollGate'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
})

function poll(over: Partial<Poll> = {}): Poll {
    return {
        id: 'pricing-1',
        question: 'Would you pay for a Club membership?',
        options: ['Yes', 'No'],
        min_games: 3,
        allow_note: false,
        note_label: null,
        ...over,
    }
}

describe('poll gate', () => {
    beforeEach(() => store.clear())

    it('asks a player who has played enough', () => {
        expect(isEligible(poll(), 3)).toBe(true)
        expect(isEligible(poll(), 40)).toBe(true)
    })

    it('stays quiet below the min_games threshold', () => {
        expect(isEligible(poll(), 2)).toBe(false)
        expect(isEligible(poll(), 0)).toBe(false)
    })

    it('never comes back once dismissed', () => {
        markDismissed('pricing-1')
        expect(isEligible(poll(), 40)).toBe(false)
    })

    it('scopes the dismissal to one poll', () => {
        markDismissed('pricing-1')
        expect(isEligible(poll({ id: 'pricing-2' }), 40)).toBe(true)
    })

    it('hides a poll whose options were mistyped in the table editor', () => {
        expect(isEligible(poll({ options: [] }), 40)).toBe(false)
        expect(isEligible(poll({ options: ['Only one'] }), 40)).toBe(false)
        expect(isEligible(poll({ options: ['a', 'b', 'c', 'd', 'e', 'f'] }), 40)).toBe(false)
        expect(isEligible(poll({ options: ['Yes', '  '] }), 40)).toBe(false)
        expect(isEligible(poll({ options: 'Yes,No' as unknown as string[] }), 40)).toBe(false)
    })

    it('treats blocked storage as dismissed rather than nagging', () => {
        vi.stubGlobal('localStorage', {
            getItem: () => { throw new Error('blocked') },
            setItem: () => { throw new Error('blocked') },
        })
        expect(isDismissed('pricing-1')).toBe(true)
        expect(() => markDismissed('pricing-1')).not.toThrow()
    })
})
