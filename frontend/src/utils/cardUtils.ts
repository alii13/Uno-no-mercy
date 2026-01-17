/**
 * Card utility functions
 */

import type { Card, CardColor } from '@/types/card'

// Simple UUID generator
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a full UNO No Mercy deck (168 cards)
 * Card distribution:
 * Colored Cards (136 total, 34 per color):
 *   Number Cards (22 per color):
 *     - 1 Zero card = 4 total
 *     - 2 sets of 1-9 = 72 total
 *     - 3 additional numbers (extra 1s, 7s) = 12 total
 *   Action Cards (12 per color):
 *     - 2 Reverse = 8 total
 *     - 2 Skip = 8 total
 *     - 2 Draw Two = 8 total
 *     - 2 Discard All = 8 total
 *     - 2 Skip Everyone = 8 total
 *     - 2 "10" Play Again = 8 total
 * Wild Cards (32 total):
 *     - 8 Wild Draw Four = 8 total
 *     - 4 Wild Draw Six = 4 total
 *     - 4 Wild Draw Ten = 4 total
 *     - 4 Wild Color Roulette = 4 total
 *     - 4 Wild Reverse Draw Four = 4 total
 *     - 8 Standard Wild = 8 total
 * Total: 168 cards
 */
export function createDeck(): Card[] {
  const deck: Card[] = []
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']
  
  // Number Cards (22 per color)
  colors.forEach(color => {
    // 1 Zero card per color
    deck.push({
      id: generateId(),
      color,
      type: 'number',
      value: 0,
    })
    
    // 2 sets of numbers 1-9 per color
    for (let num = 1; num <= 9; num++) {
      for (let i = 0; i < 2; i++) {
        deck.push({
          id: generateId(),
          color,
          type: 'number',
          value: num,
        })
      }
    }
    
    // 3 additional number cards per color (extra 1s, 7s, and 1s)
    // Distributing as: 1 extra "1", 1 extra "7", 1 extra "1" per color
    deck.push({
      id: generateId(),
      color,
      type: 'number',
      value: 1,
    })
    deck.push({
      id: generateId(),
      color,
      type: 'number',
      value: 7,
    })
    deck.push({
      id: generateId(),
      color,
      type: 'number',
      value: 1,
    })
    
    // 2 "10" Play Again cards per color (number card with value 10)
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'number',
        value: 10, // "10" Play Again modifier
      })
    }
  })
  
  // Action Cards (12 per color)
  colors.forEach(color => {
    // 2 Reverse per color
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'reverse',
      })
    }
    
    // 2 Skip per color
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'skip',
      })
    }
    
    // 2 Draw Two per color
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'draw2',
      })
    }
    
    // 2 Discard All per color
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'discardAll',
      })
    }
    
    // 2 Skip Everyone per color
    for (let i = 0; i < 2; i++) {
      deck.push({
        id: generateId(),
        color,
        type: 'skipEveryone',
      })
    }
  })
  
  // Wild Cards (32 total)
  // 8 Wild Draw Four
  for (let i = 0; i < 8; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'draw4',
    })
  }
  
  // 4 Wild Draw Six
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'draw6',
    })
  }
  
  // 4 Wild Draw Ten
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'draw10',
    })
  }
  
  // 4 Wild Color Roulette
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'wildColorRoulette',
    })
  }
  
  // 4 Wild Reverse Draw Four
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'wildReverseDraw4',
    })
  }
  
  // 8 Standard Wild cards
  for (let i = 0; i < 8; i++) {
    deck.push({
      id: generateId(),
      color: 'wild',
      type: 'wild',
    })
  }
  
  // Total: 136 colored + 32 wild = 168 cards
  return deck
}

/**
 * Shuffle deck using Fisher-Yates algorithm
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }
  return shuffled
}

/**
 * Deal cards to players
 */
export function dealCards(deck: Card[], count: number): { cards: Card[]; remainingDeck: Card[] } {
  const cards = deck.slice(0, count)
  const remainingDeck = deck.slice(count)
  return { cards, remainingDeck }
}

/**
 * Check if a card can be played
 */
export function canPlayCard(card: Card, topCard: Card): boolean {
  // Wild cards can always be played
  if (card.color === 'wild' || card.type.startsWith('wild')) {
    return true
  }
  
  // Match color
  if (card.color === topCard.color) {
    return true
  }
  
  // Match number
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
    return true
  }
  
  // Match type (for action cards)
  if (card.type === topCard.type && card.type !== 'number') {
    return true
  }
  
  return false
}

/**
 * Get human-readable card name
 */
export function getCardDisplayName(card: Card): string {
  if (card.type === 'number') {
    return `${card.color} ${card.value}`
  }
  
  const typeNames: Record<string, string> = {
    skip: 'Skip',
    reverse: 'Reverse',
    draw2: 'Draw 2',
    skipEveryone: 'Skip Everyone',
    discardAll: 'Discard All',
    tenReplayModifier: '10 Play Again',
    wild: 'Wild',
    draw4: 'Wild Draw 4',
    draw6: 'Wild Draw 6',
    draw10: 'Wild Draw 10',
    wildReverseDraw4: 'Wild Reverse Draw 4',
    wildColorRoulette: 'Wild Color Roulette',
  }
  
  const typeName = typeNames[card.type] || card.type
  return card.color === 'wild' ? typeName : `${card.color} ${typeName}`
}

