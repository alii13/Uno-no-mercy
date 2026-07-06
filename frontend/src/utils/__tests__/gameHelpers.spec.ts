import { describe, it, expect } from 'vitest'
import { countByColor } from '../gameHelpers'
import type { Card } from '../../types/card'

let nextId = 0
function card(color: Card['color'], type: Card['type'] = 'number'): Card {
  return { id: `c${nextId++}`, color, type, value: 5 }
}

describe('countByColor', () => {
  it('counts cards per color', () => {
    const hand = [
      card('red'), card('red'), card('red'),
      card('blue'),
      card('yellow'), card('yellow'),
    ]
    expect(countByColor(hand)).toEqual({ red: 3, blue: 1, green: 0, yellow: 2 })
  })

  it('excludes wild cards', () => {
    const hand = [card('wild', 'wild'), card('wild', 'draw4'), card('green', 'skip')]
    expect(countByColor(hand)).toEqual({ red: 0, blue: 0, green: 1, yellow: 0 })
  })

  it('returns all zeros for an empty hand', () => {
    expect(countByColor([])).toEqual({ red: 0, blue: 0, green: 0, yellow: 0 })
  })
})
