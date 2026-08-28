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
import { seedId, newestId, unreadCount, unreadEntries, isOnlyUnread, pendingLoud } from '../utils/whatsNew'
import { DIRECT_SESSION_KEY } from '../utils/sessionMigration'

const SEEN_KEY = 'om-whatsnew-seen'
const DISMISSED_KEY = 'om-whatsnew-dismissed'

/**
 * Keys that only exist once someone has actually played or signed in. Reading
 * settings or audio prefs would not do: those can be written on a first page
 * load, which would misread a brand-new visitor as a returning player.
 */
const PLAYED_BEFORE_KEYS = [
    DIRECT_SESSION_KEY,     // signed in, or an anonymous identity from playing
    'uno_retention_v1',
    'uno_daily_v1',
    'uno_bot_ladder_v1',
    'uno_cosmetics_v1',
    'uno_mp_room',
]

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

/**
 * True when this browser has played before. Used only to tell a genuinely new
 * visitor from a long-time player who has never had this feature — before this
 * shipped, nobody had a last-seen id, so without this check the deploy that
 * introduces What's New would announce itself to nobody.
 */
function hasPlayedBefore(): boolean {
    return PLAYED_BEFORE_KEYS.some(k => read(k) !== null)
}

if (lastSeenId.value === null) {
    const seed = seedId(CHANGELOG, hasPlayedBefore())
    if (seed !== null) {
        lastSeenId.value = seed
        write(SEEN_KEY, seed)
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

    /**
     * The entry stays in the panel; only the card is retired.
     *
     * Closing the card is reading that entry, so when it was the only unread
     * one the dot clears too — leaving it lit would point the player back at
     * what they just read. With other entries still unread the dot stays,
     * because it is then telling the truth.
     */
    function dismissCard(id: string): void {
        const wasOnlyUnread = isOnlyUnread(CHANGELOG, lastSeenId.value, id)
        if (!dismissed.value.includes(id)) {
            dismissed.value = [...dismissed.value, id]
            write(DISMISSED_KEY, JSON.stringify(dismissed.value))
        }
        if (wasOnlyUnread) markAllRead()
    }

    return { entries, unread, unreadIds, card, markAllRead, dismissCard }
}
