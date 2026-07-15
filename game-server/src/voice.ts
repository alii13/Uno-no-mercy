// Cloudflare RealtimeKit REST helpers — one voice meeting per room.
// Auth is a Cloudflare API token scoped to Realtime; the app id identifies
// the RealtimeKit app created in the dashboard. All optional: without the
// secrets the game runs voiceless.

export interface VoiceEnv {
    REALTIMEKIT_ACCOUNT_ID?: string
    REALTIMEKIT_PRESET?: string
    /** wrangler secrets */
    REALTIMEKIT_APP_ID?: string
    REALTIMEKIT_API_TOKEN?: string
}

export function voiceConfigured(env: VoiceEnv): boolean {
    return !!(env.REALTIMEKIT_ACCOUNT_ID && env.REALTIMEKIT_APP_ID && env.REALTIMEKIT_API_TOKEN)
}

function baseUrl(env: VoiceEnv): string {
    return `https://api.cloudflare.com/client/v4/accounts/${env.REALTIMEKIT_ACCOUNT_ID}/realtime/kit/${env.REALTIMEKIT_APP_ID}`
}

async function rtk<T>(env: VoiceEnv, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(baseUrl(env) + path, {
        method,
        headers: {
            'Authorization': `Bearer ${env.REALTIMEKIT_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json = await res.json<{ success: boolean; data?: T; errors?: unknown }>().catch(() => null)
    if (!res.ok || !json?.success || !json.data) {
        throw new Error(`realtimekit ${method} ${path} failed: ${res.status} ${JSON.stringify(json?.errors ?? '')}`)
    }
    return json.data
}

export async function createMeeting(env: VoiceEnv, title: string): Promise<string> {
    const data = await rtk<{ id: string }>(env, 'POST', '/meetings', { title })
    return data.id
}

export async function addParticipant(
    env: VoiceEnv,
    meetingId: string,
    opts: { name: string; customParticipantId: string }
): Promise<string> {
    const data = await rtk<{ token?: string; authToken?: string }>(env, 'POST', `/meetings/${meetingId}/participants`, {
        name: opts.name,
        preset_name: env.REALTIMEKIT_PRESET ?? 'group_call_participant',
        custom_participant_id: opts.customParticipantId,
    })
    const token = data.token ?? data.authToken
    if (!token) throw new Error('realtimekit add participant: no token in response')
    return token
}

/** Best-effort close at room GC; a leaked ACTIVE meeting costs nothing. */
export async function deactivateMeeting(env: VoiceEnv, meetingId: string): Promise<void> {
    await rtk(env, 'PATCH', `/meetings/${meetingId}`, { status: 'INACTIVE' }).catch(() => {})
}
