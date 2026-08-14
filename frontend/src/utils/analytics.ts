/**
 * GA4 gameplay events, sent through the gtag loaded in index.html.
 * No-op when gtag is absent (ad blockers, dev, tests) — analytics must
 * never break or slow the game.
 *
 * Event dictionary (all custom, snake_case, params are GA4-safe):
 *   page_view          { page_title, page_path }  — virtual, per screen
 *   mp_room_created    { rules, visibility }
 *   mp_room_joined     { method: created|code|link|quick_match|restore }
 *   mp_join_failed     { reason: <server message>|ws_closed_<code>|timeout|unknown, attempt: 1|2 }
 *   mp_game_started    { players, rules, rematch }
 *   mp_game_finished   { players, result: won|lost, duration_seconds, rules }
 *   mp_room_left       { phase: lobby|playing|finished, seconds_in_room }
 *   mp_spectate_start  {}
 *   mp_spectate_end    { seconds }
 *   mp_spectate_rematch_joined {}
 *   sp_game_started    { rules }
 *   sp_game_finished   { result: won|lost, duration_seconds, rules }
 *   voice_joined       {}
 *   voice_left         { duration_seconds }
 *   share              { method: whatsapp|x|image|native|clipboard,
 *                        content_type: sp_win|mp_win|daily }
 *   profile_shared     {}
 *   daily_started      { source: lobby|game_over }
 *   daily_finished     { result: won|lost|eliminated, turns }
 *   bot_defeated       { bot_id, rung: 1..8 }
 *   play_clicked       { method: guest }
 *   signin_failed      { message }
 *   signin_retry       {}
 *
 * Guest claim funnel. `method` on the completion is what makes the email and
 * Google paths comparable — the whole point of instrumenting them:
 *   guest_claim_started        {}                  — email form opened
 *   guest_claim_email_sent     {}                  — confirmation dispatched
 *   guest_claim_email_exists   {}                  — email belongs to someone else
 *   guest_claim_google_started {}                  — handed off to Google
 *   guest_claim_google_taken   {}                  — that Google account is taken
 *   guest_claim_completed      { method: email|google }
 */

type Params = Record<string, string | number | boolean | undefined>

export function track(event: string, params?: Params): void {
    if (typeof window === 'undefined') return
    const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof g !== 'function') return
    try {
        g('event', event, params)
    } catch { /* analytics never breaks the game */ }
}

/** Virtual page view for a screen change (this SPA has no router). */
export function trackScreen(screen: string): void {
    track('page_view', { page_title: screen, page_path: `/${screen}` })
}
