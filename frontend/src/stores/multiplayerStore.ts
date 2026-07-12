import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase, type GameRow, type GamePlayerRow } from '../lib/supabase'
import { useAuthStore } from './authStore'
import { generateFullDeck, shuffleDeck } from '../utils/deckGenerator'
import { canPlayCard, getDrawValue, type StackingMode, DEFAULT_STACKING_MODE } from '../utils/gameRules'
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
    // Set true right before our own playCard mutates the discard pile, so CardPile's
    // own "slam from above" doesn't double up with the flying-clone visual in
    // MultiplayerPlayerHand. CardPile reads and resets it.
    const suppressDiscardSlam = ref(false)
    const opponentLeft = ref(false) // True when opponent leaves during game
    // Realtime presence — who is actually connected to this game's channel.
    // Drives the disconnect badge, the host kick affordance, and the watchdog
    // that auto-skips a player who vanished mid-turn. We only treat a player as
    // disconnected if we've SEEN them in presence at least once, so clients on
    // an older build that never call .track() are never wrongly flagged.
    const presentUserIds = ref<string[]>([])
    // Players we've seen connected who have since dropped — drives the UI badge.
    // Built only from everSeenPresence, so older clients that don't broadcast
    // presence never get flagged.
    const disconnectedUserIds = ref<string[]>([])
    const DISCONNECT_GRACE_MS = 20000
    // If the turn pointer hasn't moved for this long and we're idle, re-read the
    // authoritative games row directly — covers a dropped turn-broadcast without
    // the stale-WAL-frame risk of reconciling pgchanges inside the throttle.
    const STUCK_RESYNC_MS = 10000
    let lastStateChangeAt = 0
    let everSeenPresence = new Set<string>()
    let absentSince: Record<string, number> = {}
    let watchdogTimer: ReturnType<typeof setInterval> | null = null
    const pendingDrawnWildCard = ref<Card | null>(null) // Wild card drawn that needs color selection
    const pendingDiscardAllCards = ref<Card[]>([]) // Cards to choose top from during Discard All
    // Realtime channel connectivity — surfaced in the UI as a reconnecting pill
    // when Supabase loses the WS to game updates. Values mirror what the
    // .subscribe() callback reports: 'SUBSCRIBED' once we're live.
    const realtimeStatus = ref<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'CONNECTING'>('CONNECTING')
    let gameChannel: RealtimeChannel | null = null

    // Realtime broadcast for moves. Postgres remains the system of record; this
    // is a fast lane that fans out the post-write state on the same channel.
    // postgres_changes takes 1-2s+ via WAL polling; broadcast is 50-200ms. We
    // stash a per-channel timestamp so the slow path can step aside when the
    // fast path is healthy.
    const BROADCAST_THROTTLE_PGCHANGES_MS = 3000
    let broadcastSeq = 0
    let lastBroadcastReceivedAt = 0
    // Per-subscription nonce. A sender's broadcastSeq restarts at 0 every time
    // they (re)subscribe, so the receiver keys the seq gate by (sender, epoch)
    // and resets the gate when a sender's epoch changes — otherwise a peer's
    // post-reconnect broadcasts would all look stale and get dropped.
    let broadcastEpoch = 0
    // seq gate: drop broadcasts we've already superseded for a given sender so
    // a slow/reordered frame can't clobber a newer current_player_id/turn_state.
    let lastAppliedSeqBySender: Record<string, number> = {}
    let lastEpochBySender: Record<string, number> = {}

    type StateBroadcastPayload = {
        senderId: string
        epoch: number
        seq: number
        sentAt: number
        game: GameRow
        players: GamePlayerRow[]
    }

    // Rolling window of the last ~50 sender→receiver broadcast deltas (ms), kept
    // for measuring perceived move latency. Read it from the store in devtools
    // or a headless session. Deltas span two devices, so they include clock
    // skew — on NTP-synced phones on one wifi that's small enough to read the
    // hundreds-of-ms signal we care about.
    const latencyLog = ref<number[]>([])

    function broadcastState() {
        if (!gameChannel || !currentGame.value) return
        const senderId = authStore.user?.id
        if (!senderId) return
        broadcastSeq++
        // Best-effort. postgres_changes is the backstop if this fails.
        Promise.resolve(
            gameChannel.send({
                type: 'broadcast',
                event: 'state',
                payload: {
                    senderId,
                    epoch: broadcastEpoch,
                    seq: broadcastSeq,
                    sentAt: Date.now(),
                    game: { ...currentGame.value },
                    players: gamePlayers.value.map(p => ({ ...p }))
                } satisfies StateBroadcastPayload
            })
        ).catch(() => {})
    }

    // --- Action feed: tells everyone what just happened (who played what) so a
    // card's effect isn't a silent mystery. Carries a counter so the view's
    // transient toast re-triggers even on identical consecutive text. ---
    const lastAction = ref<{ text: string; n: number } | null>(null)
    let actionCounter = 0
    function announce(text: string) {
        if (!text) return
        actionCounter++
        lastAction.value = { text, n: actionCounter }
    }
    // Structured provenance of a remote opponent's play — drives the
    // seat-to-pile throw animation in MultiplayerGameView. Set only from the
    // action broadcast of OTHER players (self-echo is filtered), so it never
    // fires for our own throws.
    const lastRemotePlay = ref<{ userId: string; card: Card; n: number } | null>(null)
    let remotePlayCounter = 0

    function broadcastAction(text: string, card?: Card) {
        announce(text)
        const senderId = authStore.user?.id
        if (!gameChannel || !senderId) return
        Promise.resolve(
            gameChannel.send({ type: 'broadcast', event: 'action', payload: { senderId, text, card } })
        ).catch(() => {})
    }
    function actionLabel(card: Card, who: string): string {
        switch (card.type) {
            case 'skip': return `${who} played Skip`
            case 'reverse': return `${who} reversed the order`
            case 'wildReverseDraw4': return `${who} reversed +4`
            case 'skipEveryone': return `${who} skipped everyone — plays again`
            case 'draw2': return `${who} hit the table with +2`
            case 'draw4': return `${who} hit the table with +4`
            case 'draw6': return `${who} dropped +6`
            case 'draw10': return `${who} dropped +10`
            case 'discardAll': return `${who} discarded all ${card.color}`
            case 'wildColorRoulette': return `${who} spun Color Roulette`
            case 'wild': return `${who} played a Wild`
            case 'number':
                if (card.value === 7) return `${who} swapped hands`
                if (card.value === 0) return `${who} rotated all hands`
                return `${who} played ${card.color} ${card.value}`
            default: return `${who} played a card`
        }
    }

    // --- UNO catch: a player on 1 card who didn't call UNO can be caught by an
    // opponent before the window closes; the offender then draws a brutal 10. ---
    const catchableUserId = ref<string | null>(null)
    const UNO_PENALTY = 10
    let catchWindowTimer: ReturnType<typeof setTimeout> | null = null

    function openCatchWindowFor(userId: string) {
        if (catchWindowTimer) clearTimeout(catchWindowTimer)
        catchableUserId.value = userId
        catchWindowTimer = setTimeout(() => {
            if (catchableUserId.value === userId) catchableUserId.value = null
        }, 6000)
    }
    function closeCatchWindow() {
        if (catchWindowTimer) { clearTimeout(catchWindowTimer); catchWindowTimer = null }
        catchableUserId.value = null
    }
    function sendCatchEvent(event: 'catch_open' | 'catch_close', userId: string) {
        if (!gameChannel || !authStore.user?.id) return
        Promise.resolve(
            gameChannel.send({ type: 'broadcast', event, payload: { senderId: authStore.user.id, userId } })
        ).catch(() => {})
    }
    // Call after our own play/discard: if we're exposed on 1 card, tell everyone
    // they have a window to catch us.
    function maybeOpenSelfCatch() {
        const me = myPlayer.value
        if (!me) return
        if ((me.hand as Card[]).length === 1 && !me.has_called_uno) {
            openCatchWindowFor(me.user_id)
            sendCatchEvent('catch_open', me.user_id)
        }
    }
    // Penalize an opponent who forgot UNO. Client-authoritative (same trust model
    // as swap): we draw 10 from the deck into their hand and persist it.
    async function catchPlayer(targetUserId: string) {
        if (!currentGame.value) return
        if (catchableUserId.value !== targetUserId || targetUserId === authStore.user?.id) return
        const target = gamePlayers.value.find(p => p.user_id === targetUserId)
        if (!target || (target.hand as Card[]).length !== 1) { closeCatchWindow(); return }

        closeCatchWindow() // optimistic — hide the button, avoid a double-catch
        try {
            const expectedVersion = localGameVersion()
            const deck = [...(currentGame.value.deck as Card[])]
            const discard = [...(currentGame.value.discard_pile as Card[])]
            const drawn: Card[] = []
            for (let i = 0; i < UNO_PENALTY; i++) {
                if (deck.length === 0 && !reshuffleDeckHelper(deck, discard)) break
                const c = deck.pop()
                if (c) drawn.push(c)
            }
            const newHand = [...(target.hand as Card[]), ...drawn]
            target.hand = newHand
            if (currentGame.value) {
                currentGame.value.deck = deck as any
                currentGame.value.discard_pile = discard as any
            }
            // PROVISIONAL: show the penalty draw on peers before the commit.
            broadcastState()
            // Commit the board + target's grown hand. Only the winner of the
            // race lands; the loser was resynced (and corrected) already.
            const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                deck,
                discard_pile: discard
            }, [{ id: target.id, hand: newHand }])
            if (!committed) return
            announce(`${target.name} got caught — draws ${UNO_PENALTY}!`)
            sendCatchEvent('catch_close', targetUserId)
            broadcastAction(`${target.name} forgot UNO — caught for ${UNO_PENALTY}!`)
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        }
    }

    // --- In-game stat tracking ---
    const mpGameStartTime = ref(0)
    const mpStats = ref({
        peakCards: 0,
        drawCardsPlayed: 0,
        wildCardsPlayed: 0,
        cardsPlayedTotal: 0,
        skipsDealt: 0,
        swapsMade: 0,
        drawsTaken: 0,
        biggestStackSurvived: 0,
        unoCalls: 0,
        unoPenalties: 0
    })

    function resetMpStats() {
        mpGameStartTime.value = Date.now()
        mpStats.value = {
            peakCards: 0, drawCardsPlayed: 0, wildCardsPlayed: 0,
            cardsPlayedTotal: 0, skipsDealt: 0, swapsMade: 0,
            drawsTaken: 0, biggestStackSurvived: 0, unoCalls: 0, unoPenalties: 0
        }
    }

    // Computed
    const isHost = computed(() => currentGame.value?.host_id === authStore.user?.id)
    const isMyTurn = computed(() =>
        currentGame.value?.current_player_id === authStore.user?.id && !actionInProgress.value
    )
    const gameStatus = computed(() => currentGame.value?.status || 'waiting')
    const roomCode = computed(() => currentGame.value?.room_code || '')
    const stackingMode = computed<StackingMode>(() => (currentGame.value?.stacking_mode as StackingMode) || DEFAULT_STACKING_MODE)
    const opponents = computed(() =>
        gamePlayers.value.filter(p => p.user_id !== authStore.user?.id)
    )

    // Stamp the moment the turn pointer last moved (any source). The watchdog's
    // stuck-resync uses this to detect a frozen game.
    watch(
        () => currentGame.value && `${currentGame.value.current_player_id}|${currentGame.value.turn_state}|${currentGame.value.status}`,
        () => { lastStateChangeAt = Date.now() }
    )

    // Signing out must abandon any active game and clear the store — otherwise
    // the next guest sees the PREVIOUS session's stale room/host chip (the top
    // bar reads the new auth name while the lobby still renders the old game).
    watch(
        () => authStore.user?.id,
        (newId, oldId) => {
            if (oldId && !newId && currentGame.value) leaveGame()
        }
    )

    // Reconnect recovery for the Discard-All picker. The matching-cards list is
    // local-only, so reloading mid-pick lands us on turn_state
    // CHOOSING_DISCARD_ALL_TOP with no picker to render. Rather than persist the
    // list, we detect the stranded state (my turn, picker state, but no pending
    // cards) and auto-resolve by keeping the current discard order and advancing
    // — the cards were already discarded; only the cosmetic top choice is lost.
    watch(
        () => currentGame.value && `${currentGame.value.turn_state}|${currentGame.value.current_player_id}`,
        () => {
            if (
                currentGame.value?.turn_state === 'CHOOSING_DISCARD_ALL_TOP' &&
                isMyTurn.value &&
                pendingDiscardAllCards.value.length === 0 &&
                !actionInProgress.value
            ) {
                resolveStrandedDiscardAll()
            }
        }
    )

    async function resolveStrandedDiscardAll() {
        if (!currentGame.value || !myPlayer.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_DISCARD_ALL_TOP') return
        if (!isMyTurn.value || pendingDiscardAllCards.value.length > 0) return
        const myId = authStore.user?.id
        if (!myId) return
        actionInProgress.value = true
        try {
            const expectedVersion = localGameVersion()
            const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
            const direction = currentGame.value.direction as (1 | -1)
            const nextIdx = calculateNextPlayerIndex(myIndex, direction, gamePlayers.value.length)
            const nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null
            currentGame.value.turn_state = 'WAITING_FOR_ACTION'
            currentGame.value.current_player_id = nextPlayerId
            const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                turn_state: 'WAITING_FOR_ACTION',
                current_player_id: nextPlayerId
            })
            if (!committed) return
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    // Generate room code
    function generateRoomCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    // Insert my seat row, retrying past unique-constraint collisions. Two
    // players joining at once can compute the same seat_order from the
    // non-atomic count; the DB's unique (game_id, seat_order) rejects the
    // duplicate (23505) and we take the next seat instead.
    async function insertSeat(gameId: string, name: string, startSeat: number): Promise<GamePlayerRow> {
        for (let seat = startSeat; seat < startSeat + 12; seat++) {
            const { data, error: err } = await supabase
                .from('game_players')
                .insert({ game_id: gameId, user_id: authStore.user!.id, name, seat_order: seat })
                .select()
                .single()
            if (data && !err) return data
            if (err && err.code !== '23505') throw err
        }
        throw new Error('Could not find a free seat — try again')
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

    // One hand row to write alongside the board. is_eliminated / has_called_uno
    // are optional — omit them to leave the row's current value untouched.
    interface HandUpdate {
        id: string
        hand: Card[]
        is_eliminated?: boolean
        has_called_uno?: boolean
    }

    // Compare-and-swap commit for the board AND the hands it touches, in one
    // round trip. Every writer passes the version of the board it computed from;
    // the commit_move RPC only lands if that version is still current (no one
    // else wrote in between) and writes the hand rows in the same transaction.
    // A lost race returns false after resyncing local state from the DB — the
    // caller's optimistic apply has already been corrected by the resync, so it
    // should simply stop instead of overwriting a newer board (last-write-wins
    // fork).
    async function commitGameUpdate(
        gameId: string,
        expectedVersion: number,
        patch: Record<string, unknown>,
        hands: HandUpdate[] = []
    ): Promise<boolean> {
        const t0 = performance.now()
        const { data, error: err } = await supabase.rpc('commit_move', {
            p_game_id: gameId,
            p_expected_version: expectedVersion,
            p_patch: patch,
            p_hands: hands,
        })
        console.debug('[mp] commit rtt', Math.round(performance.now() - t0), 'ms')
        if (err) throw err
        if (data !== true) {
            // Lost the CAS race. Pull DB truth, then CORRECTION-broadcast it so
            // any peer that applied our provisional snaps back to the real board
            // instead of waiting on the slow pgchanges backstop.
            await resyncFromDb()
            broadcastState()
            return false
        }
        if (currentGame.value?.id === gameId) {
            currentGame.value.version = expectedVersion + 1
        }
        return true
    }

    function localGameVersion(): number {
        return currentGame.value?.version ?? 0
    }

    // Build the hand-write list for a resolved play. 0-rotate and 7-swap fill
    // handsToUpdate with every affected seat; a plain play touches only mine.
    function handsFromState(state: PlayCardState): HandUpdate[] {
        if (state.handsToUpdate.length > 0) {
            return state.handsToUpdate.map(u => ({ id: u.playerId, hand: u.hand }))
        }
        if (!myPlayer.value) return []
        return [{ id: myPlayer.value.id, hand: state.newHand }]
    }

    // Create a new game
    async function createGame(mode: StackingMode = DEFAULT_STACKING_MODE) {
        mpResultLogged = false
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
                    status: 'waiting',
                    stacking_mode: mode
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

    // Quick Match — drop into a public game with strangers. Joins the oldest
    // open public room, or opens one and waits. Requires the games.is_public
    // column (see migration in the PR notes); until that exists this errors
    // gracefully and the rest of the lobby is unaffected.
    async function quickMatch(mode: StackingMode = DEFAULT_STACKING_MODE) {
        if (!authStore.user || !authStore.profile) {
            error.value = 'Profile not ready yet. Try again in a moment.'
            return null
        }
        loading.value = true
        error.value = null
        try {
            const { data: openGames, error: findErr } = await supabase
                .from('games')
                .select('*')
                .eq('status', 'waiting')
                .eq('is_public', true)
                .order('created_at', { ascending: true })
                .limit(10)
            if (findErr) throw findErr

            for (const g of (openGames || [])) {
                if (g.host_id === authStore.user.id) continue
                const { count } = await supabase
                    .from('game_players')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', g.id)
                if ((count || 0) >= 10) continue
                let player: GamePlayerRow
                try {
                    player = await insertSeat(g.id, authStore.profile.username, count || 1)
                } catch { continue }
                // Started between our scan and the insert — back out, next room.
                const { data: gAfter } = await supabase
                    .from('games')
                    .select('status')
                    .eq('id', g.id)
                    .maybeSingle()
                if (gAfter && gAfter.status !== 'waiting') {
                    await supabase.from('game_players').delete().eq('id', player.id)
                    continue
                }
                currentGame.value = g
                myPlayer.value = player
                await loadGamePlayers(g.id)
                subscribeToGame(g.id)
                return g
            }

            // No open public game — host one and wait for a stranger.
            const roomCode = generateRoomCode()
            const { data: game, error: gErr } = await supabase
                .from('games')
                .insert({ room_code: roomCode, host_id: authStore.user.id, status: 'waiting', stacking_mode: mode, is_public: true })
                .select()
                .single()
            if (gErr) throw gErr
            const { data: player, error: pErr } = await supabase
                .from('game_players')
                .insert({ game_id: game.id, user_id: authStore.user.id, name: authStore.profile.username, seat_order: 0 })
                .select()
                .single()
            if (pErr) throw pErr
            currentGame.value = game
            myPlayer.value = player
            gamePlayers.value = player ? [player] : []
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

            // Find the game by code regardless of status — an already-seated
            // player must be able to rejoin a game that's already 'playing'
            // (reconnect). The status gate below only blocks BRAND-NEW joins.
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('room_code', roomCode.toUpperCase())
                .maybeSingle()


            if (gameError || !game) {
                console.error('Game lookup failed:', gameError)
                throw new Error('Game not found')
            }

            // Check if already in game
            const { data: existingPlayer } = await supabase
                .from('game_players')
                .select('*')
                .eq('game_id', game.id)
                .eq('user_id', authStore.user.id)
                .maybeSingle()


            if (existingPlayer) {
                // Existing member — readmit regardless of status (rejoin).
                currentGame.value = game
                myPlayer.value = existingPlayer
                await loadGamePlayers(game.id)
                subscribeToGame(game.id)
                return game
            }

            // New player: only a game still in the lobby can be joined.
            if (game.status !== 'waiting') {
                throw new Error('Game already started')
            }

            // Count existing players
            const { count } = await supabase
                .from('game_players')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', game.id)


            if ((count || 0) >= 10) {
                throw new Error('Game is full (max 10 players)')
            }

            // Join the game
            const player = await insertSeat(game.id, authStore.profile.username, count || 1)

            // The status check above and this insert aren't atomic — the host
            // may have hit Start in between, in which case hands were dealt
            // without us. Back out instead of sitting in a playing game with
            // an empty hand and no turn.
            const { data: gameAfter } = await supabase
                .from('games')
                .select('status')
                .eq('id', game.id)
                .maybeSingle()
            if (gameAfter && gameAfter.status !== 'waiting') {
                await supabase.from('game_players').delete().eq('id', player.id)
                throw new Error('Game already started')
            }

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

    // Only auto-rejoin games whose row was written within this window. Prevents
    // a stale lobby/abandoned game from trapping the player on every page load.
    const RESTORE_STALENESS_MS = 3 * 60 * 60 * 1000 // 3 hours

    // Rehydrate an in-progress game after a reload/reconnect. The store is
    // in-memory only, so a refresh otherwise drops the player into the lobby
    // while their game sits stranded in the DB. We find the player's most
    // recent recently-active membership and re-enter it. No schema change —
    // this reads existing rows and reuses the same hydration as joinGame.
    async function restoreActiveGame() {
        const userId = authStore.user?.id
        if (!userId) return null
        // Already in a game (e.g. created/joined this session) — nothing to do.
        if (currentGame.value) return currentGame.value

        try {
            const { data: myRows } = await supabase
                .from('game_players')
                .select('*')
                .eq('user_id', userId)
                .order('joined_at', { ascending: false })
                .limit(10)

            if (!myRows?.length) return null

            const now = Date.now()
            for (const row of myRows) {
                const { data: game } = await supabase
                    .from('games')
                    .select('*')
                    .eq('id', row.game_id)
                    .maybeSingle()

                if (!game) continue
                if (game.status !== 'playing' && game.status !== 'waiting') continue
                // Skip stale/abandoned rooms so we don't yank the player back into
                // a game they walked away from hours ago on every visit.
                const updatedAt = game.updated_at ? Date.parse(game.updated_at) : 0
                if (updatedAt && now - updatedAt > RESTORE_STALENESS_MS) continue

                currentGame.value = game
                myPlayer.value = row
                await loadGamePlayers(game.id)
                subscribeToGame(game.id)
                return game
            }
            return null
        } catch {
            // A throw mid-hydration would otherwise leave currentGame set with
            // no players loaded and no channel — a half-rendered game.
            currentGame.value = null
            myPlayer.value = null
            gamePlayers.value = []
            return null
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

        // Unsubscribe from previous. Null the ref before the (async) removal so
        // a concurrent caller can't grab and double-remove the dying channel.
        if (gameChannel) {
            const prev = gameChannel
            gameChannel = null
            supabase.removeChannel(prev)
        }
        stopDisconnectWatchdog()

        // Reset broadcast bookkeeping so a stale throttle from a prior game
        // doesn't suppress the new game's first pgchanges events. broadcastEpoch
        // is bumped so peers reset their seq gate for our restarted counter.
        broadcastSeq = 0
        lastBroadcastReceivedAt = 0
        broadcastEpoch = Date.now()
        lastAppliedSeqBySender = {}
        lastEpochBySender = {}
        presentUserIds.value = []
        everSeenPresence = new Set()
        absentSince = {}
        lastStateChangeAt = Date.now()
        closeCatchWindow()

        gameChannel = supabase
            .channel(`game:${gameId}`)
            .on('broadcast', { event: 'state' }, ({ payload }) => {
                // Validate payload shape — broadcasts are untrusted (anyone
                // with the game ID can publish). Reject anything malformed.
                if (!payload || typeof payload !== 'object') return
                const p = payload as Partial<StateBroadcastPayload>
                if (typeof p.senderId !== 'string') return
                if (p.game && typeof p.game !== 'object') return
                if (p.players && !Array.isArray(p.players)) return

                // Self-echo: skip. Our local state is already what we sent.
                if (p.senderId === authStore.user?.id) return

                // Defense-in-depth: only accept broadcasts from a known player
                // in this game. Doesn't prevent in-game spoofing (Player B
                // claiming to be Player A) but blocks random outsiders.
                const knownIds = new Set(gamePlayers.value.map(pl => pl.user_id))
                if (knownIds.size > 0 && !knownIds.has(p.senderId)) return

                // Seq gate: keyed per (sender, epoch). When a sender's epoch
                // changes (they resubscribed and restarted their counter) reset
                // their gate; otherwise drop any frame we've already superseded.
                if (typeof p.seq === 'number') {
                    const epoch = typeof p.epoch === 'number' ? p.epoch : 0
                    if (lastEpochBySender[p.senderId] !== epoch) {
                        lastEpochBySender[p.senderId] = epoch
                        lastAppliedSeqBySender[p.senderId] = 0
                    }
                    if (p.seq <= (lastAppliedSeqBySender[p.senderId] ?? 0)) return
                    lastAppliedSeqBySender[p.senderId] = p.seq
                }

                // Version gate: a frame computed from a stale board (its writer
                // lost the CAS race) carries an older games.version — applying
                // it would propagate the loser's wrong board to this client.
                // Equal versions are fine: hand-only changes don't bump it.
                if (p.game && ((p.game as GameRow).version ?? 0) < localGameVersion()) return

                const now = Date.now()
                if (typeof p.sentAt === 'number') {
                    const delta = now - p.sentAt
                    latencyLog.value.push(delta)
                    if (latencyLog.value.length > 50) latencyLog.value.shift()
                    console.debug('[mp] broadcast latency', delta, 'ms')
                }
                lastBroadcastReceivedAt = now

                if (p.game) {
                    currentGame.value = {
                        ...(currentGame.value || {}),
                        ...(p.game as GameRow)
                    }
                }

                if (p.players?.length) {
                    const byId = new Map(p.players.map(pl => [pl.id, pl]))
                    // Replace existing players in place; preserve order; pick up new ones
                    const merged = gamePlayers.value.map(existing => byId.get(existing.id) ?? existing)
                    for (const incoming of p.players) {
                        if (!merged.some(m => m.id === incoming.id)) merged.push(incoming)
                    }
                    gamePlayers.value = merged

                    const myId = authStore.user?.id
                    if (myId) {
                        myPlayer.value = gamePlayers.value.find(pl => pl.user_id === myId) || null
                        opponent.value = gamePlayers.value.find(pl => pl.user_id !== myId) || null
                    }

                    if (myPlayer.value) {
                        const handLen = (myPlayer.value.hand as Card[])?.length || 0
                        if (handLen > mpStats.value.peakCards) mpStats.value.peakCards = handLen
                    }
                }
            })
            .on('broadcast', { event: 'action' }, ({ payload }) => {
                const p = payload as { senderId?: string; text?: string; card?: Card }
                if (!p?.text || p.senderId === authStore.user?.id) return
                announce(p.text)
                // Card payload is optional + untrusted — validate the fields
                // the throw animation actually renders before exposing it.
                const c = p.card
                if (p.senderId && c && typeof c === 'object' &&
                    typeof c.id === 'string' && typeof c.type === 'string' && typeof c.color === 'string') {
                    remotePlayCounter++
                    lastRemotePlay.value = { userId: p.senderId, card: c, n: remotePlayCounter }
                }
            })
            .on('broadcast', { event: 'catch_open' }, ({ payload }) => {
                const uid = (payload as { userId?: string })?.userId
                if (uid) openCatchWindowFor(uid)
            })
            .on('broadcast', { event: 'catch_close' }, ({ payload }) => {
                const uid = (payload as { userId?: string })?.userId
                if (uid && catchableUserId.value === uid) closeCatchWindow()
            })
            .on('broadcast', { event: 'player_left' }, ({ payload }) => {
                // Explicit, instant leave signal. We don't rely on the
                // game_players DELETE pgchanges for this — its payload.old only
                // carries the primary key (no game_id) unless the table has
                // REPLICA IDENTITY FULL, so that event is easily filtered out
                // and the survivor would be stranded with no feedback.
                const leftId = (payload as { userId?: string })?.userId
                if (!leftId) return
                // Host kicked us — tear down locally and surface why.
                if (leftId === authStore.user?.id) {
                    handleRemovedFromGame()
                    return
                }
                gamePlayers.value = gamePlayers.value.filter(p => p.user_id !== leftId)
                everSeenPresence.delete(leftId)
                delete absentSince[leftId]
                disconnectedUserIds.value = disconnectedUserIds.value.filter(id => id !== leftId)
                checkOpponentLeft()
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'games',
                filter: `id=eq.${gameId}`
            }, (payload) => {
                // Broadcast is the fast path. While it's actively delivering,
                // a pgchanges WAL frame can be an OLDER write (WAL lags 1-2s+)
                // and has no ordering key, so applying it could revert a turn
                // pointer we already advanced — re-creating the soft-lock. So we
                // skip pgchanges inside the window. The dropped-broadcast case is
                // covered instead by the stuck-resync in the watchdog, which
                // re-reads the authoritative row directly (never stale).
                if (Date.now() - lastBroadcastReceivedAt < BROADCAST_THROTTLE_PGCHANGES_MS) return
                if (payload.new) {
                    // WAL frames have no ordering key — drop one older than the
                    // board we already hold (same gate as the broadcast path).
                    if (((payload.new as GameRow).version ?? 0) < localGameVersion()) return
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
                // Filter to our game
                if (payload.new?.game_id === gameId || payload.old?.game_id === gameId) {

                    // INSERT (player joined) and DELETE (player left) are membership
                    // events that broadcast doesn't carry — always process them.
                    // Only UPDATE (in-game state changes) gets throttled while
                    // broadcasts are flowing.
                    const eventType = payload.eventType
                    const isMembershipChange = eventType === 'INSERT' || eventType === 'DELETE'
                    if (!isMembershipChange && Date.now() - lastBroadcastReceivedAt < BROADCAST_THROTTLE_PGCHANGES_MS) {
                        return
                    }

                    await loadGamePlayers(gameId)

                    // We were removed from the game (kicked by host) — our seat
                    // is gone from the roster. Surface it and drop to the lobby
                    // instead of leaving us stranded on a game we're not in.
                    const myId = authStore.user?.id
                    if (currentGame.value && myId && !gamePlayers.value.some(p => p.user_id === myId)) {
                        handleRemovedFromGame()
                        return
                    }

                    // Track peak cards for my hand
                    if (myPlayer.value) {
                        const handLen = (myPlayer.value.hand as Card[])?.length || 0
                        if (handLen > mpStats.value.peakCards) {
                            mpStats.value.peakCards = handLen
                        }
                    }

                    // If during an active game we're down to < 2 active players,
                    // there's no one to play against.
                    checkOpponentLeft()
                }
            })
            .on('presence', { event: 'sync' }, () => {
                const state = gameChannel?.presenceState() || {}
                const ids = new Set<string>()
                for (const key in state) {
                    for (const meta of (state as any)[key]) {
                        if (meta?.user_id) ids.add(meta.user_id)
                    }
                }
                presentUserIds.value = Array.from(ids)
                const now = Date.now()
                for (const id of ids) {
                    everSeenPresence.add(id)
                    delete absentSince[id]
                }
                // A player we've seen before who is no longer present is a
                // disconnect candidate; stamp the moment they dropped.
                for (const id of everSeenPresence) {
                    if (!ids.has(id) && !absentSince[id]) absentSince[id] = now
                }
                disconnectedUserIds.value = Array.from(everSeenPresence).filter(id => !ids.has(id))

                // If a 1v1 opponent who tripped the disconnect overlay has come
                // back (e.g. they just reloaded to reconnect), lift it. An
                // explicit leaver is gone from the roster, so `others` is empty
                // and the overlay correctly stays.
                if (opponentLeft.value) {
                    const active = gamePlayers.value.filter(p => !p.is_eliminated)
                    const others = active.filter(p => p.user_id !== authStore.user?.id)
                    if (others.length > 0 && others.every(o => ids.has(o.user_id))) {
                        opponentLeft.value = false
                    }
                }
            })
            .subscribe((status) => {
                // status is one of: SUBSCRIBED | CHANNEL_ERROR | TIMED_OUT | CLOSED
                if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR'
                    || status === 'TIMED_OUT' || status === 'CLOSED') {
                    realtimeStatus.value = status
                }
                if (status === 'SUBSCRIBED') {
                    const uid = authStore.user?.id
                    if (uid) gameChannel?.track({ user_id: uid }).catch(() => {})
                    startDisconnectWatchdog()
                }
            })
    }

    // Periodically reconcile presence against the turn pointer. Runs on every
    // client but only the host mutates state (single writer). A player must be
    // confirmed absent for DISCONNECT_GRACE_MS — long enough that a reconnect
    // (restoreActiveGame) or a brief network flap cancels it before we act.
    function startDisconnectWatchdog() {
        if (watchdogTimer) return
        watchdogTimer = setInterval(() => {
            const game = currentGame.value
            if (!game || game.status !== 'playing') return
            const now = Date.now()

            // Stuck-resync: if nothing has changed for a while and we're not
            // mid-action, a turn-advancing broadcast may have been dropped. Pull
            // the authoritative row directly (current truth, never a stale WAL
            // frame) to unstick a frozen isMyTurn.
            if (!actionInProgress.value && now - lastStateChangeAt > STUCK_RESYNC_MS) {
                lastStateChangeAt = now // bound to one resync per window while idle
                resyncFromDb()
            }

            // Disconnect handling is scoped to ACTIVE (non-eliminated) players so
            // an eliminated-but-still-seated player can't be mistaken for the
            // live opponent or trigger a false end-of-game.
            const active = gamePlayers.value.filter(p => !p.is_eliminated)
            const others = active.filter(p => p.user_id !== authStore.user?.id)

            if (active.length <= 2) {
                // Down to a 1v1: a confirmed-gone opponent ends the round for us.
                const opp = others[0]
                if (opp && absentSince[opp.user_id] && now - absentSince[opp.user_id]! > DISCONNECT_GRACE_MS) {
                    opponentLeft.value = true
                }
                return
            }

            // 3+ active players: a single elected captain unsticks a turn held by
            // a vanished player. The captain is the lowest-seat present player
            // (not necessarily the host) — so the watchdog keeps working even if
            // the host is the one who vanished, while staying a single writer.
            if (authStore.user?.id !== watchdogCaptainId()) return
            const cur = game.current_player_id
            if (cur && absentSince[cur] && now - absentSince[cur]! > DISCONNECT_GRACE_MS) {
                absentSince[cur] = now // debounce repeated advances during the gap
                advancePastPlayer(cur)
            }
        }, 4000)
    }

    // Deterministic single writer for watchdog turn-advances. Prefers the
    // lowest-seat player currently present; falls back to lowest-seat active
    // (presence may be empty if peers run an older build), then the host.
    function watchdogCaptainId(): string | null {
        const active = gamePlayers.value.filter(p => !p.is_eliminated)
        const present = active.filter(p => presentUserIds.value.includes(p.user_id))
        const pool = present.length ? present : active
        const sorted = [...pool].sort((a, b) => a.seat_order - b.seat_order)
        return sorted[0]?.user_id ?? currentGame.value?.host_id ?? null
    }

    // Authoritative re-read used by the stuck-resync. A direct select returns the
    // current DB row, so there's no WAL-ordering hazard — safe to full-merge.
    async function resyncFromDb() {
        const game = currentGame.value
        if (!game) return
        try {
            const { data } = await supabase
                .from('games')
                .select('*')
                .eq('id', game.id)
                .maybeSingle()
            if (data && currentGame.value && currentGame.value.id === (data as GameRow).id) {
                currentGame.value = { ...currentGame.value, ...(data as GameRow) }
                await loadGamePlayers(game.id)
                checkOpponentLeft()
            }
        } catch {
            // best-effort backstop
        }
    }

    // Surface the "opponent left" state whenever a playing game no longer has
    // two active players — i.e. everyone else left/was eliminated to the point
    // we can't continue. Centralized so every roster-changing path agrees.
    function checkOpponentLeft() {
        if (currentGame.value?.status !== 'playing') return
        const active = gamePlayers.value.filter(p => !p.is_eliminated)
        if (active.length < 2) opponentLeft.value = true
    }

    function stopDisconnectWatchdog() {
        if (watchdogTimer) {
            clearInterval(watchdogTimer)
            watchdogTimer = null
        }
    }

    // Move play off a player who left/was kicked while holding the turn. Clears
    // any pending CHOOSING_* state so the next active player can act.
    async function advancePastPlayer(leaverUserId: string) {
        if (!currentGame.value) return
        if (currentGame.value.current_player_id !== leaverUserId) return
        const expectedVersion = localGameVersion()
        const nextId = getNextPlayerId(leaverUserId)
        currentGame.value.turn_state = 'WAITING_FOR_ACTION'
        currentGame.value.current_player_id = nextId
        currentGame.value.roulette_target_color = null
        try {
            // CAS: if the "vanished" player actually just played (their write
            // bumped the version), this advance loses the race and is dropped
            // instead of yanking the turn off a legitimate move.
            const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                turn_state: 'WAITING_FOR_ACTION',
                current_player_id: nextId,
                roulette_target_color: null
            })
            if (!committed) return
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        }
    }

    // Start the game (host only)
    async function startGame() {

        if (!currentGame.value || !isHost.value) {
            return
        }
        if (gamePlayers.value.length < 2) {
            error.value = 'Need 2 players to start'
            return
        }

        loading.value = true

        try {
            // Generate and shuffle deck
            let deck = shuffleDeck(generateFullDeck())
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

            // Find first non-wild card for discard. If the top is a wild, put it
            // back and reshuffle (Fisher-Yates via shuffleDeck — `sort(() =>
            // Math.random() - 0.5)` is a biased shuffle, not a uniform one), then
            // draw again.
            let firstCard = deck.pop()
            while (firstCard?.type === 'wild' || firstCard?.color === 'wild') {
                deck.push(firstCard)
                deck = shuffleDeck(deck)
                firstCard = deck.pop()
            }


            // Update player hands. Deliberately BEFORE the games-row CAS — the
            // reverse of the in-game actions. If hands land but the commit
            // loses its race, the room just stays 'waiting' and a retry
            // re-deals over them; committing 'playing' first could publish a
            // started game whose hands were never written, which has no retry.
            for (let i = 0; i < gamePlayers.value.length; i++) {
                const player = gamePlayers.value[i]
                if (!player) continue

                const { error: updateError } = await supabase
                    .from('game_players')
                    .update({ hand: hands[i] })
                    .eq('id', player.id)

                if (updateError) throw updateError
            }


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

            const committed = await commitGameUpdate(currentGame.value.id, localGameVersion(), {
                status: 'playing',
                deck: deck,
                discard_pile: firstCard ? [firstCard] : [],
                current_color: firstCard?.color || 'red',
                current_player_id: startingPlayerId,
                direction: startingDirection,
                draw_stack: startingDrawStack,
                turn_state: 'WAITING_FOR_ACTION'
            })
            if (!committed) return

            resetMpStats()

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
                // Penalty: the last card still counts as played, but you draw 2
                // and play continues. Write the COMPLETE board (mirror
                // updateGameState) and broadcast — otherwise the next player is
                // left on a stale discard/color/draw_stack/turn_state and the
                // game desyncs permanently. playCard early-returns on null and
                // skips its own optimistic apply + broadcast, so we do both here.
                mpStats.value.unoPenalties++
                const deck = [...(game.deck as Card[])]
                const drawn: Card[] = []
                for (let i = 0; i < 2; i++) {
                    const c = deck.pop()
                    if (c) drawn.push(c)
                }

                if (myPlayer.value) {
                    myPlayer.value.hand = drawn
                    myPlayer.value.has_called_uno = false
                }
                if (currentGame.value) {
                    currentGame.value.deck = deck as any
                    currentGame.value.discard_pile = state.newDiscard as any
                    currentGame.value.current_color = state.newColor
                    currentGame.value.current_player_id = state.nextPlayerId
                    currentGame.value.direction = state.direction
                    currentGame.value.draw_stack = state.drawStack
                    currentGame.value.turn_state = state.turnState
                    currentGame.value.roulette_target_color = state.rouletteTargetColor
                }

                // CAS the board and my drawn hand in one commit.
                const committed = await commitGameUpdate(game.id, game.version ?? 0, {
                    deck,
                    discard_pile: state.newDiscard,
                    current_color: state.newColor,
                    current_player_id: state.nextPlayerId,
                    direction: state.direction,
                    draw_stack: state.drawStack,
                    turn_state: state.turnState,
                    roulette_target_color: state.rouletteTargetColor
                }, [{ id: myPlayer.value!.id, hand: drawn, has_called_uno: false }])
                if (committed) {
                    broadcastState()
                }

                return null // Signals early return — board already written + broadcast
            } else {
                await updateWinnerScore(myId)
                return { winnerId: myId, status: 'finished', finalHand }
            }
        }

        return { winnerId: null, status: 'playing', finalHand }
    }

    // Update the board and the hands it touched in one CAS-guarded commit.
    // Returns false (after a resync) when another client wrote the board first.
    async function updateGameState(
        gameId: string,
        expectedVersion: number,
        deck: Card[],
        state: PlayCardState,
        winnerId: string | null,
        status: string
    ): Promise<boolean> {
        return commitGameUpdate(gameId, expectedVersion, {
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
        }, handsFromState(state))
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

        // The action feed (toast + remote-throw animation) is broadcast only
        // AFTER the commit, unlike the board state which fans out provisionally.
        // An animation can't be un-played, so it must announce committed moves
        // only; a move that fails to land would otherwise animate then correct.
        // The card rides along so peers can run the remote-throw animation.
        const label = actionLabel(card, myPlayer.value.name || 'Someone')

        // Check win condition
        const winResult = await checkWinCondition(state, myId, game)
        if (winResult === null) {
            actionInProgress.value = false
            return
        }

        // Snapshot for rollback — if the write fails outright (network), the
        // optimistic apply below must be undone or our local board forks from
        // the DB (card gone from hand, turn advanced, move never committed).
        const savedMyHand = myPlayer.value.hand
        const savedHands = state.handsToUpdate.map(u => ({
            playerId: u.playerId,
            hand: gamePlayers.value.find(p => p.id === u.playerId)?.hand
        }))
        const savedGame = currentGame.value ? { ...currentGame.value } : null

        // OPTIMISTIC LOCAL APPLY — make the UI move immediately instead of
        // waiting on two DB round-trips. The realtime channel will correct
        // anything that drifts (and our writes below normally win the race).
        if (myPlayer.value) {
            myPlayer.value.hand = state.newHand
        }
        if (state.handsToUpdate.length > 0) {
            for (const upd of state.handsToUpdate) {
                const gp = gamePlayers.value.find(p => p.id === upd.playerId)
                if (gp) gp.hand = upd.hand
            }
        }
        if (currentGame.value) {
            currentGame.value.discard_pile = state.newDiscard as any
            currentGame.value.current_color = state.newColor
            currentGame.value.current_player_id = state.nextPlayerId
            currentGame.value.direction = state.direction
            currentGame.value.draw_stack = state.drawStack
            currentGame.value.turn_state = state.turnState
            currentGame.value.roulette_target_color = state.rouletteTargetColor
            if (winResult.winnerId) currentGame.value.winner_id = winResult.winnerId
            if (winResult.status) currentGame.value.status = winResult.status as typeof currentGame.value.status
        }

        // PROVISIONAL broadcast — fan out the optimistic board to peers before
        // the commit so the move shows on their screen in one fan-out hop (~100ms)
        // instead of after our commit round trip. It carries the pre-bump version
        // (equal to what peers hold), so the receiver's version + seq gates order
        // it ahead of the post-commit CONFIRM below; a lost CAS race is undone by
        // the CORRECTION broadcast in commitGameUpdate. Skipped on a winning move:
        // a provisional "you lost" that then rolls back is not worth the flicker.
        //
        // The action rides the provisional too, sent FIRST so the receiver starts
        // the seat-to-pile throw a beat before the state lands the card on the
        // pile — the two animate together. (Leaving the action on the post-commit
        // path, as PR B did, double-rendered: the pile popped the card at ~100ms,
        // then a late throw flew a second card onto it a commit-RTT later.) The
        // turn holder is the only one who can play, so this move can't lose the
        // CAS race — the provisional throw is safe from a rollback here.
        if (!winResult.winnerId) {
            broadcastAction(label, card)
            broadcastState()
        }

        let committed = false
        try {
            // Commit the board + hands in one CAS'd RPC. Only the winner of the
            // race lands; a loser has already been resynced from the DB inside
            // commitGameUpdate (which also broadcasts the correction).
            committed = await updateGameState(
                game.id, game.version ?? 0, game.deck as Card[], state, winResult.winnerId, winResult.status
            )
            if (!committed) return
            // Count the play only once it actually landed.
            const st = mpStats.value
            st.cardsPlayedTotal++
            if (card.color === 'wild') st.wildCardsPlayed++
            if (getDrawValue(card) > 0) st.drawCardsPlayed++
            if (card.type === 'skip' || card.type === 'skipEveryone') st.skipsDealt++
            broadcastState()
            // A winning move stayed on the commit path (no provisional), so its
            // announce fires here — the win can afford the extra round trip.
            if (winResult.winnerId) broadcastAction(label, card)
            // Exposed on 1 card without calling UNO — open the catch window.
            maybeOpenSelfCatch()
        } catch (err: any) {
            error.value = err.message
            // Roll back the optimistic apply only if the board never committed.
            // The commit is atomic (board + hands in one RPC transaction), so a
            // throw means nothing landed and the snapshot is safe to restore; a
            // committed board is ahead of the snapshot and must not be reverted.
            if (!committed) {
                if (myPlayer.value) myPlayer.value.hand = savedMyHand
                for (const s of savedHands) {
                    const gp = gamePlayers.value.find(p => p.id === s.playerId)
                    if (gp && s.hand) gp.hand = s.hand
                }
                if (savedGame && currentGame.value?.id === savedGame.id) currentGame.value = savedGame
                // Undo the provisional on any peer that applied it.
                broadcastState()
            }
        } finally {
            actionInProgress.value = false
        }
    }

    // Swap hands with target player (for 7 card)
    // targetPlayerId can be either game_players.id or user_id
    async function swapHands(targetPlayerId: string) {
        if (!currentGame.value || !myPlayer.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_PLAYER_TO_SWAP') return
        // Only the player who played the 7 (turn holder during the choosing
        // state) may swap — without this, any client whose local state shows
        // the choosing turn_state could overwrite both hands.
        if (currentGame.value.current_player_id !== authStore.user?.id) return
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

        // Optimistic local apply — both hands swap locally before the round-trips.
        const expectedVersion = localGameVersion()
        const meRef = gamePlayers.value.find(p => p.user_id === myId)
        const targetRef = gamePlayers.value.find(p => p.id === freshTarget.id)
        if (meRef) meRef.hand = targetHand
        if (targetRef) targetRef.hand = myHand
        if (currentGame.value) {
            currentGame.value.turn_state = 'WAITING_FOR_ACTION'
            currentGame.value.current_player_id = nextPlayerId
        }

        // PROVISIONAL: show the swapped hands + turn advance before the commit.
        broadcastState()

        try {
            // CAS the board and both swapped hands in one commit.
            const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                turn_state: 'WAITING_FOR_ACTION',
                current_player_id: nextPlayerId
            }, [
                { id: freshMe.id, hand: targetHand },
                { id: freshTarget.id, hand: myHand }
            ])
            if (!committed) return
            mpStats.value.swapsMade++
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    async function skipSwap() {
        if (!currentGame.value || !myPlayer.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_PLAYER_TO_SWAP') return
        if (currentGame.value.current_player_id !== authStore.user?.id) return
        if (actionInProgress.value) return

        actionInProgress.value = true
        const myId = authStore.user?.id
        if (!myId) {
            actionInProgress.value = false
            return
        }

        const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
        const playerCount = gamePlayers.value.length
        const direction = currentGame.value.direction as (1 | -1)
        const nextIdx = calculateNextPlayerIndex(myIndex, direction, playerCount)
        const nextPlayerId = gamePlayers.value[nextIdx]?.user_id || null

        const expectedVersion = localGameVersion()
        if (currentGame.value) {
            currentGame.value.turn_state = 'WAITING_FOR_ACTION'
            currentGame.value.current_player_id = nextPlayerId
        }

        // PROVISIONAL: hand the turn to the next player on peers before the commit.
        broadcastState()

        try {
            const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                turn_state: 'WAITING_FOR_ACTION',
                current_player_id: nextPlayerId
            })
            if (!committed) return
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    // Set roulette color (victim chooses). The victim then draws until they hit
    // the chosen color, or get eliminated at the mercy threshold. We resolve the
    // ENTIRE draw synchronously and commit it in ONE write that goes straight
    // from CHOOSING_ROULETTE_COLOR to WAITING_FOR_ACTION — we never persist an
    // intermediate ROULETTE_DRAWING state.
    //
    // This used to be a self-rescheduling setTimeout loop that wrote
    // ROULETTE_DRAWING to the DB between draws. If the acting tab died or a
    // stale broadcast flipped state mid-loop, the row stayed ROULETTE_DRAWING
    // forever with no resume path — a soft-lock that survived reloads. Atomic
    // resolution removes the durable intermediate state; the staggered card
    // reveal is produced by the view's hand-length watcher.
    async function setRouletteColor(color: CardColor) {
        if (!currentGame.value || !myPlayer.value || !isMyTurn.value) return
        if (currentGame.value.turn_state !== 'CHOOSING_ROULETTE_COLOR') return
        if (actionInProgress.value) return

        actionInProgress.value = true

        try {
            const game = currentGame.value
            const expectedVersion = localGameVersion()
            const localDeck = [...(game.deck as Card[])]
            const localDiscard = [...(game.discard_pile as Card[])]
            const hand = [...(myPlayer.value.hand as Card[])]

            // Draw until we hit the target color or cross the mercy threshold.
            // Bounded: the hand can only grow to the elimination cap.
            let foundColor = false
            let isEliminated = false
            while (true) {
                if (localDeck.length === 0) {
                    if (localDiscard.length > 1) {
                        const top = localDiscard.pop()!
                        localDeck.push(...shuffleDeck(localDiscard.splice(0)))
                        localDiscard.push(top)
                    } else {
                        break // out of cards — no match possible
                    }
                }
                const card = localDeck.pop()
                if (!card) break
                hand.push(card)
                if (checkMercyRule(hand.length)) { isEliminated = true; break }
                // Wild cards do NOT count as matching the target color.
                if (card.color === color) { foundColor = true; break }
            }

            const drawnCard = hand[hand.length - 1]
            let finalHand = hand
            const newDiscard = [...localDiscard]
            let newColor: string = game.current_color

            if (isEliminated) {
                finalHand = []
                newDiscard.push(...hand)
            } else if (foundColor && drawnCard) {
                finalHand = hand.filter(c => c.id !== drawnCard.id)
                newDiscard.push(drawnCard)
                newColor = drawnCard.color === 'wild' ? color : drawnCard.color
            } else {
                // Out of cards with no match — keep the chosen color, play on.
                newColor = color
            }

            const { winner_id, status: gStatus } = isEliminated
                ? await checkForWinnerAfterElimination()
                : { winner_id: null, status: 'playing' }
            const nextId = getNextPlayerId()

            // Optimistic local apply — the view's hand-length watcher turns the
            // jump from the old hand size to finalHand into a staggered reveal.
            if (myPlayer.value) {
                myPlayer.value.hand = finalHand
                myPlayer.value.is_eliminated = isEliminated
                myPlayer.value.has_called_uno = false
            }
            if (currentGame.value) {
                currentGame.value.deck = localDeck as any
                currentGame.value.discard_pile = newDiscard as any
                currentGame.value.current_color = newColor
                currentGame.value.turn_state = 'WAITING_FOR_ACTION'
                currentGame.value.roulette_target_color = null
                currentGame.value.current_player_id = nextId
                if (winner_id) currentGame.value.winner_id = winner_id
                currentGame.value.status = gStatus as typeof currentGame.value.status
            }

            // PROVISIONAL: show the roulette result before the commit, unless it
            // ended the game (a rolled-back "you lost" is not worth the flicker).
            if (!winner_id) broadcastState()

            // CAS the board and my resolved hand in one commit.
            const committed = await commitGameUpdate(game.id, expectedVersion, {
                deck: localDeck,
                discard_pile: newDiscard,
                current_color: newColor,
                turn_state: 'WAITING_FOR_ACTION',
                roulette_target_color: null,
                current_player_id: nextId,
                winner_id,
                status: gStatus
            }, [{ id: myPlayer.value!.id, hand: finalHand, is_eliminated: isEliminated, has_called_uno: false }])
            if (!committed) return
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        } finally {
            actionInProgress.value = false
        }
    }

    // Call UNO
    async function callUno() {
        if (!myPlayer.value) return
        mpStats.value.unoCalls++
        myPlayer.value.has_called_uno = true
        // Calling UNO closes our catch window — tell everyone we're safe.
        const myUid = myPlayer.value.user_id
        if (catchableUserId.value === myUid) closeCatchWindow()
        sendCatchEvent('catch_close', myUid)
        try {
            await supabase
                .from('game_players')
                .update({ has_called_uno: true })
                .eq('id', myPlayer.value.id)
            broadcastState()
        } catch (err: any) {
            error.value = err.message
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

        const expectedVersion = localGameVersion()
        const { winner_id, status: gStatus } = await checkForWinnerAfterElimination()
        const nextId = getNextPlayerId()

        // Optimistic local apply so broadcastState() reflects the elimination
        if (myPlayer.value) {
            myPlayer.value.hand = []
            myPlayer.value.is_eliminated = true
        }
        if (currentGame.value) {
            currentGame.value.deck = state.deck as any
            currentGame.value.discard_pile = state.discardPile as any
            currentGame.value.current_player_id = nextId
            if (winner_id) currentGame.value.winner_id = winner_id
            currentGame.value.status = gStatus as typeof currentGame.value.status
        }

        // PROVISIONAL: show the elimination before the commit, unless it ended
        // the game (skip the rolled-back "you lost" flicker).
        if (!winner_id) broadcastState()

        // CAS the board and my emptied, eliminated hand in one commit.
        const committed = await commitGameUpdate(gameId, expectedVersion, {
            deck: state.deck,
            discard_pile: state.discardPile,
            current_player_id: nextId,
            winner_id,
            status: gStatus
        }, [{ id: myPlayer.value!.id, hand: [], is_eliminated: true }])
        if (!committed) return
        broadcastState()
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

        const expectedVersion = localGameVersion()
        const nextId = getNextPlayerId()

        // Optimistic local apply before the network round-trip.
        if (myPlayer.value) {
            myPlayer.value.hand = isEliminated ? [] : newHand
            myPlayer.value.is_eliminated = isEliminated
            myPlayer.value.has_called_uno = false
        }
        if (currentGame.value) {
            currentGame.value.deck = state.deck as any
            currentGame.value.discard_pile = state.discardPile as any
            currentGame.value.draw_stack = 0
            currentGame.value.current_player_id = nextId
        }

        const { winner_id, status: gStatus } = isEliminated
            ? await checkForWinnerAfterElimination()
            : { winner_id: null, status: 'playing' }

        // PROVISIONAL: show the penalty draw before the commit, unless it ended
        // the game (skip the rolled-back "you lost" flicker).
        if (!winner_id) broadcastState()

        // CAS the board and my post-penalty hand in one commit.
        const committed = await commitGameUpdate(gameId, expectedVersion, {
            deck: state.deck,
            discard_pile: state.discardPile,
            draw_stack: 0,
            current_player_id: nextId,
            winner_id,
            status: gStatus
        }, [{ id: myPlayer.value!.id, hand: isEliminated ? [] : newHand, is_eliminated: isEliminated, has_called_uno: false }])
        if (!committed) return
        broadcastState()
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
                    const expectedVersion = localGameVersion()
                    const nextId = getNextPlayerId()
                    if (currentGame.value) currentGame.value.current_player_id = nextId
                    // PROVISIONAL: hand the turn on before the commit.
                    broadcastState()
                    const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                        current_player_id: nextId
                    })
                    if (committed) broadcastState()

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

                const expectedVersion = localGameVersion()

                // Optimistic local apply.
                myPlayer.value.hand = newHand
                myPlayer.value.has_called_uno = false
                if (currentGame.value) {
                    currentGame.value.deck = state.deck as any
                    currentGame.value.discard_pile = state.discardPile as any
                }

                // PROVISIONAL: show the drawn card before the commit.
                broadcastState()

                // A lost race (e.g. the watchdog advanced past us mid-draw) stops
                // the loop; resync inside commitGameUpdate already restored the
                // true board and hand (and broadcast the correction).
                const committed = await commitGameUpdate(currentGame.value.id, expectedVersion, {
                    deck: state.deck,
                    discard_pile: state.discardPile
                }, [{ id: myPlayer.value!.id, hand: newHand, has_called_uno: false }])
                if (!committed) {
                    actionInProgress.value = false
                    return
                }
                broadcastState()

                // Check if drawn card is playable
                if (state.topCard && canPlayCard(card, state.topCard, state.currentColor, 0, stackingMode.value)) {
                    actionInProgress.value = false

                    if (card.color === 'wild') {
                        // Wild card drawn - player needs to pick a color
                        pendingDrawnWildCard.value = card
                        return
                    }

                    setTimeout(async () => {
                        await playCard(card)
                    }, 300)
                } else {
                    // Not playable, draw again
                    setTimeout(drawUntilPlayable, 150)
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
            const hasPlayable = myHand.some(c => canPlayCard(c, topCard, curColor, 0, stackingMode.value))
            if (hasPlayable) return // Must play a card instead
        }

        actionInProgress.value = true

        // Track draw stats
        const st = mpStats.value
        st.drawsTaken++
        if (curDrawStack > 0 && curDrawStack > st.biggestStackSurvived) {
            st.biggestStackSurvived = curDrawStack
        }

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
        if (currentGame.value.current_player_id !== authStore.user?.id) return
        if (actionInProgress.value) return

        const matchingCards = pendingDiscardAllCards.value
        const topCard = matchingCards.find(c => c.id === topCardId)
        if (!topCard) return
        // All early-out guards must run BEFORE we set actionInProgress / clear
        // the picker, or we'd leak the guard and lose the picker on a bail.
        const myId = authStore.user?.id
        if (!myId) return

        actionInProgress.value = true
        // Snapshot for rollback — this optimistically advances the turn before
        // the write confirms, so on failure we must restore the picker state or
        // both clients end up believing it's the other's turn (a soft-lock).
        const savedPending = matchingCards
        const savedDiscard = currentGame.value.discard_pile
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

        const game = currentGame.value
        const myIndex = gamePlayers.value.findIndex(p => p.user_id === myId)
        const playerCount = gamePlayers.value.length
        const myHand = myPlayer.value.hand as Card[]

        let committed = false
        try {
            // Build a play-state for the chosen TOP card and run it through the
            // same effect engine as a normal play, so the picked card actually
            // does its thing (7 → swap prompt, 0 → rotate, skip/reverse/draw/
            // skip-all all fire). Previously the picked card did nothing.
            const state: PlayCardState = {
                direction: game.direction as (1 | -1),
                drawStack: game.draw_stack || 0,
                turnState: 'WAITING_FOR_ACTION',
                nextPlayerId: null,
                rouletteTargetColor: null,
                newColor: (topCard.color === 'wild' ? game.current_color : topCard.color) as CardColor,
                handsToUpdate: [],
                newHand: myHand,
                newDiscard: reorderedDiscard,
            }

            let winnerId: string | null = null
            let status = 'playing'

            if (myHand.length === 0) {
                // Bulk dump emptied the hand → win (no UNO penalty for a dump).
                await updateWinnerScore(myId)
                winnerId = myId
                status = 'finished'
                state.nextPlayerId = getNextPlayerId()
            } else {
                applyAllCardEffects(topCard, myId, myIndex, playerCount, myPlayer.value.id, state)
                broadcastAction(actionLabel(topCard, myPlayer.value.name || 'Someone'), topCard)
            }

            // Optimistic local apply.
            const mine = state.handsToUpdate.find(h => h.playerId === myPlayer.value!.id)
            if (mine && myPlayer.value) myPlayer.value.hand = mine.hand
            if (currentGame.value) {
                currentGame.value.discard_pile = state.newDiscard as any
                currentGame.value.current_color = state.newColor
                currentGame.value.turn_state = state.turnState
                currentGame.value.current_player_id = state.nextPlayerId
                currentGame.value.direction = state.direction
                currentGame.value.draw_stack = state.drawStack
                currentGame.value.roulette_target_color = state.rouletteTargetColor
                if (winnerId) currentGame.value.winner_id = winnerId
                currentGame.value.status = status as typeof currentGame.value.status
            }

            // PROVISIONAL: show the bulk discard before the commit, unless it
            // won the game (skip the rolled-back flicker).
            if (!winnerId) broadcastState()

            // On a lost race the resync restored the true board; the stranded-
            // picker watcher recovers if the turn is genuinely still ours.
            committed = await updateGameState(
                game.id, game.version ?? 0, game.deck as Card[], state, winnerId, status
            )
            if (!committed) return
            broadcastState()
            maybeOpenSelfCatch()
        } catch (err: any) {
            error.value = err.message
            // Roll back the optimistic apply so the picker reopens and the turn
            // stays on us, rather than silently desyncing both clients. Only
            // valid while the board never committed — the commit is atomic, so a
            // throw means nothing landed; a committed board is ahead of this
            // snapshot and must not be reverted.
            if (!committed) {
                pendingDiscardAllCards.value = savedPending
                if (currentGame.value) {
                    currentGame.value.discard_pile = savedDiscard
                    currentGame.value.turn_state = 'CHOOSING_DISCARD_ALL_TOP'
                    currentGame.value.current_player_id = authStore.user?.id ?? null
                }
                // Undo the provisional on any peer that applied it.
                broadcastState()
            }
        } finally {
            actionInProgress.value = false
        }
    }

    // Kick a player (host only). Removes their seat and, if they were holding
    // the turn, advances play so the table doesn't stall on them. Client-
    // enforced only — there is no RLS, so this is a usability tool (remove a
    // dropped/stuck player), not a security boundary.
    async function kickPlayer(targetUserId: string) {
        if (!currentGame.value || !isHost.value) return
        if (targetUserId === authStore.user?.id) return
        const target = gamePlayers.value.find(p => p.user_id === targetUserId)
        if (!target) return

        const holdsTurn = currentGame.value.current_player_id === targetUserId
        // Compute the successor BEFORE removing them locally — getNextPlayerId
        // resolves seats by index against the current roster.
        const nextId = holdsTurn ? getNextPlayerId(targetUserId) : null

        try {
            // Tell the kicked player (and everyone) instantly — don't rely on the
            // DELETE pgchanges, whose payload may lack game_id.
            if (gameChannel) {
                try {
                    await gameChannel.send({
                        type: 'broadcast',
                        event: 'player_left',
                        payload: { senderId: authStore.user?.id, userId: targetUserId }
                    })
                } catch { /* best-effort */ }
            }
            await supabase.from('game_players').delete().eq('id', target.id)
            gamePlayers.value = gamePlayers.value.filter(p => p.user_id !== targetUserId)
            delete absentSince[targetUserId]
            everSeenPresence.delete(targetUserId)
            disconnectedUserIds.value = disconnectedUserIds.value.filter(id => id !== targetUserId)

            if (holdsTurn && currentGame.value) {
                const expectedVersion = localGameVersion()
                currentGame.value.turn_state = 'WAITING_FOR_ACTION'
                currentGame.value.current_player_id = nextId
                currentGame.value.roulette_target_color = null
                await commitGameUpdate(currentGame.value.id, expectedVersion, {
                    turn_state: 'WAITING_FOR_ACTION',
                    current_player_id: nextId,
                    roulette_target_color: null
                })
            }
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        }
    }

    // Update my display name in the current game so other players see it.
    // The profile rename (authStore.updateUsername) only changes future games;
    // this patches the live game_players row + broadcasts so the rename shows
    // up for everyone immediately.
    async function updateMyName(name: string) {
        if (!currentGame.value || !myPlayer.value) return
        const clean = name.trim().slice(0, 20)
        if (!clean) return
        myPlayer.value.name = clean
        const me = gamePlayers.value.find(p => p.id === myPlayer.value!.id)
        if (me) me.name = clean
        try {
            await supabase
                .from('game_players')
                .update({ name: clean })
                .eq('id', myPlayer.value.id)
            broadcastState()
        } catch (err: any) {
            error.value = err.message
        }
    }

    // Local-only teardown for when WE were kicked (the row is already gone, so
    // unlike leaveGame we must not issue another delete). Drops us to the lobby
    // with a notice.
    function handleRemovedFromGame() {
        if (gameChannel) {
            supabase.removeChannel(gameChannel)
            gameChannel = null
        }
        stopDisconnectWatchdog()
        currentGame.value = null
        myPlayer.value = null
        opponent.value = null
        gamePlayers.value = []
        presentUserIds.value = []
        disconnectedUserIds.value = []
        everSeenPresence = new Set()
        absentSince = {}
        error.value = 'You were removed from the game by the host.'
    }

    // Leave game
    async function leaveGame() {
        // Tell peers immediately so the survivor isn't stranded waiting on the
        // (unreliable) game_players DELETE event. Fire-and-forget before teardown.
        if (gameChannel && currentGame.value && myPlayer.value) {
            try {
                await gameChannel.send({
                    type: 'broadcast',
                    event: 'player_left',
                    payload: { senderId: authStore.user?.id, userId: myPlayer.value.user_id }
                })
            } catch { /* best-effort */ }
        }
        if (gameChannel) {
            supabase.removeChannel(gameChannel)
            gameChannel = null
        }
        stopDisconnectWatchdog()

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
        presentUserIds.value = []
        disconnectedUserIds.value = []
        everSeenPresence = new Set()
        absentSince = {}
        closeCatchWindow()
    }

    // Log game results when multiplayer game finishes
    let mpResultLogged = false

    async function logMpGameResult() {
        if (mpResultLogged) return
        if (!currentGame.value || currentGame.value.status !== 'finished') return
        const userId = authStore.user?.id
        if (!userId) return

        mpResultLogged = true
        const st = mpStats.value
        const duration = Math.round((Date.now() - mpGameStartTime.value) / 1000)
        const myHand = (myPlayer.value?.hand as Card[]) || []

        let result: 'won' | 'lost' | 'eliminated' | 'abandoned' = 'lost'
        if (currentGame.value.winner_id === userId) result = 'won'
        else if (myPlayer.value?.is_eliminated) result = 'eliminated'

        await supabase.from('game_results').insert({
            game_id: currentGame.value.id,
            user_id: userId,
            opponent_count: gamePlayers.value.length - 1,
            result,
            cards_remaining: myHand.length,
            peak_cards: st.peakCards,
            draw_cards_played: st.drawCardsPlayed,
            wild_cards_played: st.wildCardsPlayed,
            cards_played_total: st.cardsPlayedTotal,
            skips_dealt: st.skipsDealt,
            swaps_made: st.swapsMade,
            draws_taken: st.drawsTaken,
            biggest_stack_survived: st.biggestStackSurvived,
            uno_calls: st.unoCalls,
            uno_penalties: st.unoPenalties,
            game_duration_secs: duration,
            is_bot_game: false
        })
    }

    // Watch for game status changes to log results
    watch(
        () => currentGame.value?.status,
        (newStatus, oldStatus) => {
            if (newStatus === 'finished' && oldStatus === 'playing') {
                logMpGameResult()
            }
            if (newStatus === 'playing' && oldStatus !== 'playing') {
                mpResultLogged = false
                resetMpStats()
            }
        }
    )

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
        stackingMode,
        opponentLeft,
        realtimeStatus,
        actionInProgress,
        suppressDiscardSlam,
        pendingDrawnWildCard,
        pendingDiscardAllCards,
        presentUserIds,
        disconnectedUserIds,
        lastAction,
        lastRemotePlay,
        catchableUserId,
        catchPlayer,
        mpStats,
        createGame,
        joinGame,
        quickMatch,
        restoreActiveGame,
        startGame,
        playCard,
        drawCard,
        swapHands,
        skipSwap,
        setRouletteColor,
        playDrawnWildCard,
        selectDiscardAllTop,
        callUno,
        kickPlayer,
        updateMyName,
        leaveGame,
        loadGamePlayers,
        subscribeToGame,
        latencyLog
    }
})
