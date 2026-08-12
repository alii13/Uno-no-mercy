import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeStorage = {
    store: {} as Record<string, string>,
    getItem(k: string) { return this.store[k] ?? null },
    setItem(k: string, v: string) { this.store[k] = v },
    removeItem(k: string) { delete this.store[k] },
}
vi.stubGlobal('localStorage', fakeStorage)

import { CARD_BACKS, adoptProfileEquip, equip, getEquippedId, skinColors, type UnlockInputs } from '../cosmetics'

const inputs = (over: Partial<UnlockInputs> = {}): UnlockInputs =>
    ({ wins: 0, longestStreak: 0, maxStackSurvived: 0, ...over })

beforeEach(() => { fakeStorage.store = {} })

describe('card back unlocks', () => {
    it('only the default is owned with an empty record', () => {
        const owned = CARD_BACKS.filter(s => s.unlocked(inputs())).map(s => s.id)
        expect(owned).toEqual(['ember'])
    })

    it('each unlock rule keys off the right input', () => {
        expect(CARD_BACKS.find(s => s.id === 'toxic')!.unlocked(inputs({ longestStreak: 3 }))).toBe(true)
        expect(CARD_BACKS.find(s => s.id === 'ice')!.unlocked(inputs({ maxStackSurvived: 16 }))).toBe(true)
        expect(CARD_BACKS.find(s => s.id === 'hazard')!.unlocked(inputs({ wins: 10 }))).toBe(true)
        expect(CARD_BACKS.find(s => s.id === 'royal')!.unlocked(inputs({ wins: 30 }))).toBe(true)
        expect(CARD_BACKS.find(s => s.id === 'gold')!.unlocked(inputs({ wins: 100 }))).toBe(true)
        expect(CARD_BACKS.find(s => s.id === 'gold')!.unlocked(inputs({ wins: 99 }))).toBe(false)
    })
})

describe('equip persistence', () => {
    it('defaults to ember and survives garbage', () => {
        expect(getEquippedId()).toBe('ember')
        fakeStorage.store['uno_cosmetics_v1'] = 'not-json'
        expect(getEquippedId()).toBe('ember')
        fakeStorage.store['uno_cosmetics_v1'] = JSON.stringify({ equipped: 'nonexistent' })
        expect(getEquippedId()).toBe('ember')
    })

    it('round-trips a valid equip', () => {
        equip('toxic')
        expect(getEquippedId()).toBe('toxic')
        equip('nonexistent')
        expect(getEquippedId()).toBe('toxic')
    })
})

describe('account sync + seat colors', () => {
    it('adopts a valid profile equip and ignores garbage', () => {
        adoptProfileEquip('ice')
        expect(getEquippedId()).toBe('ice')
        adoptProfileEquip('nonexistent')
        expect(getEquippedId()).toBe('ice')
        adoptProfileEquip(null)
        expect(getEquippedId()).toBe('ice')
    })

    it('maps unknown or missing seat skins to the default, never the viewer', () => {
        equip('toxic')
        expect(skinColors(undefined).accent).toBe('#ff3333')
        expect(skinColors('nonexistent').accent).toBe('#ff3333')
        expect(skinColors('ice').accent).toBe('#00e5ff')
    })
})
