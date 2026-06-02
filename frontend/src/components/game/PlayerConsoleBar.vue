<template>
  <div v-if="showUnoButton || showLeaveButton" class="player-console-bar">
    <button
      v-if="showUnoButton"
      @click="$emit('call-uno')"
      class="uno-btn"
      type="button"
    >
      UNO!
    </button>

    <button
      v-if="showLeaveButton"
      @click="$emit('leave')"
      class="leave-btn"
      type="button"
    >
      LEAVE
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  playerName: string
  cardCount: number
  isMyTurn: boolean
  showUnoButton: boolean
  showLeaveButton?: boolean
}>()

defineEmits<{
  'call-uno': []
  leave: []
}>()
</script>
