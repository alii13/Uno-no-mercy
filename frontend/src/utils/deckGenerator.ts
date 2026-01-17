import type { Card, CardColor, CardType } from '../types/card'

let idCounter = 0

function createCard(color: CardColor, type: CardType, value?: number): Card {
  return {
    id: `card-${idCounter++}`,
    color,
    type,
    value,
    isPlayable: false // Default
  }
}

export function generateFullDeck(): Card[] {
  idCounter = 0
  const deck: Card[] = []
  const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']

  colors.forEach(color => {
    // Number Cards: 0-9 (2 of each)
    for (let i = 0; i <= 9; i++) {
      deck.push(createCard(color, 'number', i))
      deck.push(createCard(color, 'number', i))
    }

    // Action Cards:
    // Skip (3 per color)
    for (let i = 0; i < 3; i++) deck.push(createCard(color, 'skip'))

    // Reverse (3 per color)
    for (let i = 0; i < 3; i++) deck.push(createCard(color, 'reverse'))

    // Draw 2 (2 per color)
    for (let i = 0; i < 2; i++) deck.push(createCard(color, 'draw2'))

    // Draw 4 (2 per color - Yes, colored in No Mercy)
    for (let i = 0; i < 2; i++) deck.push(createCard(color, 'draw4'))

    // Skip Everyone (2 per color)
    for (let i = 0; i < 2; i++) deck.push(createCard(color, 'skipEveryone'))

    // Discard All (2 per color) - reduced from 3 to 2 to balance deck size if needed, but lets stick to 2.
    for (let i = 0; i < 2; i++) deck.push(createCard(color, 'discardAll'))
  })

  // Wild Cards
  // Wild Reverse Draw 4 (8 cards)
  for (let i = 0; i < 8; i++) deck.push(createCard('wild', 'wildReverseDraw4'))

  // Wild Draw 6 (4 cards)
  for (let i = 0; i < 4; i++) deck.push(createCard('wild', 'draw6'))

  // Wild Draw 10 (4 cards)
  for (let i = 0; i < 4; i++) deck.push(createCard('wild', 'draw10'))

  // Wild Color Roulette (8 cards)
  for (let i = 0; i < 8; i++) deck.push(createCard('wild', 'wildColorRoulette'))

  return deck
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck]
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = newDeck[i]
    newDeck[i] = newDeck[j]
    newDeck[j] = temp
  }
  return newDeck
}

export function verifyDeck(deck: Card[]) {
  return {
    count: deck.length,
    valid: deck.length > 0
  }
}

export function getDeckBreakdown(deck: Card[]): Record<string, number> {
  const breakdown: Record<string, number> = {}

  deck.forEach(card => {
    const key = card.type === 'number'
      ? `${card.type}-${card.value}`
      : `${card.type}-${card.color}`
    breakdown[key] = (breakdown[key] || 0) + 1
  })

  return breakdown
}
