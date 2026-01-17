/**
 * Card SVG mapping for UNO No Mercy cards
 * Uses the actual SVG card files
 */

import { getCardSVG } from './svgCardMapping'
import type { Card } from '@/types/card'

/**
 * Get card SVG based on card type, value, and color
 * Uses the actual UNO No Mercy SVG card files
 */
export function getCardImage(card: Card): string {
  // Wild cards use 'wild' as color parameter
  const colorParam = card.color === 'wild' ? 'wild' : card.color
  return getCardSVG(card.type, card.value, colorParam)
}

