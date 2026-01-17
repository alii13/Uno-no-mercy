/**
 * Gradient generators for card backgrounds
 */

import { lighten, darken, rgba } from '../helpers/colorUtils'
import type { ColorScheme } from '@/types/card'

export function generateCardGradient(colorScheme: ColorScheme, cardType: string): string {
  const gradientId = `cardGradient-${colorScheme.primary.replace('#', '')}`
  const highlightId = `highlightGradient-${colorScheme.primary.replace('#', '')}`
  
  if (cardType.startsWith('wild')) {
    return generateWildGradient()
  }
  
  return `
    <radialGradient id="${gradientId}" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${lighten(colorScheme.primary, 25)}" />
      <stop offset="50%" stop-color="${colorScheme.primary}" />
      <stop offset="100%" stop-color="${darken(colorScheme.primary, 15)}" />
    </radialGradient>
    
    <linearGradient id="${highlightId}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${rgba('#FFFFFF', 0.3)}" />
      <stop offset="100%" stop-color="${rgba('#FFFFFF', 0)}" />
    </linearGradient>
  `
}

export function generateWildGradient(): string {
  return `
    <linearGradient id="wildGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#E53E3E" />
      <stop offset="25%" stop-color="#3182CE" />
      <stop offset="50%" stop-color="#38A169" />
      <stop offset="75%" stop-color="#D69E2E" />
      <stop offset="100%" stop-color="#805AD5" />
    </linearGradient>
    
    <linearGradient id="wildShimmer" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="white" stop-opacity="0" />
      <stop offset="50%" stop-color="white" stop-opacity="0.5" />
      <stop offset="100%" stop-color="white" stop-opacity="0" />
    </linearGradient>
  `
}

export function generateActionPattern(): string {
  return `
    <pattern id="actionPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1" fill="currentColor" opacity="0.1" />
    </pattern>
  `
}

