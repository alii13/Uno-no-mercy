/**
 * Main Card Generator Class
 * Generates beautiful cards for UNO No Mercy using actual card images
 * Now with proper color-specific SVG files - no CSS filters needed!
 */

import type { Card, Size } from '@/types/card'
import { getCardImage } from './assets/cardImages'

export class CardGenerator {
  private cache: Map<string, string> = new Map()
  
  /**
   * Generate SVG for a card
   */
  generate(card: Card, options: { width?: number; height?: number } = {}): string {
    const cacheKey = `${card.color}-${card.type}-${card.value || ''}`
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }
    
    const size: Size = { 
      width: options.width || 250, 
      height: options.height || 350 
    }
    
    const svg = this.composeCard(card, size)
    
    this.cache.set(cacheKey, svg)
    return svg
  }
  
  /**
   * Compose the complete card SVG using actual card SVG files
   * Each color has its own SVG file - no filters needed!
   */
  private composeCard(card: Card, size: Size): string {
    const cardSVGContent = getCardImage(card)
    
    // Debug: Check if SVG content is loaded
    if (!cardSVGContent || cardSVGContent.trim().length === 0) {
      console.error('Card SVG content is empty for card:', card)
      // Return a simple colored rectangle as fallback
      return `<svg width="${size.width}" height="${size.height}" viewBox="0 0 1696 2528" xmlns="http://www.w3.org/2000/svg">
        <rect width="1696" height="2528" fill="#FF0000" rx="100"/>
        <text x="848" y="1264" font-size="400" fill="white" text-anchor="middle" dominant-baseline="middle">?</text>
      </svg>`
    }
    
    // Extract viewBox from original SVG
    let viewBox = '0 0 1696 2528' // Default viewBox
    const viewBoxMatch = cardSVGContent.match(/viewBox\s*=\s*["']([^"']+)["']/i)
    if (viewBoxMatch && viewBoxMatch[1]) {
      viewBox = viewBoxMatch[1]
    }
    
    // Extract the content between <svg> and </svg>
    const svgContentMatch = cardSVGContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
    const innerContent = svgContentMatch ? svgContentMatch[1] : cardSVGContent
    
    // Build new SVG with proper sizing - colors are already correct in the SVG!
    const svg = `<svg width="${size.width}" height="${size.height}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" class="uno-card ${card.type} ${card.color}" preserveAspectRatio="xMidYMid meet">
      ${innerContent}
    </svg>`
    
    return svg
  }
  
  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * Pre-generate all cards of a specific type
   */
  pregenerateCards(cards: Card[]): void {
    cards.forEach(card => this.generate(card))
  }
}

// Export singleton instance
export const cardGenerator = new CardGenerator()

