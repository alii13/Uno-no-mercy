import { describe, expect, it } from 'vitest'
import { rankFor } from '../ranks'

describe('rankFor', () => {
    it('maps win counts onto the ladder', () => {
        expect(rankFor(0).title).toBe('Recruit')
        expect(rankFor(4).title).toBe('Recruit')
        expect(rankFor(5).title).toBe('Rookie')
        expect(rankFor(29).title).toBe('Enforcer')
        expect(rankFor(30).title).toBe('Savage')
        expect(rankFor(99).title).toBe('Warlord')
        expect(rankFor(100).title).toBe('Overlord')
        expect(rankFor(500).title).toBe('No Mercy King')
    })
})
