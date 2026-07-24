/**
 * Server-side OG tags for shared profile links. Link-preview bots don't run
 * JavaScript, so /p/<code> rewrites the app shell's meta tags with the
 * player's actual record before it leaves the edge. Any failure (bad code,
 * SQL not installed, fetch error) falls back to the untouched shell — the
 * page itself always works, previews are a bonus.
 */

async function fetchProfile(env, code) {
    const url = env.VITE_SUPABASE_URL
    const key = env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) return null
    const res = await fetch(`${url}/rest/v1/rpc/public_profile`, {
        method: 'POST',
        headers: {
            apikey: key,
            authorization: `Bearer ${key}`,
            'content-type': 'application/json',
        },
        body: JSON.stringify({ p_share_code: code }),
    })
    if (!res.ok) return null
    const rows = await res.json()
    return Array.isArray(rows) && rows.length ? rows[0] : null
}

export async function onRequestGet(context) {
    const { request, env, params } = context
    // The SPA fallback serves index.html for this path.
    const shell = await env.ASSETS.fetch(request)

    const code = String(params.code || '')
    if (!/^[A-Za-z0-9]{4,32}$/.test(code)) return shell

    let profile = null
    try {
        profile = await fetchProfile(env, code)
    } catch {
        return shell
    }
    if (!profile) return shell

    // Mirrors the thresholds in src/utils/ranks.ts (Pages Functions can't
    // import from the Vite bundle).
    const rankTitle =
        profile.wins >= 200 ? 'No Mercy King' :
        profile.wins >= 100 ? 'Overlord' :
        profile.wins >= 50 ? 'Warlord' :
        profile.wins >= 30 ? 'Savage' :
        profile.wins >= 15 ? 'Enforcer' :
        profile.wins >= 5 ? 'Rookie' : 'Recruit'

    const title = `${profile.username} — ${rankTitle} · ${profile.wins} wins | UNO No Mercy`
    const brags = []
    if (profile.max_stack_survived > 0) brags.push(`Survived a +${profile.max_stack_survived} stack`)
    if (profile.best_win_streak > 1) brags.push(`${profile.best_win_streak}-win streak`)
    brags.push(`${profile.games} games played`)
    const description = `${brags.join(' · ')}. Think you can beat ${profile.username}? Play free — no download.`
    const pageUrl = `https://uno-no-mercy.com/p/${code}`

    const setContent = (value) => ({
        element(el) { el.setAttribute('content', value) },
    })

    return new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(title) } })
        .on('meta[property="og:title"]', setContent(title))
        .on('meta[property="og:description"]', setContent(description))
        .on('meta[property="og:url"]', setContent(pageUrl))
        .on('meta[name="twitter:title"]', setContent(title))
        .on('meta[name="twitter:description"]', setContent(description))
        .on('meta[name="twitter:url"]', setContent(pageUrl))
        .transform(shell)
}
