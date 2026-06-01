<template>
  <div class="lobby-container">
    <!-- Top bar — slim, brand left, identity + auth controls right. No scan-line. -->
    <header class="lobby-top-bar">
      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">UNO</span>
        <span class="brand-mark-nomercy">NO MERCY</span>
      </a>

      <div class="top-bar-cta">
        <span class="username-chip">{{ authStore.username }}</span>
        <button
          v-if="authStore.isAnonymous"
          class="text-link upgrade-link"
          @click="upgradeAccount"
        >
          CREATE ACCOUNT
        </button>
        <button class="text-link" @click="authStore.signOut()">
          SIGN OUT
        </button>
      </div>
    </header>

    <div class="lobby-content">
      <div v-if="mpStore.error" class="error-banner">
        {{ mpStore.error }}
      </div>

      <!-- No active game — focused entry view with one primary CTA -->
      <div v-if="!mpStore.currentGame" class="lobby-entry">
        <!-- Primary action: CREATE GAME -->
        <div class="primary-action">
          <Button
            variant="primary"
            size="lg"
            block
            :disabled="mpStore.loading"
            @click="handleCreateGame"
          >
            {{ mpStore.loading ? 'CREATING...' : 'CREATE GAME' }}
          </Button>

          <div class="mode-row">
            <span class="mode-label">RULES</span>
            <div class="mode-pills">
              <button
                v-for="m in stackingModes"
                :key="m.value"
                class="mode-pill"
                :class="{ active: selectedStackingMode === m.value }"
                @click="selectedStackingMode = m.value"
                :title="m.desc"
              >
                {{ m.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="entry-divider" aria-hidden="true">OR</div>

        <!-- Secondary actions: equal weight, smaller -->
        <div class="secondary-actions">
          <Button variant="secondary" size="md" block @click="showJoinModal = true">
            JOIN WITH CODE
          </Button>
          <Button variant="ghost" size="md" block @click="$emit('playLocal', selectedStackingMode)">
            VS BOT
          </Button>
        </div>

        <!-- Tertiary: stats link -->
        <button class="stats-link" @click="handleStatsClick">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16" aria-hidden="true">
            <rect x="3" y="12" width="4" height="9" />
            <rect x="10" y="7" width="4" height="14" />
            <rect x="17" y="3" width="4" height="18" />
          </svg>
          <span v-if="authStore.isAnonymous">CREATE ACCOUNT TO TRACK STATS</span>
          <span v-else>MY STATS &rarr;</span>
        </button>

        <LandingStatsBadge class="lobby-stats" />
      </div>

      <!-- Waiting room — after creating, before starting -->
      <div v-else-if="mpStore.gameStatus === 'waiting'" class="waiting-room">
        <div class="room-code-card">
          <span class="room-code-label">ROOM CODE</span>
          <span class="room-code-value">{{ mpStore.roomCode }}</span>
          <button class="copy-btn" @click="copyRoomCode">
            {{ copied ? '✓ COPIED' : 'COPY CODE' }}
          </button>
          <span class="room-mode-tag">{{ modeLabel(mpStore.stackingMode) }} RULES</span>
        </div>

        <div class="players-section">
          <div class="players-count">
            <span class="players-count-num">{{ mpStore.gamePlayers.length }}</span>
            <span class="players-count-of">of 10 players</span>
          </div>

          <div class="players-list">
            <div
              v-for="player in mpStore.gamePlayers"
              :key="player.id"
              class="player-chip"
            >
              <div class="player-avatar">{{ player.name?.charAt(0) }}</div>
              <span class="player-name">{{ player.name }}</span>
              <span
                v-if="player.user_id === mpStore.currentGame?.host_id"
                class="player-badge"
              >HOST</span>
            </div>
            <div
              v-if="mpStore.gamePlayers.length < 10"
              class="player-chip player-chip-empty"
            >
              <div class="player-avatar empty">+</div>
              <span class="player-name muted">Waiting…</span>
            </div>
          </div>
        </div>

        <div class="waiting-actions">
          <Button
            v-if="mpStore.isHost"
            variant="primary"
            size="lg"
            block
            :disabled="mpStore.gamePlayers.length < 2"
            @click="startGame"
          >
            {{
              mpStore.gamePlayers.length < 2
                ? 'NEED AT LEAST 2 PLAYERS'
                : `START GAME (${mpStore.gamePlayers.length})`
            }}
          </Button>
          <p v-else class="waiting-text">
            Waiting for host to start the game…
          </p>
          <button class="leave-link" @click="leaveGame">LEAVE GAME</button>
        </div>
      </div>
    </div>

    <!-- Join Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showJoinModal"
          class="modal-overlay"
          @click.self="showJoinModal = false"
        >
          <div class="join-modal">
            <h2 class="join-modal-title">JOIN GAME</h2>
            <p class="join-modal-desc">Enter the 6-character room code</p>

            <input
              v-model="joinCode"
              type="text"
              placeholder="ABC123"
              maxlength="6"
              class="room-input"
              @keyup.enter="joinGame"
              autofocus
            />

            <div v-if="mpStore.error" class="error-banner">
              {{ mpStore.error }}
            </div>

            <div class="join-modal-actions">
              <Button
                variant="ghost"
                size="md"
                block
                :disabled="mpStore.loading"
                @click="showJoinModal = false"
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="md"
                block
                :disabled="joinCode.length < 4 || mpStore.loading"
                @click="joinGame"
              >
                {{ mpStore.loading ? 'JOINING...' : 'JOIN' }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
import Button from './ui/Button.vue'
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
const selectedStackingMode = ref<StackingMode>(gameStore.stackingMode)

const stackingModes: { value: StackingMode; label: string; desc: string }[] = [
  { value: 'official', label: 'OFFICIAL', desc: 'Equal or higher value to stack a draw' },
  { value: 'house', label: 'HOUSE', desc: 'Wild draws stack on anything' },
  { value: 'casual', label: 'CASUAL', desc: 'Any draw stacks on any draw' },
]

function modeLabel(m: StackingMode) {
  return stackingModes.find((x) => x.value === m)?.label || 'OFFICIAL'
}

async function handleCreateGame() {
  await mpStore.createGame(selectedStackingMode.value)
}

async function joinGame() {
  if (mpStore.loading) return
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
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<style scoped>
.lobby-container {
  min-height: 100vh;
  background: var(--bg-concrete);
  color: var(--text-primary);
  position: relative;
  display: flex;
  flex-direction: column;
}

/* TOP BAR — mirrors landing top bar pattern */
.lobby-top-bar {
  position: relative;
  z-index: var(--z-hud);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid rgba(255, 204, 0, 0.08);
  background: linear-gradient(180deg, rgba(10, 10, 11, 0.95), rgba(10, 10, 11, 0.7));
  flex-wrap: wrap;
}

.brand-mark {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-2);
  text-decoration: none;
  color: var(--text-primary);
}

.brand-mark-uno {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0.05em;
}

.brand-mark-nomercy {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  letter-spacing: 0.2em;
  color: var(--color-alert);
  text-shadow: 0 0 12px rgba(255, 42, 42, 0.5);
}

.top-bar-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-3);
}

.username-chip {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.15em;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
}

.text-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: var(--spacing-2);
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.text-link:hover {
  color: var(--color-neon-blue);
}

.upgrade-link {
  color: var(--color-neon-blue);
}

.upgrade-link:hover {
  color: var(--color-hazard);
}

/* CONTENT */
.lobby-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--spacing-8) var(--spacing-4);
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  gap: var(--spacing-6);
}

.error-banner {
  background: rgba(255, 42, 42, 0.1);
  border: 1px solid var(--color-alert);
  color: var(--color-alert);
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  text-align: center;
  border-radius: var(--radius-sm);
}

/* ENTRY */
.lobby-entry {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.primary-action {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mode-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
}

.mode-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  flex-shrink: 0;
}

.mode-pills {
  display: flex;
  gap: var(--spacing-1);
  flex: 1;
  justify-content: flex-end;
}

.mode-pill {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  padding: var(--spacing-1) var(--spacing-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-snap) var(--ease-snap);
}

.mode-pill:hover {
  border-color: var(--color-hazard-dim);
  color: var(--text-primary);
}

.mode-pill.active {
  border-color: var(--color-hazard);
  color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.06);
}

/* DIVIDER */
.entry-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.3em;
  position: relative;
}

.entry-divider::before,
.entry-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 var(--spacing-4);
}

/* SECONDARY ACTIONS */
.secondary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

/* TERTIARY STATS LINK */
.stats-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: var(--spacing-3);
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.stats-link:hover {
  color: var(--color-neon-blue);
}

.lobby-stats {
  align-self: center;
}

/* WAITING ROOM */
.waiting-room {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  align-items: center;
}

.room-code-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  background: rgba(255, 204, 0, 0.04);
  border: 1px solid var(--color-hazard-dim);
  border-radius: var(--radius-md);
  width: 100%;
}

.room-code-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.3em;
}

.room-code-value {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 9vw, 3.5rem);
  letter-spacing: 0.4rem;
  color: var(--color-hazard);
  text-shadow: 0 0 20px rgba(255, 204, 0, 0.4);
}

.copy-btn {
  background: var(--color-hazard);
  border: none;
  color: var(--bg-concrete);
  padding: var(--spacing-2) var(--spacing-4);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 44px;
  transition: filter var(--duration-snap) var(--ease-snap);
}

.copy-btn:hover {
  filter: brightness(1.1);
}

.room-mode-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  margin-top: var(--spacing-2);
}

.players-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.players-count {
  text-align: center;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  font-size: var(--text-sm);
}

.players-count-num {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin-right: var(--spacing-2);
}

.players-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
}

.player-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-pill);
}

.player-chip-empty {
  border-style: dashed;
  opacity: 0.5;
}

.player-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-neon-blue);
  color: var(--bg-concrete);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--text-sm);
}

.player-avatar.empty {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.player-name {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.player-name.muted {
  color: var(--text-muted);
}

.player-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-hazard);
  color: var(--bg-concrete);
  padding: 2px var(--spacing-2);
  border-radius: var(--radius-sm);
  letter-spacing: 0.1em;
  font-weight: bold;
}

.waiting-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
}

.waiting-text {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.15em;
  text-align: center;
}

.leave-link {
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

.leave-link:hover {
  color: var(--color-alert);
}

/* JOIN MODAL */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
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

.join-modal {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(0, 243, 255, 0.25);
  border-radius: var(--radius-md);
  padding: var(--spacing-8) var(--spacing-6);
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 0 40px rgba(0, 243, 255, 0.12);
}

.join-modal-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  letter-spacing: 0.1em;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-2);
}

.join-modal-desc {
  font-family: var(--font-body);
  color: var(--text-muted);
  margin: 0 0 var(--spacing-6);
  font-size: var(--text-sm);
}

.room-input {
  width: 100%;
  padding: var(--spacing-4);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  text-align: center;
  letter-spacing: 0.4rem;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  margin-bottom: var(--spacing-4);
  border-radius: var(--radius-sm);
  transition: border-color var(--duration-snap) var(--ease-snap);
}

.room-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.join-modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

/* MOBILE TWEAKS */
@media (max-width: 600px) {
  .lobby-top-bar {
    padding: var(--spacing-3);
  }

  .brand-mark-uno {
    font-size: var(--text-lg);
  }

  .brand-mark-nomercy {
    font-size: var(--text-xs);
    letter-spacing: 0.15em;
  }

  .username-chip {
    display: none;
  }

  .lobby-content {
    padding: var(--spacing-6) var(--spacing-4);
    gap: var(--spacing-4);
  }

  .mode-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-2);
  }

  .mode-pills {
    justify-content: stretch;
  }

  .mode-pill {
    flex: 1;
  }

  .secondary-actions {
    grid-template-columns: 1fr;
  }
}
</style>
