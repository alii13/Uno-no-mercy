/**
 * SVG Card Mapping System
 * Maps all 168 UNO No Mercy cards to their corresponding SVG files
 * Now with all color variants generated!
 */

// Import all number card SVGs (all 4 colors)
import zeroRed from '@/assets/cards-webp/zero-red.webp?url'
import zeroBlue from '@/assets/cards-webp/zero-blue.webp?url'
import zeroGreen from '@/assets/cards-webp/zero-green.webp?url'
import zeroYellow from '@/assets/cards-webp/zero-yellow.webp?url'

import oneRed from '@/assets/cards-webp/one-red.webp?url'
import oneBlue from '@/assets/cards-webp/one-blue.webp?url'
import oneGreen from '@/assets/cards-webp/one-green.webp?url'
import oneYellow from '@/assets/cards-webp/one-yellow.webp?url'

import twoRed from '@/assets/cards-webp/two-red.webp?url'
import twoBlue from '@/assets/cards-webp/two-blue.webp?url'
import twoGreen from '@/assets/cards-webp/two-green.webp?url'
import twoYellow from '@/assets/cards-webp/two-yellow.webp?url'

import threeRed from '@/assets/cards-webp/three-red.webp?url'
import threeBlue from '@/assets/cards-webp/three-blue.webp?url'
import threeGreen from '@/assets/cards-webp/three-green.webp?url'
import threeYellow from '@/assets/cards-webp/three-yellow.webp?url'

import fourRed from '@/assets/cards-webp/four-red.webp?url'
import fourBlue from '@/assets/cards-webp/four-blue.webp?url'
import fourGreen from '@/assets/cards-webp/four-green.webp?url'
import fourYellow from '@/assets/cards-webp/four-yellow.webp?url'

import fiveRed from '@/assets/cards-webp/five-red.webp?url'
import fiveBlue from '@/assets/cards-webp/five-blue.webp?url'
import fiveGreen from '@/assets/cards-webp/five-green.webp?url'
import fiveYellow from '@/assets/cards-webp/five-yellow.webp?url'

import sixRed from '@/assets/cards-webp/six-red.webp?url'
import sixBlue from '@/assets/cards-webp/six-blue.webp?url'
import sixGreen from '@/assets/cards-webp/six-green.webp?url'
import sixYellow from '@/assets/cards-webp/six-yellow.webp?url'

import sevenSwapRed from '@/assets/cards-webp/seven-swap-red.webp?url'
import sevenSwapBlue from '@/assets/cards-webp/seven-swap-blue.webp?url'
import sevenSwapGreen from '@/assets/cards-webp/seven-swap-green.webp?url'
import sevenSwapYellow from '@/assets/cards-webp/seven-swap-yellow.webp?url'

import eightRed from '@/assets/cards-webp/eight-red.webp?url'
import eightBlue from '@/assets/cards-webp/eight-blue.webp?url'
import eightGreen from '@/assets/cards-webp/eight-green.webp?url'
import eightYellow from '@/assets/cards-webp/eight-yellow.webp?url'

import nineRed from '@/assets/cards-webp/nine-red.webp?url'
import nineBlue from '@/assets/cards-webp/nine-blue.webp?url'
import nineGreen from '@/assets/cards-webp/nine-green.webp?url'
import nineYellow from '@/assets/cards-webp/nine-yellow.webp?url'

// Import all action card SVGs (all 4 colors)
import skipRed from '@/assets/cards-webp/skip-red.webp?url'
import skipBlue from '@/assets/cards-webp/skip-blue.webp?url'
import skipGreen from '@/assets/cards-webp/skip-green.webp?url'
import skipYellow from '@/assets/cards-webp/skip-yellow.webp?url'

import reverseRed from '@/assets/cards-webp/reverse-red.webp?url'
import reverseBlue from '@/assets/cards-webp/reverse-blue.webp?url'
import reverseGreen from '@/assets/cards-webp/reverse-green.webp?url'
import reverseYellow from '@/assets/cards-webp/reverse-yellow.webp?url'

import twoDrawRed from '@/assets/cards-webp/two-draw-red.webp?url'
import twoDrawBlue from '@/assets/cards-webp/two-draw-blue.webp?url'
import twoDrawGreen from '@/assets/cards-webp/two-draw-green.webp?url'
import twoDrawYellow from '@/assets/cards-webp/two-draw-yellow.webp?url'

import fourDrawRed from '@/assets/cards-webp/four-draw-red.webp?url'
import fourDrawBlue from '@/assets/cards-webp/four-draw-blue.webp?url'
import fourDrawGreen from '@/assets/cards-webp/four-draw-green.webp?url'
import fourDrawYellow from '@/assets/cards-webp/four-draw-yellow.webp?url'

import skipEveryoneRed from '@/assets/cards-webp/skip-everyone-red.webp?url'
import skipEveryoneBlue from '@/assets/cards-webp/skip-everyone-blue.webp?url'
import skipEveryoneGreen from '@/assets/cards-webp/skip-everyone-green.webp?url'
import skipEveryoneYellow from '@/assets/cards-webp/skip-everyone-yellow.webp?url'

import discardAllRed from '@/assets/cards-webp/discard-all-red.webp?url'
import discardAllBlue from '@/assets/cards-webp/discard-all-blue.webp?url'
import discardAllGreen from '@/assets/cards-webp/discard-all-green.webp?url'
import discardAllYellow from '@/assets/cards-webp/discard-all-yellow.webp?url'

// Import wild card SVGs (no color variants needed)
import wildRoulette from '@/assets/cards-webp/wild-roulette.webp?url'
import wildTenDraw from '@/assets/cards-webp/wild-ten-draw.webp?url'
import wildDrawSix from '@/assets/cards-webp/wild-draw-six.webp?url'
import wildReverseFourDraw from '@/assets/cards-webp/wild-reverse-four-draw.webp?url'

import type { CardColor, CardType } from '@/types/card'

// Number cards mapping: [value][color]
const NUMBER_SVGS: Record<number, Record<string, string>> = {
  0: { red: zeroRed, blue: zeroBlue, green: zeroGreen, yellow: zeroYellow },
  1: { red: oneRed, blue: oneBlue, green: oneGreen, yellow: oneYellow },
  2: { red: twoRed, blue: twoBlue, green: twoGreen, yellow: twoYellow },
  3: { red: threeRed, blue: threeBlue, green: threeGreen, yellow: threeYellow },
  4: { red: fourRed, blue: fourBlue, green: fourGreen, yellow: fourYellow },
  5: { red: fiveRed, blue: fiveBlue, green: fiveGreen, yellow: fiveYellow },
  6: { red: sixRed, blue: sixBlue, green: sixGreen, yellow: sixYellow },
  7: { red: sevenSwapRed, blue: sevenSwapBlue, green: sevenSwapGreen, yellow: sevenSwapYellow },
  8: { red: eightRed, blue: eightBlue, green: eightGreen, yellow: eightYellow },
  9: { red: nineRed, blue: nineBlue, green: nineGreen, yellow: nineYellow },
}

// Action cards mapping: [type][color]
const ACTION_SVGS: Record<string, Record<string, string>> = {
  skip: { red: skipRed, blue: skipBlue, green: skipGreen, yellow: skipYellow },
  reverse: { red: reverseRed, blue: reverseBlue, green: reverseGreen, yellow: reverseYellow },
  draw2: { red: twoDrawRed, blue: twoDrawBlue, green: twoDrawGreen, yellow: twoDrawYellow },
  draw4: { red: fourDrawRed, blue: fourDrawBlue, green: fourDrawGreen, yellow: fourDrawYellow },
  skipEveryone: { red: skipEveryoneRed, blue: skipEveryoneBlue, green: skipEveryoneGreen, yellow: skipEveryoneYellow },
  discardAll: { red: discardAllRed, blue: discardAllBlue, green: discardAllGreen, yellow: discardAllYellow },
}

// Wild cards mapping (no color variants)
const WILD_SVGS: Record<string, string> = {
  wildReverseDraw4: wildReverseFourDraw,
  draw6: wildDrawSix,
  draw10: wildTenDraw,
  wildColorRoulette: wildRoulette,
  wild: wildRoulette, // Use roulette as default wild
}

/**
 * Get SVG content for a card
 * Now returns the exact color variant - no CSS filters needed!
 */
export function getCardSVG(
  cardType: CardType,
  value: number | undefined,
  color: CardColor | 'wild'
): string {
  // Wild cards - use specific wild SVGs
  if (cardType === 'wildReverseDraw4' || cardType === 'draw6' || 
      cardType === 'draw10' || cardType === 'wildColorRoulette' || cardType === 'wild') {
    return WILD_SVGS[cardType] || wildRoulette
  }
  
  // Number cards - get exact color variant (including value 10 for "Play Again")
  if (cardType === 'number' && value !== undefined && value >= 0 && value <= 10) {
    // Handle value 10 ("Play Again" modifier) - use a fallback since we don't have a specific SVG
    if (value === 10) {
      // Use number 1 as fallback for "10" cards, or we could use a generated number
      return NUMBER_SVGS[1]?.[color] || oneGreen
    }
    const numberSet = NUMBER_SVGS[value]
    if (numberSet && color !== 'wild' && numberSet[color]) {
      return numberSet[color]
    }
    return numberSet?.green || oneGreen // Fallback to green
  }
  
  // Action cards - get exact color variant
  if (cardType in ACTION_SVGS) {
    const actionSet = ACTION_SVGS[cardType]
    if (actionSet && color !== 'wild' && actionSet[color]) {
      return actionSet[color]
    }
    return actionSet?.green || oneGreen // Fallback to green
  }
  
  // Default fallback
  return oneGreen
}
