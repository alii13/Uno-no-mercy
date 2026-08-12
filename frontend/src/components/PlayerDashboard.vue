<template>
  <div class="dashboard-container">
    <!-- Top bar — mirrors landing/lobby pattern -->
    <header class="dashboard-top-bar">
      <button class="back-link" @click="$emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
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
      <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
        <rect x="3" y="12" width="4" height="9" />
        <rect x="10" y="7" width="4" height="14" />
        <rect x="17" y="3" width="4" height="18" />
      </svg>
      <h2 class="state-title">NO DATA YET</h2>
      <p class="state-desc">Play your first game to start tracking stats.</p>
    </div>

    <div v-else class="dashboard-content">
      <!-- Identity card — hero -->
      <section class="identity">
        <div class="identity-avatar">{{ username.charAt(0).toUpperCase() }}</div>
        <div class="identity-info">
          <div class="identity-name">{{ username }}</div>
          <div class="identity-rank">
            <button class="identity-badge-btn" @click="navigate({ name: 'badges' })" title="How badges work">
              <Badge :badge="badge" :points="badgePoints" :progress="badgeProgress" size="chip" />
            </button>
          </div>
          <div v-if="badgeProgress.next" class="identity-progress">
            {{ badgeProgress.needed.toLocaleString() }} points to {{ badgeProgress.next.title }}
            <button class="identity-how" @click="navigate({ name: 'badges' })">How badges work &rarr;</button>
          </div>
          <button
            v-if="authStore.profile?.share_code"
            class="public-profile-link"
            @click="navigate({ name: 'profile', code: authStore.profile.share_code })"
          >
            VIEW PUBLIC PROFILE &rarr;
          </button>
        </div>
      </section>

      <!-- Primary stats: 4 dominant numbers -->
      <section class="primary-stats">
        <div class="stat-card">
          <div class="stat-value">{{ gamesPlayed }}</div>
          <div class="stat-label">GAMES</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-win">{{ winRate }}%</div>
          <div class="stat-label">WIN RATE</div>
        </div>
        <div class="stat-card">
          <div
            class="stat-value"
            :class="currentStreak.type === 'W' ? 'stat-win' : 'stat-loss'"
          >
            {{ currentStreak.type }}{{ currentStreak.count }}
          </div>
          <div class="stat-label">STREAK</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-hazard">{{ ruthlessness }}</div>
          <div class="stat-label">RUTHLESS</div>
        </div>
      </section>

      <!-- Points climb over time -->
      <section class="record-section">
        <PointsClimb v-if="results.length" :rows="results" :color="badge.color" />
        <div v-else class="climb-signin">
          <h3 class="section-title">YOUR CLIMB</h3>
          <p class="climb-signin-text">Sign in to track your points climbing over time.</p>
        </div>
      </section>

      <!-- Battle record bar + key splits -->
      <section class="record-section">
        <h3 class="section-title">BATTLE RECORD</h3>
        <div class="battle-bar">
          <div
            class="bar-segment bar-won"
            :style="{ width: (gamesWon / gamesPlayed * 100) + '%' }"
          >
            {{ gamesWon }}W
          </div>
          <div
            class="bar-segment bar-lost"
            :style="{ width: (gamesLost / gamesPlayed * 100) + '%' }"
          >
            {{ gamesLost }}L
          </div>
          <div
            v-if="gamesEliminated > 0"
            class="bar-segment bar-elim"
            :style="{ width: (gamesEliminated / gamesPlayed * 100) + '%' }"
          >
            {{ gamesEliminated }}E
          </div>
        </div>
        <dl class="splits">
          <div class="split-row">
            <dt class="split-label">Best win streak</dt>
            <dd class="split-value">{{ bestWinStreak }}</dd>
          </div>
          <div class="split-row">
            <dt class="split-label">Bot win rate</dt>
            <dd class="split-value">{{ botWinRate }}%</dd>
          </div>
          <div class="split-row">
            <dt class="split-label">Multiplayer win rate</dt>
            <dd class="split-value">{{ mpWinRate }}%</dd>
          </div>
          <div class="split-row">
            <dt class="split-label">Avg game duration</dt>
            <dd class="split-value">{{ formatDuration(avgGameDuration) }}</dd>
          </div>
        </dl>
      </section>

      <!-- Lifetime record — consolidated. Used to be 3 separate sections
           (mastery / survival / aggression) competing for attention; merged
           into one 6-cell grid of the most impressive lifetime numbers. -->
      <section class="record-section">
        <h3 class="section-title">LIFETIME RECORD</h3>
        <div class="lifetime-grid">
          <div class="lifetime-cell">
            <div class="lifetime-value">+{{ biggestStackSurvived }}</div>
            <div class="lifetime-label">Biggest stack survived</div>
          </div>
          <div class="lifetime-cell">
            <div class="lifetime-value">{{ peakCardsEver }}</div>
            <div class="lifetime-label">Peak cards held</div>
          </div>
          <div class="lifetime-cell">
            <div class="lifetime-value">{{ totalCardsPlayed }}</div>
            <div class="lifetime-label">Cards played</div>
          </div>
          <div class="lifetime-cell">
            <div class="lifetime-value">{{ totalUnoCalls }}</div>
            <div class="lifetime-label">MERCY calls</div>
          </div>
          <div class="lifetime-cell">
            <div class="lifetime-value">{{ totalSkipsDealt }}</div>
            <div class="lifetime-label">Skips dealt</div>
          </div>
          <div class="lifetime-cell">
            <div class="lifetime-value lifetime-danger">{{ gamesEliminated }}</div>
            <div class="lifetime-label">Eliminations</div>
          </div>
        </div>
      </section>

      <!-- Card backs — earn-only skins. Ownership derives from the record;
           only the equip choice is stored. -->
      <section class="record-section">
        <h3 class="section-title">CARD BACKS</h3>
        <div class="skin-grid">
          <div
            v-for="skin in CARD_BACKS"
            :key="skin.id"
            class="skin-cell"
            :class="{ owned: ownedSkinIds.has(skin.id), equipped: equippedId === skin.id }"
          >
            <span class="skin-swatch" :style="{ background: skin.accent, boxShadow: `0 0 12px ${skin.accent}55` }"></span>
            <span class="skin-title">{{ skin.title.toUpperCase() }}</span>
            <span class="skin-unlock">{{ skin.unlock }}</span>
            <button
              v-if="ownedSkinIds.has(skin.id)"
              class="skin-equip"
              :disabled="equippedId === skin.id"
              @click="equipSkin(skin.id)"
            >
              {{ equippedId === skin.id ? 'EQUIPPED' : 'EQUIP' }}
            </button>
            <span v-else class="skin-locked">LOCKED</span>
          </div>
        </div>
      </section>

      <!-- Recent games -->
      <section class="record-section">
        <h3 class="section-title">RECENT GAMES</h3>
        <ul class="recent-list">
          <li
            v-for="game in recentGames"
            :key="game.id"
            class="recent-row"
          >
            <span class="recent-badge" :class="'badge-' + game.result">
              {{ game.result.charAt(0).toUpperCase() }}
            </span>
            <span class="recent-type">{{ game.is_bot_game ? 'BOT' : 'PVP' }}</span>
            <span class="recent-cards">{{ game.cards_played_total }} cards</span>
            <span class="recent-duration">{{ formatDuration(game.game_duration_secs) }}</span>
            <span class="recent-date">{{ formatDate(game.played_at) }}</span>
          </li>
        </ul>
      </section>
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
import { computed, ref } from 'vue'
import { usePlayerStats } from '../composables/usePlayerStats'
import { CARD_BACKS, equip, getEquippedId } from '../utils/cosmetics'
import { useRetentionStore } from '../stores/retentionStore'
import { useAuthStore } from '../stores/authStore'
import { navigate } from '../utils/routes'
import Button from './ui/Button.vue'
import Badge from './Badge.vue'
import PointsClimb from './PointsClimb.vue'

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
  loading, gamesPlayed, gamesWon, gamesLost, gamesEliminated,
  winRate, botWinRate, mpWinRate, currentStreak, bestWinStreak,
  totalCardsPlayed, totalSkipsDealt,
  totalUnoCalls, biggestStackSurvived,
  peakCardsEver, ruthlessness,
  badge, badgePoints, badgeProgress, recentGames, avgGameDuration,
  results,
} = usePlayerStats()

const retention = useRetentionStore()
const ownedSkinIds = computed(() => new Set(
  CARD_BACKS
    .filter(s => s.unlocked({ wins: gamesWon.value, longestStreak: retention.longestStreak, maxStackSurvived: biggestStackSurvived.value }))
    .map(s => s.id),
))
const equippedId = ref(getEquippedId())
function equipSkin(id: string) {
  equip(id)
  equippedId.value = getEquippedId()
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

/* CONTENT */
.dashboard-content {
  flex: 1;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-12);
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

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

/* IDENTITY */
.identity {
  display: flex;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
}

.identity-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-neon-blue);
  color: var(--bg-concrete);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  flex-shrink: 0;
}

.identity-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  min-width: 0;
}

.identity-name {
  font-family: var(--font-body);
  font-size: var(--text-lg);
  font-weight: bold;
  color: var(--text-primary);
}

.identity-rank {
  font-family: var(--font-display);
  font-size: var(--text-base);
  letter-spacing: 0.1em;
}
.identity-badge-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.identity-progress {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.1em;
}
.identity-how {
  display: block;
  margin-top: var(--spacing-1);
  background: none;
  border: none;
  padding: 0;
  color: rgba(255, 204, 0, 0.75);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.08em;
  cursor: pointer;
}
.identity-how:hover { color: #ffcc00; }

.public-profile-link {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: rgba(0, 229, 255, 0.7);
  cursor: pointer;
}

.public-profile-link:hover {
  color: var(--color-neon-blue);
}

/* PRIMARY STATS — 4 cells */
.primary-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-2);
}

.stat-card {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: var(--spacing-3);
  text-align: center;
  border-radius: var(--radius-sm);
}

.stat-value {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--text-primary);
  line-height: 1;
}

.stat-value.stat-win {
  color: var(--color-neon-green);
}

.stat-value.stat-loss {
  color: var(--color-alert);
}

.stat-value.stat-hazard {
  color: var(--color-hazard);
}

.stat-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.15em;
  margin-top: var(--spacing-1);
}

/* SECTION (BATTLE RECORD, LIFETIME, RECENT) */
.record-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.climb-signin-text {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  color: var(--color-hazard);
  letter-spacing: 0.15em;
  margin: 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px dashed rgba(255, 204, 0, 0.18);
}

/* BATTLE BAR */
.battle-bar {
  display: flex;
  height: 28px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.bar-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: bold;
  min-width: 32px;
}

.bar-won {
  background: var(--color-neon-green);
  color: var(--bg-concrete);
}

.bar-lost {
  background: var(--color-alert);
  color: white;
}

.bar-elim {
  background: var(--text-muted);
  color: white;
}

/* SPLITS */
.splits {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  margin: 0;
}

.split-row {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.split-label {
  color: var(--text-muted);
  margin: 0;
}

.split-value {
  color: var(--text-primary);
  margin: 0;
  font-weight: bold;
}

/* LIFETIME GRID */
.lifetime-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-2);
}

.lifetime-cell {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  padding: var(--spacing-3);
  text-align: center;
  border-radius: var(--radius-sm);
}

.lifetime-value {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--text-primary);
  line-height: 1;
}

.lifetime-value.lifetime-danger {
  color: var(--color-alert);
}

.lifetime-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--spacing-1);
  letter-spacing: 0.1em;
}

/* RECENT GAMES */
.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--spacing-2);
  margin-top: var(--spacing-3);
}

.skin-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-3) var(--spacing-2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  opacity: 0.4;
  text-align: center;
}

.skin-cell.owned {
  opacity: 1;
}

.skin-cell.equipped {
  border-color: rgba(255, 204, 0, 0.5);
  background: rgba(255, 204, 0, 0.04);
}

.skin-swatch {
  width: 28px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.skin-title {
  font-family: var(--font-display);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--text-primary);
}

.skin-unlock {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
  line-height: 1.3;
}

.skin-equip {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: #000;
  background: var(--color-hazard);
  border: none;
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  margin-top: 2px;
}

.skin-equip:disabled {
  background: rgba(255, 204, 0, 0.25);
  color: var(--text-primary);
  cursor: default;
}

.skin-locked {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  color: var(--text-muted);
  margin-top: 2px;
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.recent-row {
  display: grid;
  grid-template-columns: 28px 40px 1fr auto auto;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.recent-badge {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: var(--text-xs);
  border-radius: var(--radius-sm);
}

.badge-won {
  background: var(--color-neon-green);
  color: var(--bg-concrete);
}

.badge-lost {
  background: var(--color-alert);
  color: white;
}

.badge-eliminated {
  background: var(--text-muted);
  color: white;
}

.badge-abandoned {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
}

.recent-type {
  color: var(--text-secondary);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
}

.recent-cards {
  color: var(--text-primary);
}

.recent-duration,
.recent-date {
  color: var(--text-muted);
  font-size: var(--text-xs);
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

  .dashboard-content {
    padding: var(--spacing-4) var(--spacing-3) var(--spacing-8);
    gap: var(--spacing-4);
  }

  .identity {
    padding: var(--spacing-4);
  }

  .identity-avatar {
    width: 48px;
    height: 48px;
    font-size: var(--text-xl);
  }

  .primary-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .lifetime-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .recent-row {
    grid-template-columns: 24px 36px 1fr auto;
    font-size: var(--text-xs);
  }

  .recent-date {
    display: none;
  }

  .share-actions {
    grid-template-columns: 1fr;
  }
}
</style>
