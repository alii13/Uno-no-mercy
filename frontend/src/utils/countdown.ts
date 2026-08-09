/**
 * Countdown to the next daily deal.
 *
 * The board keys on the viewer's local date, so the deal flips at their local
 * midnight, not UTC.
 *
 * Rendered to the second. The previous version showed whole minutes and
 * refreshed every 30s, which meant the number sat unchanged for up to a minute
 * at a time and read as static text rather than a clock.
 */

/** Milliseconds from `now` until the viewer's next local midnight. */
export function msUntilLocalMidnight(now: Date): number {
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return midnight.getTime() - now.getTime()
}

/** HH:MM:SS, zero-padded, clamped at zero. */
export function formatCountdown(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}
