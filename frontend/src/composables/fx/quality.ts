/**
 * FX quality tiers — one source of truth every effect and the WebGL canvas
 * reads. Resolved once from device traits, re-checked on demand so a
 * reduced-motion toggle or a hybrid-device pointer switch takes effect live.
 *
 *   high    — desktop: full particle counts, bloom, heat haze
 *   medium  — mobile / coarse pointer: halved counts, no haze, cheaper DPR
 *   reduced — prefers-reduced-motion or the in-app override: no WebGL FX,
 *             callers fall back to the DOM path (or jump-cut)
 */

import { useMotion } from '../useMotion'

export type FxTier = 'high' | 'medium' | 'reduced'

export interface FxKnobs {
  tier: FxTier
  /** Multiplier applied to every effect's particle count. */
  particleScale: number
  /** Ceiling on the shared particle pool. */
  maxParticles: number
  /** devicePixelRatio cap for the FX canvas (perf lever on retina phones). */
  dprCap: number
  /** Ambient heat haze + bloom-ish extras are desktop-only. */
  atmospherics: boolean
}

const hasWindow = typeof window !== 'undefined'

function coarsePointer(): boolean {
  return (
    hasWindow &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  )
}

function smallViewport(): boolean {
  return hasWindow && window.innerWidth <= 480
}

/** Current tier — cheap to call every frame; reads live signals. */
export function fxTier(): FxTier {
  if (useMotion().reduced) return 'reduced'
  if (coarsePointer() || smallViewport()) return 'medium'
  return 'high'
}

const KNOBS: Record<FxTier, FxKnobs> = {
  high: { tier: 'high', particleScale: 1, maxParticles: 2000, dprCap: 2, atmospherics: true },
  medium: { tier: 'medium', particleScale: 0.5, maxParticles: 800, dprCap: 1.5, atmospherics: false },
  reduced: { tier: 'reduced', particleScale: 0, maxParticles: 0, dprCap: 1, atmospherics: false },
}

export function fxKnobs(): FxKnobs {
  return KNOBS[fxTier()]
}
