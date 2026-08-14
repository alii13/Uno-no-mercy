import { describe, it, expect } from 'vitest'
import { botIntent, isBotId, botIdFor, profileIdFromBotId } from './botTurn'
import { BOT_LADDER } from '../../shared/engine/bot'
import type { Card, EngineState, Player, TurnState } from '../../shared/engine'

const profile = BOT_LADDER[3]!
/** Fixed rng so a decision is a decision, not a coin toss. */
const rng = () => 0.5

const red5: Card = { id: 'r5', color: 'red', type: 'number', value: 5 }
const red7: Card = { id: 'r7', color: 'red', type: 'number', value: 7 }
const blue2: Card = { id: 'b2', color: 'blue', type: 'number', value: 2 }
const wild: Card = { id: 'w', color: 'wild', type: 'wild' }
const roulette: Card = { id: 'wr', color: 'wild', type: 'wildColorRoulette' }
const draw2: Card = { id: 'd2', color: 'red', type: 'draw2' }

function seat(id: string, hand: Card[]): Player {
    return { id, name: id, hand, isEliminated: false, score: 0 }
}

function state(over: Partial<EngineState> & { players: Player[] }): EngineState {
    return {
        deck: [],
        discardPile: [red5],
        currentPlayerIndex: 0,
        direction: 1,
        drawStack: 0,
        currentColor: 'red',
        turnState: 'WAITING_FOR_ACTION' as TurnState,
        gameState: 'PLAYING',
        winnerId: null,
        rouletteTargetColor: null,
        pendingDiscardAllCards: [],
        swapInitiatorId: null,
        hasCalledUno: {},
        stackingMode: 'official',
        ...over,
    } as EngineState
}

describe('bot id helpers', () => {
    it('round-trips a profile id and never claims a human seat', () => {
        const id = botIdFor('rook')
        expect(isBotId(id)).toBe(true)
        expect(profileIdFromBotId(id)).toBe('rook')
        expect(isBotId('9f3ac21b-0000-4000-8000-000000000000')).toBe(false)
    })
})

describe('botIntent', () => {
    it('plays a legal card on its turn', () => {
        // Three cards: at two it would owe a MERCY call first (see below).
        const s = state({ players: [seat('bot:rook', [red7, blue2, wild]), seat('human', [red5])] })
        expect(botIntent(s, 'bot:rook', profile, rng)).toMatchObject({ kind: 'PLAY_CARD' })
    })

    it('draws when nothing is playable', () => {
        const s = state({ players: [seat('bot:rook', [blue2]), seat('human', [red5])], currentColor: 'green' })
        expect(botIntent(s, 'bot:rook', profile, rng)).toEqual({ kind: 'DRAW' })
    })

    it('picks a colour when it plays a wild, but not for roulette', () => {
        const withWild = state({ players: [seat('bot:rook', [wild]), seat('human', [red5])] })
        const played = botIntent(withWild, 'bot:rook', profile, rng)
        expect(played).toMatchObject({ kind: 'PLAY_CARD', cardId: 'w' })
        expect((played as { chosenColor?: string }).chosenColor).toBeDefined()

        // Roulette chooses its target colour in its own turn state.
        const withRoulette = state({ players: [seat('bot:rook', [roulette]), seat('human', [red5])] })
        expect(botIntent(withRoulette, 'bot:rook', profile, rng)).toEqual({ kind: 'PLAY_CARD', cardId: 'wr' })
    })

    it('calls MERCY at two cards, so humans cannot farm a free catch', () => {
        const s = state({ players: [seat('bot:rook', [red7, blue2]), seat('human', [red5])] })
        expect(botIntent(s, 'bot:rook', profile, rng)).toEqual({ kind: 'CALL_UNO' })
        // The call takes the tick; the card follows on the next one.
        const called = state({
            players: [seat('bot:rook', [red7, blue2]), seat('human', [red5])],
            hasCalledUno: { 'bot:rook': true },
        })
        expect(botIntent(called, 'bot:rook', profile, rng)).toMatchObject({ kind: 'PLAY_CARD' })
    })

    it('answers each choosing state with the matching intent', () => {
        const players = [seat('bot:rook', [red7, blue2, wild]), seat('human', [red5])]
        expect(botIntent(state({ players, turnState: 'CHOOSING_DRAWN_WILD_COLOR' }), 'bot:rook', profile, rng))
            .toMatchObject({ kind: 'CHOOSE_DRAWN_WILD_COLOR' })
        expect(botIntent(state({ players, turnState: 'CHOOSING_ROULETTE_COLOR' }), 'bot:rook', profile, rng))
            .toMatchObject({ kind: 'SET_ROULETTE_COLOR' })
        expect(botIntent(state({
            players, turnState: 'CHOOSING_DISCARD_ALL_TOP', pendingDiscardAllCards: [draw2],
        }), 'bot:rook', profile, rng)).toEqual({ kind: 'PICK_DISCARD_ALL_TOP', cardId: 'd2' })
        expect(botIntent(state({ players, turnState: 'CHOOSING_PLAYER_TO_SWAP' }), 'bot:rook', profile, rng))
            .toMatchObject({ kind: 'SWAP_HANDS' })
    })

    it('stays silent when it is not its turn, it is out, or the game is over', () => {
        const players = [seat('bot:rook', [red7]), seat('human', [red5])]
        expect(botIntent(state({ players, currentPlayerIndex: 1 }), 'bot:rook', profile, rng)).toBeNull()
        expect(botIntent(state({ players, gameState: 'GAME_OVER' }), 'bot:rook', profile, rng)).toBeNull()

        const out = [{ ...seat('bot:rook', [red7]), isEliminated: true }, seat('human', [red5])]
        expect(botIntent(state({ players: out }), 'bot:rook', profile, rng)).toBeNull()
        expect(botIntent(state({ players }), 'bot:nobody', profile, rng)).toBeNull()
    })

    it('passes a live stack on rather than eating it when it holds a draw card', () => {
        const s = state({
            players: [seat('bot:rook', [draw2, blue2]), seat('human', [red5])],
            drawStack: 2,
            hasCalledUno: { 'bot:rook': true },
        })
        expect(botIntent(s, 'bot:rook', profile, rng)).toEqual({ kind: 'PLAY_CARD', cardId: 'd2' })
    })
})
