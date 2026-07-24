/**
 * Card-back skins — earn-only cosmetics. A skin is two CSS custom properties
 * (accent + stripe) consumed by CardBack.vue, so every render site — piles,
 * fans, opponent hands, flying-card clones — inherits the equipped look from
 * the document root with no prop threading.
 *
 * Unlocks are pure functions of the player's record (wins, best streak,
 * earned achievements): ownership can never desync from history. Only the
 * EQUIP choice is state, persisted locally; server-side inventory sync is
 * the follow-up when cosmetics grow beyond derivables.
 */

export interface UnlockInputs {
    wins: number
    longestStreak: number
    earned: Set<string>
}

export interface CardBackSkin {
    id: string
    title: string
    unlock: string
    accent: string
    stripe: string
    unlocked: (u: UnlockInputs) => boolean
}

export const CARD_BACKS: CardBackSkin[] = [
    { id: 'ember', title: 'Ember', unlock: 'Default', accent: '#ff3333', stripe: '#ffcc00', unlocked: () => true },
    { id: 'toxic', title: 'Toxic', unlock: '3-day streak', accent: '#39ff14', stripe: '#a4ff78', unlocked: u => u.longestStreak >= 3 },
    { id: 'ice', title: 'Cold Blood', unlock: 'Survive a +16 stack', accent: '#00e5ff', stripe: '#9ff3ff', unlocked: u => u.earned.has('stack_16') },
    { id: 'hazard', title: 'Hazard', unlock: 'Win 10 games', accent: '#ffcc00', stripe: '#ff3333', unlocked: u => u.earned.has('ten_wins') },
    { id: 'royal', title: 'Royal', unlock: 'Reach Savage (30 wins)', accent: '#b26bff', stripe: '#e3c7ff', unlocked: u => u.wins >= 30 },
    { id: 'gold', title: 'Midas', unlock: 'Reach Overlord (100 wins)', accent: '#ffd700', stripe: '#fff3b0', unlocked: u => u.wins >= 100 },
]

const KEY = 'uno_cosmetics_v1'

export function getEquippedId(): string {
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return 'ember'
        const parsed = JSON.parse(raw) as { equipped?: string }
        return CARD_BACKS.some(s => s.id === parsed.equipped) ? parsed.equipped! : 'ember'
    } catch {
        return 'ember'
    }
}

export function equip(id: string): void {
    if (!CARD_BACKS.some(s => s.id === id)) return
    try {
        localStorage.setItem(KEY, JSON.stringify({ equipped: id }))
    } catch { /* localStorage disabled or quota */ }
    applyEquipped()
    void pushEquipToProfile()
}

/** Mirror the equip choice to the signed-in profile — cosmetic, never blocks.
 *  Silently a no-op until the equipped_card_back column exists. */
export async function pushEquipToProfile(): Promise<void> {
    try {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return
        await supabase.from('profiles').update({ equipped_card_back: getEquippedId() }).eq('id', session.user.id)
    } catch { /* cosmetic — never breaks the game */ }
}

/** Adopt the profile's equip on sign-in (server wins over this device). */
export function adoptProfileEquip(equipped: string | null | undefined): void {
    if (!equipped || !CARD_BACKS.some(s => s.id === equipped)) return
    if (equipped === getEquippedId()) return
    try {
        localStorage.setItem(KEY, JSON.stringify({ equipped }))
    } catch { /* localStorage disabled or quota */ }
    applyEquipped()
}

/** Colors for someone ELSE's seat: their skin, or the default — never the viewer's. */
export function skinColors(skinId: string | undefined): { accent: string; stripe: string } {
    const skin = CARD_BACKS.find(s => s.id === skinId) ?? CARD_BACKS[0]!
    return { accent: skin.accent, stripe: skin.stripe }
}

/** Stamp the equipped skin's colors onto the root; CardBack picks them up. */
export function applyEquipped(): void {
    const skin = CARD_BACKS.find(s => s.id === getEquippedId()) ?? CARD_BACKS[0]!
    if (typeof document === 'undefined') return
    document.documentElement.style.setProperty('--card-back-accent', skin.accent)
    document.documentElement.style.setProperty('--card-back-stripe', skin.stripe)
}
