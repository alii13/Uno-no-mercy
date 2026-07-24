import { createClient } from '@supabase/supabase-js'

// Use proxy URL if set (bypasses ISP blocks in India/UAE), otherwise direct Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_PROXY_URL || import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables. See frontend/.env.example')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // When using a proxy, we need to tell the realtime client where to connect
  ...(import.meta.env.VITE_SUPABASE_PROXY_URL ? {
    realtime: {
      params: {
        apikey: supabaseAnonKey,
      },
    },
  } : {}),
})

export interface GameRow {
    id: string
    room_code: string
    status: 'waiting' | 'playing' | 'finished'
    host_id: string
    current_player_id: string | null
    direction: 1 | -1
    draw_stack: number
    current_color: string
    deck: any[]
    discard_pile: any[]
    winner_id: string | null
    turn_state: string
    roulette_target_color: string | null
    // user_ids of players knocked out by the mercy rule. Lives on the board (not
    // just game_players.is_eliminated) so it rides the version-CAS and can't be
    // lost to a dropped broadcast. Optional: rows written before the migration
    // ran won't have it — treated as [].
    eliminated_user_ids?: string[]
    stacking_mode: 'official' | 'house' | 'casual'
    is_public?: boolean
    // Optimistic-concurrency counter — see commitGameUpdate in multiplayerStore.
    // Optional so rows read before the migration ran don't break; treated as 0.
    version?: number
    created_at: string
    updated_at: string
}

export interface GamePlayerRow {
    id: string
    game_id: string
    user_id: string
    name: string
    hand: any[]
    seat_order: number
    is_eliminated: boolean
    has_called_uno: boolean
    score: number
    joined_at: string
}

export interface UserProfile {
    id: string
    username: string
    /** Account-synced card-back skin id. Optional: rows written before the
     *  cosmetics migration ran won't have it. */
    equipped_card_back?: string | null
    created_at: string
}
