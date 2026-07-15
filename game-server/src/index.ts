/// <reference types="@cloudflare/workers-types" />

import { verifySupabaseToken, type AuthEnv } from './auth'
import type { ClientMsg, PresencePlayer, ServerMsg } from './protocol'

interface Env extends AuthEnv {
    ROOM: DurableObjectNamespace
}

const CONTINENT_HINTS: Record<string, string> = {
    AS: 'apac',
    OC: 'oc',
    EU: 'weur',
    NA: 'enam',
    SA: 'sam',
    AF: 'afr',
}

// Placement lottery (phase 0 finding: auto-placement lands a continent away
// ~60% of the time even with a location hint). Each room code maps to
// CANDIDATES sibling objects; at creation the worker — which runs at the
// creator's edge colo — times a probe to each and activates the closest.
// Joins ask all candidates in parallel who is active.
const CANDIDATES = 3

// A room with no connected players is garbage-collected after this long.
const ROOM_GC_MS = 10 * 60 * 1000

// Unambiguous alphabet (no 0/O, 1/I/L) for share codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateRoomCode(): string {
    const bytes = new Uint8Array(6)
    crypto.getRandomValues(bytes)
    let code = ''
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
    return code
}

function candidateStub(env: Env, code: string, i: number, hint?: string): DurableObjectStub {
    const id = env.ROOM.idFromName(`${code}#${i}`)
    return env.ROOM.get(id, hint ? { locationHint: hint as DurableObjectLocationHint } : undefined)
}

/** Find which lottery candidate holds the active room, if any. */
async function locateRoom(env: Env, code: string): Promise<DurableObjectStub | null> {
    const probes = Array.from({ length: CANDIDATES }, async (_, i) => {
        const stub = candidateStub(env, code, i)
        const res = await stub.fetch('https://do/is-active')
        if (!(await res.json<boolean>())) throw new Error('inactive')
        return stub
    })
    return Promise.any(probes).catch(() => null)
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        const url = new URL(req.url)
        const hint = CONTINENT_HINTS[(req.cf?.continent as string) ?? '']

        // Create a room: run the placement lottery and activate the winner.
        if (req.method === 'POST' && url.pathname === '/rooms') {
            const code = generateRoomCode()
            const timings = await Promise.all(
                Array.from({ length: CANDIDATES }, async (_, i) => {
                    const stub = candidateStub(env, code, i, hint)
                    // First probe pays cold creation; the second measures the
                    // settled worker→DO path.
                    await stub.fetch('https://do/probe')
                    const t1 = Date.now()
                    await stub.fetch('https://do/probe')
                    return { i, ms: Date.now() - t1 }
                })
            )
            timings.sort((a, b) => a.ms - b.ms)
            const winner = timings[0]!
            await candidateStub(env, code, winner.i).fetch('https://do/activate', {
                method: 'POST',
                body: JSON.stringify({ code }),
            })
            return Response.json({ code, placementMs: winner.ms })
        }

        // Join a room over WebSocket: /room/CODE/ws
        const roomWs = url.pathname.match(/^\/room\/([A-Za-z2-9]+)\/ws$/)
        if (roomWs) {
            if (req.headers.get('Upgrade') !== 'websocket') {
                return new Response('expected websocket', { status: 426 })
            }
            const stub = await locateRoom(env, roomWs[1]!.toUpperCase())
            if (!stub) return new Response('room not found', { status: 404 })
            return stub.fetch('https://do/room-ws', req)
        }

        // Phase 0 diagnostics: echo WS + latency page.
        if (url.pathname === '/ws') {
            if (req.headers.get('Upgrade') !== 'websocket') {
                return new Response('expected websocket', { status: 426 })
            }
            const room = url.searchParams.get('room') ?? 'phase0'
            const id = env.ROOM.idFromName(room)
            return env.ROOM.get(id, hint ? { locationHint: hint as DurableObjectLocationHint } : undefined)
                .fetch('https://do/echo-ws', req)
        }

        const colo = (req.cf?.colo as string) ?? 'unknown'
        return new Response(PAGE.replace('{{COLO}}', colo), {
            headers: { 'content-type': 'text/html; charset=utf-8' },
        })
    },
}

interface RoomRecord {
    code: string
    createdAt: number
}

interface RosterEntry {
    name: string
    joinedAt: number
}

type SocketTag = { echo: true } | { userId: string } | null

export class GameRoomDO {
    constructor(private ctx: DurableObjectState, private env: Env) {}

    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url)

        switch (url.pathname) {
            case '/probe':
                return new Response('ok')

            case '/is-active':
                return Response.json(!!(await this.ctx.storage.get('room')))

            case '/activate': {
                const body = await req.json<{ code: string }>()
                const room: RoomRecord = { code: body.code, createdAt: Date.now() }
                await this.ctx.storage.put('room', room)
                await this.ctx.storage.setAlarm(Date.now() + ROOM_GC_MS)
                return new Response('ok')
            }

            case '/room-ws': {
                if (!(await this.ctx.storage.get('room'))) {
                    return new Response('room not found', { status: 404 })
                }
                const pair = new WebSocketPair()
                this.ctx.acceptWebSocket(pair[1])
                return new Response(null, { status: 101, webSocket: pair[0] })
            }

            // Echo mode for the latency diagnostics page.
            case '/echo-ws': {
                const pair = new WebSocketPair()
                this.ctx.acceptWebSocket(pair[1])
                pair[1].serializeAttachment({ echo: true })
                return new Response(null, { status: 101, webSocket: pair[0] })
            }

            default:
                return new Response('not found', { status: 404 })
        }
    }

    async webSocketMessage(ws: WebSocket, raw: ArrayBuffer | string) {
        const tag = ws.deserializeAttachment() as SocketTag

        if (tag && 'echo' in tag) {
            ws.send(raw)
            return
        }

        let msg: ClientMsg
        try {
            msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
        } catch {
            this.send(ws, { t: 'error', code: 'bad-message' })
            return
        }

        // First frame must authenticate the socket.
        if (!tag) {
            if (msg.t !== 'auth') {
                this.send(ws, { t: 'error', code: 'unauthorized' })
                ws.close(1008, 'auth required')
                return
            }
            const verified = await verifySupabaseToken(msg.token, this.env)
            if (!verified) {
                this.send(ws, { t: 'error', code: 'unauthorized' })
                ws.close(1008, 'invalid token')
                return
            }
            const room = await this.ctx.storage.get<RoomRecord>('room')
            if (!room) {
                this.send(ws, { t: 'error', code: 'room-not-found' })
                ws.close(1011, 'room gone')
                return
            }
            const roster = (await this.ctx.storage.get<Record<string, RosterEntry>>('roster')) ?? {}
            const entry = roster[verified.userId]
            if (entry) {
                entry.name = msg.name || entry.name
            } else {
                roster[verified.userId] = { name: msg.name || 'PLAYER', joinedAt: Date.now() }
            }
            await this.ctx.storage.put('roster', roster)
            ws.serializeAttachment({ userId: verified.userId })
            // Activity resets the GC clock.
            await this.ctx.storage.setAlarm(Date.now() + ROOM_GC_MS)

            this.send(ws, { t: 'hello', roomCode: room.code, userId: verified.userId })
            await this.broadcastPresence(roster)
            return
        }

        switch (msg.t) {
            case 'ping':
                this.send(ws, { t: 'pong', now: msg.now })
                return
            case 'leave':
                ws.close(1000, 'left')
                return
            default:
                this.send(ws, { t: 'error', code: 'bad-message' })
        }
    }

    // The closing socket is still enumerable in getWebSockets() while these
    // handlers run — exclude it or it counts itself as connected.
    async webSocketClose(ws: WebSocket) {
        await this.broadcastPresence(undefined, ws)
    }

    async webSocketError(ws: WebSocket) {
        await this.broadcastPresence(undefined, ws)
    }

    // GC: a room idle (no connected room sockets) past its alarm evaporates.
    async alarm() {
        if (this.roomSockets().length === 0) {
            await this.ctx.storage.deleteAll()
        } else {
            await this.ctx.storage.setAlarm(Date.now() + ROOM_GC_MS)
        }
    }

    private roomSockets(exclude?: WebSocket): { ws: WebSocket; userId: string }[] {
        const sockets: { ws: WebSocket; userId: string }[] = []
        for (const ws of this.ctx.getWebSockets()) {
            if (ws === exclude) continue
            const tag = ws.deserializeAttachment() as SocketTag
            if (tag && 'userId' in tag) sockets.push({ ws, userId: tag.userId })
        }
        return sockets
    }

    private send(ws: WebSocket, msg: ServerMsg) {
        try {
            ws.send(JSON.stringify(msg))
        } catch { /* socket already gone */ }
    }

    private async broadcastPresence(rosterIn?: Record<string, RosterEntry>, exclude?: WebSocket) {
        const roster = rosterIn ?? (await this.ctx.storage.get<Record<string, RosterEntry>>('roster')) ?? {}
        const sockets = this.roomSockets(exclude)
        const connectedIds = new Set(sockets.map(s => s.userId))
        const players: PresencePlayer[] = Object.entries(roster)
            .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
            .map(([userId, entry]) => ({ userId, name: entry.name, connected: connectedIds.has(userId) }))
        const frame: ServerMsg = { t: 'presence', players }
        for (const { ws } of sockets) {
            this.send(ws, frame)
        }
    }
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
