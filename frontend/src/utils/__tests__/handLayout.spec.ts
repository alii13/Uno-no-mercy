import { describe, it, expect } from 'vitest'
import { computeHandLayout } from '../handLayout'

// Representative mobile band: 22dvh of an 844px-tall viewport, clamped.
const BAND = 186
const VW = 390

describe('computeHandLayout', () => {
  it('fans a small hand that fits, with slivers above the floor', () => {
    const r = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 7, pointerCoarse: true })
    expect(r.mode).toBe('fan')
    expect(r.cardW).toBe(74)
    expect(r.cardH).toBe(Math.round(74 * 1.4))
    expect(r.step).toBeGreaterThanOrEqual(44)
    expect(r.step).toBeCloseTo(49, 0)
    expect(r.slots).toHaveLength(7)
  })

  it('switches to scroll once a dense hand can no longer meet the sliver floor', () => {
    const r15 = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 15, pointerCoarse: true })
    expect(r15.mode).toBe('scroll')

    const r24 = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 24, pointerCoarse: true })
    expect(r24.mode).toBe('scroll')
    expect(r24.cardW).toBe(53)
    // scroll step is locked at 44; total laid-out width = last x + cardW
    expect(r24.step).toBe(44)
    const last = r24.slots[r24.slots.length - 1]!
    expect(last.x + r24.cardW).toBe(1065)
  })

  it('honours the coarse-pointer sliver floor (44) vs fine (24)', () => {
    const coarse = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 10, pointerCoarse: true })
    const fine = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 10, pointerCoarse: false })
    expect(coarse.mode).toBe('scroll')
    expect(fine.mode).toBe('fan')
  })

  it('locks scroll step to 44 for both pointer types', () => {
    const coarse = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 24, pointerCoarse: true })
    const fine = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 24, pointerCoarse: false })
    expect(coarse.step).toBe(44)
    expect(fine.step).toBe(44)
  })

  it('flattens rotation and arc in scroll mode', () => {
    const r = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 24, pointerCoarse: true })
    expect(r.mode).toBe('scroll')
    for (const s of r.slots) {
      expect(s.rotate).toBe(0)
      expect(s.arcY).toBe(0)
    }
  })

  it('arcs a fanned hand (center flat, edges lifted and rotated)', () => {
    const r = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 7, pointerCoarse: true })
    const mid = r.slots[3]!
    const edge = r.slots[0]!
    expect(mid.rotate).toBeCloseTo(0, 5)
    expect(mid.arcY).toBeCloseTo(0, 5)
    expect(Math.abs(edge.rotate)).toBeGreaterThan(0)
    expect(edge.arcY).toBeGreaterThan(0)
    // left of center leans negative, right leans positive
    expect(r.slots[0]!.rotate).toBeLessThan(0)
    expect(r.slots[6]!.rotate).toBeGreaterThan(0)
  })

  it('handles a single card without NaN', () => {
    const r = computeHandLayout({ viewportWidth: VW, bandHeight: BAND, handSize: 1, pointerCoarse: true })
    expect(r.mode).toBe('fan')
    expect(r.slots).toHaveLength(1)
    expect(r.slots[0]!.x).toBe(0)
    expect(r.slots[0]!.rotate).toBe(0)
    expect(Number.isNaN(r.step)).toBe(false)
  })

  it('caps card size to the band height', () => {
    const r = computeHandLayout({ viewportWidth: VW, bandHeight: 100, handSize: 7, pointerCoarse: true })
    // floor((100 - 12) / 1.4) = 62, below the width-derived 74
    expect(r.cardW).toBe(62)
    expect(r.cardH).toBe(Math.round(62 * 1.4))
  })

  it('clamps fluid card width between 58 and 100', () => {
    const tiny = computeHandLayout({ viewportWidth: 200, bandHeight: 400, handSize: 3, pointerCoarse: true })
    expect(tiny.cardW).toBe(58)
    const huge = computeHandLayout({ viewportWidth: 2000, bandHeight: 400, handSize: 3, pointerCoarse: false })
    expect(huge.cardW).toBe(100)
  })
})
