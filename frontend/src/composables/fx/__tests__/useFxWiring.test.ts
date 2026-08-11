import { describe, it, expect } from 'vitest'
import { heatLevel, slamMagnitude } from '../useFxWiring'
import type { Card } from '../../../types/card'

const card = (type: string, color = 'red'): Card => ({ id: 'x', type, color } as unknown as Card)

describe('heatLevel', () => {
  it('is cold during calm play', () => {
    expect(heatLevel(0, 6)).toBe(0)
    expect(heatLevel(0, 12)).toBe(0)
  })

  it('rises with the draw stack', () => {
    expect(heatLevel(10, 6)).toBeCloseTo(0.5)
    expect(heatLevel(20, 6)).toBe(1)
  })

  it('rises as the local hand nears mercy elimination', () => {
    expect(heatLevel(0, 25)).toBe(1)
    expect(heatLevel(0, 18)).toBeCloseTo(6 / 13)
  })

  it('clamps to 0..1 and takes the hotter of the two drivers', () => {
    expect(heatLevel(40, 30)).toBe(1)
    expect(heatLevel(4, 20)).toBeCloseTo(8 / 13) // mercy driver wins here
  })
})

describe('slamMagnitude', () => {
  it('reads the +N off draw cards', () => {
    expect(slamMagnitude(card('draw2'))).toBe(2)
    expect(slamMagnitude(card('draw10'))).toBe(10)
  })

  it('defaults for numberless power cards', () => {
    expect(slamMagnitude(card('skipEveryone'))).toBe(8)
    expect(slamMagnitude(card('wildColorRoulette', 'wild'))).toBe(6)
  })
})
