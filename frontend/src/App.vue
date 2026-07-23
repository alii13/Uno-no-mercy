<template>
  <div class="app-container">
    <!-- Loading state -->
    <div v-if="authStore.loading" class="loading-screen" role="status" aria-label="Loading">
      <h1 class="loading-brand">
        <span class="loading-uno">UNO</span>
        <span class="loading-nomercy">NO MERCY</span>
      </h1>
      <div class="loading-dot" aria-hidden="true"></div>
      <p class="loading-text">INITIALIZING</p>
    </div>

    <!-- Password recovery mode -->
    <template v-else-if="showPasswordReset">
      <div class="reset-container">
        <div class="reset-card">
          <h1 class="reset-brand">
            <span class="reset-uno">UNO</span>
            <span class="reset-nomercy">NO MERCY</span>
          </h1>
          <p class="reset-tagline">SET A NEW PASSWORD</p>

          <form class="reset-form" @submit.prevent="handlePasswordUpdate">
            <label class="field">
              <span class="field-label">NEW PASSWORD</span>
              <input
                v-model="newPassword"
                v-focus-ring
                type="password"
                placeholder="At least 6 characters"
                required
                minlength="6"
                autocomplete="new-password"
                class="field-input"
              />
            </label>

            <label class="field">
              <span class="field-label">CONFIRM PASSWORD</span>
              <input
                v-model="confirmPassword"
                v-focus-ring
                type="password"
                placeholder="Re-enter password"
                required
                minlength="6"
                autocomplete="new-password"
                class="field-input"
              />
            </label>

            <p v-if="resetError" class="msg msg-error">{{ resetError }}</p>
            <p v-if="resetSuccess" class="msg msg-success">{{ resetSuccess }}</p>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              :disabled="resetLoading"
            >
              {{ resetLoading ? 'UPDATING...' : 'UPDATE PASSWORD' }}
            </Button>
          </form>
        </div>
      </div>
    </template>

    <!-- Playing local game vs bot (works without auth for guest play) -->
    <GameView v-else-if="localGameStore.gameState !== 'LOBBY'" />

    <!-- Not authenticated -->
    <template v-else-if="!authStore.isAuthenticated">
      <AuthView v-if="showAuthView" @back="showAuthView = false" :initial-mode="authMode" />
      <LandingPage v-else @showAuth="handleShowAuth" @playGuest="playAsGuest" :loading="guestLoading" />
    </template>

    <!-- Playing multiplayer game -->
    <MultiplayerGameView
      v-else-if="mpStore.currentGame && (mpStore.currentGame.status === 'playing' || mpStore.currentGame.status === 'finished')"
    />

    <!-- Player Dashboard -->
    <PlayerDashboard
      v-else-if="showDashboard"
      @back="showDashboard = false"
    />

    <!-- Authenticated - show lobby -->
    <MultiplayerLobby
      v-else
      @playLocal="startLocalGame"
      @showAuth="handleShowAuth('signup')"
      @showStats="showDashboard = true"
    />

    <!-- Always-mounted global settings drawer (Teleport'd to body) -->
    <SettingsDrawer />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { track, trackScreen } from './utils/analytics'
import LandingPage from './components/LandingPage.vue'
import AuthView from './components/AuthView.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import Button from './components/ui/Button.vue'
// The gameplay surfaces are code-split: a first-time visitor who only sees the
// landing page shouldn't download the whole game engine + dashboard. They load
// on demand when the view is first shown.
const MultiplayerLobby = defineAsyncComponent(() => import('./components/MultiplayerLobby.vue'))
const PlayerDashboard = defineAsyncComponent(() => import('./components/PlayerDashboard.vue'))
const GameView = defineAsyncComponent(() => import('./components/game/GameView.vue'))
const MultiplayerGameView = defineAsyncComponent(() => import('./components/game/MultiplayerGameView.vue'))
import { vFocusRing } from './directives/focusRing'
import { useAuthStore } from './stores/authStore'
import { supabase } from './lib/supabase'
import { useMultiplayerStore } from './stores/multiplayerStore'
import { useGameStore } from './stores/gameStore'

const authStore = useAuthStore()
const mpStore = useMultiplayerStore()
const localGameStore = useGameStore()

const showAuthView = ref(false)
const authMode = ref<'login' | 'signup'>('signup')
const showDashboard = ref(false)
const showPasswordReset = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const resetError = ref('')
const resetSuccess = ref('')
const resetLoading = ref(false)

// Virtual page views: this SPA has no router, so GA otherwise sees one
// eternal page. One page_view per screen gives time-per-screen for free
// in GA's standard engagement reports. Mirrors the template's v-if chain.
const currentScreen = computed(() => {
  if (authStore.loading) return null
  if (showPasswordReset.value) return 'password_reset'
  if (localGameStore.gameState !== 'LOBBY') return 'sp_game'
  if (!authStore.isAuthenticated) return showAuthView.value ? 'auth' : 'landing'
  const mpStatus = mpStore.currentGame?.status
  if (mpStatus === 'playing' || mpStatus === 'finished') return 'mp_game'
  if (mpStatus === 'waiting') return 'waiting_room'
  if (showDashboard.value) return 'dashboard'
  return 'lobby'
})
watch(currentScreen, (screen) => {
  if (screen) trackScreen(screen)
})

let authSubscription: { unsubscribe: () => void } | null = null

onMounted(async () => {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showPasswordReset.value = true
    }
  })
  authSubscription = data.subscription

  await authStore.initialize()

  // Reconnect: if we were in an in-progress game when the tab reloaded/dropped,
  // re-enter it instead of stranding the player in the lobby.
  if (authStore.isAuthenticated) {
    await mpStore.restoreActiveGame()
  }
})

// App remounts (HMR) would otherwise stack PASSWORD_RECOVERY listeners.
onUnmounted(() => {
  authSubscription?.unsubscribe()
  authSubscription = null
})

async function handlePasswordUpdate() {
  resetError.value = ''
  resetSuccess.value = ''

  if (newPassword.value !== confirmPassword.value) {
    resetError.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 6) {
    resetError.value = 'Password must be at least 6 characters'
    return
  }

  resetLoading.value = true
  try {
    const result = await authStore.updatePassword(newPassword.value)
    if (result.success) {
      resetSuccess.value = 'Password updated. Redirecting...'
      setTimeout(() => {
        showPasswordReset.value = false
        newPassword.value = ''
        confirmPassword.value = ''
      }, 1500)
    } else {
      resetError.value = result.error || 'Failed to update password'
    }
  } finally {
    resetLoading.value = false
  }
}

function handleShowAuth(mode: 'login' | 'signup') {
  authMode.value = mode
  showAuthView.value = true
}

const guestLoading = ref(false)

async function playAsGuest(nickname?: string) {
  guestLoading.value = true
  track('play_clicked', { method: 'guest' })
  try {
    const result = await authStore.signInAnonymously(nickname)
    if (!result.success) {
      console.error('Guest sign-in failed:', result.error)
      track('signin_failed', { message: result.error ?? 'unknown' })
    }
  } finally {
    guestLoading.value = false
  }
}

function startLocalGame(mode?: 'official' | 'house' | 'casual') {
  localGameStore.initializeGame(['You', 'Terminator'], mode)
}
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100vw;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  background: var(--bg-concrete);
  color: var(--text-primary);
}

@media (max-width: 480px) {
  .app-container {
    -webkit-overflow-scrolling: touch;
  }
}

/* LOADING SCREEN — brand-led, single pulsing dot, no spinner */
.loading-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-6);
  z-index: var(--z-toast);
  background: var(--bg-concrete);
}

.loading-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
}

.loading-uno {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 8vw, 3.5rem);
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.loading-nomercy {
  font-family: var(--font-display);
  font-size: clamp(0.875rem, 3vw, 1.25rem);
  letter-spacing: 0.3em;
  color: var(--color-alert);
  text-shadow: 0 0 12px rgba(255, 42, 42, 0.5);
}

.loading-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-alert);
  box-shadow: 0 0 16px var(--color-alert);
  animation: loading-pulse 1.4s ease-in-out infinite;
}

@keyframes loading-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.6);
    opacity: 1;
  }
}

.loading-text {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.4em;
  margin: 0;
}

@media (prefers-reduced-motion: reduce) {
  .loading-dot {
    animation: none;
    opacity: 0.8;
  }
}

/* PASSWORD RESET CARD — matches auth card styling */
.reset-container {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
  background: var(--bg-concrete);
}

.reset-card {
  width: 100%;
  max-width: 440px;
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: var(--spacing-8) var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.reset-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
}

.reset-uno {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 8vw, 3.5rem);
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.reset-nomercy {
  font-family: var(--font-display);
  font-size: clamp(0.875rem, 3vw, 1.25rem);
  letter-spacing: 0.3em;
  color: var(--color-alert);
  text-shadow: 0 0 12px rgba(255, 42, 42, 0.5);
}

.reset-tagline {
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  letter-spacing: 0.2em;
  color: var(--text-secondary);
  text-transform: uppercase;
  text-align: center;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.field-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.18em;
}

.field-input {
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  border-radius: var(--radius-sm);
  transition: border-color var(--duration-snap) var(--ease-snap);
  min-height: 44px;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.msg {
  margin: 0;
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  border: 1px solid;
  text-align: center;
}

.msg-error {
  background: rgba(255, 42, 42, 0.08);
  border-color: var(--color-alert);
  color: var(--color-alert);
}

.msg-success {
  background: rgba(0, 255, 102, 0.08);
  border-color: var(--color-neon-green);
  color: var(--color-neon-green);
}
</style>
