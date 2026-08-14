/**
 * The lone-waiter clock for public rooms.
 *
 * At current traffic there are only a couple of people on the site at once, so
 * a second human rarely arrives inside anyone's patience — players who give up
 * on a lobby last about half a minute. A public room that can only ever wait is
 * therefore a dead end. This clock gives a real player a full minute of hope,
 * lets them buy more if they still want it, and then deals bots in so a public
 * room always turns into a game.
 *
 * Distinct from autoStart.ts, which is the countdown once two humans ARE
 * present. That one must stay fast; this one must stay patient. They never run
 * together: the moment a second human is seated this clock clears and the
 * auto-start clock takes over.
 *
 * Pure transitions, so they can be tested without the Cloudflare runtime. The
 * DO stores the result in its RoomTimers and arms its alarm off `at`. All
 * timestamps are epoch ms supplied by the caller.
 */

export const BOT_FILL_MS = 60_000
/** One press buys this much; the button is the player's, not the server's. */
export const BOT_FILL_BUMP_MS = 30_000
export const BOT_FILL_MAX_BUMPS = 2
/** At or above this many humans the room starts on its own; see autoStart.ts. */
export const BOT_FILL_MIN_HUMANS = 2

export interface BotFillState {
    /** Deadline while the clock runs. Absent means no clock. */
    at?: number
    /** Extensions already spent, capped at BOT_FILL_MAX_BUMPS. */
    bumps?: number
}

export function botFillTick(prev: BotFillState | undefined, input: {
    isPublic: boolean
    phase: 'lobby' | 'playing' | 'finished'
    humanCount: number
    now: number
}): BotFillState {
    if (!input.isPublic || input.phase !== 'lobby') return {}
    // Nobody to deal in for, and an empty room is GC's business.
    if (input.humanCount < 1) return {}
    // A second human makes this clock the wrong one — hand over to auto-start.
    if (input.humanCount >= BOT_FILL_MIN_HUMANS) return {}

    const s = prev ?? {}
    // Already counting: presence noise must not restart the wait.
    if (s.at !== undefined) return s

    // Deliberately a fresh minute rather than a resumed remainder. Unlike
    // auto-start, the interruption here is a human arriving and leaving again,
    // which genuinely restarts the "am I alone?" question.
    return { at: input.now + BOT_FILL_MS, bumps: 0 }
}

/**
 * The waiting player asked for more time. Returns the state unchanged when
 * there is no clock to extend or the allowance is spent, so the caller can
 * apply the result blindly.
 */
export function botFillBump(prev: BotFillState | undefined, now: number): BotFillState {
    const s = prev ?? {}
    if (s.at === undefined) return s
    const bumps = s.bumps ?? 0
    if (bumps >= BOT_FILL_MAX_BUMPS) return s
    // Extend from the deadline, not from now: pressing early must not shorten
    // the wait the player already had.
    return { at: Math.max(s.at, now) + BOT_FILL_BUMP_MS, bumps: bumps + 1 }
}

/** Extensions the player may still buy — drives whether the button shows. */
export function botFillBumpsLeft(state: BotFillState | undefined): number {
    if (state?.at === undefined) return 0
    return Math.max(0, BOT_FILL_MAX_BUMPS - (state.bumps ?? 0))
}
