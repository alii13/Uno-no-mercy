/**
 * Pure hand-layout solver for the card fan. Given the viewport, the hand band
 * height, and how many cards are held, it returns the card size and a slot per
 * card. It has one job: keep every card tappable. When cards can fan within the
 * band with a visible sliver at least SLIVER_MIN wide it fans them; once they
 * can't, it switches to a horizontally scrolled strip with a finger-width step.
 *
 * No DOM, no Vue, no side effects — the consumer feeds it measured numbers
 * (bandHeight via a ResizeObserver) and renders the slots.
 */

export interface HandLayoutInput {
  viewportWidth: number
  bandHeight: number
  handSize: number
  pointerCoarse: boolean
}

export interface HandSlot {
  x: number // left offset from the strip's start, px
  rotate: number // degrees; positive leans right
  arcY: number // downward drop from the arc, px
  zIndex: number
}

export interface HandLayout {
  cardW: number
  cardH: number
  step: number
  mode: 'fan' | 'scroll'
  slots: HandSlot[]
}

const CARD_ASPECT = 1.4
const W_MIN = 58
const W_MAX = 100
const W_PER_VW = 0.19
const EDGE_PAD = 12 // breathing room at each end of the fan
const COMFORT_RATIO = 0.66 // fanned cards show ~2/3 of themselves
const SCROLL_STEP = 44 // finger-width step once scrolling
const BAND_PAD = 12 // vertical slack kept inside the band

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cardWidthFor(viewportWidth: number, bandHeight: number, handSize: number): number {
  const fluid = clamp(viewportWidth * W_PER_VW, W_MIN, W_MAX)
  // Large hands shrink the cards so the fan stays workable before it has to scroll.
  const densityScale = handSize <= 8 ? 1 : Math.max(0.72, 1 - (handSize - 8) * 0.03)
  const byWidth = fluid * densityScale
  const byBand = Math.floor((bandHeight - BAND_PAD) / CARD_ASPECT)
  return Math.floor(Math.min(byWidth, byBand))
}

export function computeHandLayout(input: HandLayoutInput): HandLayout {
  const { viewportWidth, bandHeight, handSize, pointerCoarse } = input
  const n = Math.max(0, Math.floor(handSize))

  const cardW = cardWidthFor(viewportWidth, bandHeight, handSize)
  const cardH = Math.round(cardW * CARD_ASPECT)

  if (n <= 1) {
    return {
      cardW,
      cardH,
      step: 0,
      mode: 'fan',
      slots: n === 1 ? [{ x: 0, rotate: 0, arcY: 0, zIndex: 0 }] : []
    }
  }

  const sliverMin = pointerCoarse ? 44 : 24
  const available = viewportWidth - EDGE_PAD * 2
  // Step that would spread the whole hand edge-to-edge within the band.
  const stepToFit = (available - cardW) / (n - 1)

  const mode: 'fan' | 'scroll' = stepToFit >= sliverMin ? 'fan' : 'scroll'
  // Fan: never wider than a small overlap; when it must, tighten to stepToFit.
  // Scroll: fixed finger-width step, let the strip overflow and scroll.
  const step = mode === 'fan' ? Math.min(stepToFit, cardW * COMFORT_RATIO) : SCROLL_STEP

  const mid = (n - 1) / 2
  // Fan tilt per card, gentle for small hands, capped for big ones. Flattened in
  // scroll mode — an arc inside an overflow-x strip clips and fights the scroll.
  const rotatePerStep = mode === 'fan' ? clamp(n * 1.2, 6, 24) / (n - 1) : 0

  const slots: HandSlot[] = Array.from({ length: n }, (_, i) => {
    const fromMid = i - mid
    return {
      x: i * step,
      rotate: mode === 'fan' ? fromMid * rotatePerStep : 0,
      arcY: mode === 'fan' ? Math.abs(fromMid) * cardW * 0.03 : 0,
      zIndex: i
    }
  })

  return { cardW, cardH, step, mode, slots }
}
