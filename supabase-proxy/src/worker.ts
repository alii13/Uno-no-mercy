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
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.pages.dev') || origin.endsWith('.vercel.app') || origin.endsWith('.netlify.app')

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0]!,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info, x-supabase-api-version, range',
    'Access-Control-Expose-Headers': 'Content-Range, x-supabase-api-version',
    'Access-Control-Allow-Credentials': 'true',
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
  // Change protocol to wss:// for the upstream connection
  const wsUrl = new URL(targetUrl.toString())
  wsUrl.protocol = 'wss:'

  // Forward relevant headers to Supabase (don't set Host — causes CF 1016 loop)
  const headers = new Headers()
  const apikey = request.headers.get('apikey')
  if (apikey) headers.set('apikey', apikey)
  const auth = request.headers.get('Authorization')
  if (auth) headers.set('Authorization', auth)

  // Create a WebSocket pair: [client-facing, server-facing]
  const pair = new WebSocketPair()
  const [clientWs, serverWs] = [pair[0], pair[1]]

  // Accept the server side immediately so we can start receiving from client
  serverWs.accept()

  // Connect to upstream Supabase Realtime
  const upstreamResponse = await fetch(wsUrl.toString(), {
    headers,
    method: 'GET',
    // @ts-ignore - Cloudflare Workers support this
    cf: { webSocket: true },
  })

  const upstreamWs = upstreamResponse.webSocket
  if (!upstreamWs) {
    serverWs.close(1011, 'Failed to connect to upstream WebSocket')
    return new Response('WebSocket upgrade failed', { status: 502 })
  }

  upstreamWs.accept()

  // Pipe: client → upstream
  serverWs.addEventListener('message', (event) => {
    try {
      upstreamWs.send(event.data)
    } catch {
      // upstream closed
    }
  })

  serverWs.addEventListener('close', (event) => {
    try {
      upstreamWs.close(event.code, event.reason)
    } catch {
      // already closed
    }
  })

  // Pipe: upstream → client
  upstreamWs.addEventListener('message', (event) => {
    try {
      serverWs.send(event.data)
    } catch {
      // client closed
    }
  })

  upstreamWs.addEventListener('close', (event) => {
    try {
      serverWs.close(event.code, event.reason)
    } catch {
      // already closed
    }
  })

  // Return the upgrade response with the client-facing WebSocket
  return new Response(null, {
    status: 101,
    webSocket: clientWs,
  })
}
