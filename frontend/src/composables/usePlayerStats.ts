import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useRetentionStore } from '../stores/retentionStore'
import { badgeFor, pointsFromRows, pointsFromRetention, applyDecay, daysIdleFromRows, progressToNext } from '../utils/badges'

function daysIdleFromDate(dateStr: string | null): number {
  if (!dateStr) return 0
  const then = Date.parse(`${dateStr}T00:00:00`)
  if (Number.isNaN(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

interface GameResult {
  id: string
  game_id: string
  result: 'won' | 'lost' | 'eliminated' | 'abandoned'
  opponent_count: number
  cards_remaining: number
  peak_cards: number
  draw_cards_played: number
  wild_cards_played: number
  cards_played_total: number
  skips_dealt: number
  swaps_made: number
  draws_taken: number
  biggest_stack_survived: number
  uno_calls: number
  uno_penalties: number
  game_duration_secs: number
  is_bot_game: boolean
  played_at: string
}



export function usePlayerStats() {
  const authStore = useAuthStore()
  const retention = useRetentionStore()
  const results = ref<GameResult[]>([])
  const loading = ref(false)

  async function fetchStats() {
    const userId = authStore.user?.id
    if (!userId) return

    loading.value = true
    try {
      const { data } = await supabase
        .from('game_results')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })

      results.value = (data || []) as GameResult[]
    } catch {
      // Offline / RLS rejection — show what we have rather than a stuck spinner.
    } finally {
      loading.value = false
    }
  }

  // Core stats
  const gamesPlayed = computed(() => results.value.length)
  const gamesWon = computed(() => results.value.filter(r => r.result === 'won').length)
  const gamesLost = computed(() => results.value.filter(r => r.result === 'lost').length)
  const gamesEliminated = computed(() => results.value.filter(r => r.result === 'eliminated').length)
  const winRate = computed(() => gamesPlayed.value === 0 ? 0 : Math.round((gamesWon.value / gamesPlayed.value) * 100))

  // Bot vs multiplayer
  const botGames = computed(() => results.value.filter(r => r.is_bot_game))
  const mpGames = computed(() => results.value.filter(r => !r.is_bot_game))
  const botWinRate = computed(() => botGames.value.length === 0 ? 0 : Math.round((botGames.value.filter(r => r.result === 'won').length / botGames.value.length) * 100))
  const mpWinRate = computed(() => mpGames.value.length === 0 ? 0 : Math.round((mpGames.value.filter(r => r.result === 'won').length / mpGames.value.length) * 100))

  // Streaks
  const currentStreak = computed(() => {
    if (results.value.length === 0) return { type: 'none' as const, count: 0 }
    const first = results.value[0]!.result === 'won' ? 'W' : 'L'
    let count = 0
    for (const r of results.value) {
      const t = r.result === 'won' ? 'W' : 'L'
      if (t === first) count++
      else break
    }
    return { type: first as 'W' | 'L', count }
  })

  const bestWinStreak = computed(() => {
    let best = 0
    let current = 0
    for (const r of [...results.value].reverse()) {
      if (r.result === 'won') {
        current++
        if (current > best) best = current
      } else {
        current = 0
      }
    }
    return best
  })

  // Aggregated stats
  const totalCardsPlayed = computed(() => results.value.reduce((sum, r) => sum + r.cards_played_total, 0))
  const totalDrawCardsPlayed = computed(() => results.value.reduce((sum, r) => sum + r.draw_cards_played, 0))
  const totalWildCardsPlayed = computed(() => results.value.reduce((sum, r) => sum + r.wild_cards_played, 0))
  const totalSkipsDealt = computed(() => results.value.reduce((sum, r) => sum + r.skips_dealt, 0))
  const totalSwapsMade = computed(() => results.value.reduce((sum, r) => sum + r.swaps_made, 0))
  const totalDrawsTaken = computed(() => results.value.reduce((sum, r) => sum + r.draws_taken, 0))
  const totalUnoCalls = computed(() => results.value.reduce((sum, r) => sum + r.uno_calls, 0))
  const totalUnoPenalties = computed(() => results.value.reduce((sum, r) => sum + r.uno_penalties, 0))
  const biggestStackSurvived = computed(() => results.value.reduce((max, r) => Math.max(max, r.biggest_stack_survived), 0))
  const peakCardsEver = computed(() => results.value.reduce((max, r) => Math.max(max, r.peak_cards), 0))
  const avgCardsRemainingOnLoss = computed(() => {
    const losses = results.value.filter(r => r.result !== 'won' && r.cards_remaining > 0)
    if (losses.length === 0) return 0
    return Math.round(losses.reduce((sum, r) => sum + r.cards_remaining, 0) / losses.length)
  })

  // Ruthlessness score (draw cards per game avg)
  const ruthlessness = computed(() => {
    if (gamesPlayed.value === 0) return 0
    return +(totalDrawCardsPlayed.value / gamesPlayed.value).toFixed(1)
  })

  // Total damage dealt (sum of all draw card values played)
  const totalDamageDealt = computed(() => results.value.reduce((sum, r) => sum + r.draw_cards_played, 0))

  // Badge — cumulative points with floored inactivity decay. Signed-in players
  // read their real server history; guests fall back to the local estimate so
  // their badge still climbs (and jumps up when they claim an account).
  const badgePoints = computed(() => {
    if (authStore.user?.id) {
      return applyDecay(pointsFromRows(results.value), daysIdleFromRows(results.value, Date.now()))
    }
    const earned = pointsFromRetention({
      gamesPlayed: retention.gamesPlayed,
      gamesWon: retention.gamesWon,
      unoCalls: retention.totalUnos,
    })
    return applyDecay(earned, daysIdleFromDate(retention.lastPlayedDate))
  })
  const badge = computed(() => badgeFor(badgePoints.value))
  const badgeProgress = computed(() => progressToNext(badgePoints.value))

  // Recent games (last 10)
  const recentGames = computed(() => results.value.slice(0, 10))

  // Average game duration
  const avgGameDuration = computed(() => {
    if (gamesPlayed.value === 0) return 0
    return Math.round(results.value.reduce((sum, r) => sum + r.game_duration_secs, 0) / gamesPlayed.value)
  })

  onMounted(fetchStats)

  return {
    loading,
    results,
    fetchStats,
    gamesPlayed,
    gamesWon,
    gamesLost,
    gamesEliminated,
    winRate,
    botWinRate,
    mpWinRate,
    currentStreak,
    bestWinStreak,
    totalCardsPlayed,
    totalDrawCardsPlayed,
    totalWildCardsPlayed,
    totalSkipsDealt,
    totalSwapsMade,
    totalDrawsTaken,
    totalUnoCalls,
    totalUnoPenalties,
    biggestStackSurvived,
    peakCardsEver,
    avgCardsRemainingOnLoss,
    ruthlessness,
    totalDamageDealt,
    badge,
    badgePoints,
    badgeProgress,
    recentGames,
    avgGameDuration,
  }
}
