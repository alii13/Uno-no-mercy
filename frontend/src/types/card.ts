export type CardColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild'

export type CardType =
  | 'number'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'skipEveryone'
  | 'discardAll'
  | 'wild'
  | 'draw4'
  | 'draw6'
  | 'draw10'
  | 'wildReverseDraw4'
  | 'wildColorRoulette'

export interface Card {
  id: string
  color: CardColor
  type: CardType
  value?: number // 0-9
  isPlayable?: boolean
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  isEliminated: boolean
  isBot?: boolean
  score?: number
}

export type GameState = 'LOBBY' | 'PLAYING' | 'GAME_OVER'
export type TurnState =
  | 'WAITING_FOR_ACTION'
  | 'CHOOSING_COLOR'
  | 'CHOOSING_PLAYER_TO_SWAP'
  | 'STACKING_RESPONSE'
  | 'ROULETTE_DRAWING'
  | 'CHOOSING_ROULETTE_COLOR'
  | 'CHOOSING_DRAWN_WILD_COLOR'
  | 'CHOOSING_DISCARD_ALL_TOP'
  | 'DEALING'

export interface ColorScheme {
  primary: string      // Main color
  secondary: string   // Darker shade
  gradient: string    // Gradient definition ID
  glow: string        // Glow color
  text: string        // Text color (white/black)
}

export interface CardTemplate {
  type: CardType
  baseTemplate: string
  colorSchemes: Record<CardColor, ColorScheme>
  contentGenerator: (card: Card) => string
  effectsGenerator: (card: Card) => string
}

export interface Size {
  width: number
  height: number
}

