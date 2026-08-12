<template>
  <div class="bp-page">
    <header class="bp-topbar">
      <button class="back-link" @click="$emit('back')">&larr; BACK</button>
      <h1 class="bp-title">BADGES</h1>
      <span class="bp-spacer" aria-hidden="true"></span>
    </header>

    <div class="bp-body">
      <!-- Your standing, if you've played -->
      <section v-if="showOwn" class="bp-you">
        <Badge :badge="badge" size="full" :progress="badgeProgress" />
        <p class="bp-you-line">
          You're a <strong :style="{ color: badge.color }">{{ badge.title }}</strong>
          with {{ badgePoints.toLocaleString() }} points.
          <template v-if="badgeProgress.next">
            {{ badgeProgress.needed.toLocaleString() }} more to {{ badgeProgress.next.title }}.
          </template>
          <template v-else>You've hit the top. Respect.</template>
        </p>
      </section>

      <!-- Plain-language intro -->
      <section class="bp-intro">
        <h2 class="bp-h2">How it works</h2>
        <p>
          Every game you play earns points. Points add up over time and lift you
          through ten badges, from Recruit to No Mercy King. Your badge shows on
          every table you sit at, so everyone sees how far you've climbed.
        </p>
        <p>
          A badge is yours to keep - you never drop one you've earned. But if you
          stop showing up, your progress toward the <em>next</em> badge slips a
          little each day. Play again and it starts building right back.
        </p>
      </section>

      <!-- The ladder -->
      <section class="bp-ladder">
        <h2 class="bp-h2">The ten badges</h2>
        <ul class="bp-tiers">
          <li v-for="t in BADGES" :key="t.tier" class="bp-tier" :class="{ here: showOwn && t.tier === badge.tier }">
            <Badge :badge="t" size="chip" class="bp-tier-badge" />
            <span class="bp-tier-pts">{{ t.threshold === 0 ? 'Start' : t.threshold.toLocaleString() + ' pts' }}</span>
            <span class="bp-tier-feel">{{ FEEL[t.tier - 1] }}</span>
          </li>
        </ul>
      </section>

      <!-- Earning table -->
      <section class="bp-earn">
        <h2 class="bp-h2">How you earn points</h2>
        <ul class="bp-earn-list">
          <li v-for="e in EARN" :key="e.label">
            <span class="bp-earn-label">{{ e.label }}</span>
            <span class="bp-earn-pts">+{{ e.points }}</span>
          </li>
        </ul>
        <p class="bp-fine">
          Quit games and walkovers don't count - a badge has to be earned at the table.
        </p>
      </section>

      <SiteFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BADGES, POINT_WEIGHTS } from '../utils/badges'
import { usePlayerStats } from '../composables/usePlayerStats'
import Badge from './Badge.vue'
import SiteFooter from './SiteFooter.vue'

defineEmits<{ (e: 'back'): void }>()

const { badge, badgePoints, badgeProgress } = usePlayerStats()
const showOwn = computed(() => badgePoints.value > 0)

const FEEL = [
  'Everyone starts here',
  'First few games in',
  'Getting the hang of it',
  'A regular at the table',
  'Committed to the deck',
  'A serious player',
  'Rare at any table',
  'Very rare',
  'Notable across the board',
  'The apex - months of play',
]

const EARN = [
  { label: 'Win a game', points: POINT_WEIGHTS.win },
  { label: "Finish a game you're losing", points: POINT_WEIGHTS.completedLoss },
  { label: 'Each draw card you play', points: POINT_WEIGHTS.drawCard },
  { label: 'Per card in the biggest stack you survive', points: POINT_WEIGHTS.stackSurvived },
  { label: 'Call "Mercy!"', points: POINT_WEIGHTS.unoCall },
  { label: 'Show up and play (per day)', points: POINT_WEIGHTS.dayPlayed },
]
</script>

<style scoped>
.bp-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #0a0a0b;
  color: #e6e6e6;
  display: flex;
  flex-direction: column;
}

.bp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.back-link {
  background: none;
  border: none;
  color: #a1a1aa;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  cursor: pointer;
}
.back-link:hover { color: #e6e6e6; }
.bp-title {
  font-family: var(--font-display), sans-serif;
  font-size: 1.3rem;
  letter-spacing: 0.18em;
  margin: 0;
}
.bp-spacer { width: 48px; }

.bp-body {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-8);
  flex: 1;
}

.bp-you {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  text-align: center;
}
.bp-you-line { margin: 0; color: #cfcfd4; font-size: 0.95rem; line-height: 1.5; }

.bp-h2 {
  font-family: var(--font-display), sans-serif;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #ffcc00;
  margin: 0 0 var(--spacing-3);
}
.bp-intro p {
  margin: 0 0 var(--spacing-3);
  color: #cfcfd4;
  line-height: 1.6;
}
.bp-intro em { color: #e6e6e6; font-style: italic; }

.bp-tiers {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}
.bp-tier {
  display: grid;
  grid-template-columns: minmax(120px, 1.2fr) auto 1.6fr;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: 10px;
  border: 1px solid transparent;
}
.bp-tier.here {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.14);
}
.bp-tier-pts {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: #a1a1aa;
  white-space: nowrap;
  text-align: right;
}
.bp-tier-feel {
  font-size: 0.8rem;
  color: #8a8f98;
}

.bp-earn-list {
  list-style: none;
  margin: 0 0 var(--spacing-3);
  padding: 0;
  display: flex;
  flex-direction: column;
}
.bp-earn-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.bp-earn-label { color: #cfcfd4; font-size: 0.9rem; }
.bp-earn-pts {
  font-family: var(--font-mono);
  font-weight: 700;
  color: #5ed17c;
  white-space: nowrap;
}
.bp-fine { margin: 0; color: #8a8f98; font-size: 0.8rem; line-height: 1.5; }

@media (max-width: 480px) {
  .bp-tier {
    grid-template-columns: 1fr auto;
    grid-template-areas: 'badge pts' 'feel feel';
    row-gap: var(--spacing-1);
  }
  .bp-tier-badge { grid-area: badge; }
  .bp-tier-pts { grid-area: pts; }
  .bp-tier-feel { grid-area: feel; }
}
</style>
