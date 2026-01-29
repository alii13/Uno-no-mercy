/**
 * SVG Card Mapping System
 * Maps all 168 UNO No Mercy cards to their corresponding SVG files
 * Now with all color variants generated!
 */

// Import all number card SVGs (all 4 colors)
import zeroRed from '@/assets/cards-svgs/zero-red.svg?raw'
import zeroBlue from '@/assets/cards-svgs/zero-blue.svg?raw'
import zeroGreen from '@/assets/cards-svgs/zero-green.svg?raw'
import zeroYellow from '@/assets/cards-svgs/zero-yellow.svg?raw'

import oneRed from '@/assets/cards-svgs/one-red.svg?raw'
import oneBlue from '@/assets/cards-svgs/one-blue.svg?raw'
import oneGreen from '@/assets/cards-svgs/one-green.svg?raw'
import oneYellow from '@/assets/cards-svgs/one-yellow.svg?raw'

import twoRed from '@/assets/cards-svgs/two-red.svg?raw'
import twoBlue from '@/assets/cards-svgs/two-blue.svg?raw'
import twoGreen from '@/assets/cards-svgs/two-green.svg?raw'
import twoYellow from '@/assets/cards-svgs/two-yellow.svg?raw'

import threeRed from '@/assets/cards-svgs/three-red.svg?raw'
import threeBlue from '@/assets/cards-svgs/three-blue.svg?raw'
import threeGreen from '@/assets/cards-svgs/three-green.svg?raw'
import threeYellow from '@/assets/cards-svgs/three-yellow.svg?raw'

import fourRed from '@/assets/cards-svgs/four-red.svg?raw'
import fourBlue from '@/assets/cards-svgs/four-blue.svg?raw'
import fourGreen from '@/assets/cards-svgs/four-green.svg?raw'
import fourYellow from '@/assets/cards-svgs/four-yellow.svg?raw'

import fiveRed from '@/assets/cards-svgs/five-red.svg?raw'
import fiveBlue from '@/assets/cards-svgs/five-blue.svg?raw'
import fiveGreen from '@/assets/cards-svgs/five-green.svg?raw'
import fiveYellow from '@/assets/cards-svgs/five-yellow.svg?raw'

import sixRed from '@/assets/cards-svgs/six-red.svg?raw'
import sixBlue from '@/assets/cards-svgs/six-blue.svg?raw'
import sixGreen from '@/assets/cards-svgs/six-green.svg?raw'
import sixYellow from '@/assets/cards-svgs/six-yellow.svg?raw'

import sevenSwapRed from '@/assets/cards-svgs/seven-swap-red.svg?raw'
import sevenSwapBlue from '@/assets/cards-svgs/seven-swap-blue.svg?raw'
import sevenSwapGreen from '@/assets/cards-svgs/seven-swap-green.svg?raw'
import sevenSwapYellow from '@/assets/cards-svgs/seven-swap-yellow.svg?raw'

import eightRed from '@/assets/cards-svgs/eight-red.svg?raw'
import eightBlue from '@/assets/cards-svgs/eight-blue.svg?raw'
import eightGreen from '@/assets/cards-svgs/eight-green.svg?raw'
import eightYellow from '@/assets/cards-svgs/eight-yellow.svg?raw'

import nineRed from '@/assets/cards-svgs/nine-red.svg?raw'
import nineBlue from '@/assets/cards-svgs/nine-blue.svg?raw'
import nineGreen from '@/assets/cards-svgs/nine-green.svg?raw'
import nineYellow from '@/assets/cards-svgs/nine-yellow.svg?raw'

// Import all action card SVGs (all 4 colors)
import skipRed from '@/assets/cards-svgs/skip-red.svg?raw'
import skipBlue from '@/assets/cards-svgs/skip-blue.svg?raw'
import skipGreen from '@/assets/cards-svgs/skip-green.svg?raw'
import skipYellow from '@/assets/cards-svgs/skip-yellow.svg?raw'

import reverseRed from '@/assets/cards-svgs/reverse-red.svg?raw'
import reverseBlue from '@/assets/cards-svgs/reverse-blue.svg?raw'
import reverseGreen from '@/assets/cards-svgs/reverse-green.svg?raw'
import reverseYellow from '@/assets/cards-svgs/reverse-yellow.svg?raw'

import twoDrawRed from '@/assets/cards-svgs/two-draw-red.svg?raw'
import twoDrawBlue from '@/assets/cards-svgs/two-draw-blue.svg?raw'
import twoDrawGreen from '@/assets/cards-svgs/two-draw-green.svg?raw'
import twoDrawYellow from '@/assets/cards-svgs/two-draw-yellow.svg?raw'

import fourDrawRed from '@/assets/cards-svgs/four-draw-red.svg?raw'
import fourDrawBlue from '@/assets/cards-svgs/four-draw-blue.svg?raw'
import fourDrawGreen from '@/assets/cards-svgs/four-draw-green.svg?raw'
import fourDrawYellow from '@/assets/cards-svgs/four-draw-yellow.svg?raw'

import skipEveryoneRed from '@/assets/cards-svgs/skip-everyone-red.svg?raw'
import skipEveryoneBlue from '@/assets/cards-svgs/skip-everyone-blue.svg?raw'
import skipEveryoneGreen from '@/assets/cards-svgs/skip-everyone-green.svg?raw'
import skipEveryoneYellow from '@/assets/cards-svgs/skip-everyone-yellow.svg?raw'

import discardAllRed from '@/assets/cards-svgs/discard-all-red.svg?raw'
import discardAllBlue from '@/assets/cards-svgs/discard-all-blue.svg?raw'
import discardAllGreen from '@/assets/cards-svgs/discard-all-green.svg?raw'
import discardAllYellow from '@/assets/cards-svgs/discard-all-yellow.svg?raw'

// Import wild card SVGs (no color variants needed)
import wildRoulette from '@/assets/cards-svgs/wild-roulette.svg?raw'
import wildTenDraw from '@/assets/cards-svgs/wild-ten-draw.svg?raw'
import wildDrawSix from '@/assets/cards-svgs/wild-draw-six.svg?raw'
import wildReverseFourDraw from '@/assets/cards-svgs/wild-reverse-four-draw.svg?raw'

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
