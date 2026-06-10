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
    const state = {
        queue: [] as Resp[],
        calls: [] as Recorded[],
        reset() {
            state.queue = []
            state.calls = []
        },
        respond(r: Resp) {
            state.queue.push(r)
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

function playerRow(userId: string, seat: number): GamePlayerRow {
    return {
        id: `gp-${userId}`,
        game_id: 'g1',
        user_id: userId,
        name: userId,
        hand: [],
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
    it('writes conditionally on the version it computed from and bumps it on success', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow()
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('opp', 1)]

        h.state.respond({ data: [{ id: 'g1' }], error: null })

        await mp.skipSwap()

        const update = h.state.calls.find(c => c.table === 'games' && c.op === 'update')
        expect(update).toBeDefined()
        expect(update!.filters).toContainEqual(['version', 3])
        expect((update!.payload as { version: number }).version).toBe(4)
        expect(mp.currentGame?.version).toBe(4)
        expect(mp.currentGame?.current_player_id).toBe('opp')
    })

    it('drops a write that lost the race and resyncs from the DB instead of overwriting', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow()
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('p2', 1), playerRow('p3', 2)]

        // CAS misses (0 rows — someone else wrote version 3 first) ...
        h.state.respond({ data: [], error: null })
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
        const updates = h.state.calls.filter(c => c.table === 'games' && c.op === 'update')
        expect(updates).toHaveLength(1)
    })

    it('refuses to act when the turn is not ours', async () => {
        const mp = useMultiplayerStore()
        mp.currentGame = gameRow({ current_player_id: 'opp' })
        mp.myPlayer = playerRow('me', 0)
        mp.gamePlayers = [playerRow('me', 0), playerRow('opp', 1)]

        await mp.skipSwap()

        expect(h.state.calls).toHaveLength(0)
    })
})
