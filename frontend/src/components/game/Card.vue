<template>
  <div 
    :class="['card-wrapper', { 
      playable: card.isPlayable,
      selected: isSelected,
      flipped: isFlipped,
      [`color-${card.color}`]: true,
      [`type-${card.type}`]: true
    }]"
    @click="handleClick"
    @mouseenter="handleHover"
    :style="{ width: size.width + 'px', height: size.height + 'px' }"
    v-html="cardSVG"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { cardGenerator } from '@/utils/cardGenerator'
import type { Card } from '@/types/card'

interface Props {
  card: Card
  isPlayable?: boolean
  isSelected?: boolean
  isFlipped?: boolean
  size?: { width: number; height: number }
}

const props = withDefaults(defineProps<Props>(), {
  isPlayable: false,
  isSelected: false,
  isFlipped: false,
  size: () => ({ width: 250, height: 350 }),
})

const emit = defineEmits<{
  click: [card: Card]
  hover: [card: Card]
}>()

const cardSVG = computed(() => {
  const cardWithPlayable = { ...props.card, isPlayable: props.isPlayable }
  return cardGenerator.generate(cardWithPlayable, props.size)
})

const handleClick = () => {
  if (props.isPlayable) {
    emit('click', props.card)
  }
}

const handleHover = () => {
  emit('hover', props.card)
}
</script>

<style scoped>
.card-wrapper {
  display: inline-block;
  cursor: pointer;
  transition: transform 0.2s ease, filter 0.2s ease;
  transform-style: preserve-3d;
  user-select: none;
}

.card-wrapper :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  overflow: hidden;
}

.card-wrapper :deep(.card-image) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-wrapper:hover {
  transform: translateY(-8px) rotateX(5deg) rotateY(-2deg) scale(1.05);
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.3));
}

.card-wrapper.playable {
  animation: playablePulse 2s ease-in-out infinite;
}

.card-wrapper.selected {
  transform: translateY(-12px) scale(1.08);
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.4));
}

.card-wrapper.flipped {
  transform: rotateY(180deg);
}

@keyframes playablePulse {
  0%, 100% {
    filter: drop-shadow(0 0 8px currentColor);
  }
  50% {
    filter: drop-shadow(0 0 16px currentColor);
  }
}

/* Wild card shimmer animation */
.card-wrapper :deep(.wild-shimmer) {
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Playable glow animation */
.card-wrapper :deep(.playable-glow) {
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}
</style>

