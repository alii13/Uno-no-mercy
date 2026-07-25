/**
 * Country lookup for the client — Cloudflare already stamps every request
 * with its edge-detected country, so this is a zero-dependency mirror.
 * Consumed by src/utils/country.ts to store country on the profile.
 */
export function onRequestGet({ request }) {
    return new Response(JSON.stringify({ country: request.cf?.country ?? null }), {
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
        },
    })
}
