import type { Card, CardColor, StackingMode, TurnState } from './engine'

export interface PresencePlayer {
    userId: string
    name: string
    connected: boolean
}

// --- Intents: what a client may ask the authoritative room to do ---

export type IntentAction =
    | { kind: 'PLAY_CARD'; cardId: string; chosenColor?: CardColor }
    | { kind: 'DRAW' }
    | { kind: 'PICK_DISCARD_ALL_TOP'; cardId: string }
    | { kind: 'CHOOSE_DRAWN_WILD_COLOR'; color: CardColor }
    | { kind: 'SET_ROULETTE_COLOR'; color: CardColor }
    | { kind: 'SWAP_HANDS'; targetUserId: string }
    | { kind: 'SKIP_SWAP' }
    | { kind: 'CALL_UNO' }

export type ClientMsg =
    | { t: 'auth'; token: string; name: string }
    | { t: 'ping'; now: number }
    | { t: 'leave' }
    | { t: 'rename'; name: string }
    | { t: 'kick'; userId: string }
    | { t: 'start'; stackingMode?: StackingMode }
    | { t: 'intent'; id: string; action: IntentAction }

// --- Game events: animation-grade facts, personalized per viewer ---

export type GameEvent =
    | { t: 'STARTED' }
    | { t: 'CARD_PLAYED'; by: string; card: Card; chosenColor?: CardColor }
    | { t: 'YOU_DREW'; cards: Card[] }
    | { t: 'PLAYER_DREW'; playerId: string; count: number }
    | { t: 'RESHUFFLED' }
    | { t: 'ELIMINATED'; playerId: string }
    | { t: 'UNO_PENALTY'; playerId: string }
    | { t: 'AT_ONE'; playerId: string }
    | { t: 'UNO_CALLED'; playerId: string }
    | { t: 'ROULETTE_ENDED'; playerId: string; outcome: 'match' | 'eliminated' | 'exhausted'; matchCard?: Card }
    | { t: 'GAME_OVER'; winnerId: string }

// --- Personalized snapshot: everything a client may know ---

export interface SnapshotPlayer {
    userId: string
    name: string
    seat: number
    handCount: number
    isEliminated: boolean
    connected: boolean
    calledUno: boolean
}

export interface PersonalView {
    status: 'lobby' | 'playing' | 'finished'
    hostUserId: string | null
    players: SnapshotPlayer[]
    you: { userId: string; seat: number; hand: Card[] } | null
    currentPlayerId: string | null
    turnState: TurnState
    direction: 1 | -1
    drawStack: number
    currentColor: CardColor
    discardTop: Card | null
    deckCount: number
    discardCount: number
    rouletteTargetColor: CardColor | null
    /** Only present for the player who must pick a Discard All top card. */
    pendingDiscardAllCards: Card[] | null
    /** Only present for the player who drew a playable wild. */
    pendingDrawnWildCard: Card | null
    stackingMode: StackingMode
    winnerId: string | null
}

export type ServerMsg =
    | { t: 'hello'; roomCode: string; userId: string; hostUserId: string | null }
    | { t: 'presence'; players: PresencePlayer[] }
    | { t: 'pong'; now: number }
    | { t: 'snapshot'; seq: number; game: PersonalView }
    | { t: 'event'; seq: number; ev: GameEvent; intentId?: string }
    | { t: 'error'; code: 'unauthorized' | 'bad-message' | 'room-not-found' | 'not-host' | 'not-started' | 'already-started' | 'need-players' | 'not-in-lobby' | 'invalid-intent'; intentId?: string }
