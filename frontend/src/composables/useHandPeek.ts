import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import { peekReduce, IDLE, type PeekState, type PeekEvent, type PeekEffect } from '../utils/peekMachine'

// Hold this long before a press becomes a peek; a quicker release is a plain
// tap-to-play. The 4s idle timer clears a parked selection so the preview never
// sticks around forever.
const HOLD_MS = 280
const AUTO_DISMISS_MS = 4000

interface HandPeekOptions {
  /** The scroll strip — pointer capture + the non-passive touchmove guard live here. */
  stripRef: Ref<HTMLElement | null>
  /** Coarse pointer and not otherwise blocked (e.g. color picker open). */
  enabled: Ref<boolean>
  /** Card count — any change (draw/play/swap) dismisses an in-flight peek. */
  cardCount: Ref<number>
  /** Nearest card index to a client X — used to slide-browse while peeking. */
  indexAtPoint: (clientX: number) => number
  /** Whether the card at index can actually be played right now (turn + rules). */
  canPlayIndex: (index: number) => boolean
  /** Funnel a confirmed play through the host's existing play path. */
  play: (index: number) => void
  /** Shake the parked preview when a confirm lands on an unplayable card. */
  shakePreview: () => void
}

export function useHandPeek(opts: HandPeekOptions) {
  const state = ref<PeekState>(IDLE)
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let dismissTimer: ReturnType<typeof setTimeout> | null = null
  let activePointerId: number | null = null

  function clearTimers() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null }
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null }
  }

  function runEffect(eff: PeekEffect) {
    if (eff.type === 'HAPTIC') navigator.vibrate?.(12)
    else if (eff.type === 'TAP_PLAY') opts.play(eff.index)
    else if (eff.type === 'CONFIRM_PLAY') opts.play(eff.index)
  }

  function dispatch(event: PeekEvent) {
    const prevPhase = state.value.phase
    const { state: next, effects } = peekReduce(state.value, event)
    state.value = next
    for (const eff of effects) runEffect(eff)

    // Timers key off phase *changes* only, so jitter inside PRESS_PENDING never
    // restarts the hold countdown.
    if (next.phase !== prevPhase) {
      clearTimers()
      if (next.phase === 'PRESS_PENDING') {
        holdTimer = setTimeout(() => dispatch({ type: 'HOLD_ELAPSED' }), HOLD_MS)
      } else if (next.phase === 'SELECTED') {
        dismissTimer = setTimeout(() => dispatch({ type: 'DISMISS' }), AUTO_DISMISS_MS)
      }
    }
  }

  function onPointerDown(e: PointerEvent, index: number) {
    if (!opts.enabled.value) return
    // Starting a fresh press over a parked selection clears it first.
    if (state.value.phase === 'SELECTED') dispatch({ type: 'DISMISS' })
    activePointerId = e.pointerId
    // Capture can throw on a stale pointer id; the gesture still works via the
    // strip's own move/up handlers, so failing to capture is non-fatal.
    try { opts.stripRef.value?.setPointerCapture(e.pointerId) } catch { /* noop */ }
    dispatch({ type: 'POINTER_DOWN', index, x: e.clientX, y: e.clientY })
  }

  function onPointerMove(e: PointerEvent) {
    if (activePointerId !== e.pointerId) return
    const phase = state.value.phase
    if (phase === 'PRESS_PENDING') {
      dispatch({ type: 'POINTER_MOVE', index: -1, x: e.clientX, y: e.clientY })
    } else if (phase === 'PEEKING') {
      dispatch({ type: 'POINTER_MOVE', index: opts.indexAtPoint(e.clientX), x: e.clientX, y: e.clientY })
    }
  }

  function endPointer(e: PointerEvent, event: PeekEvent) {
    if (activePointerId !== e.pointerId) return
    try { opts.stripRef.value?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    activePointerId = null
    dispatch(event)
  }
  const onPointerUp = (e: PointerEvent) => endPointer(e, { type: 'POINTER_UP' })
  const onPointerCancel = (e: PointerEvent) => endPointer(e, { type: 'POINTER_CANCEL' })

  /** Tap on the lifted preview: play if legal, otherwise shake and stay parked. */
  function confirmTap() {
    if (state.value.phase !== 'SELECTED') return
    const index = state.value.index
    if (opts.canPlayIndex(index)) dispatch({ type: 'CONFIRM', index })
    else opts.shakePreview()
  }

  function dismiss() {
    dispatch({ type: 'DISMISS' })
  }

  // Suppress the browser's horizontal scroll only while actually peeking — a
  // non-passive touchmove listener is the reliable cross-browser lever
  // (pointermove preventDefault does not cancel scroll).
  function onTouchMove(e: TouchEvent) {
    if (state.value.phase === 'PEEKING') e.preventDefault()
  }
  watch(opts.stripRef, (el, _old, onCleanup) => {
    if (!el) return
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    onCleanup(() => el.removeEventListener('touchmove', onTouchMove))
  }, { immediate: true })

  // Hand mutation or losing the gesture entirely resets hard.
  watch([opts.cardCount, opts.enabled], () => {
    clearTimers()
    activePointerId = null
    if (state.value.phase !== 'IDLE') state.value = IDLE
  })

  onUnmounted(clearTimers)

  const peekPhase = computed(() => state.value.phase)
  // Index to preview from touch — only once lifted (PEEKING/SELECTED), never
  // during the pending press.
  const peekIndex = computed(() =>
    state.value.phase === 'PEEKING' || state.value.phase === 'SELECTED' ? state.value.index : -1,
  )

  return {
    peekPhase,
    peekIndex,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    confirmTap,
    dismiss,
  }
}
