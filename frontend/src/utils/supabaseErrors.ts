/**
 * Which Supabase failures are worth asking about again.
 *
 * A missing column or an unknown function answers the same way every time, so
 * a caller that keeps asking only burns requests - that is the case a surface
 * should disable itself for. A dropped connection is the opposite: it says
 * nothing about the schema, and the next attempt may well succeed.
 *
 * Treating the two alike is how a two-second signal drop turns into a feature
 * that stays dead until the tab is reloaded.
 */

/** PostgREST and Postgres codes that mean "this will fail identically
 *  forever": undefined column, undefined function, and the schema-cache pair
 *  for an unknown function or column.
 *
 *  42501 (insufficient privilege) is deliberately absent, though it looks like
 *  it belongs. Every definer function ships its grant in the same SQL file, so
 *  `authenticated` never legitimately lacks EXECUTE - which means a 42501 says
 *  the request reached Postgres carrying the `anon` role, from a stale or
 *  not-yet-refreshed JWT. That is transient, and latching on it disabled
 *  invites, friends, presence and the online count for the rest of the page
 *  load over a moment of bad timing. Feature detection loses nothing: a
 *  function that was never created reports 42883 or PGRST202 instead.
 *
 *  The cost is that a grant genuinely lost to a `drop function` and recreate
 *  now retries instead of disabling. Every caller is throttled - 60 s polls,
 *  a 20 s read gap on invites - so that is one request a minute, not a loop. */
const FATAL = new Set(['42703', '42883', 'PGRST202', 'PGRST204'])

export function isFatalSchemaError(error: { code?: string | null } | null | undefined): boolean {
    return !!error?.code && FATAL.has(error.code)
}
