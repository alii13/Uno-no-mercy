/**
 * Generate a list of all required SVG filenames for UNO No Mercy deck
 * This helps identify which SVG files need to be created
 */

import type { CardColor } from '@/types/card'

const NUMBER_WORDS: Record<number, string> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
}

const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']

export function generateRequiredSVGFilenames(): string[] {
  const filenames: string[] = []
  
  // Number cards: {number}-{color}.svg (2 of each number per color)
  colors.forEach(color => {
    for (let num = 0; num <= 9; num++) {
      if (num === 7) {
        filenames.push(`seven-swap-${color}.svg`)
      } else {
        filenames.push(`${NUMBER_WORDS[num]}-${color}.svg`)
      }
    }
  })
  
  // Skip: skip-{color}.svg
  colors.forEach(color => {
    filenames.push(`skip-${color}.svg`)
  })
  
  // Skip Everyone: skip-everyone-{color}.svg
  colors.forEach(color => {
    filenames.push(`skip-everyone-${color}.svg`)
  })
  
  // Reverse: reverse-{color}.svg
  colors.forEach(color => {
    filenames.push(`reverse-${color}.svg`)
  })
  
  // Draw Two: two-draw-{color}.svg
  colors.forEach(color => {
    filenames.push(`two-draw-${color}.svg`)
  })
  
  // Draw Four: four-draw-{color}.svg
  colors.forEach(color => {
    filenames.push(`four-draw-${color}.svg`)
  })
  
  // Discard All: discard-all-{color}.svg
  colors.forEach(color => {
    filenames.push(`discard-all-${color}.svg`)
  })
  
  // Wild cards (no color):
  filenames.push('wild-reverse-four-draw.svg')
  filenames.push('wild-six-draw.svg') // Note: you may need to create this
  filenames.push('wild-ten-draw.svg')
  filenames.push('wild-roulette.svg')
  
  return [...new Set(filenames)] // Remove duplicates
}

// Export the list
export const REQUIRED_SVG_FILES = generateRequiredSVGFilenames()

// Log missing files (files we have vs files we need)
const AVAILABLE_FILES = [
  'zero-green.svg',
  'one-green.svg',
  'skip-yellow.svg',
  'reverse-blue.svg',
  'two-draw-green.svg',
  'four-draw-red.svg',
  'skip-everyone-red.svg',
  'discard-all-green.svg',
  'seven-swap-yellow.svg',
  'wild-roulette.svg',
  'wild-ten-draw.svg',
  'wild-reverse-four-draw.svg',
]

export function getMissingSVGFiles(): string[] {
  const available = AVAILABLE_FILES.map(f => f.replace('.svg', ''))
  
  return REQUIRED_SVG_FILES.filter(filename => {
    const baseName = filename.replace('.svg', '')
    const baseParts = baseName.split('-')
    const firstPart = baseParts[0] || ''
    return !available.some(avail => {
      const availParts = avail.split('-')
      const availFirst = availParts[0] || ''
      return baseName === avail || firstPart === availFirst
    })
  })
}

