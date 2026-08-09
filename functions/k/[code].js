/**
 * Server-side OG tags for kill-card links. Link-preview bots don't run
 * JavaScript, so /k/<code> rewrites the app shell's meta tags at the edge with
 * the brag before the HTML leaves Cloudflare. Any failure (bad code, SQL not
 * installed, fetch error) falls back to the untouched shell — the page itself
 * always works, previews are a bonus. Same contract as /p/<code>.
 *
 * There is no dedicated landing screen: the SPA routes an unknown path to home,
 * which is where a curious clicker should land anyway. The preview carries the
 * brag; the page carries the Play button.
 */

const CANONICAL_ORIGIN = 'https://open-mercy.com'

/**
 * Mirrors KILL_TIERS in src/utils/killCard.ts (Pages Functions can't import
 * from the Vite bundle). The tier is written by the client and constrained by
 * a CHECK in kill-cards.sql; this is the third gate, and the one that matters,
 * because the value lands inside an image URL.
 */
const KILL_TIERS = new Set([
    '6', '8', '10', '12', '14', '16', '18', '20', '22', '24',
    '26', '28', '30', '32', '34', '36', '38', '40', '42', '42plus',
    // Cards minted before stacks got their exact number.
    '26plus',
])

async function fetchKill(env, code) {
    const url = env.VITE_SUPABASE_URL
    const key = env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) return null
    const res = await fetch(`${url}/rest/v1/rpc/kill_card`, {
        method: 'POST',
        headers: {
            apikey: key,
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ p_code: code }),
    })
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
}

/** Names come from user-controlled profiles. Keep the unfurl legible. */
function cleanName(raw) {
    const stripped = [...String(raw ?? '')]
        .filter((ch) => ch.charCodeAt(0) >= 32)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
    if (!stripped) return 'someone'
    return stripped.length > 24 ? `${stripped.slice(0, 23)}…` : stripped
}

export async function onRequestGet(context) {
    const { request, env, params } = context
    // The SPA fallback serves index.html for this path.
    const shell = await env.ASSETS.fetch(request)

    const code = String(params.code || '')
    if (!/^[A-Za-z0-9]{4,32}$/.test(code)) return shell

    let kill = null
    try {
        kill = await fetchKill(env, code)
    } catch {
        return shell
    }
    if (!kill) return shell

    const dealer = cleanName(kill.dealer)
    const victim = cleanName(kill.victim)
    const amount = Number(kill.amount) || 0
    const cardsPlayed = Number(kill.cards_played) || 0

    const title = `${dealer} stacked +${amount} on ${victim} · Open Mercy`
    const description = `+${amount} in a single turn, ${cardsPlayed} cards played. Think you can survive worse? Play Open Mercy free, no download.`
    const pageUrl = `${CANONICAL_ORIGIN}/k/${code}`
    const image = KILL_TIERS.has(kill.tier)
        ? `${CANONICAL_ORIGIN}/og/kill-${kill.tier}.jpg`
        : `${CANONICAL_ORIGIN}/og-image.png`

    const setContent = (value) => ({
        element(el) { el.setAttribute('content', value) },
    })

    return new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(title) } })
        .on('meta[property="og:title"]', setContent(title))
        .on('meta[property="og:description"]', setContent(description))
        .on('meta[property="og:url"]', setContent(pageUrl))
        .on('meta[property="og:image"]', setContent(image))
        .on('meta[name="twitter:title"]', setContent(title))
        .on('meta[name="twitter:description"]', setContent(description))
        .on('meta[name="twitter:url"]', setContent(pageUrl))
        .on('meta[name="twitter:image"]', setContent(image))
        .transform(shell)
}
