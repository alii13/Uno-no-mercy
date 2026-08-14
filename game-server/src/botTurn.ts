/**
 * What a bot wants to do on its turn, as an intent the room can apply.
 *
 * Deliberately a pure decision, not a mutation: it reads engine state and
 * returns the same `IntentAction` a human client would send, so the bot goes
 * through `applyIntent` like everyone else and inherits its validation, its
 * event translation, and every rule fix it ever gets. A bot that mutated the
 * engine directly would be a second implementation of the game to keep in step.
 *
 * The AI itself is the single-player ladder in shared/engine/bot.ts — the same
 * opponents players already meet offline, so a bot-filled public room feels
 * like the game rather than like filler.
 */

import * as engine from '../../shared/engine'
import { chooseCard, chooseSwapTarget, chooseWildColor, type BotProfile } from '../../shared/engine/bot'
import type { EngineState } from '../../shared/engine'
import type { IntentAction } from './protocol'

/** Prefix that marks a seat as ours rather than a Supabase user id. */
export const BOT_ID_PREFIX = 'bot:'

export function isBotId(userId: string): boolean {
    return userId.startsWith(BOT_ID_PREFIX)
}

export function botIdFor(profileId: string): string {
    return `${BOT_ID_PREFIX}${profileId}`
}

export function profileIdFromBotId(userId: string): string {
    return userId.slice(BOT_ID_PREFIX.length)
}

/**
 * The bot's next move, or null when it has nothing to do — not its turn, it is
 * out, or the room is in a phase the bot does not drive. Callers should treat
 * null as "stop scheduling" rather than retrying.
 */
export function botIntent(
    s: EngineState,
    userId: string,
    profile: BotProfile,
    rng: () => number,
): IntentAction | null {
    const me = s.players.find(p => p.id === userId)
    if (!me || me.isEliminated) return null
    if (s.gameState !== 'PLAYING') return null
    if (engine.currentPlayer(s)?.id !== userId) return null

    const opponents = s.players.filter(p => p.id !== userId && !p.isEliminated)

    switch (s.turnState) {
        case 'CHOOSING_DRAWN_WILD_COLOR':
            return { kind: 'CHOOSE_DRAWN_WILD_COLOR', color: chooseWildColor(me.hand, profile, rng) }

        case 'CHOOSING_ROULETTE_COLOR':
            return { kind: 'SET_ROULETTE_COLOR', color: chooseWildColor(me.hand, profile, rng) }

        case 'CHOOSING_DISCARD_ALL_TOP': {
            const first = s.pendingDiscardAllCards[0]
            return first ? { kind: 'PICK_DISCARD_ALL_TOP', cardId: first.id } : null
        }

        case 'CHOOSING_PLAYER_TO_SWAP': {
            const target = chooseSwapTarget({ playable: [], drawStack: s.drawStack, opponents }, profile, rng)
            return target ? { kind: 'SWAP_HANDS', targetUserId: target.id } : { kind: 'SKIP_SWAP' }
        }

        case 'WAITING_FOR_ACTION':
        case 'STACKING_RESPONSE': {
            // Call before playing down to one, or every human at the table gets
            // a free +10 off a bot that never speaks.
            if (me.hand.length === 2 && !s.hasCalledUno[userId]) return { kind: 'CALL_UNO' }

            const top = engine.topCard(s)
            if (!top) return { kind: 'DRAW' }

            const playable = me.hand.filter(c =>
                engine.canPlayCard(c, top, s.currentColor, s.drawStack, s.stackingMode))
            const card = chooseCard({ playable, drawStack: s.drawStack, opponents }, profile, rng)
            if (!card) return { kind: 'DRAW' }

            // Roulette picks its colour in its own turn state, so it must not
            // be handed one here.
            const needsColor = card.color === 'wild' && card.type !== 'wildColorRoulette'
            return needsColor
                ? { kind: 'PLAY_CARD', cardId: card.id, chosenColor: chooseWildColor(me.hand, profile, rng) }
                : { kind: 'PLAY_CARD', cardId: card.id }
        }

        default:
            // DEALING, CHOOSING_COLOR and ROULETTE_DRAWING resolve on the
            // server's own clock; nothing for the bot to send.
            return null
    }
}
