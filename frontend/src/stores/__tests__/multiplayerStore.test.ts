/**
 * Regression tests for the multiplayer compare-and-swap write path.
 * The games row is the lock on the board: every write must carry the version
 * it was computed from, lose cleanly (resync, no overwrite) when stale, and
 * bump the local version when it lands. skipSwap is the thinnest action that
 * exercises commitGameUpdate end to end.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '@supabase/supabase-js'

const h = vi.hoisted(() => {
    interface Resp { data: unknown; error: unknown }
    interface Recorded {
        table: string
        op: string
        payload: unknown
        filters: [string, unknown][]
    }
    interface RpcCall { name: string; args: Record<string, unknown> }
    // A single ordered timeline of broadcast sends and rpc calls, so a test can
    // assert e.g. "a state broadcast fired before the commit".
    type TimelineEntry = { kind: 'send'; event: string } | { kind: 'rpc'; name: string }
    const state = {
        queue: [] as Resp[],
        calls: [] as Recorded[],
        rpcQueue: [] as Resp[],
        rpcCalls: [] as RpcCall[],
        timeline: [] as TimelineEntry[],
        reset() {
            state.queue = []
            state.calls = []
            state.rpcQueue = []
            state.rpcCalls = []
            state.timeline = []
        },
        respond(r: Resp) {
            state.queue.push(r)
        },
        respondRpc(r: Resp) {
            state.rpcQueue.push(r)
        },
    }
    // Minimal realtime channel: chainable .on(), a .subscribe() that does NOT
    // invoke its callback (so the disconnect watchdog interval never starts and
    // leaks across tests), and a .send() that records onto the timeline.
    function makeChannel() {
        const ch: Record<string, unknown> = {}
        ch.on = () => ch
        ch.subscribe = () => ch
        ch.track = () => Promise.resolve()
        ch.presenceState = () => ({})
        ch.unsubscribe = () => Promise.resolve()
        ch.send = (msg: { event: string }) => {
            state.timeline.push({ kind: 'send', event: msg.event })
            return Promise.resolve({ status: 'ok' })
        }
        return ch
    }
    function makeBuilder(table: string) {
        const rec: Recorded = { table, op: 'select', payload: null, filters: [] }
        const b: Record<string, unknown> = {}
        const chain = (name: string, fn?: (...a: unknown[]) => void) => {
            b[name] = (...a: unknown[]) => {
                fn?.(...a)
                return b
            }
        }
        chain('insert', (v) => { rec.op = 'insert'; rec.payload = v })
        chain('update', (v) => { rec.op = 'update'; rec.payload = v })
        chain('delete', () => { rec.op = 'delete' })
        chain('select')
        chain('eq', (k, v) => rec.filters.push([k as string, v]))
        chain('order')
        chain('limit')
        chain('single')
        chain('maybeSingle')
        b.then = (onFulfilled: (r: Resp) => unknown, onRejected?: (e: unknown) => unknown) => {
            state.calls.push(rec)
            const resp = state.queue.shift() ?? { data: null, error: null }
            return Promise.resolve(resp).then(onFulfilled, onRejected)
        }
        return b
    }
    return { state, makeBuilder, makeChannel }
})

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: (table: string) => h.makeBuilder(table),
        rpc: (name: string, args: Record<string, unknown>) => {
            h.state.rpcCalls.push({ name, args })
            h.state.timeline.push({ kind: 'rpc', name })
            const resp = h.state.rpcQueue.shift() ?? { data: null, error: null }
            return Promise.resolve(resp)
        },
        channel: () => h.makeChannel(),
        removeChannel: () => {},
        auth: { getUser: async () => ({ data: { user: null } }) },
    },
}))

import { useMultiplayerStore } from '../multiplayerStore'
import { useAuthStore } from '../authStore'
import type { GameRow, GamePlayerRow } from '../../lib/supabase'

function gameRow(over: Partial<GameRow> = {}): GameRow {
    return {
        id: 'g1',
        room_code: 'ABC123',
        status: 'playing',
        host_id: 'me',
        current_player_id: 'me',
        direction: 1,
        draw_stack: 0,
        current_color: 'red',
        deck: [],
        discard_pile: [],
        winner_id: null,
        turn_state: 'CHOOSING_PLAYER_TO_SWAP',
        roulette_target_color: null,
        stacking_mode: 'official',
        version: 3,
        created_at: '',
        updated_at: '',
        ...over,
    }
}

function playerRow(userId: string, seat: number, hand: unknown[] = []): GamePlayerRow {
    return {
        id: `gp-${userId}`,
        game_id: 'g1',
        user_id: userId,
        name: userId,
        hand: hand as GamePlayerRow['hand'],
        seat_order: seat,
        is_eliminated: false,
        has_called_uno: false,
        score: 0,
        joined_at: '',
    }
}

beforeEach(() => {
    setActivePinia(createPinia())
    h.state.reset()
    const auth = useAuthStore()
    auth.user = { id: 'me' } as User
})

describe('compare-and-swap board writes (via skipSwap)', () => {
    it('commits through the commit_move RPC on the version it computed from and bumps it on success', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow()
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('opp', 1)]

        h.state.respondRpc({ data: true, error: null })

        await mp.skipSwap()

        expect(h.state.rpcCalls).toHaveLength(1)
        const call = h.state.rpcCalls[0]!
        expect(call.name).toBe('commit_move')
        expect(call.args.p_expected_version).toBe(3)
        expect((call.args.p_patch as { current_player_id: string }).current_player_id).toBe('opp')
        expect(mp.currentGame?.version).toBe(4)
        expect(mp.currentGame?.current_player_id).toBe('opp')
    })

    it('drops a write that lost the race and resyncs from the DB instead of overwriting', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow()
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2)]

        // CAS misses (RPC returns false — someone else wrote version 3 first) ...
        h.state.respondRpc({ data: false, error: null })
        // ... so resyncFromDb pulls the authoritative row, which disagrees
        // with our optimistic apply (turn went to p3, not our computed p2) ...
        h.state.respond({
            data: gameRow({ current_player_id: 'p3', turn_state: 'WAITING_FOR_ACTION', version: 5 }),
            error: null,
        })
        // ... and reloads the roster.
        h.state.respond({
            data: [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2)],
            error: null,
        })

        await mp.skipSwap()

        expect(mp.currentGame?.version).toBe(5)
        expect(mp.currentGame?.current_player_id).toBe('p3')
        // Exactly one CAS attempt — the loser must not retry blindly.
        expect(h.state.rpcCalls).toHaveLength(1)
    })

    it('refuses to act when the turn is not ours', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow({ current_player_id: 'opp' })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('opp', 1)]

        await mp.skipSwap()

        expect(h.state.rpcCalls).toHaveLength(0)
        expect(h.state.calls).toHaveLength(0)
    })
})

describe('board + hands commit in a single RPC (via swapHands)', () => {
    it('sends both swapped hands in the same commit_move call as the board patch', async () => {
        const mp = useMultiplayerStore()
        const myCards = [{ id: 'c-mine', type: 'number', color: 'red', value: 3 }]
        const oppCards = [{ id: 'c-opp', type: 'number', color: 'blue', value: 5 }]
        mp.currentGame = gameRow({ turn_state: 'CHOOSING_PLAYER_TO_SWAP', current_player_id: 'me' })
        mp.myPlayer = playerRow('me', 0, myCards)
        mp.gamePlayers = [playerRow('me', 0, myCards), playerRow('opp', 1, oppCards)]

        // swapHands re-fetches hands fresh from the DB before swapping ...
        h.state.respond({
            data: [playerRow('me', 0, myCards), playerRow('opp', 1, oppCards)],
            error: null,
        })
        // ... then the single commit lands.
        h.state.respondRpc({ data: true, error: null })

        await mp.swapHands('gp-opp')

        // No standalone game_players UPDATE — hands ride inside the RPC.
        expect(h.state.calls.some(c => c.table === 'game_players' && c.op === 'update')).toBe(false)
        expect(h.state.rpcCalls).toHaveLength(1)
        const hands = h.state.rpcCalls[0]!.args.p_hands as { id: string; hand: unknown[] }[]
        expect(hands).toHaveLength(2)
        const mine = hands.find(x => x.id === 'gp-me')!
        const theirs = hands.find(x => x.id === 'gp-opp')!
        // I now hold what was the opponent's hand, and vice versa.
        expect(mine.hand).toEqual(oppCards)
        expect(theirs.hand).toEqual(myCards)
    })
})

describe('broadcast-first fast lane (via playCard)', () => {
    // A plain number play that leaves a non-empty hand — no win, no UNO penalty.
    function setupPlayable() {
        const mp = useMultiplayerStore()
        const keep = { id: 'c-keep', type: 'number', color: 'red', value: 3 }
        const play = { id: 'c-play', type: 'number', color: 'red', value: 5 }
        const hand = [play, keep]
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'me',
            current_color: 'red',
            discard_pile: [{ id: 'top', type: 'number', color: 'red', value: 1 }],
        })
        mp.myPlayer = playerRow('me', 0, hand)
        mp.gamePlayers = [playerRow('me', 0, hand), playerRow('opp', 1, [{ id: 'o1' }])]
        mp.subscribeToGame('g1') // wire a real (mock) channel so broadcasts record
        return { mp, play }
    }

    it('sends the action then the provisional state, both BEFORE the commit, then a confirm after', async () => {
        const { mp, play } = setupPlayable()
        h.state.respondRpc({ data: true, error: null })

        await mp.playCard(play as never)

        const t = h.state.timeline
        const rpcIdx = t.findIndex(e => e.kind === 'rpc' && e.name === 'commit_move')
        const actionIdx = t.findIndex(e => e.kind === 'send' && e.event === 'action')
        const firstStateIdx = t.findIndex(e => e.kind === 'send' && e.event === 'state')

        expect(rpcIdx).toBeGreaterThanOrEqual(0)
        // Both the action (throw) and the provisional state fire before the commit,
        // so the opponent's throw + pile update land together, not a commit apart.
        expect(actionIdx).toBeGreaterThanOrEqual(0)
        expect(actionIdx).toBeLessThan(rpcIdx)
        expect(firstStateIdx).toBeLessThan(rpcIdx)
        // Action goes out first so the receiver starts the throw before the pile updates.
        expect(actionIdx).toBeLessThan(firstStateIdx)
        // Confirm: a state broadcast also follows the commit.
        expect(t.slice(rpcIdx + 1).some(e => e.kind === 'send' && e.event === 'state')).toBe(true)
    })

    it('does NOT send a provisional on a winning move', async () => {
        const mp = useMultiplayerStore()
        const play = { id: 'c-win', type: 'number', color: 'red', value: 5 }
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'me',
            current_color: 'red',
            discard_pile: [{ id: 'top', type: 'number', color: 'red', value: 1 }],
        })
        // Last card + UNO already called → emptying the hand wins outright.
        const me = playerRow('me', 0, [play])
        me.has_called_uno = true
        mp.myPlayer = me
        mp.gamePlayers = [me, playerRow('opp', 1, [{ id: 'o1' }])]
        mp.subscribeToGame('g1')

        h.state.respond({ data: null, error: null }) // updateWinnerScore write
        h.state.respondRpc({ data: true, error: null }) // the winning commit

        await mp.playCard(play as never)

        const t = h.state.timeline
        const rpcIdx = t.findIndex(e => e.kind === 'rpc' && e.name === 'commit_move')
        expect(rpcIdx).toBeGreaterThanOrEqual(0)
        // No state OR action broadcast before the commit — the win takes the
        // commit path (a rolled-back "you lost" throw/flicker isn't worth it).
        expect(t.slice(0, rpcIdx).some(e => e.kind === 'send' && e.event === 'state')).toBe(false)
        expect(t.slice(0, rpcIdx).some(e => e.kind === 'send' && e.event === 'action')).toBe(false)
        // The win still announces — after the commit lands.
        expect(t.slice(rpcIdx + 1).some(e => e.kind === 'send' && e.event === 'action')).toBe(true)
    })

    it('CORRECTION-broadcasts DB truth after losing the CAS race (via skipSwap)', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow({ turn_state: 'CHOOSING_PLAYER_TO_SWAP', current_player_id: 'me' })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('opp', 1)]
        mp.subscribeToGame('g1')

        h.state.respondRpc({ data: false, error: null }) // CAS miss
        h.state.respond({ data: gameRow({ current_player_id: 'opp', version: 5 }), error: null }) // resync game
        h.state.respond({ data: [playerRow('me', 0), playerRow('opp', 1)], error: null }) // resync players

        await mp.skipSwap()

        const t = h.state.timeline
        const rpcIdx = t.findIndex(e => e.kind === 'rpc' && e.name === 'commit_move')
        // Exactly one commit attempt — a loser must not retry.
        expect(h.state.rpcCalls).toHaveLength(1)
        // A correction state broadcast follows the failed commit.
        expect(t.slice(rpcIdx + 1).some(e => e.kind === 'send' && e.event === 'state')).toBe(true)
        expect(mp.currentGame?.current_player_id).toBe('opp')
    })
})

describe('elimination rides the version-CAS board (eliminated_user_ids)', () => {
    function numberCards(n: number): unknown[] {
        return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, type: 'number', color: 'red', value: i % 10 }))
    }

    it('skips a player who is out on the BOARD array even when their roster flag is stale', async () => {
        // The core regression: a peer never saw p2 get eliminated (row flag
        // false), but the version-CAS'd board carries them in eliminated_user_ids.
        // A turn advance must still skip p2.
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow({
            turn_state: 'CHOOSING_PLAYER_TO_SWAP',
            current_player_id: 'me',
            eliminated_user_ids: ['p2'],
        })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2)]

        h.state.respondRpc({ data: true, error: null })

        await mp.skipSwap()

        expect(h.state.rpcCalls).toHaveLength(1)
        const patch = h.state.rpcCalls[0]!.args.p_patch as { current_player_id: string }
        // Next after me (seat 0) skipping the boarded-eliminated p2 → p3.
        expect(patch.current_player_id).toBe('p3')
    })

    it('drawing into the mercy threshold writes the victim into eliminated_user_ids in the same commit', async () => {
        // 3 players so my elimination does not end the game (no winner short-circuit).
        const mp = useMultiplayerStore()
        const hand24 = numberCards(24)
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'me',
            draw_stack: 1,
            deck: numberCards(1),
            discard_pile: [{ id: 'top', type: 'number', color: 'red', value: 1 }],
        })
        mp.myPlayer = playerRow('me', 0, hand24)
        mp.gamePlayers = [playerRow('me', 0, hand24), playerRow('p2', 1), playerRow('p3', 2)]
        mp.subscribeToGame('g1')

        h.state.respondRpc({ data: true, error: null })

        await mp.drawCard()

        expect(h.state.rpcCalls).toHaveLength(1)
        const args = h.state.rpcCalls[0]!.args
        const patch = args.p_patch as { eliminated_user_ids?: string[]; draw_stack: number }
        expect(patch.eliminated_user_ids).toContain('me')
        expect(patch.draw_stack).toBe(0)
        const hands = args.p_hands as { id: string; hand: unknown[]; is_eliminated?: boolean }[]
        const mine = hands.find(x => x.id === 'gp-me')!
        expect(mine.is_eliminated).toBe(true)
        expect(mine.hand).toEqual([])
        // Local board reflects the elimination before the provisional broadcast.
        expect(mp.currentGame?.eliminated_user_ids).toContain('me')
    })

    it('captain resolves an absent victim facing a stack: draws their penalty and eliminates at 25+', async () => {
        const mp = useMultiplayerStore()
        const p3Hand = numberCards(23)
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'p3',
            draw_stack: 3,
            deck: numberCards(5),
            discard_pile: [{ id: 'top', type: 'number', color: 'red', value: 1 }],
        })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2, p3Hand)]
        mp.subscribeToGame('g1')

        // Fresh authoritative hand read for the absent victim ...
        h.state.respond({ data: { hand: p3Hand }, error: null })
        // ... then the single commit lands.
        h.state.respondRpc({ data: true, error: null })

        await mp.advancePastPlayer('p3')

        expect(h.state.rpcCalls).toHaveLength(1)
        const args = h.state.rpcCalls[0]!.args
        const patch = args.p_patch as { eliminated_user_ids?: string[]; draw_stack: number; current_player_id: string }
        // 23 + 3 = 26 ≥ 25 → eliminated, and the stack is consumed.
        expect(patch.eliminated_user_ids).toContain('p3')
        expect(patch.draw_stack).toBe(0)
        // Turn advances off p3 (seat 2, dir +1) → me (seat 0).
        expect(patch.current_player_id).toBe('me')
        const hands = args.p_hands as { id: string; hand: unknown[]; is_eliminated?: boolean }[]
        const victim = hands.find(x => x.id === 'gp-p3')!
        expect(victim.is_eliminated).toBe(true)
        expect(victim.hand).toEqual([])
    })

    it('does NOT strand the turn when a Discard All empties the hand (all cards that color)', async () => {
        // Repro: hand is a red Discard All + only red cards. Playing it discards
        // every red card, emptying the hand. The multi-card "pick the top" picker
        // must NOT engage (there's no hand left to keep the turn for) — otherwise
        // the no-UNO penalty commits with turn_state CHOOSING_DISCARD_ALL_TOP and
        // current_player_id still me → permanent "my turn" soft-lock.
        const mp = useMultiplayerStore()
        const da = { id: 'da', type: 'discardAll', color: 'red' }
        const hand = [da, { id: 'r3', type: 'number', color: 'red', value: 3 }, { id: 'r7', type: 'number', color: 'red', value: 7 }]
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'me',
            current_color: 'red',
            deck: [{ id: 'd1', type: 'number', color: 'blue', value: 8 }, { id: 'd2', type: 'number', color: 'green', value: 2 }],
            discard_pile: [{ id: 'top', type: 'number', color: 'red', value: 1 }],
        })
        const me = playerRow('me', 0, hand)
        me.has_called_uno = false // no UNO → penalty path, the one that strands
        mp.myPlayer = me
        mp.gamePlayers = [me, playerRow('p2', 1), playerRow('p3', 2)]
        mp.subscribeToGame('g1')

        h.state.respondRpc({ data: true, error: null })

        await mp.playCard(da as never)

        expect(h.state.rpcCalls).toHaveLength(1)
        const patch = h.state.rpcCalls[0]!.args.p_patch as { current_player_id: string; turn_state: string }
        expect(patch.turn_state).toBe('WAITING_FOR_ACTION')
        expect(patch.current_player_id).toBe('p2')
        expect(mp.currentGame?.turn_state).not.toBe('CHOOSING_DISCARD_ALL_TOP')
        expect(mp.pendingDiscardAllCards).toHaveLength(0)
    })

    it('advances past an already-eliminated current player without applying a penalty', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow({
            turn_state: 'WAITING_FOR_ACTION',
            current_player_id: 'p3',
            draw_stack: 0,
            eliminated_user_ids: ['p3'],
        })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2)]
        mp.subscribeToGame('g1')

        h.state.respondRpc({ data: true, error: null })

        await mp.advancePastPlayer('p3')

        expect(h.state.rpcCalls).toHaveLength(1)
        const args = h.state.rpcCalls[0]!.args
        const patch = args.p_patch as { current_player_id: string }
        expect(patch.current_player_id).toBe('me')
        // Plain advance — no hand writes, nobody drew a penalty.
        expect(args.p_hands).toEqual([])
    })
})
