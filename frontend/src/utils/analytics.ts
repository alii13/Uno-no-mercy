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
 *   sp_game_started    { rules }
 *   sp_game_finished   { result: won|lost, duration_seconds, rules }
 *   voice_joined       {}
 *   voice_left         { duration_seconds }
 *   share              { method: whatsapp|x, content_type: sp_win|mp_win }
 *   play_clicked       { method: guest }
 *   signin_failed      { message }
 *   signin_retry       {}
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
