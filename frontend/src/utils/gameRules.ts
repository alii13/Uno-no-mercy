import type { Card, CardColor } from '../types/card'

/**
 * Checks if a card can be played on top of the current top card.
 */
export function canPlayCard(
    card: Card,
    topCard: Card,
    currentColor: CardColor,
    drawStack: number
): boolean {
    // 1. Stacking Logic definition
    if (drawStack > 0) {
        const drawVal = getDrawValue(card)
        // Must play a draw card to stack.
        if (drawVal > 0) {
            const topDrawValue = getDrawValue(topCard)
            return drawVal >= topDrawValue
        }
        return false // Cannot play non-draw card when facing a stack validation
    }

    // 2. Standard Uno Logic

    // Wilds are always playable
    if (card.color === 'wild') return true

    // Color Match
    if (card.color === currentColor) return true

    // Value/Symbol Match
    if (card.type === topCard.type) {
        if (card.type === 'number') {
            return card.value === topCard.value
        }
        return true
    }

    return false
}

export function getDrawValue(card: Card): number {
    switch (card.type) {
        case 'draw2': return 2
        case 'draw4': return 4
        case 'wildReverseDraw4': return 4
        case 'draw6': return 6
        case 'draw10': return 10
        default: return 0
    }
}

export function getNextPlayerIndex(
    current: number,
    direction: 1 | -1,
    playerCount: number
): number {
    let next = current + direction
    if (next >= playerCount) next = 0
    if (next < 0) next = playerCount - 1
    return next
}
