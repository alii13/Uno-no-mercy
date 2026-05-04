import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, type GameRow, type GamePlayerRow } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { generateFullDeck, shuffleDeck } from '../utils/deckGenerator'
import { canPlayCard, getDrawValue } from '../utils/gameRules'
import {
    calculateNextPlayerIndex,
    calculateScore,
    reshuffleDeck as reshuffleDeckHelper,
    checkMercyRule,
    rotateHands as rotateHandsHelper
} from '../utils/gameHelpers'
import type { Card, CardColor } from '../types/card'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const useMultiplayerStore = defineStore('multiplayer', () => {
    const authStore = useAuthStore()

    // State
    const currentGame = ref<GameRow | null>(null)
    const gamePlayers = ref<GamePlayerRow[]>([])
    const myPlayer = ref<GamePlayerRow | null>(null)
    const opponent = ref<GamePlayerRow | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const actionInProgress = ref(false) // Prevents double-clicks during async ops
    const opponentLeft = ref(false) // True when opponent leaves during game
    const pendingDrawnWildCard = ref<Card | null>(null) // Wild card drawn that needs color selection
    const pendingDiscardAllCards = ref<Card[]>([]) // Cards to choose top from during Discard All
    let gameChannel: RealtimeChannel | null = null

    // Computed
    const isHost = computed(() => currentGame.value?.host_id === authStore.user?.id)
    const isMyTurn = computed(() =>
        currentGame.value?.current_player_id === authStore.user?.id && !actionInProgress.value
    )
    const gameStatus = computed(() => currentGame.value?.status || 'waiting')
    const roomCode = computed(() => currentGame.value?.room_code || '')
    const opponents = computed(() =>
        gamePlayers.value.filter(p => p.user_id !== authStore.user?.id)
    )

    // Generate room code
    function generateRoomCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    // Helper: Calculate next active (non-eliminated) player ID based on current player and direction
    function getNextPlayerId(fromUserId?: string): string | null {
        if (!currentGame.value) return null
        const fromId = fromUserId || authStore.user?.id
        const fromIndex = gamePlayers.value.findIndex(p => p.user_id === fromId)
        const playerCount = gamePlayers.value.length
        const direction = (currentGame.value.direction || 1) as (1 | -1)

        // Skip eliminated players
        let nextIdx = calculateNextPlayerIndex(fromIndex, direction, playerCount)
        let attempts = 0
        while (gamePlayers.value[nextIdx]?.is_eliminated && attempts < playerCount) {
            nextIdx = calculateNextPlayerIndex(nextIdx, direction, playerCount)
            attempts++
        }
        return gamePlayers.value[nextIdx]?.user_id || null
    }

    // Helper: Check if elimination results in a winner (last player standing), update scores if so
    async function checkForWinnerAfterElimination(): Promise<{ winner_id: string | null; status: string }> {
        // Count ALL active (non-eliminated) players
        const activePlayers = gamePlayers.value.filter(gp => !gp.is_eliminated)

        // Also account for the player currently being eliminated (whose DB flag hasn't been written yet)
        const activeExcludingMe = activePlayers.filter(gp => gp.user_id !== myPlayer.value?.user_id)

        if (activeExcludingMe.length === 1 && activeExcludingMe[0]) {
            const winnerId = activeExcludingMe[0].user_id
            await updateWinnerScore(winnerId)
            return { winner_id: winnerId, status: 'finished' }
        }
        return { winner_id: null, status: 'playing' }
    }

    // Create a new game
    async function createGame() {
        if (!authStore.user) {
            error.value = 'You must be logged in to create a game'
            return null
        }

        // Profile is created by database trigger after email confirmation
        if (!authStore.profile) {
            error.value = 'Profile not found. Please confirm your email and refresh the page.'
            return null
        }

        loading.value = true
        error.value = null

        try {
            const roomCode = generateRoomCode()

            // Create game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .insert({
                    room_code: roomCode,
                    host_id: authStore.user.id,
                    status: 'waiting'
                })
                .select()
                .single()

            if (gameError) throw gameError

            // Add self as player
            const username = authStore.profile?.username || authStore.user.email?.split('@')[0] || 'Player'
            const { data: player, error: playerError } = await supabase
                .from('game_players')
                .insert({
                    game_id: game.id,
                    user_id: authStore.user.id,
                    name: username,
                    seat_order: 0
                })
                .select()
                .single()

            if (playerError) throw playerError

            currentGame.value = game
            myPlayer.value = player
            gamePlayers.value = [player]

            // Subscribe to game updates
            subscribeToGame(game.id)

            return game
        } catch (err: any) {
            error.value = err.message
            return null
        } finally {
            loading.value = false
        }
    }

    // Join an existing game by room code
    async function joinGame(roomCode: string) {
        if (!authStore.user) {
            error.value = 'You must be logged in to join a game'
            return null
        }

        if (!authStore.profile) {
            error.value = 'Profile not found. Please confirm your email and refresh the page.'
            return null
        }

        loading.value = true
        error.value = null

        try {
            console.log('joinGame: user =', authStore.user?.id, 'profile =', authStore.profile?.username)
            console.log('Joining game with code:', roomCode.toUpperCase())

            // Find the game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('room_code', roomCode.toUpperCase())
                .eq('status', 'waiting')
                .single()

            console.log('Game lookup result:', { game, gameError })

            if (gameError) {
                console.error('Game lookup failed:', gameError)
                throw new Error('Game not found or already started')
            }

            // Check if already in game
            const { data: existingPlayer } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', game.id)
                .eq('user_id', authStore.user.id)
                .maybeSingle()

            console.log('Existing player check:', existingPlayer)

            if (existingPlayer) {
                currentGame.value = game
                myPlayer.value = existingPlayer
                await loadGamePlayers(game.id)
                subscribeToGame(game.id)
                return game
            }

            // Count existing players
            const { count } = await supabase
                .from('game_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id)

            console.log('Player count:', count)

            if ((count || 0) >= 10) {
                throw new Error('Game is full (max 10 players)')
            }

            // Join the game
            const { data: player, error: playerError } = await supabase
                .from('game_players')
                .insert({
                    game_id: game.id,
                    user_id: authStore.user.id,
                    name: authStore.profile.username,
                    seat_order: count || 1
                })
                .select()
                .single()

            if (playerError) throw playerError

            console.log('Joined as player:', player)

            currentGame.value = game
            myPlayer.value = player
            await loadGamePlayers(game.id)

            // Subscribe to game updates
            subscribeToGame(game.id)

            return game
        } catch (err: any) {
            console.error('joinGame error:', err)
            error.value = err.message
            return null
        } finally {
            loading.value = false
        }
    }

    // Load all players in a game
    async function loadGamePlayers(gameId: string) {
        const { data, error: err } = await supabase
            .from('game_players')
            .select('*')
            .eq('game_id', gameId)
            .order('seat_order')

        if (!err && data) {
            gamePlayers.value = data
            myPlayer.value = data.find(p => p.user_id === authStore.user?.id) || null
            // Keep first opponent for backward compat (2-player views)
            opponent.value = data.find(p => p.user_id !== authStore.user?.id) || null
        }
    }

    // Calculate and update winner score
    async function updateWinnerScore(winningUserId: string) {
        if (!currentGame.value || gamePlayers.value.length === 0) return

        // Collect opponent hands and elimination flags
        const opponentHands: Card[][] = []
        const eliminatedFlags: boolean[] = []

        gamePlayers.value.forEach(p => {
            if (p.user_id === winningUserId) return
            opponentHands.push((p.hand as Card[]) || [])
            eliminatedFlags.push(p.is_eliminated || false)
        })

        const totalPoints = calculateScore(opponentHands, eliminatedFlags)

        const winner = gamePlayers.value.find(p => p.user_id === winningUserId)
        if (winner) {
            const newScore = (winner.score || 0) + totalPoints
            await supabase
                .from('game_players')
                .update({ score: newScore })
                .eq('id', winner.id)
        }
    }

    // Subscribe to realtime updates
    function subscribeToGame(gameId: string) {
        console.log('subscribeToGame:', gameId)

        // Unsubscribe from previous
        if (gameChannel) {
            supabase.removeChannel(gameChannel)
        }

        gameChannel = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, (payload) => {
                console.log('Realtime: games table changed', payload)
                if (payload.new) {
                    // Merge to avoid dropping fields not present in realtime payload
                    currentGame.value = {
                        ...(currentGame.value || {}),
                        ...(payload.new as GameRow)
                    }
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'game_players'
            }, async (payload: any) => {
                console.log('Realtime: game_players changed', payload)
                // Filter to our game
                if (payload.new?.game_id === gameId || payload.old?.game_id === gameId) {
                    console.log('Realtime: Reloading players for our game')

                    // Check for player leaving during active game
                    if (payload.eventType === 'DELETE' && payload.old?.user_id !== authStore.user?.id) {
                        console.log('Realtime: A player left the game!')
                    }

                    await loadGamePlayers(gameId)

                    // If during an active game we're down to < 2 players, game is unplayable
                    if (currentGame.value?.status === 'playing' && gamePlayers.value.length < 2) {
                        opponentLeft.value = true
                    }
                }
            })
            .subscribe((status) => {
                console.log('Realtime subscription status:', status)
            })
    }

    // Start the game (host only)
    async function startGame() {
        console.log('startGame called:', {
            currentGame: currentGame.value?.id,
            isHost: isHost.value,
            playerCount: gamePlayers.value.length,
            players: gamePlayers.value.map(p => p.name)
        })

        if (!currentGame.value || !isHost.value) {
            console.log('startGame: Early return - not host or no game')
            return
        }
        if (gamePlayers.value.length < 2) {
            console.log('startGame: Need 2 players')
            error.value = 'Need 2 players to start'
            return
        }

        console.log('startGame: Starting game...')
        loading.value = true

        try {
            // Generate and shuffle deck
            const deck = shuffleDeck(generateFullDeck())
            const playerCount = gamePlayers.value.length

            // Deal 7 cards to each player
            const hands: Card[][] = Array.from({ length: playerCount }, () => [])
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < playerCount; j++) {
                    const card = deck.pop()
                    const hand = hands[j]
                    if (card && hand) hand.push(card)
                }
            }

            // Find first non-wild card for discard
            let firstCard = deck.pop()
            while (firstCard?.type === 'wild' || firstCard?.color === 'wild') {
                deck.push(firstCard)
                deck.sort(() => Math.random() - 0.5)
                firstCard = deck.pop()
            }

            console.log('startGame: Updating player hands...')

            // Update player hands
            for (let i = 0; i < gamePlayers.value.length; i++) {
                const player = gamePlayers.value[i]
                if (!player) continue

                const { error: updateError } = await supabase
                    .from('game_players')
                    .update({ hand: hands[i] })
                    .eq('id', player.id)

                if (updateError) throw updateError
            }

            console.log('startGame: Updating game state...')

            // Update game state with first card effects
            const firstPlayer = gamePlayers.value[0]
            if (!firstPlayer) throw new Error('No players found')

            let startingPlayerId = firstPlayer.user_id
            let startingDirection: 1 | -1 = 1
            let startingDrawStack = 0

            if (firstCard) {
                if (firstCard.type === 'skip' || (firstCard.type === 'reverse' && playerCount === 2)) {
                    // First player skipped — next player starts
                    const nextIdx = calculateNextPlayerIndex(0, 1, playerCount)
                    startingPlayerId = gamePlayers.value[nextIdx]?.user_id || firstPlayer.user_id
                } else if (firstCard.type === 'reverse') {
                    // 3+ players: reverse direction, last player goes first
                    startingDirection = -1
                    const nextIdx = calculateNextPlayerIndex(0, -1, playerCount)
                    startingPlayerId = gamePlayers.value[nextIdx]?.user_id || firstPlayer.user_id
                } else if (firstCard.type === 'draw2') {
                    startingDrawStack = 2
                } else if (firstCard.type === 'draw4') {
                    startingDrawStack = 4
                }
            }

            const { error: gameError } = await supabase
                .from('games')
                .update({
                    status: 'playing',
                    deck: deck,
                    discard_pile: firstCard ? [firstCard] : [],
                    current_color: firstCard?.color || 'red',
                    current_player_id: startingPlayerId,
                    direction: startingDirection,
                    draw_stack: startingDrawStack,
                    turn_state: 'WAITING_FOR_ACTION'
                })
                .eq('id', currentGame.value.id)

            if (gameError) throw gameError

            console.log('startGame: Game started successfully!')

        } catch (err: any) {
            console.error('startGame error:', err)
            error.value = err.message
        } finally {
            loading.value = false
        }
    }

    // --- Play Card Types and Helpers ---
    
    interface PlayCardState {
        direction: 1 | -1
        drawStack: number
        turnState: string
        nextPlayerId: string | null
        rouletteTargetColor: string | null
        newColor: CardColor
        handsToUpdate: { playerId: string; hand: Card[] }[]
        newHand: Card[]
        newDiscard: Card[]
    }

    // Apply draw stack value
    function applyDrawStack(card: Card, state: PlayCardState): void {
        const drawVal = getDrawValue(card)
        if (drawVal > 0 && card.type !== 'wildColorRoulette') {
            state.drawStack += drawVal
        }
    }

    // Handle reverse card effect
    function applyReverseEffect(
        card: Card,
        myId: string,
        playerCount: number,
        state: PlayCardState
    ): void {
        if (card.type !== 'reverse' && card.type !== 'wildReverseDraw4') return

        const isTwoPlayer = playerCount === 2
        if (isTwoPlayer) {
            if (card.type === 'reverse') {
                state.nextPlayerId = myId
            } else {
                state.direction = state.direction === 1 ? -1 : 1
                state.nextPlayerId = myId
            }
        } else {
            state.direction = state.direction === 1 ? -1 : 1
        }
    }

    // Handle skip card effect — skip the next active player
    function applySkipEffect(
        card: Card,
        myIndex: number,
        playerCount: number,
        state: PlayCardState
    ): void {
        if (card.type !== 'skip') return

        // Find next active player (the one being skipped)
        let skipIdx = calculateNextPlayerIndex(myIndex, state.direction, playerCount)
        let attempts = 0
        while (gamePlayers.value[skipIdx]?.is_eliminated && attempts < playerCount) {
            skipIdx = calculateNextPlayerIndex(skipIdx, state.direction, playerCount)
            attempts++
        }
        // Now find the player AFTER the skipped one
        let nextIdx = calculateNextPlayerIndex(skipIdx, state.direction, playerCount)
        attempts = 0
        while (gamePlayers.value[nextIdx]?.is_eliminated && attempts < playerCount) {
            nextIdx = calculateNextPlayerIndex(nextIdx, state.direction, playerCount)
            attempts++
        }
        state.nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null
    }

    // Handle skip everyone (play again)
    function applySkipEveryoneEffect(card: Card, myId: string, state: PlayCardState): void {
        if (card.type !== 'skipEveryone') return
        state.nextPlayerId = myId
    }

    // Handle wild color roulette — victim is next active player
    function applyRouletteEffect(
        card: Card,
        myIndex: number,
        playerCount: number,
        state: PlayCardState
    ): void {
        if (card.type !== 'wildColorRoulette') return

        state.turnState = 'CHOOSING_ROULETTE_COLOR'
        // Find next active (non-eliminated) player as victim
        let victimIdx = calculateNextPlayerIndex(myIndex, state.direction, playerCount)
        let attempts = 0
        while (gamePlayers.value[victimIdx]?.is_eliminated && attempts < playerCount) {
            victimIdx = calculateNextPlayerIndex(victimIdx, state.direction, playerCount)
            attempts++
        }
        state.nextPlayerId = gamePlayers.value[victimIdx]?.user_id || null
    }

    // Handle discard all cards of same color
    function applyDiscardAllEffect(card: Card, playerId: string, myId: string, state: PlayCardState): void {
        if (card.type !== 'discardAll' || card.color === 'wild') return

        const matchingCards = state.newHand.filter(c => c.color === card.color)
        if (matchingCards.length === 0) return

        if (matchingCards.length === 1) {
            // Only 1 card — auto-discard, it becomes the top card
            const finalHand = state.newHand.filter(c => c.color !== card.color)
            state.newDiscard.push(matchingCards[0]!)
            state.handsToUpdate.push({ playerId, hand: finalHand })
            return
        }

        // Multiple cards — player needs to pick which goes on top
        // Store matching cards for the picker, pause the turn
        pendingDiscardAllCards.value = matchingCards
        state.turnState = 'CHOOSING_DISCARD_ALL_TOP'
        state.nextPlayerId = myId // Keep turn on me to show the picker

        // Still discard all matching cards except we need to reorder later
        // For now, discard them all (the selectDiscardAllTop will fix the order)
        const finalHand = state.newHand.filter(c => c.color !== card.color)
        state.newDiscard.push(...matchingCards)
        state.handsToUpdate.push({ playerId, hand: finalHand })
    }

    // Handle number 0 - rotate all hands
    function applyRotateHandsEffect(
        card: Card,
        myId: string,
        playerCount: number,
        state: PlayCardState
    ): void {
        if (card.type !== 'number' || card.value !== 0) return

        const hands: Card[][] = []
        for (let i = 0; i < playerCount; i++) {
            const player = gamePlayers.value[i]
            if (player?.user_id === myId) {
                hands.push([...state.newHand])
            } else {
                hands.push([...(player?.hand as Card[] || [])])
            }
        }

        const rotated = rotateHandsHelper(hands, state.direction)
        for (let i = 0; i < playerCount; i++) {
            state.handsToUpdate.push({
                playerId: gamePlayers.value[i]!.id,
                hand: rotated[i] || []
            })
        }
    }

    // Handle number 7 - swap hands
    function applySwapEffect(card: Card, myId: string, state: PlayCardState): void {
        if (card.type !== 'number' || card.value !== 7) return

        state.turnState = 'CHOOSING_PLAYER_TO_SWAP'
        state.nextPlayerId = myId
    }

    // Apply all card effects
    function applyAllCardEffects(
        card: Card,
        myId: string,
        myIndex: number,
        playerCount: number,
        playerId: string,
        state: PlayCardState
    ): void {
        applyDrawStack(card, state)
        applyReverseEffect(card, myId, playerCount, state)
        applySkipEffect(card, myIndex, playerCount, state)
        applySkipEveryoneEffect(card, myId, state)
        applyRouletteEffect(card, myIndex, playerCount, state)
        applyDiscardAllEffect(card, playerId, myId, state)
        applyRotateHandsEffect(card, myId, playerCount, state)
        applySwapEffect(card, myId, state)

        // Default next player if not set — skip eliminated players
        if (state.nextPlayerId === null) {
            let nextIdx = calculateNextPlayerIndex(myIndex, state.direction, playerCount)
            let attempts = 0
            while (gamePlayers.value[nextIdx]?.is_eliminated && attempts < playerCount) {
                nextIdx = calculateNextPlayerIndex(nextIdx, state.direction, playerCount)
                attempts++
            }
            state.nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null
        }
    }

    // Check win condition and handle UNO penalty
    async function checkWinCondition(
        state: PlayCardState,
        myId: string,
        game: GameRow
    ): Promise<{ winnerId: string | null; status: string; finalHand: Card[] } | null> {
        const finalHand = state.handsToUpdate.find(h => h.playerId === myPlayer.value?.id)?.hand || state.newHand

        if (finalHand.length === 0) {
            if (!myPlayer.value?.has_called_uno) {
                // Penalty: Draw 2
                const deck = [...(game.deck as Card[])]
                const drawn: Card[] = []
                for (let i = 0; i < 2; i++) {
                    const c = deck.pop()
                    if (c) drawn.push(c)
                }

                await supabase
                    .from('game_players')
                    .update({ hand: drawn, has_called_uno: false })
                    .eq('id', myPlayer.value!.id)

                await supabase
                    .from('games')
                    .update({ current_player_id: state.nextPlayerId, deck })
                    .eq('id', game.id)

                return null // Signals early return
            } else {
                await updateWinnerScore(myId)
                return { winnerId: myId, status: 'finished', finalHand }
            }
        }

        return { winnerId: null, status: 'playing', finalHand }
    }

    // Update player hands in database
    async function updatePlayerHands(state: PlayCardState): Promise<void> {
        if (state.handsToUpdate.length > 0) {
            for (const update of state.handsToUpdate) {
                await supabase
                    .from('game_players')
                    .update({ hand: update.hand })
                    .eq('id', update.playerId)
            }
        } else {
            await supabase
                .from('game_players')
                .update({ hand: state.newHand })
                .eq('id', myPlayer.value!.id)
        }
    }

    // Update game state in database
    async function updateGameState(
        gameId: string,
        deck: Card[],
        state: PlayCardState,
        winnerId: string | null,
        status: string
    ): Promise<void> {
        await supabase
            .from('games')
            .update({
                deck,
                discard_pile: state.newDiscard,
                current_color: state.newColor,
                current_player_id: state.nextPlayerId,
                direction: state.direction,
                draw_stack: state.drawStack,
                turn_state: state.turnState,
                roulette_target_color: state.rouletteTargetColor,
                winner_id: winnerId,
                status
            })
            .eq('id', gameId)
    }

    // Play a card
    async function playCard(card: Card, selectedColor?: CardColor) {
        if (!currentGame.value || !myPlayer.value) return
        if (actionInProgress.value) return
        if (currentGame.value.current_player_id !== authStore.user?.id) return

        actionInProgress.value = true

        const game = currentGame.value
        const myId = authStore.user?.id
        if (!myId) {
            actionInProgress.value = false
            return
        }

        const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
        const playerCount = gamePlayers.value.length

        // Initialize state
        const state: PlayCardState = {
            direction: game.direction as (1 | -1),
            drawStack: game.draw_stack || 0,
            turnState: 'WAITING_FOR_ACTION',
            nextPlayerId: null,
            rouletteTargetColor: game.roulette_target_color,
            newColor: card.color === 'wild' ? (selectedColor || 'red') : card.color as CardColor,
            handsToUpdate: [],
            newHand: myPlayer.value.hand.filter((c: Card) => c.id !== card.id),
            newDiscard: [...(game.discard_pile as Card[]), card]
        }

        // Apply all card effects
        applyAllCardEffects(card, myId, myIndex, playerCount, myPlayer.value.id, state)

        // Check win condition
        const winResult = await checkWinCondition(state, myId, game)
        if (winResult === null) {
            actionInProgress.value = false
            return
        }

        try {
            await updatePlayerHands(state)
            await updateGameState(game.id, game.deck as Card[], state, winResult.winnerId, winResult.status)
        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    // Swap hands with target player (for 7 card)
    // targetPlayerId can be either game_players.id or user_id
    async function swapHands(targetPlayerId: string) {
        if (!currentGame.value || !myPlayer.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_PLAYER_TO_SWAP') return
        if (actionInProgress.value) return

        actionInProgress.value = true
        const myId = authStore.user?.id
        if (!myId) {
            actionInProgress.value = false
            return
        }

        // Find target by either id or user_id for flexibility
        const targetPlayer = gamePlayers.value.find(p =>
            p.id === targetPlayerId || p.user_id === targetPlayerId
        )
        if (!targetPlayer || targetPlayer.user_id === myId) {
            actionInProgress.value = false
            return
        }

        // Re-fetch hands fresh from DB to avoid stale realtime state
        const { data: freshPlayers } = await supabase
            .from('game_players')
            .select('*')
            .eq('game_id', currentGame.value.id)
            .order('seat_order')

        const freshMe = freshPlayers?.find(p => p.user_id === myId)
        const freshTarget = freshPlayers?.find(p =>
            p.id === targetPlayerId || p.user_id === targetPlayerId
        )

        if (!freshMe || !freshTarget) {
            actionInProgress.value = false
            return
        }

        const myHand = [...(freshMe.hand as Card[])]
        const targetHand = [...(freshTarget.hand as Card[])]

        // Calculate next player
        const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
        const playerCount = gamePlayers.value.length
        const direction = currentGame.value.direction as (1 | -1)
        const nextIdx = calculateNextPlayerIndex(myIndex, direction, playerCount)
        const nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null

        try {
            // Swap hands
            await supabase
                .from('game_players')
                .update({ hand: targetHand })
                .eq('id', freshMe.id)

            await supabase
                .from('game_players')
                .update({ hand: myHand })
                .eq('id', freshTarget.id)

            // Update game state
            await supabase
                .from('games')
                .update({
                    turn_state: 'WAITING_FOR_ACTION',
                    current_player_id: nextPlayerId
                })
                .eq('id', currentGame.value.id)

        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    // Set roulette color (victim chooses)
    async function setRouletteColor(color: CardColor) {
        if (!currentGame.value || !myPlayer.value || !isMyTurn.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_ROULETTE_COLOR') return
        if (actionInProgress.value) return

        actionInProgress.value = true
        try {
            await supabase
                .from('games')
                .update({
                    roulette_target_color: color,
                    current_color: color,
                    turn_state: 'ROULETTE_DRAWING'
                })
                .eq('id', currentGame.value.id)

            // Start drawing automatically
            setTimeout(() => {
                actionInProgress.value = false // Unlock for draw
                executeRouletteDraw()
            }, 500)
        } catch (err: any) {
            error.value = err.message
            actionInProgress.value = false
        }
    }

    // Call UNO
    async function callUno() {
        if (!myPlayer.value) return
        try {
            await supabase
                .from('game_players')
                .update({ has_called_uno: true })
                .eq('id', myPlayer.value.id)
        } catch (err: any) {
            error.value = err.message
        }
    }

    // Roulette draw state - persists across iterations to avoid stale reads
    let rouletteState: { deck: Card[]; discardPile: Card[]; hand: Card[] } | null = null

    // Execute roulette draw - draw until matching color
    async function executeRouletteDraw() {
        if (!currentGame.value || !myPlayer.value || !isMyTurn.value) return
        if (currentGame.value.turn_state !== 'ROULETTE_DRAWING') return
        if (actionInProgress.value) return

        actionInProgress.value = true

        try {
            const targetColor = currentGame.value.roulette_target_color as CardColor
            if (!targetColor) return

            // Initialize local state on first call, reuse on subsequent calls
            if (!rouletteState) {
                rouletteState = {
                    deck: [...(currentGame.value.deck as Card[])],
                    discardPile: [...(currentGame.value.discard_pile as Card[])],
                    hand: [...(myPlayer.value.hand as Card[])]
                }
            }

            const { deck: localDeck, discardPile: localDiscard } = rouletteState

            if (localDeck.length === 0) {
                // Reshuffle discard pile
                if (localDiscard.length > 1) {
                    const top = localDiscard.pop()!
                    localDeck.push(...shuffleDeck(localDiscard.splice(0)))
                    localDiscard.push(top)
                } else {
                    // No cards left - end roulette
                    await supabase
                        .from('games')
                        .update({
                            deck: localDeck,
                            discard_pile: localDiscard,
                            current_color: targetColor,
                            turn_state: 'WAITING_FOR_ACTION',
                            roulette_target_color: null,
                            current_player_id: getNextPlayerId()
                        })
                        .eq('id', currentGame.value.id)
                    rouletteState = null
                    return
                }
            }

            const card = localDeck.pop()
            if (!card) {
                rouletteState = null
                return
            }

            rouletteState.hand.push(card)
            const newHand = [...rouletteState.hand]

            // Check mercy rule
            const isEliminated = checkMercyRule(newHand.length)

            // Rule: Wild cards do NOT count as matching color
            const foundColor = card.color === targetColor

            if (foundColor || isEliminated) {
                let finalHand = newHand
                const newDiscard = [...localDiscard]

                if (isEliminated) {
                    finalHand = []
                    newDiscard.push(...newHand)
                } else if (foundColor) {
                    finalHand = newHand.filter(c => c.id !== card.id)
                    newDiscard.push(card)
                }

                let newColor = currentGame.value.current_color
                if (foundColor) {
                    newColor = card.color === 'wild' ? targetColor : card.color
                }

                await supabase
                    .from('game_players')
                    .update({
                        hand: finalHand,
                        is_eliminated: isEliminated,
                        has_called_uno: false
                    })
                    .eq('id', myPlayer.value.id)

                const { winner_id, status: gStatus } = isEliminated
                    ? await checkForWinnerAfterElimination()
                    : { winner_id: null, status: 'playing' }

                await supabase
                    .from('games')
                    .update({
                        deck: localDeck,
                        discard_pile: newDiscard,
                        current_color: newColor,
                        turn_state: 'WAITING_FOR_ACTION',
                        roulette_target_color: null,
                        current_player_id: getNextPlayerId(),
                        winner_id,
                        status: gStatus
                    })
                    .eq('id', currentGame.value.id)

                rouletteState = null
            } else {
                // Keep drawing - update DB then schedule next draw
                await supabase
                    .from('game_players')
                    .update({ hand: newHand, has_called_uno: false })
                    .eq('id', myPlayer.value.id)

                await supabase
                    .from('games')
                    .update({
                        deck: localDeck,
                        discard_pile: localDiscard
                    })
                    .eq('id', currentGame.value.id)

                // Continue drawing after delay
                actionInProgress.value = false
                setTimeout(() => executeRouletteDraw(), 600)
                return // Skip the finally block's actionInProgress reset
            }
        } catch (err: any) {
            error.value = err.message
            rouletteState = null
        } finally {
            actionInProgress.value = false
        }
    }

    // --- Draw Card Types and Helpers ---

    interface DrawState {
        deck: Card[]
        discardPile: Card[]
        topCard: Card | undefined
        currentColor: CardColor
    }

    // Try to reshuffle discard pile into deck
    function tryReshuffle(state: DrawState): boolean {
        return reshuffleDeckHelper(state.deck, state.discardPile)
    }

    // Handle mercy rule elimination
    async function handleMercyElimination(
        newHand: Card[],
        state: DrawState,
        gameId: string
    ): Promise<void> {
        state.discardPile = [...state.discardPile, ...newHand]

        await supabase
            .from('game_players')
            .update({ hand: [], is_eliminated: true })
            .eq('id', myPlayer.value!.id)

        const { winner_id, status: gStatus } = await checkForWinnerAfterElimination()

        await supabase
            .from('games')
            .update({
                deck: state.deck,
                discard_pile: state.discardPile,
                current_player_id: getNextPlayerId(),
                winner_id,
                status: gStatus
            })
            .eq('id', gameId)
    }

    // Draw stack cards (when facing a draw penalty)
    async function drawStackCards(
        count: number,
        state: DrawState,
        gameId: string
    ): Promise<void> {
        const drawnCards: Card[] = []
        for (let i = 0; i < count; i++) {
            if (state.deck.length === 0 && !tryReshuffle(state)) break
            const card = state.deck.pop()
            if (card) drawnCards.push(card)
        }

        const newHand = [...(myPlayer.value!.hand as Card[]), ...drawnCards]
        const isEliminated = checkMercyRule(newHand.length)

        if (isEliminated) {
            state.discardPile = [...state.discardPile, ...newHand]
        }

        await supabase
            .from('game_players')
            .update({
                hand: isEliminated ? [] : newHand,
                is_eliminated: isEliminated,
                has_called_uno: false
            })
            .eq('id', myPlayer.value!.id)

        const { winner_id, status: gStatus } = isEliminated
            ? await checkForWinnerAfterElimination()
            : { winner_id: null, status: 'playing' }

        await supabase
            .from('games')
            .update({
                deck: state.deck,
                discard_pile: state.discardPile,
                draw_stack: 0,
                current_player_id: getNextPlayerId(),
                winner_id,
                status: gStatus
            })
            .eq('id', gameId)
    }

    // Draw until a playable card is found
    function createDrawUntilPlayable(state: DrawState): () => Promise<void> {
        const drawUntilPlayable = async (): Promise<void> => {
            try {
                if (!currentGame.value || !myPlayer.value) {
                    actionInProgress.value = false
                    return
                }

                const currentHand = [...(myPlayer.value.hand as Card[])]

                // No cards left to draw
                if (state.deck.length === 0 && !tryReshuffle(state)) {
                    await supabase
                        .from('games')
                        .update({ current_player_id: getNextPlayerId() })
                        .eq('id', currentGame.value.id)

                    actionInProgress.value = false
                    return
                }

                const card = state.deck.pop()
                if (!card) {
                    actionInProgress.value = false
                    return
                }

                const newHand = [...currentHand, card]

                // Check mercy rule (25+ cards = elimination)
                if (checkMercyRule(newHand.length)) {
                    await handleMercyElimination(newHand, state, currentGame.value.id)
                    actionInProgress.value = false
                    return
                }

                // Update hand
                await supabase
                    .from('game_players')
                    .update({ hand: newHand, has_called_uno: false })
                    .eq('id', myPlayer.value.id)

                await supabase
                    .from('games')
                    .update({ deck: state.deck, discard_pile: state.discardPile })
                    .eq('id', currentGame.value.id)

                // Check if drawn card is playable
                if (state.topCard && canPlayCard(card, state.topCard, state.currentColor, 0)) {
                    actionInProgress.value = false

                    if (card.color === 'wild') {
                        // Wild card drawn - player needs to pick a color
                        pendingDrawnWildCard.value = card
                        return
                    }

                    setTimeout(async () => {
                        await playCard(card)
                    }, 800)
                } else {
                    // Not playable, draw again
                    setTimeout(drawUntilPlayable, 400)
                }
            } catch (err: any) {
                error.value = err.message
                actionInProgress.value = false
            }
        }

        return drawUntilPlayable
    }

    // Draw a card (handles stacks, draw-until-playable, mercy rule)
    async function drawCard() {
        if (!currentGame.value || !myPlayer.value) return
        if (actionInProgress.value) return
        if (currentGame.value.current_player_id !== authStore.user?.id) return

        const game = currentGame.value
        const myHand = myPlayer.value.hand as Card[]
        const topCard = (game.discard_pile as Card[])[(game.discard_pile as Card[]).length - 1]
        const curColor = game.current_color as CardColor
        const curDrawStack = game.draw_stack || 0

        // Only allow drawing if player has no playable cards (except during draw stack penalty)
        if (curDrawStack === 0 && topCard) {
            const hasPlayable = myHand.some(c => canPlayCard(c, topCard, curColor, 0))
            if (hasPlayable) return // Must play a card instead
        }

        actionInProgress.value = true

        const state: DrawState = {
            deck: [...(game.deck as Card[])],
            discardPile: [...(game.discard_pile as Card[])],
            topCard,
            currentColor: curColor
        }

        // Handle draw stack penalty
        if (curDrawStack > 0) {
            try {
                await drawStackCards(curDrawStack, state, game.id)
            } catch (err: any) {
                error.value = err.message
            } finally {
                actionInProgress.value = false
            }
            return
        }

        // Standard draw: draw until playable
        const drawUntilPlayable = createDrawUntilPlayable(state)
        drawUntilPlayable()
    }

    // Play a drawn wild card after user selects color
    async function playDrawnWildCard(color: CardColor) {
        const card = pendingDrawnWildCard.value
        if (!card) return
        pendingDrawnWildCard.value = null
        await playCard(card, color)
    }

    // Select top card for Discard All — reorder the discard pile so chosen card is on top
    async function selectDiscardAllTop(topCardId: string) {
        if (!currentGame.value || !myPlayer.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_DISCARD_ALL_TOP') return

        const matchingCards = pendingDiscardAllCards.value
        const topCard = matchingCards.find(c => c.id === topCardId)
        if (!topCard) return

        pendingDiscardAllCards.value = []

        // Re-read the current discard pile from the game
        const currentDiscard = [...(currentGame.value.discard_pile as Card[])]

        // Remove the matching cards from the end of the discard pile
        // (they were added by applyDiscardAllEffect)
        const matchingIds = new Set(matchingCards.map(c => c.id))
        const discardWithoutMatching = currentDiscard.filter(c => !matchingIds.has(c.id))

        // Re-add them with the chosen card last (on top)
        const others = matchingCards.filter(c => c.id !== topCardId)
        const reorderedDiscard = [...discardWithoutMatching, ...others, topCard]

        // Calculate next player
        const myId = authStore.user?.id
        if (!myId) return
        const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
        const playerCount = gamePlayers.value.length
        const direction = currentGame.value.direction as (1 | -1)
        const nextIdx = calculateNextPlayerIndex(myIndex, direction, playerCount)
        const nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null

        try {
            // Check win condition
            const myHand = myPlayer.value.hand as Card[]
            let winnerId: string | null = null
            let status = 'playing'

            if (myHand.length === 0) {
                if (myPlayer.value.has_called_uno) {
                    await updateWinnerScore(myId)
                    winnerId = myId
                    status = 'finished'
                }
                // DiscardAll bulk discard doesn't penalize for UNO since cards went from many→0
            }

            await supabase
                .from('games')
                .update({
                    discard_pile: reorderedDiscard,
                    turn_state: 'WAITING_FOR_ACTION',
                    current_player_id: nextPlayerId,
                    winner_id: winnerId,
                    status
                })
                .eq('id', currentGame.value.id)
        } catch (err: any) {
            error.value = err.message
        }
    }

    // Leave game
    async function leaveGame() {
        if (gameChannel) {
            supabase.removeChannel(gameChannel)
            gameChannel = null
        }

        if (currentGame.value && myPlayer.value) {
            await supabase
                .from('game_players')
                .delete()
                .eq('id', myPlayer.value.id)
        }

        currentGame.value = null
        myPlayer.value = null
        opponent.value = null
        gamePlayers.value = []
    }

    return {
        currentGame,
        gamePlayers,
        myPlayer,
        opponent,
        opponents,
        loading,
        error,
        isHost,
        isMyTurn,
        gameStatus,
        roomCode,
        opponentLeft,
        actionInProgress,
        pendingDrawnWildCard,
        pendingDiscardAllCards,
        createGame,
        joinGame,
        startGame,
        playCard,
        drawCard,
        swapHands,
        setRouletteColor,
        playDrawnWildCard,
        selectDiscardAllTop,
        callUno,
        leaveGame,
        loadGamePlayers
    }
})
