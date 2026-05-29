import type { Card, CardColor } from '../types/card'

export type StackingMode = 'official' | 'house' | 'casual'

export const DEFAULT_STACKING_MODE: StackingMode = 'official'

/**
 * Checks if a card can be played on top of the current top card.
 *
 * Stacking modes:
 *  - 'official': any draw card stacks only if its draw value >= the top card's
 *  - 'house':    wild draw cards stack on any draw card; colored draw cards still need equal-or-higher
 *  - 'casual':   any draw card stacks on any draw card
 */
export function canPlayCard(
    card: Card,
    topCard: Card,
    currentColor: CardColor,
    drawStack: number,
    stackingMode: StackingMode = DEFAULT_STACKING_MODE
): boolean {
    // 1. Stacking Logic - varies by stacking mode
    if (drawStack > 0) {
        const drawVal = getDrawValue(card)
        if (drawVal <= 0) return false

        if (stackingMode === 'casual') {
            return true
        }

        if (stackingMode === 'house') {
            // Wild draw cards stack on anything
            if (card.color === 'wild') return true
            // Colored draw cards still need equal-or-higher
            return drawVal >= getDrawValue(topCard)
        }

        // 'official'
        return drawVal >= getDrawValue(topCard)
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
