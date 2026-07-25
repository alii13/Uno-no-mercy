<template>
  <div class="lb-page">
    <header class="lb-topbar">
      <button class="back-link" @click="$emit('back')">&larr; BACK</button>
      <h1 class="lb-title">LEADERBOARDS</h1>
      <span class="lb-topbar-spacer" aria-hidden="true"></span>
    </header>

    <div class="lb-body">
      <!-- Weekly spotlights: three skill archetypes get famous, not just
           the win grinders. -->
      <div v-if="lb.spotlights.value.length" class="lb-spotlights">
        <button
          v-for="s in lb.spotlights.value"
          :key="s.kind"
          class="lb-spot"
          :disabled="!s.share_code"
          @click="s.share_code && navigate({ name: 'profile', code: s.share_code })"
        >
          <span class="lb-spot-kind">
            <component :is="SPOT_META[s.kind].icon" :size="11" aria-hidden="true" />
            {{ SPOT_META[s.kind].label }}
          </span>
          <span class="lb-spot-value">{{ SPOT_META[s.kind].fmt(s.value) }}</span>
          <span class="lb-spot-name">{{ s.username }} {{ flagEmoji(s.country) }}</span>
        </button>
      </div>

      <div class="lb-tabs" role="tablist">
        <button
          class="lb-tab"
          :class="{ active: tab === 'daily' }"
          role="tab"
          :aria-selected="tab === 'daily'"
          @click="switchTab('daily')"
        >
          TODAY'S CHALLENGE
        </button>
        <button
          class="lb-tab"
          :class="{ active: tab === 'weekly' }"
          role="tab"
          :aria-selected="tab === 'weekly'"
          @click="switchTab('weekly')"
        >
          THIS WEEK
        </button>
      </div>

      <p v-if="lb.loading.value" class="lb-empty">LOADING...</p>

      <template v-else-if="tab === 'daily'">
        <p v-if="lb.daily.value.length === 0" class="lb-empty">
          No one has played today's deal yet. Be first.
        </p>
        <ol v-else ref="listEl" class="lb-list">
          <li v-for="row in lb.daily.value" :key="row.rank" class="lb-row" :class="{ me: row.is_me }">
            <span class="lb-rank" :class="medalClass(row.rank)">{{ row.rank }}</span>
            <CardBack
              class="lb-skin"
              :size="{ width: 18, height: 25 }"
              :accent="skinColors(row.skin ?? undefined).accent"
              :stripe="skinColors(row.skin ?? undefined).stripe"
              aria-hidden="true"
            />
            <button
              v-if="row.share_code"
              class="lb-name lb-name--link"
              @click="navigate({ name: 'profile', code: row.share_code })"
            >
              {{ row.is_me ? 'YOU' : row.username }}
            </button>
            <span v-else class="lb-name">{{ row.is_me ? 'YOU' : row.username }}</span>
            <span v-if="flagEmoji(row.country)" class="lb-flag" :title="row.country ?? ''">{{ flagEmoji(row.country) }}</span>
            <span
              v-if="row.lifetime_wins !== undefined"
              class="lb-chip"
              :style="{ color: rankFor(row.lifetime_wins).color, borderColor: rankFor(row.lifetime_wins).color }"
            >
              {{ rankFor(row.lifetime_wins).title }}
            </span>
            <span class="lb-score">
              {{ row.result === 'won' ? `${row.effort} MOVES · ${clock(row.duration_secs)}` : row.result.toUpperCase() }}
            </span>
          </li>
        </ol>
        <p v-if="contextLine('daily')" class="lb-context">{{ contextLine('daily') }}</p>
      </template>

      <template v-else>
        <p v-if="lb.weekly.value.length === 0" class="lb-empty">No wins recorded this week yet.</p>
        <ol v-else ref="listEl" class="lb-list">
          <li v-for="row in lb.weekly.value" :key="row.rank" class="lb-row" :class="{ me: row.is_me }">
            <span class="lb-rank" :class="medalClass(row.rank)">{{ row.rank }}</span>
            <CardBack
              class="lb-skin"
              :size="{ width: 18, height: 25 }"
              :accent="skinColors(row.skin ?? undefined).accent"
              :stripe="skinColors(row.skin ?? undefined).stripe"
              aria-hidden="true"
            />
            <button
              v-if="row.share_code"
              class="lb-name lb-name--link"
              @click="navigate({ name: 'profile', code: row.share_code })"
            >
              {{ row.is_me ? 'YOU' : row.username }}
            </button>
            <span v-else class="lb-name">{{ row.is_me ? 'YOU' : row.username }}</span>
            <span v-if="flagEmoji(row.country)" class="lb-flag" :title="row.country ?? ''">{{ flagEmoji(row.country) }}</span>
            <span
              v-if="row.lifetime_wins !== undefined"
              class="lb-chip"
              :style="{ color: rankFor(row.lifetime_wins).color, borderColor: rankFor(row.lifetime_wins).color }"
            >
              {{ rankFor(row.lifetime_wins).title }}
            </span>
            <span class="lb-score">{{ row.wins }}W · {{ row.games }} GAMES</span>
          </li>
        </ol>
        <p v-if="contextLine('weekly')" class="lb-context">{{ contextLine('weekly') }}</p>
      </template>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { Zap, Shield, Crown } from 'lucide-vue-next'
import gsap from 'gsap'
import { useLeaderboard } from '../composables/useLeaderboard'
import { useMotion } from '../composables/useMotion'
import { navigate } from '../utils/routes'
import { skinColors } from '../utils/cosmetics'
import { flagEmoji } from '../utils/country'
import { rankFor } from '../utils/ranks'
import CardBack from './game/CardBack.vue'
import SiteFooter from './SiteFooter.vue'

defineEmits<{ (e: 'back'): void }>()

const lb = useLeaderboard()
const tab = ref<'daily' | 'weekly'>('daily')
const listEl = ref<HTMLElement | null>(null)
const motion = useMotion()

function switchTab(next: 'daily' | 'weekly') {
  if (tab.value === next) return
  tab.value = next
}

function medalClass(rank: number): string {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : ''
}

function clock(secs: number): string {
  if (!secs || secs <= 0) return '—'
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

const SPOT_META = {
  fastest_win: { label: 'FASTEST WIN', icon: Zap, fmt: clock },
  biggest_stack: { label: 'STACK SURVIVOR', icon: Shield, fmt: (v: number) => `+${v}` },
  most_wins: { label: 'MOST WINS', icon: Crown, fmt: (v: number) => `${v}W` },
} as const

function contextLine(which: 'daily' | 'weekly'): string {
  const ctx = which === 'daily' ? lb.dailyContext.value : lb.weeklyContext.value
  if (!ctx || !ctx.total_players) return ''
  const scope = which === 'daily' ? 'TODAY' : 'THIS WEEK'
  if (!ctx.my_rank) return `${ctx.total_players} PLAYERS ${scope}`
  const pct = Math.max(1, Math.ceil((ctx.my_rank / ctx.total_players) * 100))
  return `YOU'RE #${ctx.my_rank} · TOP ${pct}% OF ${ctx.total_players} PLAYERS ${scope}`
}

// Rows stagger in on load and tab switch. Final state matches the natural
// layout and clears inline props, so GSAP never fights Vue's rendering.
function animateRows() {
  const rows = listEl.value?.querySelectorAll('.lb-row')
  if (!rows?.length || motion.reduced) return
  gsap.set(rows, { opacity: 0, y: 8 })
  motion.soft(rows, { opacity: 1, y: 0, stagger: 0.025, clearProps: 'all' })
}

watch([tab, () => lb.loading.value], async () => {
  await nextTick()
  animateRows()
})

onMounted(() => { void lb.fetchBoards() })
</script>

<style scoped>
.lb-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-void, #0a0a0a);
}

.lb-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-4) var(--spacing-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.back-link {
  background: none;
  border: none;
  padding: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
}

.back-link:hover {
  color: var(--color-neon-blue);
}

.lb-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  letter-spacing: 0.14em;
  color: var(--text-primary);
  margin: 0;
}

/* Balances the back link so the title stays centered. */
.lb-topbar-spacer {
  width: 72px;
}

.lb-body {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.lb-spotlights {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-2);
}

.lb-spot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--spacing-3) var(--spacing-2);
  background: rgba(255, 204, 0, 0.04);
  border: 1px solid rgba(255, 204, 0, 0.25);
  border-radius: var(--radius-sm);
  cursor: pointer;
  min-width: 0;
}

.lb-spot:disabled { cursor: default; }

.lb-spot:hover:not(:disabled) {
  border-color: rgba(255, 204, 0, 0.6);
}

.lb-spot-kind {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  white-space: nowrap;
}

.lb-spot-value {
  font-family: var(--font-display);
  font-size: 1.1rem;
  color: var(--color-hazard, #ffcc00);
}

.lb-spot-name {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .lb-spotlights { grid-template-columns: 1fr; }
  .lb-spot { flex-direction: row; justify-content: space-between; gap: var(--spacing-2); }
}

.lb-tabs {
  display: flex;
  gap: var(--spacing-2);
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-void, #0a0a0a);
  padding: var(--spacing-2) 0;
}

.lb-tab {
  flex: 1;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--text-muted);
  cursor: pointer;
  min-height: 44px;
}

.lb-tab.active {
  border-color: rgba(0, 229, 255, 0.5);
  color: var(--color-neon-blue);
  background: rgba(0, 229, 255, 0.05);
}

.lb-empty {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--spacing-8) 0;
  margin: 0;
}

.lb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.lb-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.lb-row.me {
  background: rgba(0, 229, 255, 0.06);
  border: 1px solid rgba(0, 229, 255, 0.35);
  border-radius: var(--radius-sm);
}

.lb-rank {
  width: 2.2rem;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-muted);
  font-size: var(--text-sm);
  letter-spacing: 0.04em;
}

.lb-rank.gold { color: #ffd700; text-shadow: 0 0 8px rgba(255, 215, 0, 0.45); }
.lb-rank.silver { color: #c9ced6; text-shadow: 0 0 8px rgba(201, 206, 214, 0.35); }
.lb-rank.bronze { color: #cd7f32; text-shadow: 0 0 8px rgba(205, 127, 50, 0.35); }

.lb-skin {
  flex-shrink: 0;
  border-radius: 3px;
  box-shadow: none;
}

.lb-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  letter-spacing: 0.04em;
}

.lb-row.me .lb-name {
  color: var(--color-neon-blue);
}

.lb-name--link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(255, 255, 255, 0.2);
  text-underline-offset: 3px;
}

.lb-name--link:hover {
  color: var(--color-neon-blue);
  text-decoration-color: var(--color-neon-blue);
}

.lb-flag {
  flex-shrink: 0;
  font-size: var(--text-sm);
  line-height: 1;
}

.lb-chip {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  border: 1px solid;
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
  opacity: 0.85;
  flex-shrink: 0;
}

.lb-score {
  flex-shrink: 0;
  color: rgba(0, 229, 255, 0.85);
  letter-spacing: 0.06em;
  font-size: var(--text-xs);
}

.lb-context {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--color-hazard, #ffcc00);
  text-align: center;
  border: 1px solid rgba(255, 204, 0, 0.3);
  background: rgba(255, 204, 0, 0.05);
  border-radius: var(--radius-sm);
  padding: var(--spacing-3);
  margin: 0;
}

@media (max-width: 480px) {
  .lb-chip { display: none; }
  .lb-score { font-size: 0.65rem; }
  .lb-row { gap: var(--spacing-2); padding: var(--spacing-3) var(--spacing-2); }
}
</style>
