<template>
  <div class="color-picker-overlay">
    <div 
      class="tactical-hud" 
      :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    >
      <div
        class="hud-header"
        :class="{ 'header-danger': isRoulette }"
        @mousedown="startDrag"
        @touchstart.prevent="startTouchDrag"
        style="cursor: grab;"
      >
        <svg class="warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>{{ title }}</span>
        <svg class="drag-hint" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
      </div>
      
      <h3>{{ subtitle }}</h3>
      
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
        DRAG HEADER TO MOVE • AWAITING INPUT...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onUnmounted } from 'vue'
import type { CardColor } from '../../types/card'

withDefaults(defineProps<{
  title?: string
  subtitle?: string
  isRoulette?: boolean
}>(), {
  title: 'AUTHORIZATION REQUIRED',
  subtitle: 'SELECT FREQUENCY',
  isRoulette: false
})

const colors: CardColor[] = ['red', 'blue', 'green', 'yellow']

defineEmits<{
  (e: 'select', color: CardColor): void
}>()

// Drag functionality — modal is translated from a centered start position,
// so position.{x,y} represents the offset from screen centre. Clamp it so
// the modal's drag handle never leaves the viewport (audit-flagged: it
// could previously be dragged off-screen with no way back).
const position = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = reactive({ x: 0, y: 0 })
const HANDLE_MARGIN = 60 // keep at least this much of the modal in-view

function clampPosition() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const maxX = Math.max(0, vw / 2 - HANDLE_MARGIN)
  const maxY = Math.max(0, vh / 2 - HANDLE_MARGIN)
  position.x = Math.max(-maxX, Math.min(maxX, position.x))
  position.y = Math.max(-maxY, Math.min(maxY, position.y))
}

function startDrag(e: MouseEvent) {
  isDragging.value = true
  dragStart.x = e.clientX - position.x
  dragStart.y = e.clientY - position.y
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  position.x = e.clientX - dragStart.x
  position.y = e.clientY - dragStart.y
  clampPosition()
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onTouchDrag)
  document.removeEventListener('touchend', stopDrag)
}

function startTouchDrag(e: TouchEvent) {
  const touch = e.touches[0]
  if (!touch) return
  isDragging.value = true
  dragStart.x = touch.clientX - position.x
  dragStart.y = touch.clientY - position.y
  document.addEventListener('touchmove', onTouchDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
}

function onTouchDrag(e: TouchEvent) {
  if (!isDragging.value) return
  e.preventDefault()
  const touch = e.touches[0]
  if (!touch) return
  position.x = touch.clientX - dragStart.x
  position.y = touch.clientY - dragStart.y
  clampPosition()
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', onTouchDrag)
  document.removeEventListener('touchend', stopDrag)
})
</script>

<style scoped>
.color-picker-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
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

.header-danger {
  color: #ff3333 !important;
  border-bottom-color: #ff3333 !important;
  animation: blink-red 0.5s infinite;
}

@keyframes blink-red {
  0%, 100% { background: rgba(255, 0, 0, 0); }
  50% { background: rgba(255, 0, 0, 0.2); }
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
  user-select: none;
}

.drag-hint {
  margin-left: auto;
  opacity: 0.5;
}

.warning-icon {
  flex-shrink: 0;
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

@media (max-width: 480px) {
  .tactical-hud {
    width: 95vw;
    padding: 1rem;
  }

  h3 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
  }

  .hud-header {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    font-size: 0.8rem;
    gap: 0.5rem;
  }

  .color-btn {
    height: 65px;
  }

  .colors-grid {
    gap: 0.75rem;
  }

  .btn-inner {
    font-size: 1.1rem;
  }

  .hud-footer {
    margin-top: 1rem;
    font-size: 0.7rem;
  }
}

@media (max-width: 768px) and (min-width: 481px) {
  .tactical-hud {
    width: 85vw;
    padding: 1.5rem;
  }
}
</style>
