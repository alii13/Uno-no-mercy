<template>
  <div class="app-container">
    <div class="scan-line"></div>
    <div class="noise-overlay"></div>
    
    <!-- Loading state -->
    <div v-if="authStore.loading" class="loading-screen">
      <div class="loader"></div>
      <p>INITIALIZING...</p>
    </div>
    
    <!-- Password recovery mode -->
    <template v-else-if="showPasswordReset">
      <div class="reset-container">
        <div class="reset-card">
          <h1 class="reset-title glitch-text" data-text="UNO">UNO</h1>
          <h2 class="reset-subtitle">SET NEW PASSWORD</h2>
          <form @submit.prevent="handlePasswordUpdate">
            <div class="reset-input-group">
              <label>NEW PASSWORD</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="Enter new password"
                required
                minlength="6"
              />
            </div>
            <div class="reset-input-group">
              <label>CONFIRM PASSWORD</label>
              <input
                v-model="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                required
                minlength="6"
              />
            </div>
            <div v-if="resetError" class="reset-error">{{ resetError }}</div>
            <div v-if="resetSuccess" class="reset-success">{{ resetSuccess }}</div>
            <button type="submit" class="reset-btn" :disabled="resetLoading">
              {{ resetLoading ? 'UPDATING...' : 'UPDATE PASSWORD' }}
            </button>
          </form>
        </div>
      </div>
    </template>

    <!-- Playing local game vs bot (works without auth for guest play) -->
    <GameView v-else-if="localGameStore.gameState !== 'LOBBY'" />

    <!-- Not authenticated -->
    <template v-else-if="!authStore.isAuthenticated">
      <!-- Show auth view if user clicked login/signup -->
      <AuthView v-if="showAuthView" @back="showAuthView = false" :initial-mode="authMode" />

      <!-- Otherwise show landing page -->
      <LandingPage v-else @showAuth="handleShowAuth" @playGuest="playAsGuest" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LandingPage from './components/LandingPage.vue'
import AuthView from './components/AuthView.vue'
import MultiplayerLobby from './components/MultiplayerLobby.vue'
import PlayerDashboard from './components/PlayerDashboard.vue'
import GameView from './components/game/GameView.vue'
import MultiplayerGameView from './components/game/MultiplayerGameView.vue'
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

onMounted(() => {
  authStore.initialize()

  // Listen for password recovery event
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showPasswordReset.value = true
    }
  })
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

async function playAsGuest() {
  const result = await authStore.signInAnonymously()
  if (!result.success) {
    console.error('Guest sign-in failed:', result.error)
  }
  // Once authenticated (even anonymously), App.vue will show the lobby
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

.scan-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    to bottom,
    transparent 50%,
    rgba(0, 0, 0, 0.2) 51%
  );
  background-size: 100% 4px;
  pointer-events: none;
  z-index: 10;
}

.noise-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 9;
  opacity: 0.4;
}

.loading-screen {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  z-index: 5;
  position: relative;
}

.loader {
  width: 50px;
  height: 50px;
  border: 3px solid #333;
  border-top-color: var(--color-neon-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-screen p {
  color: var(--text-muted);
  letter-spacing: 3px;
}

.reset-container {
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
  position: relative;
  padding: 2rem;
}

.reset-card {
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid #333;
  padding: 3rem;
  max-width: 400px;
  width: 100%;
}

.reset-title {
  font-family: var(--font-display);
  font-size: 4rem;
  text-align: center;
  margin: 0;
}

.reset-subtitle {
  font-family: var(--font-display);
  font-size: 1.2rem;
  text-align: center;
  color: var(--color-hazard);
  margin: 0 0 2rem 0;
}

.reset-input-group {
  margin-bottom: 1.5rem;
}

.reset-input-group label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  letter-spacing: 1px;
}

.reset-input-group input {
  width: 100%;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
  color: white;
  font-size: 1rem;
}

.reset-input-group input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.reset-error {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid #ff4444;
  color: #ff6666;
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.reset-success {
  background: rgba(0, 255, 100, 0.1);
  border: 1px solid var(--color-neon-green);
  color: var(--color-neon-green);
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.reset-btn {
  width: 100%;
  padding: 1.2rem;
  background: linear-gradient(145deg, var(--color-hazard) 0%, var(--color-hazard-dim) 100%);
  border: none;
  color: black;
  font-family: var(--font-display);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: var(--shadow-glow-yellow);
}

.reset-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
