export type {
    Card,
    CardColor,
    CardType,
    Player,
    GameState,
    TurnState,
} from '@engine'

import type { Card, CardColor, CardType } from '@engine'

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
