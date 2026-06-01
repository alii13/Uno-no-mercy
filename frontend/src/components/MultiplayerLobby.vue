<template>
  <div class="lobby-container">
    <div class="scan-line"></div>
    
    <div class="lobby-header">
      <div class="brand-group">
        <h1 class="title glitch-text" data-text="UNO">UNO</h1>
        <h2 class="subtitle">NO MERCY</h2>
      </div>
      <LandingStatsBadge class="lobby-stats" />
      <div class="user-info">
        <span>{{ authStore.username }}</span>
        <button v-if="authStore.isAnonymous" @click="upgradeAccount" class="logout-btn" style="border-color: var(--color-neon-blue); color: var(--color-neon-blue);">CREATE ACCOUNT</button>
        <button @click="authStore.signOut()" class="logout-btn">LOGOUT</button>
      </div>
    </div>
    
    <div class="lobby-content">
      <!-- Error display -->
      <div v-if="mpStore.error" class="error-banner">
        {{ mpStore.error }}
      </div>
      
      <!-- No active game - show options -->
      <div v-if="!mpStore.currentGame" class="lobby-options">
        <div class="option-cards-row">
          <div class="option-card" :class="{ loading: mpStore.loading }" @click="handleCreateGame">
            <svg class="option-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="2"/><line x1="15" y1="10" x2="15" y2="14"/><line x1="13" y1="12" x2="17" y2="12"/></svg>
            <h3>{{ mpStore.loading ? 'CREATING...' : 'CREATE GAME' }}</h3>
            <p>Start a new game and invite a friend</p>
          </div>

          <div class="option-card" @click="showJoinModal = true">
            <svg class="option-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <h3>JOIN GAME</h3>
            <p>Enter a room code to join</p>
          </div>

          <div class="option-card" @click="$emit('playLocal', selectedStackingMode)">
            <svg class="option-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="3"/><line x1="12" y1="8" x2="12" y2="11"/><circle cx="8" cy="16" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/></svg>
            <h3>VS BOT</h3>
            <p>Practice against AI opponent</p>
          </div>
        </div>

        <!-- Game Settings -->
        <div class="settings-bar">
          <button class="settings-toggle" @click="showSettings = !showSettings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            GAME SETTINGS
            <span class="settings-mode-tag">{{ modeLabel(selectedStackingMode) }}</span>
            <svg class="settings-chevron" :class="{ open: showSettings }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div v-if="showSettings" class="settings-panel">
            <div class="setting-row">
              <label class="setting-label">STACKING RULES</label>
              <div class="setting-options">
                <button
                  v-for="m in stackingModes"
                  :key="m.value"
                  class="setting-option"
                  :class="{ active: selectedStackingMode === m.value }"
                  @click="selectedStackingMode = m.value"
                >
                  <div class="option-name">{{ m.label }}</div>
                  <div class="option-desc">{{ m.desc }}</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-bar" @click="handleStatsClick">
          <svg class="stats-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="3" width="4" height="18"/></svg>
          <div class="stats-bar-info">
            <h3>MY STATS</h3>
            <p v-if="authStore.isAnonymous">Create an account to track your battle record</p>
            <p v-else>View your battle record and share stats</p>
          </div>
          <svg v-if="authStore.isAnonymous" class="stats-bar-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          <svg v-else class="stats-bar-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </div>
      
      <!-- Waiting room -->
      <div v-else-if="mpStore.gameStatus === 'waiting'" class="waiting-room">
        <div class="room-code-display">
          <span class="label">ROOM CODE</span>
          <span class="code">{{ mpStore.roomCode }}</span>
          <button @click="copyRoomCode" class="copy-btn">
            {{ copied ? '✓ COPIED' : 'COPY' }}
          </button>
          <div class="room-mode-badge">RULES: {{ modeLabel(mpStore.stackingMode) }}</div>
        </div>
        
        <div class="players-list">
          <div class="player-slot" v-for="player in mpStore.gamePlayers" :key="player.id">
            <div class="player-avatar">{{ player.name?.charAt(0) }}</div>
            <span class="player-name">{{ player.name }}</span>
            <span class="player-badge" v-if="player.user_id === mpStore.currentGame?.host_id">HOST</span>
            <span class="player-status ready">READY</span>
          </div>
          <div class="player-slot empty-slot" v-if="mpStore.gamePlayers.length < 10">
            <div class="player-avatar empty">?</div>
            <span class="player-name muted">Waiting for players...</span>
            <div class="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>

        <div class="player-counter">
          {{ mpStore.gamePlayers.length }} / 10 PLAYERS
        </div>

        <div class="waiting-actions">
          <button
            v-if="mpStore.isHost"
            @click="startGame"
            :disabled="mpStore.gamePlayers.length < 2"
            class="start-btn"
          >
            {{ mpStore.gamePlayers.length < 2 ? 'NEED AT LEAST 2 PLAYERS...' : `START GAME (${mpStore.gamePlayers.length} PLAYERS)` }}
          </button>
          <p v-else class="waiting-text">Waiting for host to start... ({{ mpStore.gamePlayers.length }} players)</p>

          <button @click="leaveGame" class="leave-btn">LEAVE GAME</button>
        </div>
      </div>
    </div>
    
    <!-- Join Modal -->
    <div v-if="showJoinModal" class="modal-overlay" @click.self="showJoinModal = false">
      <div class="modal-card">
        <h2>JOIN GAME</h2>
        <p>Enter the room code shared by your friend</p>
        
        <input 
          v-model="joinCode" 
          type="text" 
          placeholder="ABC123"
          maxlength="6"
          class="room-input"
          @keyup.enter="joinGame"
        />
        
        <div v-if="mpStore.error" class="error-message">
          {{ mpStore.error }}
        </div>
        
        <div class="modal-actions">
          <button @click="showJoinModal = false" class="cancel-btn" :disabled="mpStore.loading">CANCEL</button>
          <button @click="joinGame" :disabled="joinCode.length < 4 || mpStore.loading" class="join-btn">
            {{ mpStore.loading ? 'JOINING...' : 'JOIN' }}
          </button>
        </div>
      </div>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'
import { useGameStore } from '../stores/gameStore'
import SiteFooter from './SiteFooter.vue'
import LandingStatsBadge from './LandingStatsBadge.vue'
import type { StackingMode } from '../utils/gameRules'

const emit = defineEmits<{
  (e: 'playLocal', mode: StackingMode): void
  (e: 'showAuth'): void
  (e: 'showStats'): void
}>()

const authStore = useAuthStore()
const mpStore = useMultiplayerStore()
const gameStore = useGameStore()

const showJoinModal = ref(false)
const joinCode = ref('')
const copied = ref(false)
const showSettings = ref(false)
const selectedStackingMode = ref<StackingMode>(gameStore.stackingMode)

const stackingModes: { value: StackingMode; label: string; desc: string }[] = [
  { value: 'official', label: 'OFFICIAL', desc: 'Draw cards stack only if equal or higher value (printed rules)' },
  { value: 'house', label: 'HOUSE', desc: 'Wild draws stack on anything; colored draws still need equal or higher' },
  { value: 'casual', label: 'CASUAL', desc: 'Any draw card stacks on any draw card' },
]

function modeLabel(m: StackingMode) {
  return stackingModes.find(x => x.value === m)?.label || 'OFFICIAL'
}

async function handleCreateGame() {
  await mpStore.createGame(selectedStackingMode.value)
}

async function joinGame() {
  if (mpStore.loading) {
    return
  }
  const result = await mpStore.joinGame(joinCode.value)
  if (result) {
    showJoinModal.value = false
    joinCode.value = ''
  }
}

async function startGame() {
  await mpStore.startGame()
}

async function leaveGame() {
  await mpStore.leaveGame()
}

async function upgradeAccount() {
  await authStore.signOut()
  emit('showAuth')
}

function handleStatsClick() {
  if (authStore.isAnonymous) {
    upgradeAccount()
  } else {
    emit('showStats')
  }
}

function copyRoomCode() {
  navigator.clipboard.writeText(mpStore.roomCode)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
.lobby-container {
  min-height: 100vh;
  height: 100vh;
  background: var(--bg-concrete);
  color: var(--text-primary);
  position: relative;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

.scan-line {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.2) 51%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
}

.lobby-header {
  text-align: center;
  padding: 0.75rem 2rem;
  border-bottom: 2px solid #333;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
}

.lobby-stats {
  align-self: center;
}

@media (max-width: 720px) {
  .lobby-stats { display: none; } /* keep header tight on mobile */
}

.brand-group {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.title {
  font-family: var(--font-display);
  font-size: 2rem;
  margin: 0;
  line-height: 1;
}

.subtitle {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-alert);
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  margin-left: auto;
}

.logout-btn {
  background: transparent;
  border: 1px solid #444;
  color: var(--text-muted);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.8rem;
}

.logout-btn:hover {
  border-color: var(--color-alert);
  color: var(--color-alert);
}

.lobby-content {
  padding: 1.5rem 3rem 3rem;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
}

.lobby-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.option-cards-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.option-card {
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid #333;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.option-card:hover {
  border-color: var(--color-neon-blue);
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.option-svg {
  width: 40px;
  height: 40px;
  color: var(--color-neon-blue);
  margin-bottom: 1rem;
}

.option-card:hover .option-svg {
  color: var(--color-neon-green);
}

.option-card h3 {
  font-family: var(--font-display);
  margin: 0 0 0.5rem 0;
}

.option-card p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin: 0;
}

/* Settings Bar */
.settings-bar {
  margin-bottom: 0.5rem;
}

.settings-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #2a2a2a;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: 0.75rem;
  letter-spacing: 1px;
  transition: all 0.2s;
}

.settings-toggle:hover {
  border-color: var(--color-neon-blue);
}

.settings-mode-tag {
  margin-left: auto;
  font-size: 0.7rem;
  color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.1);
  border: 1px solid var(--color-hazard-dim);
  padding: 0.15rem 0.5rem;
}

.settings-chevron {
  transition: transform 0.2s;
  color: var(--text-muted);
}

.settings-chevron.open {
  transform: rotate(180deg);
}

.settings-panel {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #2a2a2a;
  border-top: none;
  padding: 1rem;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-label {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.setting-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.setting-option {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #333;
  color: var(--text-secondary);
  padding: 0.75rem 0.5rem;
  cursor: pointer;
  text-align: left;
  font-family: 'Courier New', monospace;
  transition: all 0.2s;
}

.setting-option:hover {
  border-color: var(--color-neon-blue);
  color: var(--text-primary);
}

.setting-option.active {
  border-color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.05);
  color: var(--text-primary);
}

.setting-option .option-name {
  font-family: var(--font-display);
  font-size: 0.85rem;
  color: var(--color-hazard);
  margin-bottom: 0.25rem;
}

.setting-option:not(.active) .option-name {
  color: var(--text-secondary);
}

.setting-option .option-desc {
  font-size: 0.7rem;
  color: var(--text-muted);
  line-height: 1.4;
}

@media (max-width: 600px) {
  .setting-options {
    grid-template-columns: 1fr;
  }
  .settings-mode-tag { font-size: 0.65rem; }
}

/* Stats Bar */
.stats-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
  cursor: pointer;
  transition: all 0.3s;
}

.stats-bar:hover {
  border-color: var(--color-neon-blue);
  background: rgba(0, 243, 255, 0.03);
}

.stats-bar-icon {
  width: 28px;
  height: 28px;
  color: var(--color-hazard);
  flex-shrink: 0;
}

.stats-bar-info {
  flex: 1;
}

.stats-bar-info h3 {
  font-family: var(--font-display);
  font-size: 0.9rem;
  margin: 0;
}

.stats-bar-info p {
  color: var(--text-muted);
  font-size: 0.8rem;
  margin: 0.2rem 0 0;
}

.stats-bar-lock {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}

.stats-bar-arrow {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}

.option-card.loading {
  opacity: 0.7;
  pointer-events: none;
}

.error-banner {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid #ff4444;
  color: #ff6666;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: center;
}

/* Waiting Room */
.waiting-room {
  text-align: center;
}

.room-mode-badge {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: var(--color-hazard);
  letter-spacing: 2px;
  padding-top: 0.5rem;
  border-top: 1px dashed #333;
  margin-top: 0.25rem;
}

.room-code-display {
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid var(--color-hazard);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: inline-flex;
  flex-direction: column;
  gap: 0.75rem;
}

.room-code-display .label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.room-code-display .code {
  font-family: var(--font-display);
  font-size: 3rem;
  letter-spacing: 0.5rem;
  color: var(--color-hazard);
}

.copy-btn {
  background: var(--color-hazard);
  border: none;
  color: black;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: bold;
}

.players-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.player-slot {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #333;
  padding: 1.5rem;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.player-slot.empty-slot {
  border-style: dashed;
  opacity: 0.5;
}

.player-badge {
  font-size: 0.65rem;
  background: var(--color-hazard);
  color: black;
  padding: 0.15rem 0.5rem;
  font-weight: bold;
  letter-spacing: 1px;
}

.player-counter {
  text-align: center;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  margin-bottom: 1.5rem;
  letter-spacing: 2px;
}

.player-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-neon-blue);
  color: black;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1.5rem;
  font-weight: bold;
}

.player-avatar.empty {
  background: #333;
  color: #666;
}

.player-name {
  font-weight: bold;
}

.player-name.muted {
  color: var(--text-muted);
}

.player-status.ready {
  color: var(--color-neon-green);
  font-size: 0.8rem;
}

.loading-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #444;
  border-radius: 50%;
  margin: 0 3px;
  animation: blink 1.4s infinite;
}

.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 1; }
}

.waiting-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.start-btn {
  background: linear-gradient(145deg, #ff4444 0%, #cc0000 100%);
  border: none;
  color: white;
  padding: 1.5rem 4rem;
  font-family: var(--font-display);
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.start-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(255, 0, 0, 0.5);
}

.leave-btn {
  background: transparent;
  border: 1px solid #444;
  color: var(--text-muted);
  padding: 0.75rem 2rem;
  cursor: pointer;
}

.leave-btn:hover {
  border-color: var(--color-alert);
  color: var(--color-alert);
}

.waiting-text {
  color: var(--text-muted);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.modal-card {
  background: #111;
  border: 2px solid var(--color-neon-blue);
  padding: 2rem;
  min-width: 400px;
  text-align: center;
}

.modal-card h2 {
  margin: 0 0 0.5rem 0;
  font-family: var(--font-display);
}

.modal-card p {
  color: var(--text-muted);
  margin: 0 0 1.5rem 0;
}

.room-input {
  width: 100%;
  padding: 1rem;
  font-size: 2rem;
  text-align: center;
  letter-spacing: 0.5rem;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid #444;
  color: white;
  margin-bottom: 1rem;
}

.room-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.error-message {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid #ff4444;
  color: #ff6666;
  padding: 1rem;
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
}

.cancel-btn {
  flex: 1;
  background: transparent;
  border: 1px solid #444;
  color: var(--text-muted);
  padding: 1rem;
  cursor: pointer;
}

.join-btn {
  flex: 1;
  background: var(--color-neon-blue);
  border: none;
  color: black;
  padding: 1rem;
  font-weight: bold;
  cursor: pointer;
}

.join-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .option-cards-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .lobby-content {
    padding: 1.5rem;
  }

  .room-code-display .code {
    font-size: 2rem;
  }

  .start-btn {
    font-size: 1.2rem;
    padding: 1rem 2rem;
  }

  .modal-card {
    min-width: unset;
    width: 90vw;
  }
}

@media (max-width: 480px) {
  .lobby-header {
    flex-wrap: wrap;
    padding: 0.5rem 1rem;
    gap: 0.5rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .subtitle {
    font-size: 0.8rem;
  }

  .lobby-content {
    padding: 1rem;
  }

  .room-code-display .code {
    font-size: 2rem;
    letter-spacing: 0.3rem;
  }

  .start-btn {
    font-size: 1rem;
    padding: 1rem;
    width: 100%;
  }

  .option-card {
    padding: 1.5rem;
  }

  .option-icon {
    font-size: 2rem;
  }

  .player-slot {
    min-width: 120px;
    padding: 1rem;
  }

  .player-avatar {
    width: 45px;
    height: 45px;
    font-size: 1.2rem;
  }

  .modal-card {
    min-width: unset;
    width: 95vw;
    padding: 1.5rem;
  }

  .room-input {
    font-size: 1.5rem;
  }
}
</style>
