/// <reference types="@cloudflare/workers-types" />

interface Env {
    ROOM: DurableObjectNamespace
}

// Phase 0 echo room: accepts WebSockets via the hibernation API (the same
// wiring the real game server will use) and echoes every message back.
export class GameRoomDO {
    constructor(private ctx: DurableObjectState) {}

    async fetch(_req: Request): Promise<Response> {
        const pair = new WebSocketPair()
        this.ctx.acceptWebSocket(pair[1])
        return new Response(null, { status: 101, webSocket: pair[0] })
    }

    webSocketMessage(ws: WebSocket, msg: ArrayBuffer | string) {
        ws.send(msg)
    }
}

export default {
    fetch(req: Request, env: Env): Response | Promise<Response> {
        const url = new URL(req.url)
        if (url.pathname === '/ws') {
            if (req.headers.get('Upgrade') !== 'websocket') {
                return new Response('expected websocket', { status: 426 })
            }
            const room = url.searchParams.get('room') ?? 'phase0'
            const id = env.ROOM.idFromName(room)
            return env.ROOM.get(id).fetch(req)
        }
        const colo = (req.cf?.colo as string) ?? 'unknown'
        return new Response(PAGE.replace('{{COLO}}', colo), {
            headers: { 'content-type': 'text/html; charset=utf-8' },
        })
    },
}

const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UNO latency test</title>
<style>
  body { font-family: ui-monospace, monospace; background: #111; color: #eee; padding: 2rem; max-width: 34rem; margin: auto; }
  h1 { font-size: 1.1rem; }
  .big { font-size: 2.4rem; margin: 1rem 0; }
  .dim { color: #888; }
  td { padding: 0.15rem 0.8rem 0.15rem 0; }
</style>
<h1>UNO game-server latency test</h1>
<p class="dim">edge colo: {{COLO}} &middot; room: <span id="room"></span></p>
<div class="big" id="status">connecting&hellip;</div>
<table>
  <tr><td>median</td><td id="p50">-</td></tr>
  <tr><td>p95</td><td id="p95">-</td></tr>
  <tr><td>min</td><td id="min">-</td></tr>
</table>
<p class="dim">20 pings over one WebSocket to a Durable Object. The room is shared:
whoever opens the link first decides where the object lives, everyone else
measures their distance to it - same as a real game.</p>
<script>
  const room = new URLSearchParams(location.search).get('room') || 'phase0'
  document.getElementById('room').textContent = room
  const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + room)
  const samples = []
  const WARMUP = 3, COUNT = 20
  let sent = 0
  const ping = () => { ws.send(String(performance.now())); sent++ }
  ws.onopen = ping
  ws.onerror = () => { document.getElementById('status').textContent = 'connection failed' }
  ws.onmessage = (e) => {
    const rtt = performance.now() - Number(e.data)
    if (sent > WARMUP) samples.push(rtt)
    if (sent < WARMUP + COUNT) { ping(); return }
    samples.sort((a, b) => a - b)
    const at = (q) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))].toFixed(1) + ' ms'
    document.getElementById('status').textContent = at(0.5)
    document.getElementById('p50').textContent = at(0.5)
    document.getElementById('p95').textContent = at(0.95)
    document.getElementById('min').textContent = samples[0].toFixed(1) + ' ms'
  }
</script>
`
