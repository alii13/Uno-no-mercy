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
 *  forever": undefined column, undefined function, insufficient privilege,
 *  and the schema-cache pair for an unknown function or column. */
const FATAL = new Set(['42703', '42883', '42501', 'PGRST202', 'PGRST204'])

export function isFatalSchemaError(error: { code?: string | null } | null | undefined): boolean {
    return !!error?.code && FATAL.has(error.code)
}
