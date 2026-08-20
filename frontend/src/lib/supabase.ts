import { createClient } from '@supabase/supabase-js'

// Direct connection. The uno-supabase-proxy Worker stays deployed as a parked fallback
// for ISP-level blocks of supabase.co - restore by preferring VITE_SUPABASE_PROXY_URL here.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables. See frontend/.env.example')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
    /** ISO-3166 alpha-2 from the CDN. Optional until leaderboards-v2.sql runs. */
    country?: string | null
    /** Shareable /p/<code> identity. Optional until leaderboards-v2.sql runs. */
    share_code?: string | null
    created_at: string
}
