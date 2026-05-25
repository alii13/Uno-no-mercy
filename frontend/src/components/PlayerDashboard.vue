<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <button @click="$emit('back')" class="back-btn">← BACK</button>
      <h2 class="dash-title">COMMAND CENTER</h2>
      <button @click="generateShareCard" class="share-btn">SHARE STATS</button>
    </div>

    <div v-if="loading" class="loading-state">
      <p>LOADING INTEL...</p>
    </div>

    <div v-else-if="gamesPlayed === 0" class="empty-state">
      <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>
      <p class="empty-title">NO DATA YET</p>
      <p class="empty-desc">Play your first game to start tracking stats.</p>
    </div>

    <div v-else class="dashboard-content">
      <!-- Identity Card -->
      <div class="identity-card">
        <div class="identity-avatar">{{ username.charAt(0).toUpperCase() }}</div>
        <div class="identity-info">
          <div class="identity-name">{{ username }}</div>
          <div class="identity-rank" :style="{ color: rank.color }">{{ rank.title }}</div>
          <div v-if="nextRank" class="identity-progress">
            {{ nextRank.winsNeeded }} wins to {{ nextRank.title }}
          </div>
        </div>
      </div>

      <!-- Core Stats Row -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ gamesPlayed }}</div>
          <div class="stat-label">GAMES</div>
        </div>
        <div class="stat-card">
          <div class="stat-value highlight">{{ winRate }}%</div>
          <div class="stat-label">WIN RATE</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" :class="currentStreak.type === 'W' ? 'streak-win' : 'streak-loss'">
            {{ currentStreak.type }}{{ currentStreak.count }}
          </div>
          <div class="stat-label">STREAK</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ruthless">{{ ruthlessness }}</div>
          <div class="stat-label">RUTHLESS</div>
        </div>
      </div>

      <!-- Battle Record -->
      <div class="section">
        <h3 class="section-title">BATTLE RECORD</h3>
        <div class="battle-bar" v-if="gamesPlayed > 0">
          <div class="bar-segment bar-won" :style="{ width: (gamesWon / gamesPlayed * 100) + '%' }">{{ gamesWon }}W</div>
          <div class="bar-segment bar-lost" :style="{ width: (gamesLost / gamesPlayed * 100) + '%' }">{{ gamesLost }}L</div>
          <div v-if="gamesEliminated > 0" class="bar-segment bar-elim" :style="{ width: (gamesEliminated / gamesPlayed * 100) + '%' }">{{ gamesEliminated }}E</div>
        </div>
        <div class="battle-details">
          <div class="detail-row">
            <span class="detail-label">Best win streak</span>
            <span class="detail-value">{{ bestWinStreak }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Bot win rate</span>
            <span class="detail-value">{{ botWinRate }}%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Multiplayer win rate</span>
            <span class="detail-value">{{ mpWinRate }}%</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Avg game duration</span>
            <span class="detail-value">{{ formatDuration(avgGameDuration) }}</span>
          </div>
        </div>
      </div>

      <!-- Card Mastery -->
      <div class="section">
        <h3 class="section-title">CARD MASTERY</h3>
        <div class="mastery-grid">
          <div class="mastery-item">
            <div class="mastery-value">{{ totalCardsPlayed }}</div>
            <div class="mastery-label">Cards played</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ totalWildCardsPlayed }}</div>
            <div class="mastery-label">Wild cards</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ totalDrawCardsPlayed }}</div>
            <div class="mastery-label">Draw cards</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ avgCardsRemainingOnLoss }}</div>
            <div class="mastery-label">Avg cards on loss</div>
          </div>
        </div>
      </div>

      <!-- Survival Stats -->
      <div class="section">
        <h3 class="section-title">SURVIVAL</h3>
        <div class="mastery-grid">
          <div class="mastery-item">
            <div class="mastery-value danger">{{ gamesEliminated }}</div>
            <div class="mastery-label">Eliminations</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ peakCardsEver }}</div>
            <div class="mastery-label">Peak cards held</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">+{{ biggestStackSurvived }}</div>
            <div class="mastery-label">Biggest stack survived</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ totalDrawsTaken }}</div>
            <div class="mastery-label">Total draws</div>
          </div>
        </div>
      </div>

      <!-- Aggression Stats -->
      <div class="section">
        <h3 class="section-title">AGGRESSION</h3>
        <div class="mastery-grid">
          <div class="mastery-item">
            <div class="mastery-value">{{ totalSkipsDealt }}</div>
            <div class="mastery-label">Skips dealt</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ totalSwapsMade }}</div>
            <div class="mastery-label">Hand swaps</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value">{{ totalUnoCalls }}</div>
            <div class="mastery-label">UNO calls</div>
          </div>
          <div class="mastery-item">
            <div class="mastery-value danger">{{ totalUnoPenalties }}</div>
            <div class="mastery-label">UNO penalties</div>
          </div>
        </div>
      </div>

      <!-- Recent Games -->
      <div class="section">
        <h3 class="section-title">RECENT GAMES</h3>
        <div class="recent-list">
          <div v-for="game in recentGames" :key="game.id" class="recent-game">
            <span class="recent-badge" :class="'badge-' + game.result">{{ game.result.charAt(0).toUpperCase() }}</span>
            <span class="recent-type">{{ game.is_bot_game ? 'BOT' : 'PVP' }}</span>
            <span class="recent-cards">{{ game.cards_played_total }} cards</span>
            <span class="recent-duration">{{ formatDuration(game.game_duration_secs) }}</span>
            <span class="recent-date">{{ formatDate(game.played_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="share-overlay" @click.self="showShareModal = false">
      <div class="share-modal">
        <h3 class="share-title">SHARE YOUR STATS</h3>
        <canvas ref="shareCanvas" width="600" height="400" class="share-preview"></canvas>
        <div class="share-buttons">
          <button @click="downloadCard" class="share-action">DOWNLOAD PNG</button>
          <button @click="shareToTwitter" class="share-action twitter">TWITTER / X</button>
          <button @click="shareToWhatsApp" class="share-action whatsapp">WHATSAPP</button>
          <button @click="copyShareLink" class="share-action">{{ copied ? 'COPIED!' : 'COPY LINK' }}</button>
        </div>
        <button @click="showShareModal = false" class="share-close">CLOSE</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStats } from '../composables/usePlayerStats'
import { useAuthStore } from '../stores/authStore'

defineEmits<{
  (e: 'back'): void
}>()

const authStore = useAuthStore()
const username = authStore.username
const shareCanvas = ref<HTMLCanvasElement | null>(null)
const showShareModal = ref(false)
const copied = ref(false)

const {
  loading, gamesPlayed, gamesWon, gamesLost, gamesEliminated,
  winRate, botWinRate, mpWinRate, currentStreak, bestWinStreak,
  totalCardsPlayed, totalDrawCardsPlayed, totalWildCardsPlayed,
  totalSkipsDealt, totalSwapsMade, totalDrawsTaken,
  totalUnoCalls, totalUnoPenalties, biggestStackSurvived,
  peakCardsEver, avgCardsRemainingOnLoss, ruthlessness,
  rank, nextRank, recentGames, avgGameDuration
} = usePlayerStats()

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
  return `I'm a ${rank.value.title} in UNO No Mercy - ${winRate.value}% win rate across ${gamesPlayed.value} games. Think you can beat me?`
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
  ctx.fillText('UNO NO MERCY', 30, 55)

  ctx.fillStyle = rank.value.color
  ctx.font = 'bold 18px monospace'
  ctx.fillText(rank.value.title.toUpperCase(), 30, 85)

  ctx.fillStyle = '#a1a1aa'
  ctx.font = '16px monospace'
  ctx.fillText(username, 280, 55)

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
  ctx.fillText('uno-no-mercy.pages.dev', 30, 380)
}

function generateShareCard() {
  showShareModal.value = true
  setTimeout(renderShareCanvas, 100)
}

function downloadCard() {
  const canvas = shareCanvas.value
  if (!canvas) return
  const link = document.createElement('a')
  link.download = 'uno-no-mercy-stats.png'
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function shareToTwitter() {
  const text = encodeURIComponent(getShareText())
  const url = encodeURIComponent('https://uno-no-mercy.pages.dev')
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
}

function shareToWhatsApp() {
  const text = encodeURIComponent(getShareText() + '\n\nhttps://uno-no-mercy.pages.dev')
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

function copyShareLink() {
  const text = getShareText() + '\n\nhttps://uno-no-mercy.pages.dev'
  navigator.clipboard?.writeText(text)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  height: 100vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: var(--bg-concrete);
  color: var(--text-primary);
  display: flex;
  flex-direction: column;
}

.dashboard-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-bottom: 2px solid #333;
  flex-shrink: 0;
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.5rem;
}

.back-btn:hover { color: var(--color-neon-blue); }

.dash-title {
  flex: 1;
  text-align: center;
  font-family: var(--font-display);
  font-size: 1.2rem;
  margin: 0;
  color: var(--color-hazard);
}

.share-btn {
  background: transparent;
  border: 1px solid var(--color-neon-blue);
  color: var(--color-neon-blue);
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-family: var(--font-display);
  transition: all 0.2s;
}

.share-btn:hover {
  background: var(--color-neon-blue);
  color: black;
}

.dashboard-content {
  padding: 1rem 1.5rem 3rem;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}

.loading-state, .empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: var(--text-muted);
}

.empty-icon { color: var(--text-muted); margin-bottom: 1rem; }
.empty-title { font-family: var(--font-display); font-size: 1.5rem; margin: 0 0 0.5rem; }
.empty-desc { color: var(--text-muted); margin: 0; }

/* Identity Card */
.identity-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0,0,0,0.4);
  border: 1px solid #333;
  margin-bottom: 1rem;
}

.identity-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: var(--color-neon-blue);
  color: black;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
}

.identity-name {
  font-weight: bold;
  font-size: 1.1rem;
}

.identity-rank {
  font-family: var(--font-display);
  font-size: 0.9rem;
}

.identity-progress {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: rgba(0,0,0,0.4);
  border: 1px solid #333;
  padding: 0.75rem;
  text-align: center;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: var(--text-primary);
}

.stat-value.highlight { color: var(--color-neon-green); }
.stat-value.streak-win { color: var(--color-neon-green); }
.stat-value.streak-loss { color: var(--color-alert); }
.stat-value.ruthless { color: var(--color-hazard); }
.stat-value.danger { color: var(--color-alert); }

.stat-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  letter-spacing: 1px;
  margin-top: 0.25rem;
}

/* Sections */
.section {
  margin-bottom: 1.5rem;
}

.section-title {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--color-hazard);
  margin: 0 0 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px dashed #333;
}

/* Battle Bar */
.battle-bar {
  display: flex;
  height: 24px;
  margin-bottom: 0.75rem;
  overflow: hidden;
}

.bar-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
  min-width: 30px;
}

.bar-won { background: var(--color-neon-green); color: black; }
.bar-lost { background: var(--color-alert); color: white; }
.bar-elim { background: #666; color: white; }

.battle-details { display: flex; flex-direction: column; gap: 0.4rem; }

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
}

.detail-label { color: var(--text-muted); }
.detail-value { color: var(--text-primary); font-weight: bold; }

/* Mastery Grid */
.mastery-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.mastery-item {
  background: rgba(0,0,0,0.3);
  border: 1px solid #222;
  padding: 0.75rem;
  text-align: center;
}

.mastery-value {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--text-primary);
}

.mastery-value.danger { color: var(--color-alert); }

.mastery-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-top: 0.2rem;
}

/* Recent Games */
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.recent-game {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: rgba(0,0,0,0.3);
  border: 1px solid #222;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
}

.recent-badge {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.7rem;
  flex-shrink: 0;
}

.badge-won { background: var(--color-neon-green); color: black; }
.badge-lost { background: var(--color-alert); color: white; }
.badge-eliminated { background: #666; color: white; }
.badge-abandoned { background: #444; color: #888; }

.recent-type { color: var(--text-muted); min-width: 30px; }
.recent-cards { color: var(--text-secondary); flex: 1; }
.recent-duration { color: var(--text-muted); }
.recent-date { color: var(--text-muted); margin-left: auto; }

/* Share Modal */
.share-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1rem;
}

.share-modal {
  background: #111;
  border: 2px solid var(--color-hazard);
  padding: 1.5rem;
  max-width: 650px;
  width: 100%;
  text-align: center;
}

.share-title {
  font-family: var(--font-display);
  color: var(--color-hazard);
  margin: 0 0 1rem;
  font-size: 1.1rem;
}

.share-preview {
  display: block;
  width: 100%;
  max-width: 600px;
  height: auto;
  border: 1px solid #333;
  margin: 0 auto 1rem;
}

.share-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.share-action {
  padding: 0.75rem;
  background: #222;
  border: 1px solid #444;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 0.8rem;
  transition: all 0.2s;
}

.share-action:hover {
  border-color: var(--color-neon-blue);
  color: var(--color-neon-blue);
}

.share-action.twitter {
  border-color: #1DA1F2;
  color: #1DA1F2;
}

.share-action.twitter:hover {
  background: #1DA1F2;
  color: black;
}

.share-action.whatsapp {
  border-color: #25D366;
  color: #25D366;
}

.share-action.whatsapp:hover {
  background: #25D366;
  color: black;
}

.share-close {
  background: transparent;
  border: 1px solid #444;
  color: var(--text-muted);
  padding: 0.5rem 2rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.share-close:hover {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

/* Mobile */
@media (max-width: 480px) {
  .dashboard-content { padding: 0.75rem 0.75rem 2rem; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .stat-value { font-size: 1.2rem; }
  .mastery-value { font-size: 1.1rem; }
  .dashboard-header { padding: 0.5rem 0.75rem; }
  .dash-title { font-size: 1rem; }
  .share-btn { padding: 0.3rem 0.5rem; font-size: 0.7rem; }
  .recent-game { font-size: 0.7rem; gap: 0.5rem; }
  .share-buttons { grid-template-columns: 1fr; }
  .share-modal { padding: 1rem; }
}
</style>
