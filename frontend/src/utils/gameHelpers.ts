import type { Card, CardColor } from '../types/card'
import { shuffleDeck } from './deckGenerator'

/**
 * Calculate card positioning style for fan-spread hand display
 * @param index - Card's position in hand
 * @param totalCards - Total number of cards in hand
 * @param hoverIndex - Currently hovered card index (-1 if none)
 * @returns Style object with zIndex and transform
 */
export function getCardStyle(
    index: number,
    totalCards: number,
    hoverIndex: number,
    compact?: boolean
): { zIndex: number; transform: string } {
    const middleIndex = (totalCards - 1) / 2
    const offset = index - middleIndex
    const isHovered = hoverIndex === index

    const spreadX = compact ? 1.8 : 3
    const spreadRotate = compact ? 1.8 : 3
    const hoverLift = compact ? -15 : -25
    const arcY = compact ? 1.2 : 2

    return {
        zIndex: isHovered ? 100 : index,
        transform: `
            translateX(${offset * spreadX}px)
            rotate(${offset * spreadRotate}deg)
            translateY(${isHovered ? hoverLift : Math.abs(offset) * arcY}px)
        `
    }
}

/**
 * Calculate the next player index based on current position and direction
 * @param currentIndex - Current player index
 * @param direction - Game direction (1 or -1)
 * @param playerCount - Total number of players
 * @returns The next player index (wrapped around)
 */
export function calculateNextPlayerIndex(
    currentIndex: number,
    direction: 1 | -1,
    playerCount: number
): number {
    let nextIdx = currentIndex + direction
    if (nextIdx < 0) nextIdx = playerCount - 1
    if (nextIdx >= playerCount) nextIdx = 0
    return nextIdx
}

/**
 * Calculate score for a winning player based on opponents' remaining hands
 * @param hands - Array of card hands (one per opponent)
 * @param eliminatedFlags - Array indicating if each player is eliminated
 * @returns Total points earned
 */
export function calculateScore(
    hands: Card[][],
    eliminatedFlags: boolean[]
): number {
    let totalPoints = 0

    hands.forEach((hand, idx) => {
        if (eliminatedFlags[idx]) {
            // Rule: CAUSE a player to be eliminated = 250 bonus points
            totalPoints += 250
        } else {
            hand.forEach(card => {
                if (card.color === 'wild') {
                    totalPoints += 50
                } else if (card.type !== 'number') {
                    totalPoints += 20
                } else {
                    totalPoints += card.value || 0
                }
            })
        }
    })

    return totalPoints
}

/**
 * Reshuffle discard pile into deck when deck is empty
 * @param deck - Current deck (will be mutated)
 * @param discardPile - Current discard pile (will be mutated)
 * @returns true if reshuffle was possible, false if not enough cards
 */
export function reshuffleDeck(
    deck: Card[],
    discardPile: Card[]
): boolean {
    if (discardPile.length <= 1) return false

    const top = discardPile.pop()!
    const rest = [...discardPile]
    
    // Clear and refill deck with shuffled cards
    deck.length = 0
    deck.push(...shuffleDeck(rest))
    
    // Reset discard pile to just the top card
    discardPile.length = 0
    discardPile.push(top)

    return true
}

/**
 * Check if mercy rule is triggered (25+ cards in hand)
 * @param handLength - Number of cards in player's hand
 * @returns true if player should be eliminated
 */
export function checkMercyRule(handLength: number): boolean {
    return handLength >= 25
}

/**
 * Pick the most common color from a hand (used for wild card color selection)
 * @param hand - Player's current hand
 * @returns Best color to pick, or random color if hand is empty/all wild
 */
export function getWildCardColor(hand: Card[]): CardColor {
    const counts = hand.reduce((acc, card) => {
        if (card.color !== 'wild') {
            acc[card.color] = (acc[card.color] || 0) + 1
        }
        return acc
    }, {} as Record<string, number>)

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const bestColor = sorted[0]?.[0] as CardColor | undefined

    // Fallback to random color if no colored cards in hand
    if (!bestColor) {
        const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']
        return colors[Math.floor(Math.random() * colors.length)]!
    }

    return bestColor
}

/**
 * Rotate hands between players (for 0 card effect)
 * @param hands - Array of player hands
 * @param direction - Game direction (1 or -1)
 * @returns New array of hands after rotation
 */
export function rotateHands(hands: Card[][], direction: 1 | -1): Card[][] {
    const playerCount = hands.length
    if (playerCount < 2) return hands.map(h => [...h])

    const rotated: Card[][] = []
    for (let i = 0; i < playerCount; i++) {
        let sourceIdx = i - direction
        if (sourceIdx < 0) sourceIdx = playerCount - 1
        if (sourceIdx >= playerCount) sourceIdx = 0
        rotated.push([...(hands[sourceIdx] || [])])
    }

    return rotated
}
