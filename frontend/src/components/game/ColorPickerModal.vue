<template>
  <div class="color-picker-overlay">
    <div class="tactical-hud">
      <div class="hud-header">
        <span class="warning-icon">⚠</span>
        <span>AUTHORIZATION REQUIRED</span>
      </div>
      
      <h3>SELECT FREQUENCY</h3>
      
      <div class="colors-grid">
        <button 
          v-for="color in colors" 
          :key="color"
          class="color-btn"
          :class="`bg-${color}`"
          @click="$emit('select', color)"
        >
          <div class="btn-inner">
            <span class="color-label">{{ color.toUpperCase() }}</span>
            <div class="scan-bar"></div>
          </div>
        </button>
      </div>
      
      <div class="hud-footer">
        AWAITING INPUT...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CardColor } from '../../types/card'

const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']

defineEmits<{
  (e: 'select', color: CardColor): void
}>()
</script>

<style scoped>
.color-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  backdrop-filter: blur(5px);
}

.tactical-hud {
  background: #111;
  border: 2px solid var(--color-hazard);
  padding: 2rem;
  width: 500px;
  position: relative;
  box-shadow: 0 0 50px rgba(255, 204, 0, 0.2);
}

/* Decorations */
.tactical-hud::before {
  content: '';
  position: absolute;
  top: -2px; left: 20%; right: 20%; height: 2px;
  background: #111; /* Cutout effect on border */
  z-index: 1;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-hazard);
  font-family: 'Courier New', monospace;
  font-weight: bold;
  letter-spacing: 2px;
  margin-bottom: 2rem;
  border-bottom: 1px dashed var(--color-hazard-dim);
  padding-bottom: 1rem;
}

.warning-icon {
  font-size: 1.5rem;
  animation: blink 1s infinite;
}

h3 {
  text-align: center;
  color: white;
  font-family: var(--font-display);
  font-size: 2rem;
  margin-bottom: 2rem;
  letter-spacing: 2px;
}

.colors-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.color-btn {
  height: 100px;
  border: none;
  background: #222;
  cursor: pointer;
  padding: 4px; /* for outer rim */
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  transition: all 0.2s;
}

.btn-inner {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: var(--font-display);
  font-size: 1.5rem;
  color: white;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
  position: relative;
  overflow: hidden;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.color-btn:hover {
  transform: scale(1.02);
  filter: brightness(1.2);
}

.bg-red .btn-inner { background: linear-gradient(135deg, #cc0000, #990000); }
.bg-blue .btn-inner { background: linear-gradient(135deg, #0066cc, #004499); }
.bg-green .btn-inner { background: linear-gradient(135deg, #00cc66, #009944); }
.bg-yellow .btn-inner { background: linear-gradient(135deg, #ffcc00, #cc9900); color: black; text-shadow: none; }

.scan-bar {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 4px;
  background: rgba(255,255,255,0.5);
  opacity: 0;
  transition: opacity 0.2s;
}

.color-btn:hover .scan-bar {
  opacity: 1;
  animation: scan-down 1s infinite linear;
}

@keyframes scan-down {
  0% { top: 0; }
  100% { top: 100%; }
}

.hud-footer {
  margin-top: 2rem;
  text-align: right;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  color: var(--text-muted);
  animation: blink 2s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
