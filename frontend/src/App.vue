<template>
  <div class="app-container">
    <div class="scan-line"></div>
    <div class="noise-overlay"></div>
    
    <!-- Loading state -->
    <div v-if="authStore.loading" class="loading-screen">
      <div class="loader"></div>
      <p>INITIALIZING...</p>
    </div>
    
    <!-- Not authenticated -->
    <template v-else-if="!authStore.isAuthenticated">
      <!-- Show auth view if user clicked login/signup -->
      <AuthView v-if="showAuthView" @back="showAuthView = false" :initial-mode="authMode" />
      
      <!-- Otherwise show landing page -->
      <LandingPage v-else @showAuth="handleShowAuth" />
    </template>
    
    <!-- Playing multiplayer game -->
    <MultiplayerGameView 
      v-else-if="mpStore.currentGame && (mpStore.currentGame.status === 'playing' || mpStore.currentGame.status === 'finished')" 
    />
    
    <!-- Playing local game vs bot -->
    <GameView v-else-if="localGameStore.gameState !== 'LOBBY'" />
    
    <!-- Authenticated - show lobby -->
    <MultiplayerLobby 
      v-else 
      @playLocal="startLocalGame"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LandingPage from './components/LandingPage.vue'
import AuthView from './components/AuthView.vue'
import MultiplayerLobby from './components/MultiplayerLobby.vue'
import GameView from './components/game/GameView.vue'
import MultiplayerGameView from './components/game/MultiplayerGameView.vue'
import { useAuthStore } from './stores/authStore'
import { useMultiplayerStore } from './stores/multiplayerStore'
import { useGameStore } from './stores/gameStore'

const authStore = useAuthStore()
const mpStore = useMultiplayerStore()
const localGameStore = useGameStore()

const showAuthView = ref(false)
const authMode = ref<'login' | 'signup'>('signup')

onMounted(() => {
  authStore.initialize()
})

function handleShowAuth(mode: 'login' | 'signup') {
  authMode.value = mode
  showAuthView.value = true
}

function startLocalGame() {
  localGameStore.initializeGame(['You', 'Terminator'])
}
</script>

<style scoped>
.app-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background: var(--bg-concrete);
  color: var(--text-primary);
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
</style>
