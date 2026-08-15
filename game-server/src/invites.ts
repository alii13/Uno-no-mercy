/**
 * Room invites, written by the room that the sender is actually sitting in.
 *
 * The client could call Supabase directly - it holds a session - but then the
 * database would only know who asked, never from where, and "X wants you at
 * their table" would be a claim rather than a fact. The Durable Object holds
 * the sender's authenticated socket for this room, so it is the only party
 * that can say both things at once.
 *
 * Everything about the sender's conduct - blocked, too soon, too many - stays
 * in send_room_invite, which this calls with the service key. One place for
 * the limits, and it is the place that cannot be bypassed by talking to
 * PostgREST directly.
 */

export interface InviteEnv {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY?: string
}

/** What send_room_invite answers, plus the two states only the worker knows. */
export type InviteResult =
    | 'sent' | 'blocked' | 'self' | 'too_soon' | 'rate_limited'
    | 'not_found' | 'bad_code' | 'unauthorized'
    | 'not-in-lobby' | 'unavailable'

export async function sendRoomInvite(
    env: InviteEnv,
    fromUserId: string,
    toUserId: string,
    roomCode: string,
    /** What the room looks like right now - the receiver decides on this. */
    room: { players: number; mode: string },
): Promise<InviteResult> {
    // No secret bound (a local dev run, or a fresh deploy) - the caller shows
    // "try again", which is truer than a silent failure.
    if (!env.SUPABASE_SERVICE_KEY) return 'unavailable'

    try {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/send_room_invite`, {
            method: 'POST',
            headers: {
                apikey: env.SUPABASE_SERVICE_KEY,
                Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                p_from: fromUserId, p_user: toUserId, p_code: roomCode,
                p_players: room.players, p_mode: room.mode,
            }),
        })
        if (!res.ok) {
            console.log('send_room_invite failed', res.status, (await res.text()).slice(0, 200))
            return 'unavailable'
        }
        // The function returns a bare JSON string.
        const value = await res.json<unknown>()
        return typeof value === 'string' ? (value as InviteResult) : 'unavailable'
    } catch (err) {
        console.error('send_room_invite threw:', err)
        return 'unavailable'
    }
}
