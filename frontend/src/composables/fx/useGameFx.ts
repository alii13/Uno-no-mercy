/**
 * Game FX event bus. Game views emit semantic events describing WHAT happened
 * ('a power card landed on the pile', 'the stack resolved onto a victim'); the
 * FX layer is the only subscriber and decides HOW it looks. This keeps game
 * logic free of animation code and lets one effect serve both the
 * single-player and multiplayer views unchanged.
 *
 * Tiny typed emitter, no dependency — mitt is ~200 bytes but this is less.
 */

import type { CardColor } from '../../types/card'

export type FxColor = CardColor | 'wild'

/** Payloads carry resolved DOM anchors; the FX layer maps them to canvas
 *  coords via getBoundingClientRect, the same convention useGameFeel uses. */
export interface FxEventMap {
  /** A card hit the discard pile. `power` gates the heavier treatment. */
  impact: { originEl: HTMLElement; color: FxColor; power: boolean }
  /** A +N power card landed — shockwave magnitude scales with the number. */
  slam: { originEl: HTMLElement; color: FxColor; magnitude: number }
  /** A draw stack was eaten — particle spray from pile toward the victim seat. */
  stackSpray: { fromEl: HTMLElement; toEl: HTMLElement; color: FxColor; count: number }
  /** Ambient table heat, 0..1 — embers + haze that track stack/mercy pressure. */
  heat: { level: number }
  /** A wild's colour was chosen — flood a ring + wash in that colour. */
  colorFlood: { color: FxColor }
  /** Stack cam ignition (macro, step 3) — sustained embers from the pile. */
  embers: { originEl: HTMLElement; color: FxColor; on: boolean }
  /** Victory burst (macro, step 4). */
  confetti: { originEl: HTMLElement }
}

export type FxEvent = keyof FxEventMap
type Handler<E extends FxEvent> = (payload: FxEventMap[E]) => void

const handlers = new Map<FxEvent, Set<Handler<FxEvent>>>()

function on<E extends FxEvent>(event: E, fn: Handler<E>): () => void {
  let set = handlers.get(event)
  if (!set) {
    set = new Set()
    handlers.set(event, set)
  }
  set.add(fn as Handler<FxEvent>)
  return () => off(event, fn)
}

function off<E extends FxEvent>(event: E, fn: Handler<E>): void {
  handlers.get(event)?.delete(fn as Handler<FxEvent>)
}

function emit<E extends FxEvent>(event: E, payload: FxEventMap[E]): void {
  const set = handlers.get(event)
  if (!set) return
  for (const fn of set) (fn as Handler<E>)(payload)
}

export function useGameFx() {
  return { on, off, emit }
}
