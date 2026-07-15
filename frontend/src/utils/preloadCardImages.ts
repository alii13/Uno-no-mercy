/**
 * Warm the browser cache with every card face so no card ever pops in as a
 * ghost outline mid-game. ~2.6MB of WebP total; fired once, off the critical
 * path, from the pre-game surfaces.
 */

const urls = Object.values(
    import.meta.glob('@/assets/cards-webp/*.webp', { eager: true, query: '?url', import: 'default' })
) as string[]

let warmed = false

export function preloadCardImages(): void {
    if (warmed) return
    warmed = true
    for (const url of urls) {
        const img = new Image()
        img.decoding = 'async'
        img.src = url
    }
}
