/**
 * Deterministic PRNG for the daily challenge: the same seed string must
 * produce the same shuffle and the same bot decisions on every device, so
 * everyone in the world plays the same deal.
 */

/** xmur3 string hash feeding a mulberry32 generator. Returns a Math.random drop-in. */
export function seededRng(seed: string): () => number {
    let h = 1779033703 ^ seed.length
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
        h = (h << 13) | (h >>> 19)
    }
    let a = (h ^= h >>> 16) >>> 0
    return () => {
        a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/** YYYY-MM-DD in the player's local timezone — the daily challenge day key. */
export function localDateString(d: Date = new Date()): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}
