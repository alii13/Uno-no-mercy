/**
 * The public-rooms directory: which quick-match rooms are open, and enough
 * about each to render a live-tables strip without one round trip per room.
 *
 * Entries used to be a bare timestamp (`Record<code, number>`), and rooms
 * registered once at creation. That is enough to pick a room to join but not
 * to show one, so entries now carry a snapshot the room DO refreshes whenever
 * its roster or game state changes.
 *
 * Deliberately carries NO player names. Clicking "quick match" is consent to
 * play with a stranger, not consent to appear on the landing page, so the
 * strip shows activity (seats, rules, card backs) and never identity. Names
 * are visible only after someone chooses to spectate.
 */

export interface DirEntry {
    /** When the room first registered. Ordering key — oldest first. */
    at: number
    /** Last snapshot refresh. */
    updatedAt?: number
    players?: number
    seatsFree?: number
    inProgress?: boolean
    mode?: string
    /** Equipped card-back ids, cosmetic only. */
    skins?: string[]
}

/** What a room looks like to the landing page. */
export interface PublicTable {
    code: string
    players: number
    seatsFree: number
    inProgress: boolean
    mode: string
    skins: string[]
}

/**
 * A room that stopped heartbeating this long ago is treated as gone. Rooms
 * normally leave via dir-unregister at GC; this only catches a DO that died
 * without cleaning up, so it is far longer than any real refresh gap.
 */
export const DIR_STALE_MS = 2 * 60 * 60 * 1000

/**
 * Entries written before the snapshot change are bare numbers. Reading has to
 * cope with both or a deploy would blank the directory for every live room.
 */
export function normalizeDir(raw: Record<string, DirEntry | number> | undefined): Record<string, DirEntry> {
    const out: Record<string, DirEntry> = {}
    for (const [code, value] of Object.entries(raw ?? {})) {
        out[code] = typeof value === 'number' ? { at: value } : value
    }
    return out
}

/**
 * Joinable codes, oldest first, so early rooms fill before new ones open.
 *
 * Started rooms stay registered now — the landing strip wants to show a game
 * in progress, and evicting them on start meant the directory only ever held
 * empty lobbies. Quick match must therefore filter them out here, or it would
 * drop someone into a game already under way.
 */
export function dirCodes(raw: Record<string, DirEntry | number> | undefined): string[] {
    const dir = normalizeDir(raw)
    return Object.entries(dir)
        .filter(([, e]) => !e.inProgress)
        .sort((a, b) => a[1].at - b[1].at)
        .map(([code]) => code)
}

/**
 * Rooms worth showing: not stale, and with someone actually in them. An empty
 * room is a worse advert than no room at all, and a room registered but never
 * joined would otherwise sit on the landing page indefinitely.
 */
export function liveTables(
    raw: Record<string, DirEntry | number> | undefined,
    now: number,
    limit = 3,
): PublicTable[] {
    const dir = normalizeDir(raw)
    return Object.entries(dir)
        .filter(([, e]) => (e.players ?? 0) > 0)
        .filter(([, e]) => now - (e.updatedAt ?? e.at) < DIR_STALE_MS)
        // Fullest first: a table with people on it is the better invitation,
        // and a nearly-empty room reads as a dead game.
        .sort((a, b) => (b[1].players ?? 0) - (a[1].players ?? 0) || a[1].at - b[1].at)
        .slice(0, limit)
        .map(([code, e]) => ({
            code,
            players: e.players ?? 0,
            seatsFree: e.seatsFree ?? 0,
            inProgress: !!e.inProgress,
            mode: e.mode ?? 'official',
            skins: e.skins ?? [],
        }))
}
