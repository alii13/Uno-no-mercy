/**
 * CSS Color Filters for SVG Cards
 * Uses hue-rotate to change card colors while preserving detail
 * 
 * Base SVGs are GREEN. We use hue-rotate to shift to other colors:
 * - Green (120°) → Red (0°): rotate -120° or +240°
 * - Green (120°) → Blue (240°): rotate +120°
 * - Green (120°) → Yellow (60°): rotate -60° or +300°
 */

export const COLOR_FILTERS: Record<string, string> = {
  // Green to Red: shift hue by -120 degrees (or 240 degrees)
  red: 'hue-rotate(-120deg) saturate(1.2)',
  
  // Green to Blue: shift hue by +120 degrees
  blue: 'hue-rotate(120deg) saturate(1.1)',
  
  // Green: no filter needed (base color)
  green: 'none',
  
  // Green to Yellow: shift hue by -60 degrees
  yellow: 'hue-rotate(-60deg) saturate(1.3) brightness(1.1)',
  
  // Wild cards: no filter
  wild: 'none',
}

/**
 * Get CSS filter for a color
 * Returns filter string to transform base color (green) to target color
 */
export function getColorFilter(color: string | undefined): string {
  if (!color || color === 'wild') return 'none'
  return COLOR_FILTERS[color] || 'none'
}

