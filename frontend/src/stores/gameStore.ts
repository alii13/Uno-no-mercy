import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Card, Player, GameState, TurnState, CardColor } from '../types/card'
import { generateFullDeck, shuffleDeck } from '../utils/deckGenerator'
import { canPlayCard, getDrawValue, type StackingMode, DEFAULT_STACKING_MODE } from '../utils/gameRules'
import {
    calculateNextPlayerIndex,
    calculateScore,
    reshuffleDeck as reshuffleDeckHelper,
    checkMercyRule as checkMercyRuleHelper,
    getWildCardColor,
    rotateHands as rotateHandsHelper
} from '../utils/gameHelpers'
import { soundEffects } from '../composables/useSoundEffects'
import { supabase } from '../lib/supabase'

export const useGameStore = defineStore('game', () => {
    // Timings (single tunable block).
    //
    // Two distinct categories — don't blindly cut both:
    //   BOT_DELAYS         pure dead time waiting on the bot. Cut aggressively.
    //   COMPREHENSION_STALLS  time the human needs to absorb what just happened
    //                      (stack landing, roulette spin, mercy elimination).
    //                      These ARE the drama — over-cutting makes the game feel
    //                      anaemic even when "snappier" by the stopwatch.
    const TIMINGS = {
        // --- BOT_DELAYS (pure dead time) ---
        botThink: 1100,                 // turn-start -> bot acts (was 2000)
        botRoulette: 250,               // bot reacts to roulette (was 500)
        botRouletteColorPick: 600,      // bot picks roulette target color (was 1500)

        // --- COMPREHENSION_STALLS (human reads the moment) ---
        drawStaggerPenalty: 200,        // per card when human eats a +N stack (was 250 -> 90 too fast, restored drama)
        drawUntilPlayableRetry: 280,    // between unplayable draws so human reads each card (was 400 -> 150 too fast)
        drawnPlayableAutoPlay: 750,     // pause to read the drawn card before it auto-plays (was 1000 -> 400 too fast)
        rouletteSpin: 520,              // between roulette card reveals — the most dramatic beat (was 800 -> 320 too fast)
        rouletteSafeStall: 1100,        // "Safe!" pause — relief should breathe (was 1500 -> 600 too fast)
        rouletteEliminatedStall: 1500,  // mercy-elimination during roulette — emotional landing (was 1000 -> 400 way too fast)
    } as const

    // --- State ---
    const gameState = ref<GameState>('LOBBY')
    const turnState = ref<TurnState>('WAITING_FOR_ACTION')

    // Dealing Animation State
    const isDealing = ref(false)
    const pendingDealCard = ref<{ playerId: string; card: Card } | null>(null)

    const deck = ref<Card[]>([])
    const discardPile = ref<Card[]>([])

    const players = ref<Player[]>([])
    const currentPlayerIndex = ref(0)
    const direction = ref<1 | -1>(1)

    const drawStack = ref(0)
    const currentColor = ref<CardColor>('red')

    // For Roulette logic
    const rouletteTargetColor = ref<CardColor | null>(null)

    // For draw-until-playable wild card color selection
    const pendingDrawnWildCard = ref<Card | null>(null)

    // For Discard All top card selection
    const pendingDiscardAllCards = ref<Card[]>([])

    const winnerId = ref<string | null>(null)
    const swapInitiatorId = ref<string | null>(null)
    const hasCalledUno = ref<Record<string, boolean>>({})
    // A player who hit 1 card without calling UNO — catchable until the window
    // closes. If it's a bot, the human gets a CAUGHT button; if it's the human,
    // a bot may catch them (~70%). Penalty is a brutal draw 10 (No Mercy).
    const catchableId = ref<string | null>(null)
    let catchTimer: ReturnType<typeof setTimeout> | null = null
    const UNO_PENALTY = 10

    // Re-entrancy guard. Set when a play/draw is in flight so rapid clicks don't queue
    // up actions while bot delays / draw cascades / animations are still resolving.
    const actionInProgress = ref(false)

    // When the human throws their own card, PlayerHand already shows a flying-clone
    // animation arriving on the discard pile. CardPile would otherwise also fire its
    // "slam from above" on the new top card — double animation. Set this true right
    // before player-initiated playCard; CardPile reads + resets it. Bot plays leave
    // it false, so the slam is the ONLY visual (which is correct — there's no clone
    // for bot throws).
    const suppressDiscardSlam = ref(false)

    // Provenance of the most recent play — who threw which card. Drives the
    // seat-to-pile throw animation and special-card payoffs in GameView. The
    // counter retriggers watchers even when consecutive plays look identical.
    const lastPlay = ref<{ playerId: string; card: Card; n: number } | null>(null)
    let playCounter = 0

    // Stacking mode - persists in localStorage so the user keeps their pick across sessions
    function loadStackingMode(): StackingMode {
        try {
            const v = localStorage.getItem('uno_stacking_mode')
            if (v === 'official' || v === 'house' || v === 'casual') return v
        } catch { /* localStorage unavailable */ }
        return DEFAULT_STACKING_MODE
    }
    const stackingMode = ref<StackingMode>(loadStackingMode())
    function setStackingMode(m: StackingMode) {
        stackingMode.value = m
        try { localStorage.setItem('uno_stacking_mode', m) } catch { /* noop */ }
    }

    // --- Per-player stat tracking (keyed by player id) ---
    const gameStartTime = ref<number>(0)
    const playerStats = ref<Record<string, {
        peakCards: number
        drawCardsPlayed: number
        wildCardsPlayed: number
        cardsPlayedTotal: number
        skipsDealt: number
        swapsMade: number
        drawsTaken: number
        biggestStackSurvived: number
        unoCalls: number
        unoPenalties: number
    }>>({})

    // --- Getters ---
    const currentPlayer = computed(() => players.value[currentPlayerIndex.value])
    const topCard = computed(() => discardPile.value[discardPile.value.length - 1])

    // Derived, never latched — a stored flag here once stuck visible after the
    // hand grew past 2 (draw penalties), showing a pointless UNO button at 3+
    // cards. Show it only while calling UNO is meaningful: the human's turn at
    // exactly 2 cards (including choosing a drawn wild's color, since that
    // play counts as going to 1), or while exposed in a catch window.
    const showUnoButton = computed(() => {
        if (gameState.value !== 'PLAYING') return false
        const human = players.value.find(pl => !pl.isBot)
        if (!human || human.isEliminated || hasCalledUno.value[human.id]) return false
        if (catchableId.value === human.id) return true
        return currentPlayer.value?.id === human.id
            && (turnState.value === 'WAITING_FOR_ACTION' || turnState.value === 'CHOOSING_DRAWN_WILD_COLOR')
            && human.hand.length === 2
    })


    // --- Actions ---

    // Bumped whenever the current deal becomes obsolete (new game, return to
    // lobby). The async deal loop checks it after every await so a deal that
    // outlives its game can't keep mutating the next game's state.
    let dealGeneration = 0

    function initializeGame(playerNames: string[], mode?: StackingMode) {
        dealGeneration++
        closeCatchWindow()
        if (mode) setStackingMode(mode)
        players.value = playerNames.map((name, index) => ({
            id: `p-${index}`,
            name,
            hand: [],
            isEliminated: false,
            isBot: index > 0,
            score: 0
        }))

        const rawDeck = generateFullDeck()
        deck.value = shuffleDeck(rawDeck)
        discardPile.value = []

        // DON'T deal cards here - will be done incrementally via dealInitialCards()

        currentPlayerIndex.value = 0
        direction.value = 1
        drawStack.value = 0
        gameState.value = 'PLAYING'
        winnerId.value = null
        turnState.value = 'DEALING'
        rouletteTargetColor.value = null
        isDealing.value = true
        hasCalledUno.value = {}
        // GameView persists across rematches, so any in-flight flags from the
        // previous game must be cleared here or they leak into the new one.
        actionInProgress.value = false
        suppressDiscardSlam.value = false
        pendingDealCard.value = null
        pendingDrawnWildCard.value = null
        pendingDiscardAllCards.value = []
        swapInitiatorId.value = null
        gameStartTime.value = Date.now()

        // Initialize per-player stats
        const stats: typeof playerStats.value = {}
        for (const p of players.value) {
            stats[p.id] = {
                peakCards: 0, drawCardsPlayed: 0, wildCardsPlayed: 0,
                cardsPlayedTotal: 0, skipsDealt: 0, swapsMade: 0,
                drawsTaken: 0, biggestStackSurvived: 0, unoCalls: 0, unoPenalties: 0
            }
        }
        playerStats.value = stats
    }

    // Async function to deal initial cards one-by-one with animation support
    async function dealInitialCards(onCardDealt: (playerId: string, card: Card) => Promise<void>) {
        const CARDS_PER_PLAYER = 7
        const myGen = dealGeneration

        for (let round = 0; round < CARDS_PER_PLAYER; round++) {
            for (const player of players.value) {
                const card = drawCardFromDeck()
                if (!card) continue

                // Set pending card for animation
                pendingDealCard.value = { playerId: player.id, card }

                // Wait for animation callback
                await onCardDealt(player.id, card)

                // Deal became obsolete while awaiting (player left mid-deal,
                // rematch re-initialized) — stop before touching fresh state.
                // Clear the pending card so the stale entry can't render into
                // whatever view replaces this game.
                if (myGen !== dealGeneration) {
                    pendingDealCard.value = null
                    return
                }

                // Add card to hand after animation
                player.hand.push(card)
                pendingDealCard.value = null
            }
        }

        if (myGen !== dealGeneration) return

        // Deal first discard card
        let firstCard = drawCardFromDeck()
        while (firstCard?.type === 'wild' || firstCard?.color === 'wild') {
            deck.value.push(firstCard)
            deck.value = shuffleDeck(deck.value)
            firstCard = drawCardFromDeck()
        }
        if (firstCard) {
            discardPile.value.push(firstCard)
            currentColor.value = firstCard.color

            // Apply first card effect per UNO rules
            if (firstCard.type === 'skip') {
                // First player is skipped
                advanceTurn()
            } else if (firstCard.type === 'reverse') {
                // Reverse direction (in 2-player, first player gets skipped)
                if (players.value.length === 2) {
                    advanceTurn()
                } else {
                    direction.value = -1
                }
            } else if (firstCard.type === 'draw2') {
                // First player draws 2 and is skipped
                drawStack.value = 2
            } else if (firstCard.type === 'draw4') {
                // First player draws 4 and is skipped
                drawStack.value = 4
            } else if (firstCard.type === 'skipEveryone') {
                // All players skipped - dealer (p0) plays again (no-op since p0 starts)
            } else if (firstCard.type === 'discardAll') {
                // First player may discard matching color cards on their turn
            }
        }

        // Dealing complete
        isDealing.value = false
        turnState.value = 'WAITING_FOR_ACTION'

    }

    function drawCardFromDeck(): Card | undefined {
        if (deck.value.length === 0) {
            const reshuffled = reshuffleDeckHelper(deck.value, discardPile.value)
            if (!reshuffled) return undefined
            soundEffects.playCardShuffle()
        }
        return deck.value.pop()
    }

    function drawCardToHand(player: Player): Card | undefined {
        const card = drawCardFromDeck()
        if (card) {
            player.hand.push(card)
            hasCalledUno.value[player.id] = false
            soundEffects.playCardPick()
            // Track peak cards
            const s = playerStats.value[player.id]
            if (s && player.hand.length > s.peakCards) {
                s.peakCards = player.hand.length
            }
        }
        checkMercyRule(player)
        return card
    }

    function checkMercyRule(player: Player): boolean {
        if (checkMercyRuleHelper(player.hand.length)) {
            player.isEliminated = true
            discardPile.value.push(...player.hand)
            player.hand = []

            const activePlayers = players.value.filter(p => !p.isEliminated)
            if (activePlayers.length === 1 && activePlayers[0]) {
                winnerId.value = activePlayers[0].id
                applyScoresToWinner(activePlayers[0].id)
                gameState.value = 'GAME_OVER'
            }
            return true
        }
        return false
    }

    function advanceTurn() {
        // Release the action guard now that the previous player's action has fully resolved.
        actionInProgress.value = false
        const count = players.value.length
        currentPlayerIndex.value = calculateNextPlayerIndex(
            currentPlayerIndex.value,
            direction.value,
            count
        )

        // If coming from Roulette, reset state default
        // FIX: Don't reset if we are just entering CHOOSING logic
        if (turnState.value !== 'ROULETTE_DRAWING' && turnState.value !== 'CHOOSING_ROULETTE_COLOR') {
            turnState.value = 'WAITING_FOR_ACTION'
        }

        // Skip eliminated players
        let sanity = 0
        while (players.value[currentPlayerIndex.value]?.isEliminated && sanity < 20) {
            currentPlayerIndex.value = calculateNextPlayerIndex(
                currentPlayerIndex.value,
                direction.value,
                count
            )
            sanity++
        }

    }

    function callUno(playerId: string) {
        hasCalledUno.value[playerId] = true
        // Calling UNO closes our own catch window — we're safe.
        if (catchableId.value === playerId) closeCatchWindow()
        const s = playerStats.value[playerId]
        if (s) s.unoCalls++
    }

    function clearCatchTimer() {
        if (catchTimer) { clearTimeout(catchTimer); catchTimer = null }
    }

    function closeCatchWindow() {
        catchableId.value = null
        clearCatchTimer()
    }

    // A player ended an action on exactly 1 card without calling UNO — open the
    // catch window. Bots forget ~30% of the time (existing), so this fires for
    // the human's exposure and for a bot that didn't auto-call.
    function openCatchWindow(player: Player) {
        closeCatchWindow()
        catchableId.value = player.id
        if (player.isBot) {
            // Bot forgot UNO — the human can catch it. Window auto-closes if missed.
            catchTimer = setTimeout(() => {
                if (catchableId.value === player.id) closeCatchWindow()
            }, 7000)
        } else {
            // Human is exposed — the UNO button derives from catchableId, and
            // a bot may pounce ~70% of the time before the window closes.
            const willCatch = Math.random() < 0.7
            catchTimer = setTimeout(() => {
                if (catchableId.value !== player.id) return
                if (willCatch) penalizeForgottenUno(player.id)
                else closeCatchWindow()
            }, 1800 + Math.random() * 1600)
        }
    }

    function penalizeForgottenUno(playerId: string) {
        const p = players.value.find(x => x.id === playerId)
        if (!p) { closeCatchWindow(); return }
        closeCatchWindow()
        const s = playerStats.value[p.id]
        if (s) s.unoPenalties++
        // Draw the penalty (mercy elimination is handled inside drawCardToHand).
        for (let i = 0; i < UNO_PENALTY; i++) {
            if (p.isEliminated || gameState.value === 'GAME_OVER') break
            drawCardToHand(p)
        }
    }

    // Human catches an opponent (bot) who forgot UNO.
    function catchNoUno(targetId: string) {
        if (catchableId.value !== targetId) return
        penalizeForgottenUno(targetId)
    }

    function playCard(playerId: string, card: Card, selectedColor?: CardColor) {
        const player = players.value.find(p => p.id === playerId)
        if (!player) return

        if (!topCard.value) return
        if (!canPlayCard(card, topCard.value, currentColor.value, drawStack.value, stackingMode.value)) return

        const cardIndex = player.hand.findIndex(c => c.id === card.id)
        if (cardIndex === -1) return
        const handSizeBeforePlay = player.hand.length
        player.hand.splice(cardIndex, 1)

        discardPile.value.push(card)
        playCounter++
        lastPlay.value = { playerId, card, n: playCounter }

        // Track card play stats
        const s = playerStats.value[playerId]
        if (s) {
            s.cardsPlayedTotal++
            if (card.color === 'wild') s.wildCardsPlayed++
            if (getDrawValue(card) > 0) s.drawCardsPlayed++
            if (card.type === 'skip' || card.type === 'skipEveryone') s.skipsDealt++
        }

        // Handle Color Selection (Wilds)
        if (card.type === 'wildColorRoulette') {
            // Roulette: Color is chosen by NEXT player (Victim)
            // We leave currentColor as is for now, or set to 'wild'
            // It will be set effectively when the victim finds their color.
        } else if (card.color === 'wild') {
            if (selectedColor) {
                currentColor.value = selectedColor
            } else {
                // Fallback (shouldn't happen with UI)
                console.warn("Wild card played without color selection!")
                currentColor.value = 'red'
            }
        } else {
            currentColor.value = card.color
        }

        // Sounds
        soundEffects.playCardLand()
        if (card.color === 'wild' || card.type.includes('draw') || card.type === 'skip' || card.type === 'reverse') {
            soundEffects.playSpecialCard()
        }

        applyCardEffect(card)

        if (card.type === 'wildColorRoulette') {
            // Roulette handling stops here; turn has already advanced to victim in applyCardEffect
            return
        }

        if (player.hand.length === 0) {
            // UNO penalty only applies if player went from exactly 2→1→0 (they had a chance to call UNO)
            // If DiscardAll or other effects dropped them from 3+→0, no UNO call was expected
            const neededUno = handSizeBeforePlay === 2
            if (neededUno && !hasCalledUno.value[player.id]) {
                // Penalty: Draw 2
                if (s) s.unoPenalties++
                drawCardToHand(player)
                drawCardToHand(player)
                // The penalty draws can mercy-eliminate the player and end the game.
                if (gameState.value !== 'GAME_OVER') advanceTurn()
                return
            }
            winnerId.value = player.id
            applyScoresToWinner(player.id)
            gameState.value = 'GAME_OVER'
            return
        }

        // UNO handling when player reaches 1 card. Bots auto-call ~70% of the
        // time; whoever is still exposed (the human, or a bot that forgot)
        // becomes catchable.
        if (player.hand.length === 1 && !hasCalledUno.value[player.id]) {
            if (player.isBot && Math.random() > 0.3) {
                callUno(player.id)
            } else {
                openCatchWindow(player)
            }
        }

        // Advance only if not blocked by special states
        // If applied effect was Roulette, state is now ROULETTE_DRAWING, so we advance to victim
        // FIX: Do not advance if card is 'skipEveryone' (Play Again)
        if (card.type !== 'skipEveryone') {
            if (turnState.value === 'WAITING_FOR_ACTION' || turnState.value === 'ROULETTE_DRAWING' || turnState.value === 'CHOOSING_ROULETTE_COLOR') {
                // Note: CHOOSING_ROULETTE_COLOR means we advance to victim to pick color.
                // If wildColorRoulette played, state is CHOOSING_ROULETTE_COLOR (set in applyCardEffect).
                // We MUST advance so it becomes victim's turn to choose.
                advanceTurn()
            }
        } else {
            // Skip Everyone: turn stays with the current player (play again). advanceTurn
            // is the only place that resets actionInProgress — without this explicit
            // reset, the player who just played Skip Everyone is locked out of their
            // own follow-up turn (canPlay short-circuits on actionInProgress, draw
            // button bails on the same flag). Stuck game.
            actionInProgress.value = false
        }
    }

    // --- Card Effect Handlers ---
    
    function handleReverse(card: Card) {
        const isTwoPlayer = players.value.length === 2
        if (isTwoPlayer) {
            if (card.type === 'reverse') {
                // Reverse acts as Skip in 2p
                advanceTurn()
            }
            // Wild Reverse Draw 4 in 2p: just reverse direction, penalty goes to opponent
            // (the normal advanceTurn in playCard will move to the other player)
            direction.value = direction.value === 1 ? -1 : 1
        } else {
            direction.value = direction.value === 1 ? -1 : 1
        }
    }

    function handleSkip() {
        advanceTurn()
    }

    function handleSkipEveryone(): boolean {
        return true // Signal to stop processing (play again)
    }

    function handleWildColorRoulette() {
        // Next player chooses the color, then draws until they get it
        turnState.value = 'CHOOSING_ROULETTE_COLOR'
        advanceTurn()
    }

    function handleDiscardAll(card: Card): boolean | void {
        const player = currentPlayer.value
        if (!player) return

        const toDiscard = player.hand.filter(c => c.color === card.color)
        if (toDiscard.length === 0) return

        // If only 1 matching card, no choice needed — auto-discard
        if (toDiscard.length === 1) {
            executeDiscardAll(toDiscard, toDiscard[0]!)
            return
        }

        if (player.isBot) {
            // Bot picks a random top card
            const topChoice = toDiscard[Math.floor(Math.random() * toDiscard.length)]!
            executeDiscardAll(toDiscard, topChoice)
            return
        }

        // Human: show picker to choose which card goes on top
        pendingDiscardAllCards.value = toDiscard
        turnState.value = 'CHOOSING_DISCARD_ALL_TOP'
        return true // Signal to stop — don't advance turn yet
    }

    function executeDiscardAll(cards: Card[], topCard: Card) {
        const player = currentPlayer.value
        if (!player) return

        // Discard all except the chosen top card first, then top card last
        const others = cards.filter(c => c.id !== topCard.id)
        for (const c of [...others, topCard]) {
            const idx = player.hand.findIndex(h => h.id === c.id)
            if (idx > -1) {
                player.hand.splice(idx, 1)
                discardPile.value.push(c)
            }
        }
    }

    function selectDiscardAllTop(topCardId: string) {
        if (turnState.value !== 'CHOOSING_DISCARD_ALL_TOP') return
        const cards = pendingDiscardAllCards.value
        const topCard = cards.find(c => c.id === topCardId)
        if (!topCard) return

        executeDiscardAll(cards, topCard)
        pendingDiscardAllCards.value = []
        turnState.value = 'WAITING_FOR_ACTION'

        const player = currentPlayer.value

        // Bulk discard emptied the hand → win (no UNO call expected for a dump).
        if (player && player.hand.length === 0) {
            winnerId.value = player.id
            applyScoresToWinner(player.id)
            gameState.value = 'GAME_OVER'
            return
        }

        // Apply the chosen TOP card's effect, exactly as if it had just been
        // played — a 7 opens the swap prompt, 0 rotates hands, skip/reverse/
        // draw/skip-all all fire. Previously the picked card did nothing.
        applyCardEffect(topCard)

        if (player && player.hand.length === 1 && !hasCalledUno.value[player.id]) {
            if (player.isBot && Math.random() > 0.3) callUno(player.id)
            else openCatchWindow(player)
        }

        // Mirror playCard's advance: Skip Everyone plays again; a swap/choosing
        // state waits for input; otherwise pass the turn.
        if (topCard.type === 'skipEveryone') {
            actionInProgress.value = false
        } else if (turnState.value === 'WAITING_FOR_ACTION') {
            advanceTurn()
        }
    }

    function handleNumberZero() {
        rotateHands()
    }

    function handleNumberSeven(): boolean {
        turnState.value = 'CHOOSING_PLAYER_TO_SWAP'
        if (currentPlayer.value) {
            swapInitiatorId.value = currentPlayer.value.id
        }
        return true // Signal to stop processing
    }

    // Card effect dispatch map
    type CardEffectHandler = (card: Card) => boolean | void
    const cardEffectHandlers: Record<string, CardEffectHandler> = {
        reverse: handleReverse,
        wildReverseDraw4: handleReverse,
        skip: handleSkip,
        skipEveryone: handleSkipEveryone,
        wildColorRoulette: handleWildColorRoulette,
        discardAll: handleDiscardAll
    }

    function applyCardEffect(card: Card) {
        // Apply draw stack (except roulette)
        const drawVal = getDrawValue(card)
        if (drawVal > 0 && card.type !== 'wildColorRoulette') {
            drawStack.value += drawVal
        }

        // Handle special number cards (0 and 7)
        if (card.type === 'number') {
            if (card.value === 0) {
                handleNumberZero()
                return
            }
            if (card.value === 7) {
                handleNumberSeven()
                return
            }
        }

        // Dispatch to effect handler if exists
        const handler = cardEffectHandlers[card.type]
        if (handler) {
            const shouldStop = handler(card)
            if (shouldStop) return
        }
    }

    function rotateHands() {
        if (players.value.length < 2) return
        const hands = players.value.map(p => [...p.hand])
        const rotated = rotateHandsHelper(hands, direction.value)
        players.value.forEach((p, i) => {
            p.hand = rotated[i] || []
        })
    }

    function drawCardsForCurrentPlayer() {
        const p = currentPlayer.value
        if (!p) return
        actionInProgress.value = true

        if (drawStack.value > 0) {
            // Stacking Penalty Draw
            const cardsToDraw = drawStack.value
            const ps = playerStats.value[p.id]
            if (ps) {
                ps.drawsTaken++
                if (cardsToDraw > ps.biggestStackSurvived) {
                    ps.biggestStackSurvived = cardsToDraw
                }
            }
            drawStack.value = 0
            let drawnCount = 0
            function drawNext() {
                // If this player got eliminated mid-stack (crossed the mercy
                // threshold) or the game ended, stop shoveling cards into an
                // emptied hand and don't advance a finished game.
                if (p?.isEliminated || gameState.value === 'GAME_OVER') {
                    if (gameState.value !== 'GAME_OVER') advanceTurn()
                    return
                }
                if (drawnCount < cardsToDraw) {
                    if (p) drawCardToHand(p)
                    drawnCount++
                    setTimeout(drawNext, TIMINGS.drawStaggerPenalty)
                } else {
                    advanceTurn()
                }
            }
            drawNext()
        } else {
            // Standard Draw: Draw Until Playable
            // Creating a loop with delay for visual effect

            function drawUntilPlayable() {
                // Dead-end bails must release the turn — otherwise actionInProgress
                // stays true with no advanceTurn and the whole game soft-locks
                // (e.g. deck + discard both run dry mid-draw).
                if (!p || !topCard.value) { advanceTurn(); return }
                const ps = playerStats.value[p.id]
                if (ps) ps.drawsTaken++
                // Draw 1
                const card = drawCardToHand(p)
                if (!card) { advanceTurn(); return }

                // Check if playable
                if (canPlayCard(card, topCard.value, currentColor.value, 0, stackingMode.value)) {
                    // Playable! Rule: "then immediately play it"
                    setTimeout(() => {
                        if (card.color === 'wild' && !p.isBot) {
                            // Human player needs to pick a color - show modal
                            pendingDrawnWildCard.value = card
                            turnState.value = 'CHOOSING_DRAWN_WILD_COLOR'
                            return
                        }
                        let colorToPick: CardColor | undefined
                        if (card.color === 'wild') {
                            colorToPick = chooseBotColor(p)
                        }
                        playerActionPlayCard(card, colorToPick)
                    }, TIMINGS.drawnPlayableAutoPlay)
                    return
                } else {
                    // Not playable, check mercy rule (handled in drawCardToHand).
                    if (p.isEliminated) {
                        advanceTurn()
                        return
                    }
                    // Draw again
                    setTimeout(drawUntilPlayable, TIMINGS.drawUntilPlayableRetry)
                }
            }
            drawUntilPlayable()
        }
    }

    // NEW: Execute Roulette Draw Logic
    function executeRouletteDraw() {
        if (turnState.value !== 'ROULETTE_DRAWING') return
        const p = currentPlayer.value
        if (!p) return

        // Draw card
        const card = drawCardToHand(p)

        // Deck + discard ran dry mid-roulette — nothing left to draw, so the
        // roulette can never resolve. Without this bail the setTimeout loop below
        // spins forever in ROULETTE_DRAWING. Victim keeps their hand, turn passes.
        if (!card) {
            turnState.value = 'WAITING_FOR_ACTION'
            advanceTurn()
            return
        }

        // Rule: "Wild cards revealed do not count as matching the color – they have to pull an actual colored card of that color"
        if (card && rouletteTargetColor.value && card.color === rouletteTargetColor.value) {
            // Found matching color
            // Rule: "The card that stopped the roulette is discarded and becomes the new top of the discard pile"

            // Remove from hand (it was just added by drawCardToHand)
            const idx = p.hand.indexOf(card)
            if (idx > -1) {
                p.hand.splice(idx, 1)
            }

            // Discard it
            discardPile.value.push(card)

            // Updates current color to the card found (or the target color if wild?)
            currentColor.value = card.color === 'wild' ? rouletteTargetColor.value : card.color

            // Turn ends (Victim loses turn)
            // Add a stall so the user can see the final card before turn jumps
            setTimeout(() => {
                turnState.value = 'WAITING_FOR_ACTION'
                if (gameState.value !== 'GAME_OVER') advanceTurn()
            }, TIMINGS.rouletteSafeStall)

        } else if (p.isEliminated) {
            // Mercy rule trigger. The elimination may have just ended the game —
            // don't advance the turn pointer on a finished game.
            setTimeout(() => {
                turnState.value = 'WAITING_FOR_ACTION'
                if (gameState.value !== 'GAME_OVER') advanceTurn()
            }, TIMINGS.rouletteEliminatedStall)
        } else {
            // Keep drawing
            setTimeout(executeRouletteDraw, TIMINGS.rouletteSpin)
        }
    }

    function executeBotRouletteChoice() {
        if (!currentPlayer.value?.isBot || turnState.value !== 'CHOOSING_ROULETTE_COLOR') return

        const bot = currentPlayer.value
        const color = chooseBotColor(bot)

        // Small delay for realism
        setTimeout(() => {
            if (turnState.value === 'CHOOSING_ROULETTE_COLOR') {
                setRouletteColor(color)
            }
        }, TIMINGS.botRouletteColorPick)
    }

    function swapHands(targetPlayerId: string) {
        if (turnState.value !== 'CHOOSING_PLAYER_TO_SWAP') return
        const initiator = players.value.find(p => p.id === swapInitiatorId.value)
        const target = players.value.find(p => p.id === targetPlayerId)
        if (initiator && target) {
            const s = playerStats.value[initiator.id]
            if (s) s.swapsMade++
            const temp = [...initiator.hand]
            initiator.hand = [...target.hand]
            target.hand = temp
        }
        turnState.value = 'WAITING_FOR_ACTION'
        advanceTurn()
    }

    function skipSwap() {
        if (turnState.value !== 'CHOOSING_PLAYER_TO_SWAP') return
        turnState.value = 'WAITING_FOR_ACTION'
        advanceTurn()
    }

    function returnToLobby() {
        dealGeneration++
        closeCatchWindow()
        gameState.value = 'LOBBY'
        players.value = []
        deck.value = []
        discardPile.value = []
    }

    function playerActionPlayCard(card: Card, selectedColor?: CardColor) {
        if (!currentPlayer.value) return
        actionInProgress.value = true
        playCard(currentPlayer.value.id, card, selectedColor)
    }

    // --- Bot AI Logic ---

    function executeBotTurn() {
        const bot = currentPlayer.value
        if (!bot || !bot.isBot || gameState.value !== 'PLAYING') return

        // Handle special states for Bot
        if (turnState.value === 'ROULETTE_DRAWING') {
            executeRouletteDraw()
            return
        }

        if (turnState.value !== 'WAITING_FOR_ACTION') return

        const top = topCard.value
        if (!top) return

        const playableCards = bot.hand.filter(c =>
            canPlayCard(c, top, currentColor.value, drawStack.value, stackingMode.value)
        )

        if (playableCards.length > 0) {
            let cardToPlay: Card
            if (drawStack.value > 0) {
                cardToPlay = playableCards[0]!
            } else {
                const specialCards = playableCards.filter(c =>
                    c.type !== 'number' && c.type !== 'discardAll'
                )
                if (specialCards.length > 0) {
                    cardToPlay = specialCards[Math.floor(Math.random() * specialCards.length)]!
                } else {
                    cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)]!
                }
            }

            let colorToPick: CardColor | undefined
            if (cardToPlay.color === 'wild') {
                colorToPick = chooseBotColor(bot)
            }
            playerActionPlayCard(cardToPlay, colorToPick)
        } else {
            drawCardsForCurrentPlayer()
        }
    }

    function chooseBotColor(bot: Player): CardColor {
        return getWildCardColor(bot.hand)
    }

    function executeBotSwap() {
        if (!currentPlayer.value?.isBot || turnState.value !== 'CHOOSING_PLAYER_TO_SWAP') return
        const otherPlayers = players.value.filter(p =>
            p.id !== currentPlayer.value?.id && !p.isEliminated
        )
        if (otherPlayers.length > 0) {
            const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)]
            if (target) {
                swapHands(target.id)
            }
        }
    }

    watch([currentPlayerIndex, gameState, turnState, topCard], () => {
        if (gameState.value !== 'PLAYING') return

        const player = currentPlayer.value
        // If it's a bot's turn OR bot is forced to act (Roulette)
        if (player?.isBot) {
            // Debounce slightly to prevent rapid-fire on same turn
            setTimeout(() => {
                // Re-check conditions after delay (game might have ended or state changed)
                if (gameState.value !== 'PLAYING') return
                if (currentPlayerIndex.value !== players.value.indexOf(player) &&
                    turnState.value !== 'ROULETTE_DRAWING' &&
                    turnState.value !== 'CHOOSING_ROULETTE_COLOR' &&
                    turnState.value !== 'CHOOSING_DISCARD_ALL_TOP') return

                if (turnState.value === 'CHOOSING_DISCARD_ALL_TOP') {
                    // Bot auto-selects a random top card
                    const cards = pendingDiscardAllCards.value
                    if (cards.length > 0) {
                        const pick = cards[Math.floor(Math.random() * cards.length)]!
                        selectDiscardAllTop(pick.id)
                    }
                } else if (turnState.value === 'CHOOSING_PLAYER_TO_SWAP') {
                    executeBotSwap()
                } else if (turnState.value === 'ROULETTE_DRAWING') {
                    executeRouletteDraw()
                } else if (turnState.value === 'CHOOSING_ROULETTE_COLOR') {
                    executeBotRouletteChoice()
                } else {
                    executeBotTurn()
                }
            }, turnState.value === 'ROULETTE_DRAWING' ? TIMINGS.botRoulette : TIMINGS.botThink)
        } else {
            // Human player logic: 
            // The drawing loop is started by setRouletteColor once they choose.
            // No automated action needed here for WAITING_FOR_ACTION.
        }
    }, { immediate: true })

    function applyScoresToWinner(winningPlayerId: string) {
        const winner = players.value.find(p => p.id === winningPlayerId)
        if (!winner) return

        // Collect opponent hands and elimination flags
        const opponentHands: Card[][] = []
        const eliminatedFlags: boolean[] = []

        players.value.forEach(p => {
            if (p.id === winningPlayerId) return
            opponentHands.push(p.hand)
            eliminatedFlags.push(p.isEliminated)
        })

        const totalPoints = calculateScore(opponentHands, eliminatedFlags)

        if (winner.score !== undefined) {
            winner.score += totalPoints
        } else {
            winner.score = totalPoints
        }
    }

    // Auto-log results when game ends
    watch(gameState, (newState) => {
        if (newState === 'GAME_OVER') {
            logGameResults()
        }
    })

    async function logGameResults() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const humanPlayer = players.value.find(p => !p.isBot)
        if (!humanPlayer) return

        const s = playerStats.value[humanPlayer.id]
        if (!s) return

        const duration = Math.round((Date.now() - gameStartTime.value) / 1000)
        let result: 'won' | 'lost' | 'eliminated' = 'lost'
        if (winnerId.value === humanPlayer.id) result = 'won'
        else if (humanPlayer.isEliminated) result = 'eliminated'

        const gameId = `bot-${Date.now()}`

        await supabase.from('game_results').insert({
            game_id: gameId,
            user_id: user.id,
            opponent_count: players.value.length - 1,
            result,
            cards_remaining: humanPlayer.hand.length,
            peak_cards: s.peakCards,
            draw_cards_played: s.drawCardsPlayed,
            wild_cards_played: s.wildCardsPlayed,
            cards_played_total: s.cardsPlayedTotal,
            skips_dealt: s.skipsDealt,
            swaps_made: s.swapsMade,
            draws_taken: s.drawsTaken,
            biggest_stack_survived: s.biggestStackSurvived,
            uno_calls: s.unoCalls,
            uno_penalties: s.unoPenalties,
            game_duration_secs: duration,
            is_bot_game: true
        })
    }

    return {
        gameState,
        turnState,
        deck,
        discardPile,
        players,
        currentPlayerIndex,
        direction,
        drawStack,
        currentColor,
        winnerId,
        currentPlayer,
        topCard,
        rouletteTargetColor,
        pendingDrawnWildCard,
        pendingDiscardAllCards,
        showUnoButton,
        catchableId,
        catchNoUno,
        hasCalledUno,
        actionInProgress,
        suppressDiscardSlam,
        lastPlay,
        stackingMode,
        playerStats,
        setStackingMode,
        initializeGame,
        drawCardFromDeck,
        drawCardToHand,
        playCard,
        applyCardEffect,
        rotateHands,
        drawCardsForCurrentPlayer,
        swapHands,
        skipSwap,
        playerActionPlayCard,
        executeRouletteDraw,
        setRouletteColor,
        playDrawnWildCard,
        selectDiscardAllTop,
        callUno,
        isDealing,
        pendingDealCard,
        dealInitialCards,
        returnToLobby
    }

    function setRouletteColor(color: CardColor) {
        if (turnState.value !== 'CHOOSING_ROULETTE_COLOR') return
        rouletteTargetColor.value = color
        turnState.value = 'ROULETTE_DRAWING'
        executeRouletteDraw()
    }

    function playDrawnWildCard(color: CardColor) {
        if (turnState.value !== 'CHOOSING_DRAWN_WILD_COLOR') return
        const card = pendingDrawnWildCard.value
        if (!card) return
        pendingDrawnWildCard.value = null
        turnState.value = 'WAITING_FOR_ACTION'
        playerActionPlayCard(card, color)
    }
})
