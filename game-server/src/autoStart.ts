/**
 * The auto-start clock for public lobbies: two seated players should not need
 * a host to press anything. Once the minimum is present a visible countdown
 * runs; every extra join shortens it; at zero the room deals itself.
 *
 * Pure state transitions live here so they are testable without the
 * Cloudflare runtime; the DO stores the result in its RoomTimers and arms its
 * alarm off `at`. All timestamps are epoch ms supplied by the caller.
 */

export const AUTO_START_MS = 30_000
/** Every join above the minimum shaves this off. */
export const AUTO_START_CUT_MS = 5_000
/** Join cuts never push the clock below this (but never extend it either). */
export const AUTO_START_FLOOR_MS = 10_000
/** A full room starts almost immediately. */
export const AUTO_START_FULL_MS = 5_000
export const AUTO_START_MIN_PLAYERS = 2

export interface AutoStartState {
    /** Deadline while the countdown runs. */
    at?: number
    /** Frozen remainder while the room is below the minimum. */
    leftMs?: number
    /** Connected count at the last tick — how a join is detected. */
    seen?: number
}

export function autoStartTick(prev: AutoStartState | undefined, input: {
    isPublic: boolean
    phase: 'lobby' | 'playing' | 'finished'
    connected: number
    seatsFree: number
    now: number
}): AutoStartState {
    const s = prev ?? {}
    if (!input.isPublic || input.phase !== 'lobby') return {}

    if (input.connected < AUTO_START_MIN_PLAYERS) {
        // Pause at the current value — a leaver must not cancel the clock,
        // and a fresh room below the minimum has no clock to pause.
        if (s.at !== undefined) return { leftMs: Math.max(0, s.at - input.now), seen: input.connected }
        if (s.leftMs !== undefined) return { leftMs: s.leftMs, seen: input.connected }
        return {}
    }

    // `seen` never goes down while the clock lives (it only resets with the
    // state): a socket flap lowers `connected` and the reconnect would
    // otherwise read as a fresh join and take a cut.
    const seen = Math.max(s.seen ?? 0, input.connected)

    if (s.leftMs !== undefined) {
        // Resume keeps the remainder but never below the floor — pause/resume
        // cycles must not burn the clock down to dealing joiners in instantly.
        return { at: input.now + Math.max(s.leftMs, AUTO_START_FLOOR_MS), seen }
    }
    if (s.at === undefined) return { at: input.now + AUTO_START_MS, seen }

    let remaining = s.at - input.now
    // Only a join above the minimum cuts; the second player STARTS the clock
    // and presence noise (renames, reconnects) must not erode it.
    if (input.connected > (s.seen ?? 0) && input.connected > AUTO_START_MIN_PLAYERS) {
        remaining = Math.max(Math.min(remaining, AUTO_START_FLOOR_MS), remaining - AUTO_START_CUT_MS)
    }
    if (input.seatsFree === 0) remaining = Math.min(remaining, AUTO_START_FULL_MS)
    return { at: input.now + remaining, seen }
}
