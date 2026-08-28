/**
 * What's New state: what the player has seen, and which release card is still
 * owed to them.
 *
 * Module-scoped refs, not per-call state. The top-bar button, the panel and
 * the release card all read the same thing, and a divergence would show as a
 * dot that will not clear.
 *
 * Every storage access is wrapped: localStorage throws in a private window and
 * wherever a browser blocks site data. A player in that state sees no dot
 * rather than a crash.
 */

import { ref, computed } from 'vue'
import { CHANGELOG } from '../data/changelog'
import { newestId, unreadCount, unreadEntries, pendingLoud } from '../utils/whatsNew'

const SEEN_KEY = 'om-whatsnew-seen'
const DISMISSED_KEY = 'om-whatsnew-dismissed'

function read(key: string): string | null {
    try {
        return window.localStorage.getItem(key)
    } catch {
        return null
    }
}

function write(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value)
    } catch { /* storage blocked — the dot just won't persist */ }
}

function readDismissed(): string[] {
    const raw = read(DISMISSED_KEY)
    if (!raw) return []
    try {
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
        return []
    }
}

const lastSeenId = ref<string | null>(read(SEEN_KEY))
const dismissed = ref<string[]>(readDismissed())

// A first visit is caught up by definition: seed to the newest entry so the
// player is not shown a backlog and a stale card for features that predate
// them. The dot then appears on the next release, which is the point.
if (lastSeenId.value === null) {
    const newest = newestId(CHANGELOG)
    if (newest) {
        lastSeenId.value = newest
        write(SEEN_KEY, newest)
    }
}

export function useWhatsNew() {
    const entries = computed(() => [...CHANGELOG].sort((a, b) => (a.id < b.id ? 1 : -1)))
    const unread = computed(() => unreadCount(CHANGELOG, lastSeenId.value))
    const unreadIds = computed(() => new Set(unreadEntries(CHANGELOG, lastSeenId.value).map(e => e.id)))
    const card = computed(() => pendingLoud(CHANGELOG, lastSeenId.value, dismissed.value))

    /** Opening the panel is the read receipt. */
    function markAllRead(): void {
        const newest = newestId(CHANGELOG)
        if (!newest) return
        lastSeenId.value = newest
        write(SEEN_KEY, newest)
    }

    /** Dismissing the card only retires the card. The entry stays in the panel. */
    function dismissCard(id: string): void {
        if (dismissed.value.includes(id)) return
        dismissed.value = [...dismissed.value, id]
        write(DISMISSED_KEY, JSON.stringify(dismissed.value))
    }

    return { entries, unread, unreadIds, card, markAllRead, dismissCard }
}
