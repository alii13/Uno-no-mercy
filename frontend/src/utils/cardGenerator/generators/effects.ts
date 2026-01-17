/**
 * Effect generators for card visual effects
 */

import type { Card, ColorScheme } from '@/types/card'

export function generateEffects(card: Card, colors: ColorScheme): string {
  let effects = ''
  
  // Glow effect for playable cards
  if (card.isPlayable) {
    effects += `
      <rect x="0" y="0" width="63" height="88" 
            rx="8" ry="8"
            fill="none"
            stroke="${colors.glow || colors.primary}"
            stroke-width="2"
            opacity="0.6"
            class="playable-glow"
            filter="url(#playableGlow)" />
    `
  }
  
  // Special effects for wild cards
  if (card.type.startsWith('wild') || card.type === 'draw4' || card.type === 'draw6' || card.type === 'draw10') {
    effects += `
      <rect x="0" y="0" width="63" height="88" 
            rx="8" ry="8"
            fill="url(#wildShimmer)" 
            opacity="0.2"
            class="wild-shimmer" />
    `
  }
  
  return effects
}

