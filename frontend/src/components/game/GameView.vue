<template>
  <div class="game-view" :class="{ 'shake-screen': isShakeActive }">
    <!-- Ambient Background Elements -->
    <div class="metal-surface"></div>
    <div class="warning-stripes top"></div>
    <div class="warning-stripes bottom"></div>
    <div class="vignette"></div>

    <!-- Directional Cog Animation (Background) -->
    <div class="mechanical-cog" :class="{ 'spin-ccw': store.direction === -1 }">
      ⚙️
    </div>

    <!-- Top Bar: Opponents Surveillance -->
    <div class="surveillance-bar">
      <div class="bar-label">OPPONENT_FEED_LIVE</div>
      <div class="opponents-grid">
        <OpponentHand 
          v-for="player in opponents" 
          :key="player.id"
          :player="player" 
          :is-active="player.id === store.currentPlayer?.id"
          :is-selectable="store.turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn"
          @click="onOpponentClick(player.id)"
        />
      </div>
    </div>

    <!-- Main Game Table "The Pit" -->
    <div class="battle-pit">
      <!-- Draw Station -->
      <div class="station draw-station" @click="drawCard">
        <div class="station-mark">DRAW_PILE</div>
        <CardPile :cards="store.deck" />
        <div class="action-hint" v-if="isMyTurn && store.turnState === 'WAITING_FOR_ACTION'">
          [ CLICK TO DRAW ]
        </div>
      </div>

      <!-- Discard Station (Center) -->
      <div class="station discard-station" ref="discardAreaRef">
        <div class="station-mark warning">DISCARD_ZONE</div>
        <CardPile :cards="store.discardPile" :is-discard="true" :large="true" />
        
        <!-- Status Readout Overlay -->
        <div class="status-panel">
            <div class="panel-row">
                <span class="label">TURN</span>
                <span class="value blink" v-if="store.currentPlayer">{{ store.currentPlayer.name }}</span>
            </div>
            <div class="panel-row" v-if="store.drawStack > 0">
                <span class="label hazard">STACK_LEVEL</span>
                <span class="value hazard-text">+{{ store.drawStack }}</span>
            </div>
             <div class="panel-row" v-if="gameMessage">
                <span class="message-text">{{ gameMessage }}</span>
            </div>
        </div>
      </div>

      <!-- Utilities Sidebar -->
      <div class="utilities-sidebar">
        <div class="control-switch" @click="toggleSound">
            <div class="switch-label">AUDIO</div>
            <div class="switch-indicator" :class="{ active: !soundEffects.isMuted.value }"></div>
        </div>
      </div>
    </div>

    <!-- Player Console (Bottom) -->
    <div class="player-console">
      <div class="console-header">
        <div class="console-id">PLAYER: {{ myPlayer?.name }}</div>
        <div class="console-status" :class="{ 'status-active': isMyTurn }">
            STATUS: {{ isMyTurn ? 'ACTION_REQUIRED' : 'STANDBY' }}
        </div>
      </div>
      
      <div class="controls-area">
        <button v-if="store.turnState === 'CHOOSING_PLAYER_TO_SWAP'" class="btn-hazard">
          ⚠ SELECT TARGET TO SWAP
        </button>
      </div>

      <div class="hand-container-wrapper">
         <PlayerHand 
            v-if="myPlayer"
            :hand="myPlayer.hand" 
            :is-my-turn="isMyTurn"
            :discard-area-ref="discardAreaRef"
          />
      </div>
    </div>
    
    <!-- Animated Card Layer (for flying cards) -->
    <div class="animation-layer" ref="animationLayer"></div>
    
    <!-- Modals / Overlays -->
    <ColorPickerModal 
      v-if="store.turnState === 'CHOOSING_ROULETTE_COLOR' && isMyTurn"
      @select="(c) => store.setRouletteColor(c)"
    />

    <div v-if="store.gameState === 'GAME_OVER'" class="overlay">
      <div class="modal terminal-modal">
        <h1 class="glitch-text" data-text="GAME OVER">GAME OVER</h1>
        <div class="scan-line"></div>
        <p class="winner-text">VICTOR: {{ getWinnerName() }}</p>
        <button @click="restart" class="btn-primary">REBOOT_SYSTEM</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, provide, watch } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { soundEffects } from '../../composables/useSoundEffects'
import OpponentHand from './OpponentHand.vue'
import PlayerHand from './PlayerHand.vue'
import CardPile from './CardPile.vue'
import ColorPickerModal from './ColorPickerModal.vue'

const store = useGameStore()

// For MVP single player, we assume we are player 0
const myPlayerId = 'p-0'

const discardAreaRef = ref<HTMLElement | null>(null)
const animationLayer = ref<HTMLElement | null>(null)

// Provide refs for child components
provide('discardAreaRef', discardAreaRef)
provide('animationLayer', animationLayer)

const myPlayer = computed(() => store.players.find(p => p.id === myPlayerId))
const opponents = computed(() => store.players.filter(p => p.id !== myPlayerId))

const isMyTurn = computed(() => store.currentPlayer?.id === myPlayerId)

const gameMessage = computed(() => {
  if (store.turnState === 'CHOOSING_PLAYER_TO_SWAP') return "INITIATE HAND SWAP"
  if (store.turnState === 'ROULETTE_DRAWING') {
    const target = store.rouletteTargetColor?.toUpperCase() || store.currentColor.toUpperCase()
    return `ROULETTE: SEEKING ${target}`
  }
  return ""
})

const isShakeActive = ref(false)

// Watch for big stack increases to trigger shake
watch(() => store.drawStack, (newVal, oldVal) => {
  if (newVal > oldVal && newVal >= 6) {
    triggerShake()
  }
})

function triggerShake() {
  isShakeActive.value = true
  setTimeout(() => {
    isShakeActive.value = false
  }, 500)
}

function drawCard() {
  if (isMyTurn.value && store.turnState === 'WAITING_FOR_ACTION') {
    soundEffects.playCardPick()
    store.drawCardsForCurrentPlayer()
  }
}

function toggleSound() {
  soundEffects.toggleMute()
}

function getWinnerName() {
  const w = store.players.find(p => p.id === store.winnerId)
  return w ? w.name : 'UNKNOWN_ENTITY'
}

function restart() {
  store.initializeGame(['Hero', 'Rival 1', 'Rival 2', 'Rival 3'])
}
function onOpponentClick(playerId: string) {
  if (store.turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn.value) {
    store.swapHands(playerId)
  }
}
</script>

<style scoped>
.game-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  position: relative;
  background: var(--bg-concrete);
  color: var(--text-primary);
}

.metal-surface {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  pointer-events: none;
  z-index: 0;
  opacity: 0.1;
  background: 
    repeating-linear-gradient(90deg, transparent 0, transparent 50px, #000 50px, #000 51px),
    repeating-linear-gradient(0deg, transparent 0, transparent 50px, #000 50px, #000 51px);
}

.warning-stripes {
  position: absolute;
  left: 0;
  width: 100%;
  height: 10px;
  background: repeating-linear-gradient(
    45deg,
    var(--color-hazard-dim),
    var(--color-hazard-dim) 10px,
    #000 10px,
    #000 20px
  );
  z-index: 10;
  opacity: 0.5;
}
.warning-stripes.top { top: 0; }
.warning-stripes.bottom { bottom: 0; }

.vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8));
  pointer-events: none;
  z-index: 1;
}

.mechanical-cog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 30rem;
  opacity: 0.03;
  color: white;
  z-index: 0;
  transition: transform 1s ease-out;
}
.spin-ccw { transform: translate(-50%, -50%) rotate(-360deg); }

/* SURVEILLANCE BAR */
.surveillance-bar {
  flex: 0 0 auto;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(5px);
  border-bottom: 1px solid #333;
  padding: 0.5rem;
  z-index: 2;
  display: flex;
  flex-direction: column;
}

.bar-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  margin-left: 1rem;
}

.opponents-grid {
  display: flex;
  justify-content: center;
  gap: 2rem;
}

/* BATTLE PIT */
.battle-pit {
  flex: 1;
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 200px 1fr 100px;
  align-items: center;
  padding: 0 2rem;
}

.station {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.station-mark {
  position: absolute;
  top: -2rem;
  font-weight: bold;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.1);
  letter-spacing: 2px;
  pointer-events: none;
  border: 2px solid rgba(255,255,255,0.1);
  padding: 0.25rem 0.5rem;
}

.station-mark.warning {
  border-color: var(--color-hazard-dim);
  color: var(--color-hazard-dim);
  opacity: 0.3;
}

.draw-station {
  cursor: pointer;
}
.draw-station:hover {
  filter: brightness(1.2);
}

.action-hint {
  font-size: 0.8rem;
  color: var(--color-neon-blue);
  animation: flicker 2s infinite;
}

.discard-station {
  position: relative;
}

.status-panel {
  margin-top: 2rem;
  background: rgba(0,0,0,0.6);
  border: 1px solid #333;
  padding: 0.5rem;
  width: 200px;
}

.panel-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
}

.label { color: var(--text-muted); }
.value { color: var(--text-primary); font-weight: bold; }
.label.hazard { color: var(--color-alert); }
.value.hazard-text { color: var(--color-alert); text-shadow: 0 0 5px red; }

.blink { animation: flicker 3s infinite; }

/* PLAYER CONSOLE */
.player-console {
  flex: 0 0 auto;
  background: var(--surface-metal-dark);
  border-top: 2px solid #333;
  padding: 1rem;
  z-index: 10;
  box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
}

.console-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--text-secondary);
  border-bottom: 1px dashed #333;
  padding-bottom: 0.5rem;
}

.status-active {
  color: var(--color-neon-green);
  text-shadow: 0 0 5px var(--color-neon-green);
}

.controls-area {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
}

.btn-hazard {
  background: var(--color-hazard);
  color: black;
  border: none;
  padding: 0.5rem 2rem;
  font-weight: bold;
  font-family: var(--font-display);
  cursor: pointer;
  clip-path: polygon(10% 0, 100% 0, 90% 100%, 0% 100%);
}

.hand-container-wrapper {
  min-height: 150px;
}

/* MODAL */
.overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.terminal-modal {
  background: #111;
  border: 2px solid var(--color-neon-green);
  padding: 3rem;
  text-align: center;
  position: relative;
  width: 500px;
  overflow: hidden;
  box-shadow: 0 0 20px rgba(0, 255, 100, 0.2);
}

.winner-text {
  font-size: 1.5rem;
  margin: 2rem 0;
  color: var(--color-neon-green);
}

.btn-primary {
  background: transparent;
  border: 1px solid var(--color-neon-green);
  color: var(--color-neon-green);
  padding: 1rem 3rem;
  font-family: var(--font-display);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: var(--color-neon-green);
  color: black;
  box-shadow: 0 0 20px var(--color-neon-green);
}

.utilities-sidebar .control-switch {
  cursor: pointer;
  text-align: center;
}
.switch-indicator {
  width: 30px; height: 10px; background: #333; margin: 0 auto;
}
.switch-indicator.active {
  background: var(--color-neon-blue);
  box-shadow: 0 0 10px var(--color-neon-blue);
}

.shake-screen {
  animation: screen-shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
}

@keyframes screen-shake {
  10%, 90% { transform: translate3d(-1px, 0, 0) rotate(-1deg); }
  20%, 80% { transform: translate3d(2px, 0, 0) rotate(1deg); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0) rotate(-2deg); }
  40%, 60% { transform: translate3d(4px, 0, 0) rotate(2deg); }
}
</style>
