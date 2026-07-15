<template>
  <!-- Single root carrying `opponent-card` + `data-uid`: single-player captures
       its $el into a ref-map by id, multiplayer finds it via
       document.querySelector('.opponent-card[data-uid=...]') for fly-to-chip
       animations. Both contracts must hold — don't rename the class or drop the
       attribute. -->
  <div
    class="opponent-card"
    :data-uid="uid"
    :class="{ active: isActive, selectable: isSelectable, eliminated: isEliminated, disconnected: isDisconnected }"
    :role="isSelectable ? 'button' : undefined"
    :tabindex="isSelectable ? 0 : undefined"
    :aria-label="`${name}, ${cardCount} cards${isActive ? ', current turn' : ''}`"
    @click="$emit('click')"
    @keydown.enter.prevent="isSelectable && $emit('click')"
    @keydown.space.prevent="isSelectable && $emit('click')"
  >
    <div class="avatar" :class="{ 'avatar-active': isActive, speaking: isSpeaking }">{{ name.charAt(0).toUpperCase() }}</div>
    <div class="opponent-info">
      <span class="name">{{ name }}
        <span v-if="inVoice" class="voice-dot" :class="{ speaking: isSpeaking }" title="In voice"></span>
      </span>
      <span v-if="isDisconnected && !isEliminated" class="card-count dc-text">DISCONNECTED</span>
      <span v-else-if="isEliminated" class="card-count eliminated-text">OUT</span>
      <span v-else class="card-count">{{ cardCount }} {{ displayLabel }}</span>
    </div>
    <button
      v-if="canKick"
      class="opp-kick-btn"
      title="Remove player"
      aria-label="Remove player"
      @click.stop="$emit('kick')"
    >✕</button>
    <span class="status-indicator" :class="{ active: isActive }"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  cardCount: number
  uid?: string
  isActive?: boolean
  isEliminated?: boolean
  isDisconnected?: boolean
  isSelectable?: boolean
  canKick?: boolean
  countLabel?: string
  inVoice?: boolean
  isSpeaking?: boolean
}>()

defineEmits<{ click: []; kick: [] }>()

// Explicit label (e.g. multiplayer's "INTEL") wins; otherwise pluralize.
const displayLabel = computed(() => props.countLabel ?? (props.cardCount === 1 ? 'card' : 'cards'))
</script>
