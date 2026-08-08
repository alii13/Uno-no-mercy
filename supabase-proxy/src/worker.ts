/**
 * Cloudflare Worker: Supabase Proxy
 *
 * Proxies all Supabase traffic (REST, Auth, Storage, Realtime WebSockets)
 * through Cloudflare's network to bypass ISP-level blocks in India/UAE.
 *
 * How it works:
 *   Browser → worker.yourname.workers.dev → supabase.co
 *
 * The worker forwards requests 1:1, preserving headers, body, and
 * WebSocket upgrade handshakes so Realtime channels keep working.
 */

interface Env {
  SUPABASE_URL: string
  SUPABASE_PROJECT_REF: string
}

// Allowed origins for CORS (update with your actual frontend URLs)
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || ''
  // The production site plus Cloudflare Pages preview deploys. vercel/netlify
  // suffixes were dropped (the game ships on Cloudflare Pages, so they only
  // widened the reflected-origin surface). Auth is bearer-token (Authorization
  // header), never cookies, so we do NOT send Allow-Credentials — that removes
  // the credentialed-cross-origin grant a reflected wildcard would otherwise
  // hand to any *.pages.dev site.
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin === 'https://uno-no-mercy.com' || origin === 'https://www.uno-no-mercy.com' || origin === 'https://open-mercy.com' || origin === 'https://www.open-mercy.com' || origin.endsWith('.pages.dev')

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0]!,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version, range, prefer, accept, accept-profile, content-profile, x-retry-count',
    'Access-Control-Expose-Headers': 'Content-Range, x-supabase-api-version',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      })
    }

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', proxy: 'uno-supabase-proxy' }), {
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
      })
    }

    // Build the target Supabase URL
    // The worker mirrors Supabase's URL structure:
    //   /rest/v1/*     → REST API (PostgREST)
    //   /auth/v1/*     → GoTrue auth
    //   /storage/v1/*  → Storage
    //   /realtime/v1/* → Realtime (WebSocket)
    //   /functions/v1/* → Edge Functions
    const targetUrl = new URL(url.pathname + url.search, env.SUPABASE_URL)

    // Never forward off the configured Supabase project. A request path that
    // begins with `//` (or `/\`) is a protocol-relative reference, so the URL
    // parser above would take the host from the PATH — e.g. `//evil.com/rest/v1`
    // resolves to `https://evil.com/...`, turning the worker into an open relay
    // to any host. Pin the target host to Supabase's.
    if (targetUrl.host !== new URL(env.SUPABASE_URL).host) {
      return new Response(JSON.stringify({ error: 'Invalid target' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
      })
    }

    // --- WebSocket Upgrade (Realtime) ---
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      return handleWebSocket(request, targetUrl, env)
    }

    // --- Standard HTTP Proxy ---
    const proxyHeaders = new Headers()

    // Copy only the headers Supabase needs (avoid Cloudflare routing conflicts)
    const passHeaders = [
      'content-type', 'authorization', 'apikey', 'accept', 'accept-language',
      'x-client-info', 'x-supabase-api-version', 'range', 'prefer',
      'content-profile', 'accept-profile',
    ]
    for (const name of passHeaders) {
      const val = request.headers.get(name)
      if (val) proxyHeaders.set(name, val)
    }

    // Set Host header to Supabase domain to avoid Cloudflare 1016 DNS loop
    const supabaseHost = new URL(env.SUPABASE_URL).host
    proxyHeaders.set('Host', supabaseHost)

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: proxyHeaders,
        body: request.body,
        redirect: 'follow',
      })

      // Build response with CORS headers
      const responseHeaders = new Headers(response.headers)
      const corsHeaders = getCorsHeaders(request)
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value)
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch (err: any) {
      return new Response(JSON.stringify({ error: 'Proxy error', message: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
      })
    }
  },
}

/**
 * Handle WebSocket upgrade for Supabase Realtime.
 *
 * Cloudflare Workers support WebSocket proxying via the "WebSocket pair" API:
 * 1. Accept the client's upgrade request
 * 2. Open a new WebSocket to Supabase
 * 3. Pipe messages between client ↔ Supabase
 */
async function handleWebSocket(request: Request, targetUrl: URL, env: Env): Promise<Response> {
  // Cloudflare fetch() needs https://, not wss:// - it handles the WS upgrade internally
  const wsUrl = new URL(targetUrl.toString())
  wsUrl.protocol = 'https:'

  // Build headers for upstream connection (no Host header - causes 1101 on WS)
  const headers = new Headers()
  const apikey = request.headers.get('apikey') || wsUrl.searchParams.get('apikey')
  if (apikey) headers.set('apikey', apikey)
  const auth = request.headers.get('Authorization')
  if (auth) headers.set('Authorization', auth)

  try {
    // Use Cloudflare's fetch with Upgrade header for WebSocket
    headers.set('Upgrade', 'websocket')
    const upstreamResponse = await fetch(wsUrl.toString(), {
      headers,
    })

    const upstreamWs = upstreamResponse.webSocket
    if (!upstreamWs) {
      const body = await upstreamResponse.text()
      return new Response(JSON.stringify({ error: 'WebSocket upgrade failed', status: upstreamResponse.status, body }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    upstreamWs.accept()

    // Create a WebSocket pair for the client
    const pair = new WebSocketPair()
    const [clientWs, serverWs] = [pair[0], pair[1]]
    serverWs.accept()

    // Pipe: client → upstream
    serverWs.addEventListener('message', (event) => {
      try { upstreamWs.send(event.data) } catch {}
    })
    serverWs.addEventListener('close', (event) => {
      try { upstreamWs.close(event.code, event.reason) } catch {}
    })

    // Pipe: upstream → client
    upstreamWs.addEventListener('message', (event) => {
      try { serverWs.send(event.data) } catch {}
    })
    upstreamWs.addEventListener('close', (event) => {
      try { serverWs.close(event.code, event.reason) } catch {}
    })

    return new Response(null, {
      status: 101,
      webSocket: clientWs,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'WebSocket proxy error', message: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
