/**
 * ISO alpha-2 → readable country name for the leaderboard's country filter.
 *
 * `Intl.DisplayNames` ships in every browser we support, so there is no
 * country table in the bundle. When the runtime lacks the API or the code
 * names nothing, the code itself is a usable label — `ZZ` beats a blank row.
 */

let displayNames: Intl.DisplayNames | null | undefined

function resolver(): Intl.DisplayNames | null {
    if (displayNames === undefined) {
        try {
            displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
        } catch {
            displayNames = null
        }
    }
    return displayNames
}

/** '' for a missing or malformed code, so callers can hide the row. */
export function countryName(iso: string | null | undefined): string {
    if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return ''
    const code = iso.toUpperCase()
    try {
        return resolver()?.of(code) ?? code
    } catch {
        return code
    }
}
