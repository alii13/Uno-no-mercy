<template>
  <div class="opponent-hand" :class="{ active: isActive, selectable: isSelectable }">
    <div class="avatar" :class="{ 'avatar-active': isActive }">
      {{ player.name.charAt(0).toUpperCase() }}
      <div class="scan-line"></div>
    </div>
    <div class="info">
      <div class="name-row">
        <span class="name">{{ player.name }}</span>
        <span class="status-dot" :class="{ active: isActive }"></span>
      </div>
      <div class="card-count">{{ player.hand.length }} INTEL</div>
      <div v-if="player.isEliminated" class="eliminated-badge">TERMINATED</div>
    </div>
    
    <!-- Face-down cards in a fan formation -->
    <div class="card-fan" :class="{ 'many-cards': player.hand.length > 10 }">
      <CardBack 
        v-for="i in displayCount" 
        :key="i"
        :size="cardSize"
        class="fan-card"
        :style="getFanStyle(i)"
      />
      <div v-if="player.hand.length > maxDisplay" class="more-cards">
        +{{ player.hand.length - maxDisplay }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../../types/card'
import CardBack from './CardBack.vue'

const props = defineProps<{
  player: Player
  isActive: boolean
  isSelectable?: boolean
}>()

const maxDisplay = 7
const cardSize = { width: 40, height: 56 }

const displayCount = computed(() => Math.min(props.player.hand.length, maxDisplay))

// Create fan formation style
function getFanStyle(index: number) {
  const total = displayCount.value
  const middleIndex = (total - 1) / 2
  const offset = index - 1 - middleIndex
  
  // Rotation: cards fan out from center
  const rotation = offset * 8
  // Horizontal spread
  const translateX = offset * 18
  // Vertical arc - cards in middle are slightly higher
  const translateY = Math.abs(offset) * 3
  
  return {
    transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg)`,
    zIndex: index
  }
}
</script>

<style scoped>
.opponent-hand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px dashed #333;
  min-width: 160px;
  transition: all 0.3s ease;
  position: relative;
}

.opponent-hand::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 1px;
  background: #333;
}

.opponent-hand::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 1px;
  background: #333;
}

.opponent-hand.selectable {
  cursor: pointer;
  border-color: var(--color-hazard);
  animation: pulse-border 1.5s infinite;
}

.opponent-hand.selectable:hover {
  background: rgba(255, 159, 67, 0.1);
  transform: scale(1.05);
}

@keyframes pulse-border {
  0% { border-color: rgba(255, 204, 0, 0.4); }
  50% { border-color: rgba(255, 204, 0, 1); }
  100% { border-color: rgba(255, 204, 0, 0.4); }
}

.opponent-hand.active {
  border-style: solid;
  border-color: var(--color-neon-blue);
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
  background: rgba(0, 243, 255, 0.05);
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #222;
  border: 1px solid #444;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-size: 1.3rem;
  margin-bottom: 0.5rem;
  position: relative;
  overflow: hidden;
}

.scan-line {
  position: absolute;
  top: 0; width: 100%; height: 2px;
  background: rgba(255,255,255,0.5);
  animation: scan 2s linear infinite;
}
@keyframes scan {
  0% { top: 0; opacity: 0; }
  20% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

.avatar-active {
  color: var(--color-neon-blue);
  border-color: var(--color-neon-blue);
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
}

.info {
  text-align: center;
  color: white;
  margin-bottom: 0.75rem;
  width: 100%;
}

.name-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.name {
  font-weight: bold;
  font-size: 0.8rem;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.status-dot {
  width: 6px; height: 6px; background: #333; border-radius: 50%;
}
.status-dot.active {
  background: var(--color-neon-blue);
  box-shadow: 0 0 5px var(--color-neon-blue);
}

.card-count {
  font-size: 0.7rem;
  opacity: 0.8;
  font-family: 'Courier New', monospace;
  color: var(--color-hazard-dim);
}

.eliminated-badge {
  color: #ff2a2a;
  font-weight: bold;
  font-size: 0.7rem;
  margin-top: 0.25rem;
  border: 1px solid #ff2a2a;
  padding: 2px 4px;
  display: inline-block;
  font-family: var(--font-display);
}

.card-fan {
  position: relative;
  height: 60px;
  width: 160px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 0.5rem;
}

.card-fan.many-cards {
  width: 180px;
}

.fan-card {
  position: absolute;
  transition: transform 0.3s ease;
  transform-origin: bottom center;
}

.more-cards {
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  background: #111;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-family: 'Courier New', monospace;
  padding: 2px 6px;
  border: 1px solid #333;
}

@media (max-width: 768px) {
  .opponent-hand {
    min-width: 120px;
    padding: 0.5rem;
  }

  .avatar {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }

  .card-fan {
    height: 45px;
    width: 120px;
  }
}

@media (max-width: 480px) {
  .opponent-hand {
    min-width: 80px;
    padding: 0.4rem;
  }

  .avatar {
    width: 28px;
    height: 28px;
    font-size: 0.8rem;
    margin-bottom: 0.25rem;
  }

  .name {
    font-size: 0.65rem;
  }

  .card-count {
    font-size: 0.6rem;
  }

  .card-fan {
    display: none;
  }

  .info {
    margin-bottom: 0.25rem;
  }
}
</style>
