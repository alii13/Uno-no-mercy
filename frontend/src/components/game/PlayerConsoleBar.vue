<template>
  <div class="player-console-bar">
    <div class="console-id">PLAYER: {{ playerName }}</div>
    
    <!-- UNO Button -->
    <button 
      v-if="showUnoButton" 
      @click="$emit('call-uno')" 
      class="uno-btn blink"
    >
      YELL_UNO
    </button>

    <div class="console-cards">
      CARDS: <span class="card-count">{{ cardCount }}</span>
    </div>
    <div class="console-status" :class="{ 'status-active': isMyTurn }">
      STATUS: {{ isMyTurn ? 'ACTION_REQUIRED' : 'STANDBY' }}
    </div>
    
    <!-- Optional leave button for multiplayer -->
    <button v-if="showLeaveButton" @click="$emit('leave')" class="leave-btn">
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
  'leave': []
}>()
</script>
