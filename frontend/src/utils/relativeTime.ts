/**
 * "3 hours ago" for last-seen lines, and the one rule for what counts as
 * online.
 *
 * Built on Intl.RelativeTimeFormat, which every browser we support ships. A
 * date library would add 7 KB for one string.
 *
 * The formatter is pinned to English because every other word in the app is
 * English; a Hindi "3 घंटे पहले" beside an English "LAST SEEN" label reads as a
 * bug, not as localization.
 */

/** How fresh a heartbeat must be to read as online. Matches the two-minute
 *  window in supabase/presence.sql - change both together. */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000

/**
 * Still worth inviting. Someone who closed the tab five minutes ago is a
 * different person, to a player deciding who to ask, than someone last seen on
 * Tuesday - and a two-state dot cannot tell you which one you are looking at.
 */
export const RECENT_WINDOW_MS = 15 * 60 * 1000

export type PresenceState = 'online' | 'recent' | 'offline'

export function presenceState(
    lastSeenAt: string | number | Date | null | undefined,
    now = Date.now(),
): PresenceState {
    if (lastSeenAt === null || lastSeenAt === undefined) return 'offline'
    const seen = new Date(lastSeenAt).getTime()
    if (!Number.isFinite(seen)) return 'offline'
    const age = now - seen
    if (age < ONLINE_WINDOW_MS) return 'online'
    if (age < RECENT_WINDOW_MS) return 'recent'
    return 'offline'
}

/** What the dot says when you hover it. Sentence case: it is a sentence. */
export function presenceLabel(
    lastSeenAt: string | number | Date | null | undefined,
    now = Date.now(),
): string {
    if (presenceState(lastSeenAt, now) === 'online') return 'Online'
    const rel = relativeTime(lastSeenAt, now)
    return rel ? `Last seen ${rel}` : 'Offline'
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 7],
    ['week', 4.34524],
    ['month', 12],
    ['year', Infinity],
]

// numeric: 'always' keeps every result grammatical after a "LAST SEEN" label.
// 'auto' would render "yesterday", which reads as "LAST SEEN YESTERDAY AGO"
// to anyone writing the label with the word "ago" in it.
const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'always' })

/** "3 hours ago", "in 5 minutes". Empty string when the input is not a date. */
export function relativeTime(when: string | number | Date | null | undefined, now = Date.now()): string {
    if (when === null || when === undefined) return ''
    const then = new Date(when).getTime()
    if (!Number.isFinite(then)) return ''

    let delta = (then - now) / 1000
    for (const [unit, span] of UNITS) {
        if (Math.abs(delta) < span) return fmt.format(Math.round(delta), unit)
        delta /= span
    }
    return fmt.format(Math.round(delta), 'year')
}

/** True while the last heartbeat is inside the online window. */
export function isOnline(lastSeenAt: string | number | Date | null | undefined, now = Date.now()): boolean {
    if (lastSeenAt === null || lastSeenAt === undefined) return false
    const seen = new Date(lastSeenAt).getTime()
    if (!Number.isFinite(seen)) return false
    return now - seen < ONLINE_WINDOW_MS
}
