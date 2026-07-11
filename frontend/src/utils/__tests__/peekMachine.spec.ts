import { describe, it, expect } from 'vitest'
import { peekReduce, IDLE, PEEK_MOVE_THRESHOLD, type PeekState } from '../peekMachine'

const pressPending = (index = 2, startX = 100, startY = 200): PeekState => ({
  phase: 'PRESS_PENDING', index, startX, startY,
})

describe('peekReduce', () => {
  describe('IDLE', () => {
    it('pointerdown arms the press', () => {
      const { state, effects } = peekReduce(IDLE, { type: 'POINTER_DOWN', index: 3, x: 10, y: 20 })
      expect(state).toEqual({ phase: 'PRESS_PENDING', index: 3, startX: 10, startY: 20 })
      expect(effects).toEqual([])
    })

    it('ignores everything else', () => {
      expect(peekReduce(IDLE, { type: 'POINTER_UP' }).state).toBe(IDLE)
      expect(peekReduce(IDLE, { type: 'HOLD_ELAPSED' }).state).toBe(IDLE)
    })
  })

  describe('PRESS_PENDING', () => {
    it('quick release plays the pressed card (tap beats the hold)', () => {
      const { state, effects } = peekReduce(pressPending(2), { type: 'POINTER_UP' })
      expect(state).toBe(IDLE)
      expect(effects).toEqual([{ type: 'TAP_PLAY', index: 2 }])
    })

    it('small jitter under the threshold keeps the press armed', () => {
      const s = pressPending(2, 100, 200)
      const { state } = peekReduce(s, { type: 'POINTER_MOVE', index: 2, x: 100 + PEEK_MOVE_THRESHOLD - 1, y: 200 })
      expect(state).toBe(s)
    })

    it('moving past the threshold hands the gesture to the scroller', () => {
      const { state, effects } = peekReduce(pressPending(2, 100, 200), {
        type: 'POINTER_MOVE', index: 2, x: 100 + PEEK_MOVE_THRESHOLD + 1, y: 200,
      })
      expect(state).toBe(IDLE)
      expect(effects).toEqual([])
    })

    it('the hold timer lifts into peek with a haptic', () => {
      const { state, effects } = peekReduce(pressPending(4), { type: 'HOLD_ELAPSED' })
      expect(state).toEqual({ phase: 'PEEKING', index: 4 })
      expect(effects).toEqual([{ type: 'HAPTIC' }])
    })

    it('cancel drops back to idle without playing', () => {
      expect(peekReduce(pressPending(), { type: 'POINTER_CANCEL' }).state).toBe(IDLE)
      expect(peekReduce(pressPending(), { type: 'POINTER_CANCEL' }).effects).toEqual([])
    })
  })

  describe('PEEKING', () => {
    it('move slides the browse index without side effects', () => {
      const { state, effects } = peekReduce({ phase: 'PEEKING', index: 4 }, {
        type: 'POINTER_MOVE', index: 7, x: 300, y: 200,
      })
      expect(state).toEqual({ phase: 'PEEKING', index: 7 })
      expect(effects).toEqual([])
    })

    it('release selects the browsed card (does NOT auto-play)', () => {
      const { state, effects } = peekReduce({ phase: 'PEEKING', index: 7 }, { type: 'POINTER_UP' })
      expect(state).toEqual({ phase: 'SELECTED', index: 7 })
      expect(effects).toEqual([])
    })

    it('cancel or dismiss drops to idle', () => {
      expect(peekReduce({ phase: 'PEEKING', index: 1 }, { type: 'POINTER_CANCEL' }).state).toBe(IDLE)
      expect(peekReduce({ phase: 'PEEKING', index: 1 }, { type: 'DISMISS' }).state).toBe(IDLE)
    })
  })

  describe('SELECTED', () => {
    it('confirm plays the selected card', () => {
      const { state, effects } = peekReduce({ phase: 'SELECTED', index: 7 }, { type: 'CONFIRM', index: 7 })
      expect(state).toBe(IDLE)
      expect(effects).toEqual([{ type: 'CONFIRM_PLAY', index: 7 }])
    })

    it('dismiss (tap elsewhere / timeout / turn change) drops to idle', () => {
      expect(peekReduce({ phase: 'SELECTED', index: 7 }, { type: 'DISMISS' }).state).toBe(IDLE)
    })

    it('ignores stray moves while selected', () => {
      const s: PeekState = { phase: 'SELECTED', index: 7 }
      expect(peekReduce(s, { type: 'POINTER_MOVE', index: 3, x: 1, y: 1 }).state).toBe(s)
    })
  })

  it('full happy path: down → hold → browse → release → confirm', () => {
    let r = peekReduce(IDLE, { type: 'POINTER_DOWN', index: 2, x: 50, y: 100 })
    r = peekReduce(r.state, { type: 'HOLD_ELAPSED' })
    expect(r.state.phase).toBe('PEEKING')
    expect(r.effects).toEqual([{ type: 'HAPTIC' }])
    r = peekReduce(r.state, { type: 'POINTER_MOVE', index: 9, x: 400, y: 100 })
    expect(r.state).toEqual({ phase: 'PEEKING', index: 9 })
    r = peekReduce(r.state, { type: 'POINTER_UP' })
    expect(r.state).toEqual({ phase: 'SELECTED', index: 9 })
    r = peekReduce(r.state, { type: 'CONFIRM', index: 9 })
    expect(r.state).toBe(IDLE)
    expect(r.effects).toEqual([{ type: 'CONFIRM_PLAY', index: 9 }])
  })
})
