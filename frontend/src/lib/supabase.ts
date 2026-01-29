import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://djzqoccutacfueuadflw.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

console.log('Supabase config:', { url: supabaseUrl, keyLength: supabaseAnonKey.length, keyPrefix: supabaseAnonKey.substring(0, 10) })

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
    created_at: string
}
