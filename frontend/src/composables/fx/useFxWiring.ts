/**
 * Wires live game state to FX bus events. Kept out of the views so the
 * single-player and multiplayer boards share one definition of "how much the
 * table should be on fire".
 */

import { watch } from 'vue'
import { useGameFx, type FxColor } from './useGameFx'
import type { Card } from '../../types/card'

/** Shockwave magnitude for a power card — the +N draw amount, or a sensible
 *  default for skip-everyone and wilds that carry no number. */
export function slamMagnitude(card: Card): number {
  const m = /^draw(\d+)$/.exec(card.type)
  if (m) return Number(m[1])
  if (card.type === 'skipEveryone') return 8
  if (card.color === 'wild') return 6
  return 4
}

/**
 * Ambient "angry table" heat, 0..1. Rises with the live draw stack and with how
 * close the local player is to mercy elimination (25 cards). Calm play stays
 * cold so the heat reads as danger, not wallpaper.
 */
export function heatLevel(drawStack: number, myCardCount: number): number {
  const fromStack = drawStack / 20 // +10 -> 0.5, +16 -> 0.8, +20 -> 1
  const fromMercy = (myCardCount - 12) / 13 // 12 cards -> 0, 25 -> 1
  return Math.max(0, Math.min(1, Math.max(fromStack, fromMercy)))
}

/** Emit `heat` whenever the stack or the local hand size changes. */
export function useHeatWiring(getDrawStack: () => number, getCardCount: () => number): void {
  const fx = useGameFx()
  watch(
    () => [getDrawStack(), getCardCount()] as const,
    ([stack, count]) => fx.emit('heat', { level: heatLevel(stack, count) }),
    { immediate: true },
  )
}

/** Draw-stack size at which the stack cam ignites. Double digits read as an
 *  event on the pot counter; +8 fires too often in No Mercy to stay special. */
export const STACK_CAM_THRESHOLD = 10

/**
 * Keep the stack cam lit while the draw stack is at cinematic size. Emits
 * `stackCamActive` on every change at/above the threshold (the cam ignites once,
 * then just rolls the pot); emits a quiet reveal (no victim) if the stack drops
 * back below the threshold without being eaten, so the cam always stands down.
 */
export function useStackCamWiring(getDrawStack: () => number, getColor: () => string | undefined): void {
  const fx = useGameFx()
  watch(getDrawStack, (now, old) => {
    if (now >= STACK_CAM_THRESHOLD) {
      fx.emit('stackCamActive', { amount: now, color: (getColor() ?? 'wild') as FxColor })
    } else if (old !== undefined && old >= STACK_CAM_THRESHOLD && now > 0) {
      fx.emit('stackCamReveal', { amount: old, color: (getColor() ?? 'wild') as FxColor, victimEl: null, victimName: '' })
    }
  })
}

/**
 * Emit `colorFlood` when a wild's colour is chosen. Fires when the active colour
 * changes to a concrete colour while the top card is a wild — so it triggers on
 * wild colour picks (roulette, drawn wild, played wild) but not on ordinary
 * coloured cards, which also move currentColor.
 */
export function useWildFloodWiring(
  getCurrentColor: () => string | undefined,
  getTopCardColor: () => string | undefined,
): void {
  const fx = useGameFx()
  watch(
    getCurrentColor,
    (color) => {
      if (!color || color === 'wild') return
      if (getTopCardColor() !== 'wild') return
      fx.emit('colorFlood', { color: color as FxColor })
    },
  )
}
