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
    const state = {
        queue: [] as Resp[],
        calls: [] as Recorded[],
        rpcQueue: [] as Resp[],
        rpcCalls: [] as RpcCall[],
        reset() {
            state.queue = []
            state.calls = []
            state.rpcQueue = []
            state.rpcCalls = []
        },
        respond(r: Resp) {
            state.queue.push(r)
        },
        respondRpc(r: Resp) {
            state.rpcQueue.push(r)
        },
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
    return { state, makeBuilder }
})

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: (table: string) => h.makeBuilder(table),
        rpc: (name: string, args: Record<string, unknown>) => {
            h.state.rpcCalls.push({ name, args })
            const resp = h.state.rpcQueue.shift() ?? { data: null, error: null }
            return Promise.resolve(resp)
        },
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
