/**
 * The auto-start clock for public lobbies: two seated players should not need
 * a host to press anything. Once the minimum is present a visible countdown
 * runs; every extra join shortens it; at zero the room deals itself. A room
 * that would rather wait for more players can buy one extra minute, once.
 *
 * Pure state transitions live here so they are testable without the
 * Cloudflare runtime; the DO stores the result in its RoomTimers and arms its
 * alarm off `at`. All timestamps are epoch ms supplied by the caller.
 */

export const AUTO_START_MS = 60_000
/** Every join above the minimum shaves this off. */
export const AUTO_START_CUT_MS = 5_000
/** Join cuts never push the clock below this (but never extend it either). */
export const AUTO_START_FLOOR_MS = 10_000
/** A full room starts almost immediately. */
export const AUTO_START_FULL_MS = 5_000
export const AUTO_START_MIN_PLAYERS = 2
/** One press buys this much; the button is the players', not the server's. */
export const AUTO_START_BUMP_MS = 60_000
/** Bought time is capped per room, so a lobby cannot be held open forever. */
export const AUTO_START_MAX_BUMPS = 1

export interface AutoStartState {
    /** Deadline while the countdown runs. */
    at?: number
    /** Frozen remainder while the room is below the minimum. */
    leftMs?: number
    /** Extensions already spent, capped at AUTO_START_MAX_BUMPS. */
    bumps?: number
    /**
     * User ids already counted into the clock. Identity, not a count: a
     * count cannot tell "someone new arrived" from "someone came back", so
     * it either cut the clock on reconnect flaps or, held monotonic, masked
     * genuine joins after departures.
     */
    seen?: string[]
}

export function autoStartTick(prev: AutoStartState | undefined, input: {
    isPublic: boolean
    phase: 'lobby' | 'playing' | 'finished'
    connectedIds: string[]
    seatsFree: number
    now: number
}): AutoStartState {
    const s = prev ?? {}
    if (!input.isPublic || input.phase !== 'lobby') return {}
    // Bought time is spent for the life of the clock: a pause, a resume or a
    // join must never hand the room a second minute to buy.
    const bumps = s.bumps

    if (input.connectedIds.length < AUTO_START_MIN_PLAYERS) {
        // Pause at the current value - a leaver must not cancel the clock -
        // and keep `seen`: the clock's memory of who has been counted must
        // survive a blip below the minimum, or a returning player reads as
        // a fresh join on resume.
        if (s.at !== undefined) return { leftMs: Math.max(0, s.at - input.now), seen: s.seen, bumps }
        if (s.leftMs !== undefined) return { leftMs: s.leftMs, seen: s.seen, bumps }
        return {}
    }

    const prevSeen = s.seen ?? []
    const joined = input.connectedIds.some(id => !prevSeen.includes(id))
    const seen = joined ? [...new Set([...prevSeen, ...input.connectedIds])] : prevSeen

    if (s.leftMs !== undefined) {
        // Resume: a returning player gets the raw remainder (a flap must
        // cost nothing); only a genuine newcomer is owed the readable-lobby
        // floor, or pause/resume cycles deal them in seconds after arrival.
        return { at: input.now + (joined ? Math.max(s.leftMs, AUTO_START_FLOOR_MS) : s.leftMs), seen, bumps }
    }
    if (s.at === undefined) return { at: input.now + AUTO_START_MS, seen, bumps }

    let remaining = s.at - input.now
    // Only a join above the minimum cuts; the second player STARTS the clock
    // and presence noise (renames, reconnects) must not erode it.
    if (joined && input.connectedIds.length > AUTO_START_MIN_PLAYERS) {
        remaining = Math.max(Math.min(remaining, AUTO_START_FLOOR_MS), remaining - AUTO_START_CUT_MS)
    }
    if (input.seatsFree === 0) remaining = Math.min(remaining, AUTO_START_FULL_MS)
    return { at: input.now + remaining, seen, bumps }
}

/**
 * A player asked the room to wait longer. Returns the state unchanged when
 * there is no running clock or the allowance is spent, so the caller can apply
 * the result blindly.
 */
export function autoStartBump(prev: AutoStartState | undefined, now: number): AutoStartState {
    const s = prev ?? {}
    if (s.at === undefined) return s
    const bumps = s.bumps ?? 0
    if (bumps >= AUTO_START_MAX_BUMPS) return s
    // Extend from the deadline, not from now: pressing early must not shorten
    // the wait the room already had.
    return { ...s, at: Math.max(s.at, now) + AUTO_START_BUMP_MS, bumps: bumps + 1 }
}

/** Extensions the room may still buy - drives whether the button shows. */
export function autoStartBumpsLeft(state: AutoStartState | undefined): number {
    if (state?.at === undefined) return 0
    return Math.max(0, AUTO_START_MAX_BUMPS - (state.bumps ?? 0))
}
