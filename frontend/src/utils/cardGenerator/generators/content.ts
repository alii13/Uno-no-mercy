/**
 * Content generators for different card types
 */

import type { ColorScheme } from '@/types/card'
import { getActionIcon, getActionLabel, getWildIcon } from '../assets/icons'
import { COLOR_PALETTE } from '../helpers/colorUtils'

export function generateNumberContent(value: number, colors: ColorScheme): string {
  return `
    <!-- Corner numbers (top-left) -->
    <text x="8" y="20" 
          font-family="'Montserrat', 'Arial Black', sans-serif" 
          font-weight="900" 
          font-size="16"
          fill="${colors.text}"
          filter="url(#textShadow)">${value}</text>
    
    <!-- Corner numbers (bottom-right, rotated) -->
    <text x="55" y="80" 
          font-family="'Montserrat', 'Arial Black', sans-serif" 
          font-weight="900" 
          font-size="16"
          fill="${colors.text}"
          transform="rotate(180 55 80)"
          filter="url(#textShadow)">${value}</text>
    
    <!-- Center number -->
    <text x="31.5" y="44" 
          text-anchor="middle"
          dominant-baseline="central"
          font-family="'Montserrat', 'Arial Black', sans-serif" 
          font-weight="900" 
          font-size="64"
          fill="${colors.text}"
          filter="url(#textShadow)">${value}</text>
  `
}

export function generateActionContent(actionType: string, colors: ColorScheme): string {
  const icon = getActionIcon(actionType)
  const label = getActionLabel(actionType)
  
  return `
    <!-- Background pattern -->
    <rect x="2" y="2" width="59" height="84" fill="url(#actionPattern)" opacity="0.15" />
    
    <!-- Center icon -->
    <g transform="translate(31.5, 36) scale(1.8)">
      <path d="${icon}" fill="${colors.text}" filter="url(#textShadow)" />
    </g>
    
    <!-- Label -->
    <text x="31.5" y="68" 
          text-anchor="middle"
          font-family="'Montserrat', sans-serif" 
          font-weight="700" 
          font-size="11"
          letter-spacing="1px"
          fill="${colors.text}"
          filter="url(#textShadow)">${label}</text>
  `
}

export function generateWildContent(cardType: string): string {
  const wildColors = [COLOR_PALETTE.red, COLOR_PALETTE.blue, COLOR_PALETTE.green, COLOR_PALETTE.yellow]
  const icon = getWildIcon(cardType)
  
  // Determine label based on wild type
  let label = 'WILD'
  if (cardType === 'draw4') label = 'DRAW 4'
  else if (cardType === 'draw6') label = 'DRAW 6'
  else if (cardType === 'draw10') label = 'DRAW 10'
  else if (cardType === 'wildReverseDraw4') label = 'REVERSE +4'
  else if (cardType === 'wildColorRoulette') label = 'ROULETTE'
  
  return `
    <!-- Color indicator dots (corners) -->
    <circle cx="12" cy="12" r="4" fill="${wildColors[0]}" stroke="white" stroke-width="0.5" />
    <circle cx="51" cy="12" r="4" fill="${wildColors[1]}" stroke="white" stroke-width="0.5" />
    <circle cx="12" cy="76" r="4" fill="${wildColors[2]}" stroke="white" stroke-width="0.5" />
    <circle cx="51" cy="76" r="4" fill="${wildColors[3]}" stroke="white" stroke-width="0.5" />
    
    <!-- Center wild symbol/icon -->
    <g transform="translate(31.5, 36) scale(1.5)">
      <path d="${icon}" fill="white" filter="url(#textShadow)" />
    </g>
    
    <!-- Label -->
    <text x="31.5" y="68" 
          text-anchor="middle"
          font-family="'Montserrat', sans-serif" 
          font-weight="700" 
          font-size="10"
          letter-spacing="1px"
          fill="white"
          filter="url(#textShadow)">${label}</text>
    
    <!-- Shimmer overlay (animated via CSS) -->
    <rect x="0" y="0" width="63" height="88" 
          fill="url(#wildShimmer)" 
          opacity="0.3"
          class="wild-shimmer" />
  `
}

