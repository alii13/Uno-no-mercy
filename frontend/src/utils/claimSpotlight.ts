/**
 * One-shot prominence for the guest "save your stats" claim CTA. The first
 * win a guest sees on this device earns a real CTA block on the game-over
 * screen; every game-over after that keeps the quiet footer link. The flag
 * lives in localStorage because the unit is "once per device", not once per
 * session - seen and ignored means the pitch never escalates again.
 */
const KEY = 'om_claim_spotlight_shown'

export function shouldSpotlightClaim(isAnonymous: boolean, isWinner: boolean): boolean {
    if (!isAnonymous || !isWinner) return false
    try {
        return localStorage.getItem(KEY) === null
    } catch {
        return false
    }
}

export function markClaimSpotlightShown(): void {
    try {
        localStorage.setItem(KEY, '1')
    } catch { /* private mode - the quiet link still exists */ }
}
