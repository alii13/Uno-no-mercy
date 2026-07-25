import { describe, it, expect } from 'vitest'
import { buildActivityGrid, localISODate } from '../activity'

// Fixed reference: Wednesday 2026-07-22. Week columns run Mon..Sun.
const TODAY = new Date(2026, 6, 22)

describe('localISODate', () => {
    it('formats local dates with zero padding', () => {
        expect(localISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
        expect(localISODate(new Date(2026, 11, 31))).toBe('2026-12-31')
    })
})

describe('buildActivityGrid', () => {
    it('returns the requested number of week columns, 7 cells each', () => {
        const grid = buildActivityGrid([], 12, TODAY)
        expect(grid).toHaveLength(12)
        for (const week of grid) expect(week.cells).toHaveLength(7)
    })

    it('ends on the week containing today, later cells flagged future', () => {
        const grid = buildActivityGrid([], 4, TODAY)
        const last = grid[3]!.cells
        expect(last[2]!.date).toBe('2026-07-22') // Wednesday = row 2
        expect(last[2]!.future).toBe(false)
        expect(last[3]!.future).toBe(true) // Thursday onward hasn't happened
        expect(last[6]!.future).toBe(true)
    })

    it('aligns every column to start on a Monday', () => {
        const grid = buildActivityGrid([], 6, TODAY)
        for (const week of grid) {
            expect(new Date(week.cells[0]!.date + 'T00:00').getDay()).toBe(1)
        }
    })

    it('maps day rows onto cells with losses derived', () => {
        const grid = buildActivityGrid(
            [{ day: '2026-07-20', games: 5, wins: 3 }],
            2,
            TODAY,
        )
        const cell = grid[1]!.cells[0]! // Monday of the current week
        expect(cell.games).toBe(5)
        expect(cell.wins).toBe(3)
        expect(cell.losses).toBe(2)
    })

    it('tones cells by net result: win, loss, even, empty', () => {
        const grid = buildActivityGrid(
            [
                { day: '2026-07-20', games: 3, wins: 2 }, // more wins
                { day: '2026-07-21', games: 3, wins: 1 }, // more losses
                { day: '2026-07-22', games: 4, wins: 2 }, // split
            ],
            2,
            TODAY,
        )
        const week = grid[1]!.cells
        expect(week[0]!.tone).toBe('win')
        expect(week[1]!.tone).toBe('loss')
        expect(week[2]!.tone).toBe('even')
        expect(grid[0]!.cells[0]!.tone).toBeNull() // no games that day
    })

    it('levels intensity by games played', () => {
        const grid = buildActivityGrid(
            [
                { day: '2026-07-13', games: 1, wins: 1 },
                { day: '2026-07-14', games: 3, wins: 0 },
                { day: '2026-07-15', games: 6, wins: 3 },
            ],
            2,
            TODAY,
        )
        const week = grid[0]!.cells
        expect(week[0]!.level).toBe(1)
        expect(week[1]!.level).toBe(2)
        expect(week[2]!.level).toBe(3)
        expect(week[3]!.level).toBe(0)
    })

    it('drops the first label when the month changes on the second column', () => {
        // 26 weeks back from Sat 2026-07-25 starts Mon Jan 26 — a one-week
        // stub of January that would render as "JAN FEB" glued together.
        const grid = buildActivityGrid([], 26, new Date(2026, 6, 25))
        expect(grid[0]!.label).toBeNull()
        expect(grid[1]!.label).toBe('FEB')
    })

    it('labels the first column and every month change', () => {
        // 8 weeks back from 2026-07-22 spans June and July.
        const grid = buildActivityGrid([], 8, TODAY)
        expect(grid[0]!.label).not.toBeNull()
        const labels = grid.map(w => w.label).filter(Boolean)
        expect(labels).toContain('JUN')
        expect(labels).toContain('JUL')
        // A label marks a change — never two identical labels in a row.
        for (let i = 1; i < grid.length; i++) {
            if (grid[i]!.label) expect(grid[i]!.label).not.toBe(grid[i - 1]!.label)
        }
    })
})
