/**
 * Unread arithmetic for the What's New panel and the release card.
 *
 * Pure on purpose: `localStorage` throws in a private window and wherever a
 * browser blocks site data, so all of it is caught in one place
 * (composables/useWhatsNew.ts) and never in here.
 *
 * Ids are ISO dates, so a plain string compare orders them.
 */

import type { ChangelogEntry } from '../data/changelog'

/** The highest id in the list, whatever order it is written in. */
export function newestId(entries: readonly ChangelogEntry[]): string | null {
    let newest: string | null = null
    for (const e of entries) {
        if (newest === null || e.id > newest) newest = e.id
    }
    return newest
}

/**
 * Entries shipped since the player last looked.
 *
 * A null `lastSeenId` means they have never been here. A first visit has no
 * "before" to catch up on, so it is caught up by definition — otherwise every
 * new player would open the site to a full backlog and a stale release card.
 */
export function unreadEntries(
    entries: readonly ChangelogEntry[],
    lastSeenId: string | null,
): ChangelogEntry[] {
    if (lastSeenId === null) return []
    return entries.filter(e => e.id > lastSeenId)
}

export function unreadCount(
    entries: readonly ChangelogEntry[],
    lastSeenId: string | null,
): number {
    return unreadEntries(entries, lastSeenId).length
}

/**
 * The one card to show, or null.
 *
 * Only the newest loud entry is ever a candidate. Once it is dismissed nothing
 * takes its place: falling back to an older loud entry would nag rather than
 * announce.
 */
export function pendingLoud(
    entries: readonly ChangelogEntry[],
    lastSeenId: string | null,
    dismissedIds: readonly string[],
): ChangelogEntry | null {
    const unread = unreadEntries(entries, lastSeenId)
    let newest: ChangelogEntry | null = null
    for (const e of unread) {
        if (e.level !== 'loud') continue
        if (newest === null || e.id > newest.id) newest = e
    }
    if (newest === null || dismissedIds.includes(newest.id)) return null
    return newest
}
