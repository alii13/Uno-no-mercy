/**
 * Rank ladder — win-count thresholds. Shared by the stats dashboard and the
 * seat chips so a player's rank reads identically everywhere they're seen.
 */

export interface Rank {
    threshold: number
    title: string
    color: string
}

export const RANKS: Rank[] = [
    { threshold: 0, title: 'Recruit', color: '#888' },
    { threshold: 5, title: 'Rookie', color: '#4CAF50' },
    { threshold: 15, title: 'Enforcer', color: '#2196F3' },
    { threshold: 30, title: 'Savage', color: '#FF9800' },
    { threshold: 50, title: 'Warlord', color: '#f44336' },
    { threshold: 100, title: 'Overlord', color: '#9C27B0' },
    { threshold: 200, title: 'No Mercy King', color: '#FFD700' },
]

export function rankFor(wins: number): Rank {
    let current = RANKS[0]!
    for (const r of RANKS) {
        if (wins >= r.threshold) current = r
    }
    return current
}
