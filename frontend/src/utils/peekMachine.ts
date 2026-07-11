// Pure state machine for the long-press peek gesture. The composable
// (useHandPeek) owns the DOM, the timers, and pointer capture; this reducer
// owns only the transition logic so every edge (scroll-cancel, cancel,
// dismiss, quick-tap-vs-hold) is unit-testable without a browser.
//
//   IDLE → pointerdown → PRESS_PENDING
//   PRESS_PENDING: up → TAP_PLAY | move >8px → IDLE (scroll wins) | hold → PEEKING
//   PEEKING: move → browse peekIndex | up → SELECTED | cancel/dismiss → IDLE
//   SELECTED: confirm → CONFIRM_PLAY | dismiss/cancel → IDLE
//
// Being *in* PRESS_PENDING when the pointer lifts already means the release
// beat the hold timer, so "up < hold ⇒ tap" needs no clock in the reducer.

export const PEEK_MOVE_THRESHOLD = 8

export type PeekState =
  | { phase: 'IDLE' }
  | { phase: 'PRESS_PENDING'; index: number; startX: number; startY: number }
  | { phase: 'PEEKING'; index: number }
  | { phase: 'SELECTED'; index: number }

export type PeekEvent =
  | { type: 'POINTER_DOWN'; index: number; x: number; y: number }
  | { type: 'POINTER_MOVE'; index: number; x: number; y: number }
  | { type: 'POINTER_UP' }
  | { type: 'HOLD_ELAPSED' }
  | { type: 'POINTER_CANCEL' }
  | { type: 'CONFIRM'; index: number }
  | { type: 'DISMISS' }

export type PeekEffect =
  | { type: 'TAP_PLAY'; index: number }
  | { type: 'HAPTIC' }
  | { type: 'CONFIRM_PLAY'; index: number }

export interface PeekResult {
  state: PeekState
  effects: PeekEffect[]
}

export const IDLE: PeekState = { phase: 'IDLE' }

export function peekReduce(state: PeekState, event: PeekEvent): PeekResult {
  switch (state.phase) {
    case 'IDLE':
      if (event.type === 'POINTER_DOWN') {
        return {
          state: { phase: 'PRESS_PENDING', index: event.index, startX: event.x, startY: event.y },
          effects: [],
        }
      }
      return { state, effects: [] }

    case 'PRESS_PENDING':
      if (event.type === 'POINTER_MOVE') {
        const moved = Math.hypot(event.x - state.startX, event.y - state.startY)
        // Past the slop radius the finger is scrolling, not holding — let the
        // scroller own the gesture.
        return moved > PEEK_MOVE_THRESHOLD ? { state: IDLE, effects: [] } : { state, effects: [] }
      }
      if (event.type === 'HOLD_ELAPSED') {
        return { state: { phase: 'PEEKING', index: state.index }, effects: [{ type: 'HAPTIC' }] }
      }
      if (event.type === 'POINTER_UP') {
        return { state: IDLE, effects: [{ type: 'TAP_PLAY', index: state.index }] }
      }
      if (event.type === 'POINTER_CANCEL' || event.type === 'DISMISS') {
        return { state: IDLE, effects: [] }
      }
      return { state, effects: [] }

    case 'PEEKING':
      if (event.type === 'POINTER_MOVE') {
        return { state: { phase: 'PEEKING', index: event.index }, effects: [] }
      }
      if (event.type === 'POINTER_UP') {
        return { state: { phase: 'SELECTED', index: state.index }, effects: [] }
      }
      if (event.type === 'POINTER_CANCEL' || event.type === 'DISMISS') {
        return { state: IDLE, effects: [] }
      }
      return { state, effects: [] }

    case 'SELECTED':
      if (event.type === 'CONFIRM') {
        return { state: IDLE, effects: [{ type: 'CONFIRM_PLAY', index: event.index }] }
      }
      if (event.type === 'DISMISS' || event.type === 'POINTER_CANCEL') {
        return { state: IDLE, effects: [] }
      }
      return { state, effects: [] }
  }
}
