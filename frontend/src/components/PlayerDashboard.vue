<template>
  <div class="dashboard-container">
    <!-- Top bar — mirrors landing/lobby pattern -->
    <header class="dashboard-top-bar">
      <button class="back-link" @click="$emit('back')">
        <ChevronLeft :size="14" :stroke-width="2" aria-hidden="true" />
        BACK
      </button>

      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">OPEN</span>
        <span class="brand-mark-nomercy">MERCY</span>
      </a>

      <button
        v-if="gamesPlayed > 0"
        class="share-link"
        @click="generateShareCard"
      >
        SHARE STATS
      </button>
      <span v-else class="share-link-placeholder" aria-hidden="true"></span>
    </header>

    <div v-if="loading" class="state-screen">
      <p class="state-text">LOADING INTEL…</p>
    </div>

    <div v-else-if="gamesPlayed === 0" class="state-screen">
      <BarChart3 class="state-icon" :size="40" :stroke-width="2" aria-hidden="true" />
      <h2 class="state-title">NO DATA YET</h2>
      <p class="state-desc">Play your first game to start tracking stats.</p>
    </div>

    <!-- Dossier: badge rail, then who you are, then the record. Grid puts the
         rail beside the record on desktop and below the name on a phone. -->
    <div v-else class="dossier">
      <header class="who">
        <h1 class="who-name">
          {{ username }}<span v-if="flag" class="who-flag" aria-hidden="true">{{ flag }}</span>
        </h1>
        <p class="who-meta">
          <span v-if="memberSince" class="who-enlisted">Enlisted {{ memberSince }}</span>
          <span v-if="memberSince" class="who-sep who-enlisted" aria-hidden="true"></span>
          <span>{{ gamesPlayed }} games</span>
          <span class="who-sep" aria-hidden="true"></span>
          <span class="who-last">{{ lastPlayed }}</span>
        </p>
        <button
          v-if="authStore.profile?.share_code"
          class="public-profile-link"
          @click="navigate({ name: 'profile', code: authStore.profile.share_code })"
        >
          VIEW PUBLIC PROFILE <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </header>

      <aside class="rail">
        <Badge
          class="rail-badge"
          :badge="badge"
          size="full"
          :points="badgePoints"
          :progress="badgeProgress"
          link
        />
        <p class="rail-tier">TIER {{ badge.tier }} OF {{ BADGES.length }}</p>

        <div class="rail-points">
          <span class="rail-points-value">{{ badgePoints.toLocaleString() }}</span>
          <span class="rail-points-label">POINTS EARNED</span>
        </div>

        <ol class="ladder">
          <li
            v-for="tier in BADGES"
            :key="tier.tier"
            class="ladder-row"
            :class="{
              'ladder-row--current': tier.tier === badge.tier,
              'ladder-row--locked': tier.tier > badge.tier,
            }"
          >
            <Badge class="ladder-mark" :badge="tier" size="mark" />
            <span class="ladder-name">{{ tier.title }}</span>
            <span class="ladder-threshold">{{ tier.threshold.toLocaleString() }}</span>
          </li>
        </ol>
      </aside>

      <div class="record">
        <section v-if="standingAvailable && globalRank" class="panel">
          <h2 class="panel-title">STANDING</h2>
          <div class="standing">
            <div class="standing-cell">
              <p class="standing-label">GLOBAL RANK</p>
              <p class="standing-value">#{{ globalRank.rank!.toLocaleString() }}</p>
              <p class="standing-sub">
                of {{ globalRank.total.toLocaleString() }}<template v-if="topPercent"> · top {{ topPercent }}%</template>
              </p>
            </div>
            <div v-if="countryRank && flag" class="standing-cell">
              <p class="standing-label"><span class="standing-flag" aria-hidden="true">{{ flag }}</span> COUNTRY</p>
              <p class="standing-value">#{{ countryRank.rank!.toLocaleString() }}</p>
              <p class="standing-sub">of {{ countryRank.total.toLocaleString() }}</p>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">SERVICE RECORD</h2>
          <ul class="records">
            <li class="record-card">
              <p class="record-label">FASTEST WIN</p>
              <p class="record-value record-value--hazard">{{ fastestWin }}</p>
            </li>
            <li class="record-card">
              <p class="record-label">STACK EATEN</p>
              <p class="record-value">+{{ biggestStackSurvived }}</p>
            </li>
            <li class="record-card">
              <p class="record-label">LEANEST WIN</p>
              <p class="record-value">{{ leanestWin }}</p>
            </li>
            <li class="record-card">
              <p class="record-label">PEAK HELD</p>
              <p class="record-value">{{ peakCardsEver }}</p>
            </li>
            <li class="record-card">
              <p class="record-label">BEST RUN</p>
              <p class="record-value">{{ bestWinStreak }}</p>
            </li>
          </ul>
        </section>

        <section v-if="promotions.length" class="panel">
          <h2 class="panel-title">UPGRADES</h2>
          <ol class="upgrades">
            <li
              v-for="promotion in promotions"
              :key="promotion.badge.tier"
              class="upgrade"
              :class="{ 'upgrade--current': promotion.badge.tier === badge.tier }"
            >
              <Badge class="ladder-mark" :badge="promotion.badge" size="mark" />
              <span class="upgrade-name">{{ promotion.badge.title }}</span>
              <span class="upgrade-when">{{ formatDate(promotion.at) }} · {{ upgradeGap(promotion) }}</span>
            </li>
            <li v-if="badgeProgress.next" class="upgrade upgrade--next">
              <Badge class="ladder-mark ladder-mark--locked" :badge="badgeProgress.next" size="mark" />
              <span class="upgrade-name">{{ badgeProgress.next.title }}</span>
              <span class="upgrade-when">{{ badgeProgress.needed.toLocaleString() }} to go</span>
            </li>
          </ol>
        </section>

        <section class="panel">
          <h2 class="panel-title">ACTIVITY</h2>
          <ul class="activity">
            <li v-for="game in recentGames" :key="game.id" class="activity-row">
              <span class="activity-result" :class="'activity-result--' + game.result">
                {{ game.result.charAt(0).toUpperCase() }}
              </span>
              <span class="activity-body">
                <span class="activity-line">{{ game.cards_played_total }} cards in {{ formatDuration(game.game_duration_secs) }}</span>
                <span class="activity-sub">{{ game.is_bot_game ? 'BOT' : 'PVP' }} · {{ formatDate(game.played_at) }}</span>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- Share modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showShareModal"
          class="share-overlay"
          @click.self="showShareModal = false"
        >
          <div class="share-modal">
            <h3 class="share-modal-title">SHARE YOUR STATS</h3>
            <canvas
              ref="shareCanvas"
              width="600"
              height="400"
              class="share-preview"
            ></canvas>
            <div class="share-actions">
              <Button variant="primary" size="md" block @click="downloadCard">
                DOWNLOAD PNG
              </Button>
              <Button variant="secondary" size="md" block @click="shareToTwitter">
                SHARE TO X
              </Button>
              <Button variant="secondary" size="md" block @click="shareToWhatsApp">
                WHATSAPP
              </Button>
              <Button variant="ghost" size="md" block @click="copyShareLink">
                {{ copied ? 'COPIED' : 'COPY LINK' }}
              </Button>
            </div>
            <button class="link" @click="showShareModal = false">CLOSE</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight, BarChart3, ChevronLeft } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { usePlayerStats } from '../composables/usePlayerStats'
import { useProfileStanding } from '../composables/useProfileStanding'
import { useAuthStore } from '../stores/authStore'
import { navigate } from '../utils/routes'
import { BADGES } from '../utils/badges'
import { flagEmoji } from '../utils/country'
import { personalRecords } from '../utils/personalRecords'
import { promotionHistory, type Promotion } from '../utils/promotions'
import { relativeTime } from '../utils/relativeTime'
import Button from './ui/Button.vue'
import Badge from './Badge.vue'

defineEmits<{
  (e: 'back'): void
}>()

const authStore = useAuthStore()
// Stays reactive — a plain `authStore.username` snapshot would freeze on the
// 'Player' fallback when the dashboard mounts before the profile fetch lands.
const username = computed(() => authStore.username)
const shareCanvas = ref<HTMLCanvasElement | null>(null)
const showShareModal = ref(false)
const copied = ref(false)

const {
  loading, results, gamesPlayed, gamesWon, gamesLost, gamesEliminated,
  winRate, currentStreak, bestWinStreak,
  totalCardsPlayed, biggestStackSurvived,
  peakCardsEver, ruthlessness,
  badge, badgePoints, badgeProgress, recentGames,
} = usePlayerStats()

const {
  available: standingAvailable,
  globalRank,
  countryRank,
} = useProfileStanding()

const flag = computed(() => flagEmoji(authStore.profile?.country))

const memberSince = computed(() => {
  const iso = authStore.profile?.created_at
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
})

// Your own page always knows you are online, so a presence dot would say
// nothing. When you last played is the live line that actually informs.
const lastPlayed = computed(() => {
  const newest = results.value[0]?.played_at
  return newest ? `Last played ${relativeTime(newest)}` : 'No games yet'
})

const promotions = computed<Promotion[]>(() => promotionHistory(results.value))

const records = computed(() => personalRecords(results.value))
const fastestWin = computed(() =>
  records.value.fastestWinSecs === null ? '—' : formatDuration(records.value.fastestWinSecs),
)
const leanestWin = computed(() =>
  records.value.leanestWinCards === null ? '—' : String(records.value.leanestWinCards),
)

/** Rounded up, so the very top of the board never reads "top 0%". */
const topPercent = computed(() => {
  const g = globalRank.value
  if (!g?.rank || g.total <= 0) return 0
  return Math.max(1, Math.ceil((g.rank / g.total) * 100))
})

function upgradeGap(promotion: Promotion): string {
  const days = promotion.daysSincePrevious
  if (days === null) return 'joined'
  if (days === 0) return 'same day'
  return days === 1 ? '1 day later' : `${days} days later`
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}m ${s}s`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getShareText() {
  return `I'm a ${badge.value.title} in Open Mercy - ${winRate.value}% win rate across ${gamesPlayed.value} games. Think you can beat me?`
}

function renderShareCanvas() {
  const canvas = shareCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#0a0a0b'
  ctx.fillRect(0, 0, 600, 400)

  ctx.strokeStyle = '#ffcc00'
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 580, 380)

  ctx.fillStyle = '#e6e6e6'
  ctx.font = 'bold 28px monospace'
  ctx.fillText('OPEN MERCY', 30, 55)

  ctx.fillStyle = badge.value.color
  ctx.font = 'bold 18px monospace'
  ctx.fillText(badge.value.title.toUpperCase(), 30, 85)

  ctx.fillStyle = '#a1a1aa'
  ctx.font = '16px monospace'
  ctx.fillText(username.value, 280, 55)

  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(30, 100)
  ctx.lineTo(570, 100)
  ctx.stroke()

  const statsY = 140
  ctx.fillStyle = '#e6e6e6'
  ctx.font = 'bold 32px monospace'
  ctx.fillText(String(gamesPlayed.value), 30, statsY)
  ctx.fillText(winRate.value + '%', 180, statsY)
  ctx.fillText(currentStreak.value.type + String(currentStreak.value.count), 330, statsY)
  ctx.fillText(String(ruthlessness.value), 470, statsY)

  ctx.fillStyle = '#52525b'
  ctx.font = '12px monospace'
  ctx.fillText('GAMES', 30, statsY + 20)
  ctx.fillText('WIN RATE', 180, statsY + 20)
  ctx.fillText('STREAK', 330, statsY + 20)
  ctx.fillText('RUTHLESS', 470, statsY + 20)

  ctx.fillStyle = '#ffcc00'
  ctx.font = '14px monospace'
  const hlY = 210
  ctx.fillText(`Biggest stack survived: +${biggestStackSurvived.value}`, 30, hlY)
  ctx.fillText(`Best win streak: ${bestWinStreak.value}`, 30, hlY + 25)
  ctx.fillText(`Peak cards held: ${peakCardsEver.value}`, 30, hlY + 50)
  ctx.fillText(`Cards played: ${totalCardsPlayed.value}`, 30, hlY + 75)

  const barY = 320
  const barW = 540
  ctx.fillStyle = '#333'
  ctx.fillRect(30, barY, barW, 20)
  if (gamesPlayed.value > 0) {
    const wonW = (gamesWon.value / gamesPlayed.value) * barW
    ctx.fillStyle = '#00ff66'
    ctx.fillRect(30, barY, wonW, 20)
    const lostW = (gamesLost.value / gamesPlayed.value) * barW
    ctx.fillStyle = '#ff2a2a'
    ctx.fillRect(30 + wonW, barY, lostW, 20)
  }

  ctx.fillStyle = '#52525b'
  ctx.font = '11px monospace'
  ctx.fillText(`${gamesWon.value}W / ${gamesLost.value}L / ${gamesEliminated.value}E`, 30, barY + 38)

  ctx.fillStyle = '#52525b'
  ctx.font = '12px monospace'
  ctx.fillText('open-mercy.com', 30, 380)
}

function generateShareCard() {
  showShareModal.value = true
  setTimeout(renderShareCanvas, 100)
}

function downloadCard() {
  const canvas = shareCanvas.value
  if (!canvas) return
  const link = document.createElement('a')
  link.download = 'open-mercy-stats.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function shareToTwitter() {
  const text = encodeURIComponent(getShareText())
  const url = encodeURIComponent('https://open-mercy.com')
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
}

function shareToWhatsApp() {
  const text = encodeURIComponent(getShareText() + '\n\nhttps://open-mercy.com')
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

function copyShareLink() {
  const text = getShareText() + '\n\nhttps://open-mercy.com'
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: var(--bg-concrete);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

/* TOP BAR */
.dashboard-top-bar {
  position: relative;
  z-index: var(--z-hud);
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid rgba(255, 204, 0, 0.08);
  background: linear-gradient(180deg, rgba(10, 10, 11, 0.95), rgba(10, 10, 11, 0.7));
}

.back-link,
.share-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  cursor: pointer;
  padding: var(--spacing-2);
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.back-link {
  justify-self: flex-start;
}

.share-link {
  justify-self: flex-end;
  color: var(--color-neon-blue);
}

.share-link-placeholder {
  justify-self: flex-end;
}

.back-link:hover {
  color: var(--color-neon-blue);
}

.share-link:hover {
  color: var(--color-hazard);
}

.brand-mark {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-2);
  text-decoration: none;
  color: var(--text-primary);
  justify-self: center;
}

.brand-mark-uno {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  letter-spacing: 0.05em;
}

.brand-mark-nomercy {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  color: var(--color-alert);
  text-shadow: 0 0 12px rgba(255, 42, 42, 0.5);
}

/* CONTENT — the dossier grid. The rail spans both rows beside the record on
   desktop; on a phone the whole thing stacks with the name first, because you
   should know whose page this is before you see the badge. */
.dossier {
  flex: 1;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-12);
  display: grid;
  grid-template-columns: 340px 1fr;
  grid-template-areas:
    'rail who'
    'rail record';
  align-content: start;
  gap: var(--spacing-6) var(--spacing-8);
}

.who { grid-area: who; }
.rail { grid-area: rail; }
.record { grid-area: record; }

/* STATE SCREEN — loading / empty */
.state-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-8);
  color: var(--text-muted);
}

.state-icon {
  color: var(--text-muted);
}

.state-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  letter-spacing: 0.1em;
  color: var(--text-primary);
  margin: 0;
}

.state-desc,
.state-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
  letter-spacing: 0.1em;
}

/* WHO — name, flag, and the live "last played" line */
.who {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.who-name {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-3);
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 400;
  line-height: 1.05;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

/* 1em, from painted pixels rather than font metrics — the same measurement the
   all-time board's flag uses. The emoji renders in the system colour font,
   whose box bears no relation to the display face's, so a metrics-derived
   fraction reads like a footnote. */
.who-flag {
  flex: none;
  font-size: 1em;
  line-height: 1;
}

.who-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.who-sep {
  width: 3px;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--text-muted);
  opacity: 0.6;
}

.who-last {
  color: var(--text-secondary);
}

.public-profile-link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: var(--spacing-1);
  padding: var(--spacing-1) 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.16em;
  color: var(--color-neon-blue);
  transition: color var(--duration-snap) var(--ease-snap);
}

.public-profile-link:hover {
  color: var(--color-hazard);
}

/* RAIL — the badge is the hero of this page */
.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6) var(--spacing-4);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
}

/* The shared Badge renders emblem, tier name and progress at a size tuned for
   chips; this page is where it gets to be big. */
.rail-badge :deep(.badge-emblem) {
  width: 132px;
  height: 132px;
}

.rail-badge :deep(.badge-label) {
  font-size: var(--text-2xl);
}

.rail-tier {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.rail-points {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  width: 100%;
  padding-top: var(--spacing-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.rail-points-value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  color: var(--text-primary);
  line-height: 1;
}

.rail-points-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

/* LADDER — where this badge sits among all ten */
.ladder {
  list-style: none;
  width: 100%;
  margin: 0;
  padding: var(--spacing-4) 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.ladder-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.ladder-row--current {
  border-color: color-mix(in srgb, var(--color-hazard) 35%, transparent);
  background: rgba(255, 204, 0, 0.08);
  color: var(--text-primary);
}

.ladder-row--locked {
  color: var(--text-muted);
}

/* The real tier emblem via the shared Badge, which also carries the tooltip.
   `mark` is the emblem-only size; the rows just pin it to a fixed lane so the
   names line up whatever the art. */
.ladder-mark {
  flex: none;
}

.ladder-mark :deep(.badge-emblem) {
  width: 22px;
  height: 22px;
}

/* An unearned tier is shown, but dimmed — you can see what is coming without
   it competing with the badges you actually hold. */
.ladder-row--locked .ladder-mark,
.ladder-mark--locked {
  opacity: 0.4;
}

.ladder-name {
  flex: 1;
  min-width: 0;
}

.ladder-threshold {
  flex: none;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* RECORD — the right-hand column */
.record {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  min-width: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.panel-title {
  margin: 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px dashed rgba(255, 204, 0, 0.18);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--color-hazard);
}

/* STANDING */
.standing {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-4);
}

.standing-cell {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: var(--spacing-4);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(0, 243, 255, 0.16);
  border-radius: var(--radius-sm);
}

.standing-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: var(--text-muted);
}

.standing-flag {
  font-size: 1em;
  line-height: 1;
}

.standing-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1;
  color: var(--color-neon-blue);
}

.standing-sub {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* SERVICE RECORD */
.records {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.record-card {
  flex: 1 1 120px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
}

/* Uniform white labels: five different label colours read as noise, and they
   were decorative, never semantic. One value carries the colour instead. */
.record-label {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: #ffffff;
}

.record-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  line-height: 1;
  color: var(--text-primary);
}

.record-value--hazard {
  color: var(--color-hazard);
}

/* UPGRADES — the badges taken, and the next one */
.upgrades {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.upgrade {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.upgrade--current {
  border-color: color-mix(in srgb, var(--color-hazard) 30%, transparent);
  background: rgba(255, 204, 0, 0.07);
  color: var(--text-primary);
}

.upgrade--next {
  color: var(--text-muted);
  border-style: dashed;
}

.upgrade-name {
  flex: 1;
  min-width: 0;
}

.upgrade-when {
  flex: none;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ACTIVITY */
.activity {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.activity-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
}

.activity-result {
  flex: none;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: var(--text-xs);
}

.activity-result--won {
  background: var(--color-neon-green);
  color: var(--bg-concrete);
}

.activity-result--lost {
  background: var(--color-alert);
  color: #ffffff;
}

.activity-result--eliminated {
  background: var(--text-muted);
  color: #ffffff;
}

.activity-result--abandoned {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
}

.activity-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.activity-line {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.activity-sub {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

/* SHARE MODAL */
.share-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-soft) var(--ease-soft);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active {
    transition: none;
  }
}

.share-modal {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 204, 0, 0.25);
  border-radius: var(--radius-md);
  padding: var(--spacing-6);
  max-width: 640px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.12);
}

.share-modal-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0.1em;
  color: var(--color-hazard);
  margin: 0;
  text-align: center;
}

.share-preview {
  display: block;
  width: 100%;
  max-width: 600px;
  height: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  margin: 0 auto;
}

.share-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-2);
}

.link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  cursor: pointer;
  padding: var(--spacing-2);
  text-align: center;
  transition: color var(--duration-snap) var(--ease-snap);
}

.link:hover {
  color: var(--text-secondary);
}

/* MOBILE */
@media (max-width: 600px) {
  .dashboard-top-bar {
    padding: var(--spacing-3);
  }

  .brand-mark-uno {
    font-size: var(--text-base);
  }

  .brand-mark-nomercy {
    font-size: 0.6rem;
    letter-spacing: 0.15em;
  }

  .share-actions {
    grid-template-columns: 1fr;
  }
}

/* Below the two-column breakpoint the dossier stacks. The name leads, so you
   read whose page this is before the badge. */
@media (max-width: 900px) {
  .dossier {
    grid-template-columns: 1fr;
    grid-template-areas:
      'who'
      'rail'
      'record';
    gap: var(--spacing-4);
    padding: var(--spacing-4) var(--spacing-3) var(--spacing-8);
  }

  .who-name {
    font-size: var(--text-2xl);
  }

  /* Three segments wrap to two lines on a phone and strand a separator dot at
     the end of the first. The join date is the least useful of the three and
     the public profile already carries it. */
  .who-enlisted {
    display: none;
  }

  /* Slightly under the letters on a phone, where a full-height flag next to a
     shorter name crowds the line. */
  .who-flag {
    font-size: 0.9em;
  }

  .rail-badge :deep(.badge-emblem) {
    width: 104px;
    height: 104px;
  }

  .record-card {
    flex-basis: 100px;
  }

  .upgrade-when {
    font-size: 10px;
  }
}
</style>
