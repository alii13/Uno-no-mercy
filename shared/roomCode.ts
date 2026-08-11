/**
 * Room code alphabet and validation, shared by the client and the game server.
 *
 * It lives here because the two disagreeing was a real bug. The server mints
 * codes from an alphabet that omits the ambiguous glyphs (I, L, O, 0, 1), and its
 * WebSocket route only matched `[A-Za-z2-9]`. The client accepted `[A-Z0-9]`, so a
 * code containing 0 or 1 passed validation, missed the server's route, fell
 * through to a bare 404 — and a 404 on a WebSocket upgrade reaches the browser as
 * close 1006 with no reason, indistinguishable from a network drop. One in eight
 * hand-typed joins died there, reported only as `ws_closed_1006`.
 *
 * Anything that validates a room code imports from here, so the alphabet can
 * never drift apart again.
 */

/** Mirrors the server's minting alphabet. No I, L, O, 0 or 1. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const ROOM_CODE_MIN = 4
export const ROOM_CODE_MAX = 8

// Built from the alphabet rather than hand-written ranges: writing it by hand as
// [A-HJ-NP-Z2-9] silently readmits L, which is not in the alphabet.
const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_MIN},${ROOM_CODE_MAX}}$`)

/** Upper-cases and strips surrounding whitespace. Does not validate. */
export function normalizeRoomCode(raw: string): string {
    return String(raw ?? '').trim().toUpperCase()
}

export function isRoomCode(raw: string): boolean {
    return ROOM_CODE_RE.test(normalizeRoomCode(raw))
}

/** The glyphs a code can never contain, in the order a person would read them. */
const EXCLUDED = ['0', '1', 'I', 'L', 'O']

/**
 * A human explanation of why a code is unusable, or null when it's fine.
 *
 * Worth the extra detail: the excluded glyphs are exactly the ones people
 * mistype for each other, so "check for a typo" without naming them is useless.
 */
export function roomCodeProblem(raw: string): string | null {
    const code = normalizeRoomCode(raw)
    if (!code) return 'Enter a room code.'

    const hit = EXCLUDED.filter(ch => code.includes(ch))
    if (hit.length) {
        return `Room codes never use ${EXCLUDED.join(', ')} - check the ${hit.join(' and ')}.`
    }
    if (code.length < ROOM_CODE_MIN || code.length > ROOM_CODE_MAX) {
        return `Room codes are ${ROOM_CODE_MIN}-${ROOM_CODE_MAX} characters.`
    }
    if (!ROOM_CODE_RE.test(code)) return 'That is not a valid room code.'
    return null
}
