export type {
    Card,
    CardColor,
    CardType,
    Player,
    GameState,
    TurnState,
    StackingMode,
    Rng,
    EngineState,
    EngineEvent,
} from './types'

export {
    generateFullDeck,
    shuffleDeck,
    verifyDeck,
    getDeckBreakdown,
} from './deck'

export {
    DEFAULT_STACKING_MODE,
    canPlayCard,
    getDrawValue,
    getNextPlayerIndex,
    calculateNextPlayerIndex,
    calculateScore,
    reshuffleDeck,
    checkMercyRule,
    getWildCardColor,
    countByColor,
    rotateHands,
} from './rules'

export {
    currentPlayer,
    topCard,
    drawCardFromDeck,
    drawCardToHand,
    checkMercyElimination,
    endGame,
    applyScoresToWinner,
    advanceTurn,
    playCard,
    applyCardEffect,
    resolveDiscardAllTop,
    selectDiscardAllTop,
    rotateActiveHands,
    swapHands,
    skipSwap,
    setRouletteColor,
    rouletteDrawStep,
    finishRouletteTurn,
    penalizeUnoDraws,
    drawFirstDiscard,
} from './engine'

export type { PlayCardOpts, PlayResult, RouletteOutcome } from './engine'
