/**
 * Eligibility for the one-question poll pushed from the `polls` table.
 *
 * Two gates, both client-side and both cheap. `min_games` keeps the sample to
 * players who have actually played, because an opinion from someone who
 * finished one game tells you nothing. The dismissed flag is per poll and per
 * device: closed without answering means that question never comes back, the
 * same rule as claimSpotlight.
 *
 * Neither gate is a security boundary. A player who wants to answer a poll
 * twice can, and it does not matter.
 *
 * No supabase import here on purpose - lib/supabase.ts throws at import time
 * when env vars are unset, and CI passes none, so keeping this module pure
 * keeps it testable.
 */

export interface Poll {
    id: string
    question: string
    options: string[]
    min_games: number
    allow_note: boolean
    note_label: string | null
}

/**
 * One poll lookup per page load. The sheet is mounted only on the lobby, so it
 * unmounts on every game and remounts on every return. Without this, a player
 * bouncing lobby to game and back pays a request each lap for an answer that
 * cannot change until they reload.
 */
let lookedUp = false

export function hasLookedUp(): boolean {
    return lookedUp
}

export function markLookedUp(): void {
    lookedUp = true
}

const dismissKey = (pollId: string) => `om_poll_dismissed_${pollId}`

/** True when this device has already closed or answered this poll. */
export function isDismissed(pollId: string): boolean {
    try {
        return localStorage.getItem(dismissKey(pollId)) !== null
    } catch {
        return true // storage blocked: never nag, since the answer cannot be remembered
    }
}

export function markDismissed(pollId: string): void {
    try {
        localStorage.setItem(dismissKey(pollId), '1')
    } catch { /* storage blocked - isDismissed already returns true there */ }
}

/**
 * Whether to put this poll in front of the player. Rejects a malformed
 * `options` payload too, since it is hand-entered in the Supabase Table
 * Editor and a typo there should hide the poll, not render a broken sheet.
 */
export function isEligible(poll: Poll, gamesPlayed: number): boolean {
    if (!Array.isArray(poll.options)) return false
    if (poll.options.length < 2 || poll.options.length > 5) return false
    if (poll.options.some((o) => typeof o !== 'string' || o.trim() === '')) return false
    if (gamesPlayed < poll.min_games) return false
    return !isDismissed(poll.id)
}
