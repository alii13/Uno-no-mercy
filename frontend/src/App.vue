<template>
  <div class="app-container">
    <div class="scan-line"></div>
    <div class="noise-overlay"></div>
    
    <GameView v-if="store.gameState !== 'LOBBY'" />
    
    <div v-else class="lobby war-room">
      <div class="left-panel">
        <div class="brand-container">
          <h1 class="title glitch-text" data-text="UNO">UNO</h1>
          <h2 class="subtitle glitch-text" data-text="NO MERCY">NO MERCY</h2>
        </div>
        <div class="warning-box">
          <div class="warning-header">
            <span class="hazard-icon">⚠️</span> CAUTION
          </div>
          <p>AUTHORIZED PERSONNEL ONLY. EXTREME PENALTY RISK.</p>
        </div>
      </div>

      <div class="right-panel">
        <div class="panel-content">
          <div class="decorative-grid"></div>
          <div class="start-sequence">
            <p class="sequence-label">INITIATE GAME SEQUENCE</p>
            <button @click="startGame" class="big-red-button">
              <span class="btn-text">ENGAGE</span>
              <div class="btn-glare"></div>
            </button>
            <div class="status-readout">
              <span>SYSTEM: ONLINE</span>
              <span>PLAYERS: AI_READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import GameView from './components/game/GameView.vue'
import { useGameStore } from './stores/gameStore'

const store = useGameStore()

function startGame() {
    // Play a mechanical sound here ideally
    store.initializeGame(['Hero', 'Rival 1', 'Rival 2', 'Rival 3'])
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

.lobby {
  height: 100%;
  display: flex;
  position: relative;
  z-index: 5;
}

.left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  padding-right: 4rem;
  background: linear-gradient(90deg, var(--bg-concrete) 60%, rgba(0,0,0,0) 100%);
  border-right: 2px solid var(--color-hazard-dim);
  position: relative;
}

.brand-container {
  text-align: right;
  margin-bottom: 4rem;
}

.title {
  font-family: var(--font-display);
  font-size: 12rem;
  line-height: 0.8;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: -5px;
  position: relative;
}

.subtitle {
  font-family: var(--font-display);
  font-size: 4rem;
  color: var(--color-alert);
  text-transform: uppercase;
  letter-spacing: 0.5rem;
}

.warning-box {
  border: 1px solid var(--color-hazard);
  padding: 1rem 2rem;
  background: rgba(255, 204, 0, 0.05);
  font-family: var(--font-body);
  border-left: 4px solid var(--color-hazard);
}

.warning-header {
  color: var(--color-hazard);
  font-weight: bold;
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.right-panel {
  flex: 1;
  background: var(--surface-metal-dark);
  display: flex;
  align-items: center;
  padding-left: 4rem;
  position: relative;
  overflow: hidden;
}

/* Hazard stripes background for right panel */
.right-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background: repeating-linear-gradient(
    -45deg,
    #111,
    #111 20px,
    #151515 20px,
    #151515 40px
  );
  z-index: 0;
}

.panel-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.sequence-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  letter-spacing: 2px;
  margin-bottom: 1rem;
}

.big-red-button {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: none;
  background: radial-gradient(circle at 30% 30%, #ff5252, #800000);
  box-shadow: 
    0 0 0 10px #2c0e0e,
    0 0 0 12px #444,
    0 20px 50px rgba(0,0,0,0.8),
    inset 0 0 20px rgba(0,0,0,0.5);
  cursor: pointer;
  position: relative;
  transition: transform 0.1s, box-shadow 0.1s;
  display: flex;
  justify-content: center;
  align-items: center;
}

.big-red-button:active {
  transform: scale(0.95);
  box-shadow: 
    0 0 0 10px #2c0e0e,
    0 0 0 12px #444,
    0 10px 30px rgba(0,0,0,0.8),
    inset 0 0 40px rgba(0,0,0,0.8);
}

.btn-text {
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: rgba(0,0,0,0.6);
  z-index: 2;
  font-weight: bold;
}

.btn-glare {
  position: absolute;
  top: 15%;
  left: 20%;
  width: 25%;
  height: 15%;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  filter: blur(5px);
}

.status-readout {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--color-neon-green);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: 0.7;
  border-left: 2px solid var(--color-neon-green);
  padding-left: 1rem;
}
</style>
