import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Card, CardColor } from '../types/card'
import { DEFAULT_STACKING_MODE, type StackingMode } from '../utils/gameRules'
import { getDrawValue } from '../utils/gameRules'
import { supabase, type GameRow, type GamePlayerRow } from '../lib/supabase'
import { track } from '../utils/analytics'
import { useAuthStore } from './authStore'
import { useVoiceStore } from './voiceStore'
import type { ClientMsg, IntentAction, PersonalView, PresencePlayer, ServerMsg } from '@protocol'

// The authoritative game server (Cloudflare Worker + one Durable Object per
// room). The client is a thin mirror: it sends intents and renders the
// personalized snapshots the room answers with. All rules run server-side —
// opponents' hands never reach this client.
const GAME_SERVER = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined) || 'https://uno-game-server.shekhaliul44.workers.dev'
const STORED_ROOM_KEY = 'uno_mp_room'

export const useMultiplayerStore = defineStore('multiplayer', () => {
    const authStore = useAuthStore()

    // --- Server state mirrors ---
    const view = ref<PersonalView | null>(null)
    const presence = ref<PresencePlayer[]>([])
    const roomCodeRef = ref<string | null>(null)
    // Legacy contract: always a string ('' when not in a room).
    const roomCode = computed(() => roomCodeRef.value ?? '')
    const myUserId = ref<string | null>(null)
    const hostUserId = ref<string | null>(null)
    let lastSeq = 0

    // --- Connection ---
    const realtimeStatus = ref<'CONNECTING' | 'SUBSCRIBED' | 'CLOSED'>('CLOSED')
    let ws: WebSocket | null = null
    let closedByUs = false
    let reconnectAttempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    // --- Host/UI concerns ---
    const loading = ref(false)
    const error = ref<string | null>(null)
    const actionInProgress = ref(false)
    const suppressDiscardSlam = ref(false)
    const stackingMode = ref<StackingMode>(DEFAULT_STACKING_MODE)
    const opponentLeft = ref(false)
    // Catch windows are a phase-5 server feature; until then nobody is catchable.
    const catchableUserId = ref<string | null>(null)
    const lastAction = ref<{ text: string; n: number } | null>(null)
    const lastRemotePlay = ref<{ userId: string; card: Card; n: number } | null>(null)
    let actionN = 0
    let playN = 0
    let intentN = 0

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
        unoPenalties: 0,
    })

    // One in-flight optimistic intent: remember the pre-mutation view so a
    // server rejection can roll the render back.
    let pendingIntent: { id: string; prevView: PersonalView | null } | null = null

    // --- Analytics clocks (never affect gameplay) ---
    // STARTED only fires on a real deal (never a reconnect); the player count
    // lives in the snapshot that follows, so the event arms and the snapshot fires.
    let pendingStartTrack = false
    let trackedGameId: string | null = null
    let gameStartedAt = 0
    let roomJoinedAt = 0

    // --- Adapters: legacy row shapes the views already consume ---

    function hiddenHand(userId: string, count: number): Card[] {
        return Array.from({ length: count }, (_, i) => ({
            id: `hidden-${userId}-${i}`, color: 'red' as CardColor, type: 'number' as const, value: 0,
        }))
    }

    const currentGame = computed<GameRow | null>(() => {
        const v = view.value
        if (!v || !roomCodeRef.value) return null
        return {
            id: v.gameId ?? roomCode.value,
            room_code: roomCode.value,
            status: v.status === 'lobby' ? 'waiting' : v.status,
            host_id: v.hostUserId ?? hostUserId.value ?? '',
            current_player_id: v.currentPlayerId,
            direction: v.direction,
            draw_stack: v.drawStack,
            current_color: v.currentColor,
            deck: Array.from({ length: v.deckCount }),
            discard_pile: v.discardTop ? [v.discardTop] : [],
            winner_id: v.winnerId,
            turn_state: v.turnState,
            roulette_target_color: v.rouletteTargetColor,
            eliminated_user_ids: v.players.filter(p => p.isEliminated).map(p => p.userId),
            stacking_mode: v.stackingMode,
            is_public: false,
            version: lastSeq,
            created_at: '',
            updated_at: '',
        }
    })

    const gamePlayers = computed<GamePlayerRow[]>(() => {
        const v = view.value
        if (v && v.status !== 'lobby') {
            return v.players.map(p => ({
                id: p.userId,
                game_id: roomCodeRef.value ?? '',
                user_id: p.userId,
                name: p.name,
                hand: p.userId === myUserId.value ? (v.you?.hand ?? []) : hiddenHand(p.userId, p.handCount),
                seat_order: p.seat,
                is_eliminated: p.isEliminated,
                has_called_uno: p.calledUno,
                score: 0,
                joined_at: '',
            }))
        }
        // Waiting room: live presence is the roster.
        return presence.value.map((p, i) => ({
            id: p.userId, game_id: roomCodeRef.value ?? '', user_id: p.userId, name: p.name,
            hand: [], seat_order: i, is_eliminated: false, has_called_uno: false, score: 0, joined_at: '',
        }))
    })

    const myPlayer = computed(() => gamePlayers.value.find(p => p.user_id === myUserId.value) ?? null)
    const opponents = computed(() => gamePlayers.value.filter(p => p.user_id !== myUserId.value))
    const opponent = computed(() => opponents.value[0] ?? null)
    const eliminatedIds = computed(() => new Set((view.value?.players ?? []).filter(p => p.isEliminated).map(p => p.userId)))
    const isHost = computed(() => !!myUserId.value && (view.value?.hostUserId ?? hostUserId.value) === myUserId.value)
    const isMyTurn = computed(() => view.value?.status === 'playing' && view.value.currentPlayerId === myUserId.value)
    const gameStatus = computed(() => currentGame.value?.status ?? null)
    // Arrays, not Sets — the views call .includes()/.length on these.
    const presentUserIds = computed(() => presence.value.filter(p => p.connected).map(p => p.userId))
    const disconnectedUserIds = computed(() => {
        const connected = new Set(presentUserIds.value)
        return (view.value?.players ?? []).map(p => p.userId).filter(id => !connected.has(id))
    })
    const pendingDrawnWildCard = computed(() => view.value?.pendingDrawnWildCard ?? null)
    const pendingDiscardAllCards = computed(() => view.value?.pendingDiscardAllCards ?? [])

    // --- Wire handling ---

    function playerName(userId: string): string {
        return view.value?.players.find(p => p.userId === userId)?.name
            ?? presence.value.find(p => p.userId === userId)?.name
            ?? 'PLAYER'
    }

    function shout(text: string) {
        lastAction.value = { text, n: ++actionN }
    }

    function handleServerMsg(msg: ServerMsg) {
        switch (msg.t) {
            case 'hello':
                myUserId.value = msg.userId
                hostUserId.value = msg.hostUserId
                realtimeStatus.value = 'SUBSCRIBED'
                reconnectAttempts = 0
                break

            case 'presence':
                presence.value = msg.players
                break

            case 'snapshot':
                if (msg.seq < lastSeq) break
                lastSeq = msg.seq
                view.value = msg.game
                stackingMode.value = msg.game.stackingMode
                pendingIntent = null
                actionInProgress.value = false
                if (msg.game.you && msg.game.you.hand.length > mpStats.value.peakCards) {
                    mpStats.value.peakCards = msg.game.you.hand.length
                }
                if (pendingStartTrack && msg.game.status === 'playing') {
                    pendingStartTrack = false
                    track('mp_game_started', {
                        players: msg.game.players.length,
                        rules: msg.game.stackingMode,
                        rematch: trackedGameId !== null,
                    })
                    trackedGameId = msg.game.gameId
                    gameStartedAt = Date.now()
                }
                break

            case 'event': {
                const ev = msg.ev
                switch (ev.t) {
                    case 'STARTED':
                        // Fresh deal (first game or a rematch) — stats are per game.
                        mpStats.value = {
                            peakCards: 0, drawCardsPlayed: 0, wildCardsPlayed: 0, cardsPlayedTotal: 0,
                            skipsDealt: 0, swapsMade: 0, drawsTaken: 0, biggestStackSurvived: 0,
                            unoCalls: 0, unoPenalties: 0,
                        }
                        catchableUserId.value = null
                        pendingStartTrack = true
                        break

                    case 'GAME_OVER':
                        track('mp_game_finished', {
                            players: view.value?.players.length,
                            result: ev.winnerId === myUserId.value ? 'won' : 'lost',
                            duration_seconds: gameStartedAt ? Math.round((Date.now() - gameStartedAt) / 1000) : undefined,
                            rules: stackingMode.value,
                        })
                        break
                    case 'CARD_PLAYED':
                        if (ev.by !== myUserId.value) {
                            lastRemotePlay.value = { userId: ev.by, card: ev.card, n: ++playN }
                        } else {
                            mpStats.value.cardsPlayedTotal++
                            if (ev.card.color === 'wild') mpStats.value.wildCardsPlayed++
                            if (getDrawValue(ev.card) > 0) mpStats.value.drawCardsPlayed++
                            if (ev.card.type === 'skip' || ev.card.type === 'skipEveryone') mpStats.value.skipsDealt++
                        }
                        break
                    case 'YOU_DREW':
                        mpStats.value.drawsTaken++
                        break
                    case 'ELIMINATED':
                        shout(`${playerName(ev.playerId)} is ELIMINATED`)
                        if (catchableUserId.value === ev.playerId) catchableUserId.value = null
                        break
                    case 'UNO_CALLED':
                        if (ev.playerId === myUserId.value) mpStats.value.unoCalls++
                        shout(`${playerName(ev.playerId)} called UNO`)
                        if (catchableUserId.value === ev.playerId) catchableUserId.value = null
                        break
                    case 'UNO_WINDOW_OPEN':
                        catchableUserId.value = ev.playerId
                        break
                    case 'UNO_WINDOW_CLOSED':
                        if (catchableUserId.value === ev.playerId) catchableUserId.value = null
                        break
                    case 'UNO_PENALTY':
                        if (ev.playerId === myUserId.value) mpStats.value.unoPenalties++
                        shout(`${playerName(ev.playerId)} got caught — draw 10`)
                        break
                    case 'TURN_AUTO_RESOLVED':
                        shout(`${playerName(ev.playerId)} was away — turn resolved`)
                        break
                }
                break
            }

            case 'voice-token':
                useVoiceStore().onVoiceToken(msg.token)
                break

            case 'error':
                if (msg.code === 'voice-unavailable') {
                    useVoiceStore().onVoiceUnavailable()
                    break
                }
                if (msg.code === 'need-players') {
                    error.value = 'Need at least 2 connected players to start'
                }
                if (msg.intentId && pendingIntent?.id === msg.intentId) {
                    // Server refused the intent — roll the optimistic render back.
                    view.value = pendingIntent.prevView
                    pendingIntent = null
                    actionInProgress.value = false
                }
                if (msg.code === 'room-not-found') {
                    try { localStorage.removeItem(STORED_ROOM_KEY) } catch { /* noop */ }
                }
                break

            case 'pong':
                break
        }
    }

    function wsUrl(code: string): string {
        return GAME_SERVER.replace(/^http/, 'ws') + `/room/${code}/ws`
    }

    async function accessToken(): Promise<string | null> {
        const { data } = await supabase.auth.getSession()
        return data.session?.access_token ?? null
    }

    function myNickname(): string {
        return authStore.username || 'PLAYER'
    }

    /** Open + authenticate a socket to a room. Resolves on hello, rejects on refusal. */
    async function connect(code: string): Promise<boolean> {
        const token = await accessToken()
        if (!token) { error.value = 'You must be logged in to play online'; return false }

        closedByUs = false
        realtimeStatus.value = 'CONNECTING'
        return new Promise<boolean>((resolve) => {
            const socket = new WebSocket(wsUrl(code))
            ws = socket
            let settled = false
            const settle = (ok: boolean) => { if (!settled) { settled = true; resolve(ok) } }

            socket.onopen = () => {
                socket.send(JSON.stringify({ t: 'auth', token, name: myNickname() } satisfies ClientMsg))
            }
            socket.onmessage = (e) => {
                const msg = JSON.parse(e.data) as ServerMsg
                if (msg.t === 'hello') {
                    roomCodeRef.value = code
                    try { localStorage.setItem(STORED_ROOM_KEY, code) } catch { /* noop */ }
                }
                if (msg.t === 'error' && (msg.code === 'unauthorized' || msg.code === 'room-not-found')) {
                    error.value = msg.code === 'room-not-found' ? 'Room not found' : 'Could not authenticate'
                    settle(false)
                }
                handleServerMsg(msg)
                // Settle on the first snapshot, not hello — callers read
                // currentGame off the result, and the view fills in here.
                if (msg.t === 'snapshot') settle(true)
            }
            socket.onerror = () => settle(false)
            socket.onclose = (e) => {
                settle(false)
                if (ws !== socket) return
                realtimeStatus.value = 'CLOSED'
                if (e?.reason === 'kicked') {
                    // Being removed ends the whole session — voice included.
                    closedByUs = true
                    void useVoiceStore().leaveVoice()
                    try { localStorage.removeItem(STORED_ROOM_KEY) } catch { /* noop */ }
                    resetState()
                    error.value = 'You were removed from the room'
                    return
                }
                if (!closedByUs && roomCodeRef.value) scheduleReconnect()
            }
        })
    }

    function scheduleReconnect() {
        if (reconnectTimer) return
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 10_000)
        reconnectAttempts++
        realtimeStatus.value = 'CONNECTING'
        reconnectTimer = setTimeout(async () => {
            reconnectTimer = null
            if (closedByUs || !roomCodeRef.value) return
            const ok = await connect(roomCodeRef.value)
            if (!ok && !closedByUs && roomCodeRef.value) scheduleReconnect()
        }, delay)
    }

    function sendMsg(msg: ClientMsg) {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
    }

    function sendIntent(action: IntentAction, opts: { optimistic?: (v: PersonalView) => void } = {}) {
        const id = `i${++intentN}`
        if (opts.optimistic && view.value) {
            pendingIntent = { id, prevView: JSON.parse(JSON.stringify(view.value)) }
            opts.optimistic(view.value)
        }
        sendMsg({ t: 'intent', id, action })
    }

    // --- Lobby actions ---

    function resetState() {
        pendingStartTrack = false
        trackedGameId = null
        gameStartedAt = 0
        roomJoinedAt = 0
        view.value = null
        presence.value = []
        roomCodeRef.value = null
        hostUserId.value = null
        lastSeq = 0
        pendingIntent = null
        actionInProgress.value = false
        suppressDiscardSlam.value = false
        opponentLeft.value = false
        lastAction.value = null
        lastRemotePlay.value = null
        error.value = null
        mpStats.value = {
            peakCards: 0, drawCardsPlayed: 0, wildCardsPlayed: 0, cardsPlayedTotal: 0,
            skipsDealt: 0, swapsMade: 0, drawsTaken: 0, biggestStackSurvived: 0,
            unoCalls: 0, unoPenalties: 0,
        }
    }

    async function createRoom(mode: StackingMode, isPublic: boolean): Promise<string | null> {
        const token = await accessToken()
        if (!token) { error.value = 'You must be logged in to create a game'; return null }
        try {
            const res = await fetch(`${GAME_SERVER}/rooms`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
                body: JSON.stringify({ stackingMode: mode, public: isPublic }),
            })
            if (!res.ok) { error.value = 'Could not create the room'; return null }
            const { code } = await res.json() as { code: string }
            return code
        } catch {
            // Network/CORS failure — surface it instead of dying silently.
            error.value = 'Could not reach the game server'
            return null
        }
    }

    function trackJoined(method: 'created' | 'code' | 'link' | 'quick_match' | 'restore') {
        roomJoinedAt = Date.now()
        track('mp_room_joined', { method })
    }

    async function createGame(mode: StackingMode = DEFAULT_STACKING_MODE) {
        loading.value = true
        error.value = null
        resetState()
        try {
            const code = await createRoom(mode, false)
            if (!code) return null
            stackingMode.value = mode
            track('mp_room_created', { rules: mode, visibility: 'private' })
            if (!(await connect(code))) return null
            trackJoined('created')
            return currentGame.value
        } finally {
            loading.value = false
        }
    }

    async function joinGame(code: string, via: 'code' | 'link' = 'code') {
        loading.value = true
        error.value = null
        resetState()
        try {
            const ok = await connect(code.trim().toUpperCase())
            if (!ok) {
                track('mp_join_failed', { reason: error.value ?? 'unknown' })
                return null
            }
            trackJoined(via)
            return currentGame.value
        } finally {
            loading.value = false
        }
    }

    async function quickMatch(mode: StackingMode = DEFAULT_STACKING_MODE) {
        loading.value = true
        error.value = null
        resetState()
        try {
            const codes = await fetch(`${GAME_SERVER}/public-rooms`)
                .then(res => (res.ok ? (res.json() as Promise<string[]>) : []))
                .catch(() => [] as string[])
            for (const code of codes) {
                if (await connect(code)) {
                    trackJoined('quick_match')
                    return code
                }
            }
            // Nothing open — host a public room and wait for company.
            const code = await createRoom(mode, true)
            if (!code) return null
            stackingMode.value = mode
            track('mp_room_created', { rules: mode, visibility: 'public' })
            if (!(await connect(code))) return null
            trackJoined('quick_match')
            return currentGame.value
        } finally {
            loading.value = false
        }
    }

    /** Resume the room stored from a previous session (page refresh). */
    async function restoreActiveGame() {
        let code: string | null = null
        try { code = localStorage.getItem(STORED_ROOM_KEY) } catch { /* noop */ }
        if (!code) return
        const ok = await connect(code)
        if (!ok) {
            try { localStorage.removeItem(STORED_ROOM_KEY) } catch { /* noop */ }
            resetState()
            return
        }
        // A restored game keeps its identity so a rematch isn't miscounted
        // as a first game, and finish duration isn't nonsense.
        trackedGameId = view.value?.gameId ?? null
        gameStartedAt = 0
        trackJoined('restore')
    }

    async function startGame() {
        sendMsg({ t: 'start', stackingMode: stackingMode.value })
    }

    /** The voice store asks for a RealtimeKit token over the game socket. */
    function requestVoiceJoin() {
        sendMsg({ t: 'voice-join' })
    }

    async function leaveGame() {
        track('mp_room_left', {
            phase: view.value?.status,
            seconds_in_room: roomJoinedAt ? Math.round((Date.now() - roomJoinedAt) / 1000) : undefined,
        })
        // Leaving the room leaves its voice channel; rematches keep it.
        void useVoiceStore().leaveVoice()
        closedByUs = true
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
        sendMsg({ t: 'leave' })
        ws?.close()
        ws = null
        realtimeStatus.value = 'CLOSED'
        try { localStorage.removeItem(STORED_ROOM_KEY) } catch { /* noop */ }
        resetState()
    }

    async function kickPlayer(userId: string) {
        sendMsg({ t: 'kick', userId })
        // Eject them from the voice channel too (host permission; no-op otherwise —
        // the kicked client also leaves voice itself when its socket closes).
        void useVoiceStore().kickFromVoice(userId)
    }

    async function updateMyName(name: string) {
        sendMsg({ t: 'rename', name })
    }

    // --- Game intents ---

    async function playCard(card: Card, selectedColor?: CardColor) {
        if (!isMyTurn.value || actionInProgress.value) return
        actionInProgress.value = true
        suppressDiscardSlam.value = true
        sendIntent({ kind: 'PLAY_CARD', cardId: card.id, chosenColor: selectedColor }, {
            // Optimistic echo: the card leaves the hand and lands on the pile
            // now; the authoritative snapshot confirms (or the error rolls back).
            optimistic: (v) => {
                if (v.you) v.you.hand = v.you.hand.filter(c => c.id !== card.id)
                v.discardTop = card
                if (card.type !== 'wildColorRoulette') {
                    v.currentColor = card.color === 'wild' ? (selectedColor ?? v.currentColor) : card.color
                }
            },
        })
    }

    async function drawCard() {
        if (!isMyTurn.value || actionInProgress.value) return
        actionInProgress.value = true
        const stack = view.value?.drawStack ?? 0
        if (stack > mpStats.value.biggestStackSurvived) mpStats.value.biggestStackSurvived = stack
        sendIntent({ kind: 'DRAW' })
    }

    async function swapHands(targetUserId: string) {
        mpStats.value.swapsMade++
        sendIntent({ kind: 'SWAP_HANDS', targetUserId })
    }

    async function skipSwap() {
        sendIntent({ kind: 'SKIP_SWAP' })
    }

    async function setRouletteColor(color: CardColor) {
        sendIntent({ kind: 'SET_ROULETTE_COLOR', color })
    }

    async function playDrawnWildCard(color: CardColor) {
        sendIntent({ kind: 'CHOOSE_DRAWN_WILD_COLOR', color })
    }

    async function selectDiscardAllTop(cardId: string) {
        sendIntent({ kind: 'PICK_DISCARD_ALL_TOP', cardId })
    }

    async function callUno() {
        sendIntent({ kind: 'CALL_UNO' })
    }

    async function catchPlayer(userId: string) {
        if (catchableUserId.value !== userId) return
        sendIntent({ kind: 'CATCH_UNO', targetUserId: userId })
    }

    return {
        currentGame,
        gamePlayers,
        myPlayer,
        opponent,
        opponents,
        eliminatedIds,
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
        requestVoiceJoin,
        leaveGame,
    }
})
