/**
 * Kill cards — the shareable artifact for the single most brutal stack of a
 * game. A game ends, the biggest stack that landed on anyone becomes a link,
 * and that link unfurls in a group chat with the brag as its title.
 *
 * The OG image is NOT rendered per kill. There are a handful of pre-rendered
 * tier images and the exact names/amount ride in the meta text, which is what
 * link-preview cards display as the bold headline anyway. That trades a small
 * amount of image fidelity for no storage bucket, no upload path, and no
 * image-rendering dependency at the edge.
 *
 * The tier is computed here and stored on the row, so functions/k/[code].js
 * never has to duplicate this logic — it reads the slug and checks it against
 * KILL_TIERS before putting it in an image URL.
 */

/** Slugs of the pre-rendered images in public/og/kill-<tier>.png. */
export const KILL_TIERS = ['2', '4', '6', '10', '12', '16', '20', '26plus'] as const

export type KillTier = (typeof KILL_TIERS)[number]

/** Lower bound of each tier, index-aligned with KILL_TIERS. */
const TIER_FLOORS = [2, 4, 6, 10, 12, 16, 20, 26]

/**
 * Stacks smaller than this are routine — a +4 happens several times a game and
 * nobody posts one. Below the threshold we don't mint a card at all.
 */
export const MIN_BRAG_STACK = 6

/** Longest name we'll put in an unfurl before truncating. */
const MAX_NAME = 24

/**
 * The share code is minted here, not by the table default, so the insert never
 * needs a RETURNING clause. That matters: kill_cards has no SELECT policy by
 * design (public reads go through the kill_card() definer), and RETURNING would
 * require one — an insert with ?select=code fails RLS with 42501 even though
 * the insert itself is allowed.
 *
 * 12 hex chars is ~48 bits; at this table's volume a collision would need
 * millions of rows, and one would surface as a primary-key error the caller
 * already treats as "sharing failed".
 */
export function newKillCode(): string {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function killTier(amount: number): KillTier {
    let idx = 0
    for (let i = 0; i < TIER_FLOORS.length; i++) {
        if (amount >= TIER_FLOORS[i]!) idx = i
    }
    return KILL_TIERS[idx]!
}

export function isBragworthy(amount: number): boolean {
    return amount >= MIN_BRAG_STACK
}

/**
 * Names reach here from user-controlled profiles and go straight into meta
 * tags, so collapse control characters and cap the length. HTMLRewriter
 * attribute-escapes on the way out; this is about the unfurl staying legible,
 * not about escaping.
 */
function cleanName(raw: string): string {
    const stripped = [...String(raw ?? '')]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
    if (!stripped) return 'someone'
    return stripped.length > MAX_NAME ? `${stripped.slice(0, MAX_NAME - 1)}…` : stripped
}

export interface KillMetaInput {
    dealer: string
    victim: string
    amount: number
    cardsPlayed: number
}

export function buildKillMeta(input: KillMetaInput): { title: string; description: string } {
    const dealer = cleanName(input.dealer)
    const victim = cleanName(input.victim)
    return {
        title: `${dealer} stacked +${input.amount} on ${victim} · Open Mercy`,
        description: `+${input.amount} in a single turn, ${input.cardsPlayed} cards played. Think you can survive worse? Play Open Mercy free, no download.`,
    }
}
