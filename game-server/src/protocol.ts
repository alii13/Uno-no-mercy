export interface PresencePlayer {
    userId: string
    name: string
    connected: boolean
}

export type ClientMsg =
    | { t: 'auth'; token: string; name: string }
    | { t: 'ping'; now: number }
    | { t: 'leave' }

export type ServerMsg =
    | { t: 'hello'; roomCode: string; userId: string }
    | { t: 'presence'; players: PresencePlayer[] }
    | { t: 'pong'; now: number }
    | { t: 'error'; code: 'unauthorized' | 'bad-message' | 'room-not-found' }
