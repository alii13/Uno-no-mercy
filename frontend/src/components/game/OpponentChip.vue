<template>
  <!-- Single root carrying `opponent-card` + `data-uid`: single-player captures
       its $el into a ref-map by id, multiplayer finds it via
       document.querySelector('.opponent-card[data-uid=...]') for fly-to-chip
       animations. Both contracts must hold — don't rename the class or drop the
       attribute. -->
  <div
    class="opponent-card"
    :data-uid="uid"
    :class="{ active: isActive, selectable: isSelectable, eliminated: isEliminated, disconnected: isDisconnected, danger: !isEliminated && cardCount >= 20 }"
    :role="isSelectable ? 'button' : undefined"
    :tabindex="isSelectable ? 0 : undefined"
    :aria-label="`${name}, ${cardCount} cards${isActive ? ', current turn' : ''}`"
    @click="$emit('click')"
    @keydown.enter.prevent="isSelectable && $emit('click')"
    @keydown.space.prevent="isSelectable && $emit('click')"
  >
    <div class="avatar" :class="{ 'avatar-active': isActive, speaking: isSpeaking }">{{ name.charAt(0).toUpperCase() }}</div>
    <div class="opponent-info">
      <span class="name"><Badge v-if="badge" :badge="badge" :points="badgePoints" :progress="badgeProgress" size="mark" class="seat-emblem" />{{ name }}
        <span v-if="inVoice" class="voice-dot" :class="{ speaking: isSpeaking }" title="In voice"></span>
      </span>
      <span v-if="isDisconnected && !isEliminated" class="card-count dc-text">DISCONNECTED</span>
      <span v-else-if="isEliminated" class="card-count eliminated-text">OUT</span>
      <span v-else class="card-count">{{ cardCount }} {{ displayLabel }}</span>
    </div>
    <button
      v-if="canVoiceMute"
      class="opp-voice-btn"
      :class="{ 'is-muted': voiceMuted }"
      :title="voiceMuteTitle"
      :aria-label="voiceMuteTitle"
      @click.stop="$emit('voiceMute')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path v-if="!voiceMuted" d="M15.5 8.5a5 5 0 0 1 0 7" />
        <line v-if="voiceMuted" x1="15" y1="9" x2="21" y2="15" />
        <line v-if="voiceMuted" x1="21" y1="9" x2="15" y2="15" />
      </svg>
    </button>
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
import Badge from '../Badge.vue'
import type { Badge as BadgeType, Progress } from '../../utils/badges'

const props = defineProps<{
  name: string
  cardCount: number
  uid?: string
  badge?: BadgeType
  badgePoints?: number
  badgeProgress?: Progress
  isActive?: boolean
  isEliminated?: boolean
  isDisconnected?: boolean
  isSelectable?: boolean
  canKick?: boolean
  countLabel?: string
  inVoice?: boolean
  isSpeaking?: boolean
  canVoiceMute?: boolean
  voiceMuted?: boolean
  voiceMuteTitle?: string
}>()

defineEmits<{ click: []; kick: []; voiceMute: [] }>()

// Explicit label (e.g. multiplayer's "INTEL") wins; otherwise pluralize.
const displayLabel = computed(() => props.countLabel ?? (props.cardCount === 1 ? 'card' : 'cards'))
</script>
