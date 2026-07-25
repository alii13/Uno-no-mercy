/**
 * Profile activity heatmap grid (GitHub-contribution style). Pure layout
 * math over the per-day rows from profile_activity() — weeks are columns,
 * Monday-first, ending on the week that contains today.
 */

export interface ActivityDay {
    day: string // YYYY-MM-DD, already bucketed in the viewer's timezone
    games: number
    wins: number
}

export interface ActivityCell {
    date: string
    games: number
    wins: number
    losses: number
    /** Intensity by games that day: 0 none, 1 = 1–2, 2 = 3–5, 3 = 6+ */
    level: 0 | 1 | 2 | 3
    /** Net result: more wins = 'win', more losses = 'loss', split = 'even' */
    tone: 'win' | 'loss' | 'even' | null
    future: boolean
}

export interface ActivityWeek {
    /** Month short name above the column where a new month starts. */
    label: string | null
    cells: ActivityCell[]
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

export function localISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function level(games: number): ActivityCell['level'] {
    if (games <= 0) return 0
    if (games <= 2) return 1
    if (games <= 5) return 2
    return 3
}

function tone(games: number, wins: number): ActivityCell['tone'] {
    if (games <= 0) return null
    const losses = games - wins
    if (wins > losses) return 'win'
    if (losses > wins) return 'loss'
    return 'even'
}

export function buildActivityGrid(rows: ActivityDay[], weeks: number, today: Date): ActivityWeek[] {
    const byDay = new Map(rows.map(r => [r.day, r]))
    const todayKey = localISODate(today)

    // Monday of the current week, then back (weeks - 1) full weeks.
    const start = new Date(today)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7)

    const grid: ActivityWeek[] = []
    const cursor = new Date(start)
    let prevMonth = -1
    for (let w = 0; w < weeks; w++) {
        const month = cursor.getMonth()
        const label = month !== prevMonth ? (MONTHS[month] ?? null) : null
        prevMonth = month
        const cells: ActivityCell[] = []
        for (let d = 0; d < 7; d++) {
            const date = localISODate(cursor)
            const row = byDay.get(date)
            const games = row?.games ?? 0
            const wins = row?.wins ?? 0
            cells.push({
                date,
                games,
                wins,
                losses: games - wins,
                level: level(games),
                tone: tone(games, wins),
                future: date > todayKey,
            })
            cursor.setDate(cursor.getDate() + 1)
        }
        grid.push({ label, cells })
    }
    // A partial first month would render two labels glued together —
    // keep the one that marks the real month start.
    if (grid[0]?.label && grid[1]?.label) grid[0].label = null
    return grid
}
