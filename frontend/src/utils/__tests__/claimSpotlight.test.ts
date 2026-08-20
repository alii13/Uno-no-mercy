import { describe, expect, it, beforeEach, vi } from 'vitest'
import { shouldSpotlightClaim, markClaimSpotlightShown } from '../claimSpotlight'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
})

describe('claim spotlight', () => {
    beforeEach(() => store.clear())

    it('spotlights a guest win when never shown before', () => {
        expect(shouldSpotlightClaim(true, true)).toBe(true)
    })

    it('never spotlights signed-in players or losses', () => {
        expect(shouldSpotlightClaim(false, true)).toBe(false)
        expect(shouldSpotlightClaim(true, false)).toBe(false)
    })

    it('goes quiet after being marked shown', () => {
        markClaimSpotlightShown()
        expect(shouldSpotlightClaim(true, true)).toBe(false)
    })
})
