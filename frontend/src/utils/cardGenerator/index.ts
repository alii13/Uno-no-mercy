/**
 * Card image lookup. Returns the static asset URL for a card's SVG so the
 * browser can lazy-load it via <img>, instead of inlining 19MB of SVG text
 * into the JS bundle (the old `?raw` import pattern).
 */

import type { Card } from '@/types/card'
import { getCardImage } from './assets/cardImages'

export function getCardImageUrl(card: Card): string {
  return getCardImage(card)
}

export function cardClassNames(card: Card, isPlayable: boolean): string {
  const base = `uno-card type-${card.type} color-${card.color}`
  return isPlayable ? `${base} is-playable` : base
}
