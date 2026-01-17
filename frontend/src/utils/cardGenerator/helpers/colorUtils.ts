/**
 * Color utility functions for card generation
 */

export function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0, g: 0, b: 0 }
  return {
    r: parseInt(result[1] || '0', 16),
    g: parseInt(result[2] || '0', 16),
    b: parseInt(result[3] || '0', 16),
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export function lighten(color: string | undefined, percent: number): string {
  if (!color) return '#FFFFFF'
  const rgb = hexToRgb(color)
  const factor = 1 + percent / 100
  return rgbToHex(
    Math.min(255, Math.round(rgb.r * factor)),
    Math.min(255, Math.round(rgb.g * factor)),
    Math.min(255, Math.round(rgb.b * factor))
  )
}

export function darken(color: string | undefined, percent: number): string {
  if (!color) return '#000000'
  const rgb = hexToRgb(color)
  const factor = 1 - percent / 100
  return rgbToHex(
    Math.max(0, Math.round(rgb.r * factor)),
    Math.max(0, Math.round(rgb.g * factor)),
    Math.max(0, Math.round(rgb.b * factor))
  )
}

export function rgba(color: string | undefined, alpha: number): string {
  if (!color) return `rgba(0, 0, 0, ${alpha})`
  const rgb = hexToRgb(color)
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

// Color schemes for each card color
export const COLOR_PALETTE: Record<string, string> = {
  red: '#E53E3E',
  blue: '#3182CE',
  green: '#38A169',
  yellow: '#D69E2E',
  wild: '#805AD5', // Purple for wild cards
}

export function getColorScheme(color: string): {
  primary: string
  secondary: string
  text: string
} {
  const primary = COLOR_PALETTE[color] || COLOR_PALETTE.wild || '#805AD5'
  return {
    primary,
    secondary: darken(primary, 20),
    text: color === 'yellow' ? '#1A202C' : '#FFFFFF', // Dark text for yellow, white for others
  }
}

