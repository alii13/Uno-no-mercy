<template>
  <div class="game-view" :class="{ 'shake-screen': isShakeActive }">
    <!-- Shared Background Elements -->
    <GameBackground :direction="store.direction" />

    <!-- Top Bar: Opponents Surveillance -->
    <SurveillanceBar>
      <OpponentHand 
        v-for="player in opponents" 
        :key="player.id"
        :ref="(el) => { if (el) opponentRefs[player.id] = (el as any).$el }"
        :player="player" 
        :is-active="player.id === store.currentPlayer?.id"
        :is-selectable="store.turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn"
        @click="onOpponentClick(player.id)"
      />
    </SurveillanceBar>

    <!-- Main Game Table "The Pit" -->
    <BattlePit
      ref="battlePitRef"
      :show-draw-hint="isMyTurn && store.turnState === 'WAITING_FOR_ACTION'"
      :is-muted="soundEffects.isMuted.value"
      @draw="drawCard"
      @toggle-sound="toggleSound"
    >
      <template #draw-pile>
        <CardPile :cards="store.deck" />
      </template>
      
      <template #discard-pile>
        <CardPile :cards="store.discardPile" :is-discard="true" :large="true" />
      </template>
      
      <template #status-panel>
        <StatusPanel
          :current-player-name="store.currentPlayer?.name || 'Unknown'"
          :direction="store.direction"
          :draw-stack="store.drawStack"
          :current-color="store.currentColor"
          :message="gameMessage"
          :message-style="messageStyle"
          :stacking-mode="store.stackingMode"
        />
      </template>
    </BattlePit>

    <!-- Player Cards (rendered LAST so they're on top of everything) -->
    <div class="floating-hand-wrapper" ref="playerHandRef">
      <PlayerHand 
        v-if="myPlayer"
        :hand="myPlayer.hand" 
        :is-my-turn="isMyTurn"
      />
    </div>

    <!-- Player Console Info Bar (BOTTOM) -->
    <PlayerConsoleBar
      :player-name="myPlayer?.name || 'Unknown'"
      :card-count="myPlayer?.hand.length || 0"
      :is-my-turn="isMyTurn"
      :show-uno-button="store.showUnoButton"
      @call-uno="store.callUno(myPlayerId)"
    />
    
    <!-- Animated Card Layer (for flying cards) -->
    <div class="animation-layer" ref="animationLayer"></div>
    
    <!-- Modals / Overlays -->
    <ColorPickerModal
      v-if="store.turnState === 'CHOOSING_ROULETTE_COLOR' && isMyTurn"
      title="ROULETTE TRAP DETECTED"
      subtitle="CHOOSE YOUR FATE"
      :is-roulette="true"
      @select="(c) => store.setRouletteColor(c)"
    />

    <ColorPickerModal
      v-if="store.turnState === 'CHOOSING_DRAWN_WILD_COLOR' && isMyTurn"
      title="WILD CARD DRAWN"
      subtitle="CHOOSE COLOR TO PLAY"
      @select="(c) => store.playDrawnWildCard(c)"
    />

    <PlayerSelectModal
      v-if="store.turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn"
      :eligible-players="store.players.filter(p => !p.isEliminated && p.id !== myPlayerId)"
      @select="(id: string) => store.swapHands(id)"
      @skip="store.skipSwap()"
    />

    <DiscardAllPickerModal
      v-if="store.turnState === 'CHOOSING_DISCARD_ALL_TOP' && isMyTurn"
      :cards="store.pendingDiscardAllCards"
      @select="(id: string) => store.selectDiscardAllTop(id)"
    />

    <GameOverModal
      v-if="store.gameState === 'GAME_OVER'"
      :is-winner="isWinner"
      :winner-name="getWinnerName()"
      :stats="gameStats"
      :is-anonymous="authStore.isAnonymous"
      mode="sp"
      @rematch="restart"
      @back-to-lobby="store.returnToLobby()"
      @upgrade-account="handleUpgrade"
      @share-twitter="shareToTwitter"
      @share-whatsapp="shareToWhatsApp"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, provide, watch, onMounted } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'
import { canPlayCard } from '../../utils/gameRules'
import { soundEffects } from '../../composables/useSoundEffects'
import { useCardAnimations } from '../../composables/useCardAnimations'
import OpponentHand from './OpponentHand.vue'
import PlayerHand from './PlayerHand.vue'
import CardPile from './CardPile.vue'
import ColorPickerModal from './ColorPickerModal.vue'
import PlayerSelectModal from './PlayerSelectModal.vue'
import DiscardAllPickerModal from './DiscardAllPickerModal.vue'
import GameBackground from './GameBackground.vue'
import SurveillanceBar from './SurveillanceBar.vue'
import BattlePit from './BattlePit.vue'
import StatusPanel from './StatusPanel.vue'
import PlayerConsoleBar from './PlayerConsoleBar.vue'
import GameOverModal from './GameOverModal.vue'

const store = useGameStore()
const authStore = useAuthStore()
const { animateFlyingCard, animateDrawCardsStaggered } = useCardAnimations()

// For MVP single player, we assume we are player 0
const myPlayerId = 'p-0'

const battlePitRef = ref<InstanceType<typeof BattlePit> | null>(null)
const discardAreaRef = computed(() => battlePitRef.value?.discardAreaRef || null)
const animationLayer = ref<HTMLElement | null>(null)

// Provide refs for child components
provide('discardAreaRef', discardAreaRef)
provide('animationLayer', animationLayer)

const myPlayer = computed(() => store.players.find(p => p.id === myPlayerId))
const opponents = computed(() => store.players.filter(p => p.id !== myPlayerId))

const isMyTurn = computed(() => store.currentPlayer?.id === myPlayerId)

// Animation Handling
const playerHandRef = ref<HTMLElement | null>(null)
const opponentRefs = ref<Record<string, HTMLElement>>({})
const prevHandLengths = ref<Record<string, number>>({})

// Initial Deal Animation
onMounted(async () => {
  if (store.isDealing) {
    await store.dealInitialCards(animateSingleCardDeal)
  }
})

// Animate a single card being dealt to a player
async function animateSingleCardDeal(playerId: string, _card: any): Promise<void> {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!deckEl) return
  
  // Determine target element
  const targetEl = playerId === myPlayerId 
    ? playerHandRef.value 
    : opponentRefs.value[playerId] || null
  
  if (!targetEl) return
  
  // Play sound
  soundEffects.playCardPick()
  
  // Use composable for animation
  await animateFlyingCard(deckEl, targetEl, { duration: 0.3 })
}

function triggerDrawAnimation(playerId: string, count: number) {
    const targetEl = playerId === myPlayerId ? playerHandRef.value : opponentRefs.value[playerId]
    const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
    if (!targetEl || !deckEl) return

    // Use composable for staggered draw animation
    animateDrawCardsStaggered(deckEl, targetEl, count, {
        duration: 0.4,
        staggerDelay: 0.15
    })
}

// Watch for hand size increases to animate draws (Flying Cards).
// Watch a derived (id, length) tuple array so Vue doesn't have to deep-traverse
// every card on every mutation.
watch(
  () => store.players.map(p => [p.id, p.hand.length] as const),
  (next) => {
    next.forEach(([id, len]) => {
      const oldLen = prevHandLengths.value[id] || 0
      if (!store.isDealing && len > oldLen && oldLen > 0) {
        triggerDrawAnimation(id, len - oldLen)
      }
      prevHandLengths.value[id] = len
    })
  },
  { immediate: true }
)

const gameMessage = computed(() => {
  if (store.turnState === 'CHOOSING_PLAYER_TO_SWAP') return isMyTurn.value ? "SELECT PLAYER TO SWAP HANDS" : "BOT IS CHOOSING SWAP TARGET..."
  if (store.turnState === 'CHOOSING_ROULETTE_COLOR') return isMyTurn.value ? "INCOMING ROULETTE! CHOOSE YOUR FATE" : "ROULETTE INITIATED: WAITING FOR VICTIM..."
  if (store.turnState === 'ROULETTE_DRAWING') {
    const target = store.rouletteTargetColor?.toUpperCase() || store.currentColor.toUpperCase()
    return isMyTurn.value ? `DANGER: YOU NEED ${target}` : `BOT IS SEEKING ${target}...`
  }
  return ""
})

const messageStyle = computed(() => {
    if (store.turnState === 'ROULETTE_DRAWING') {
        const colorMap: Record<string, string> = {
            red: '#ff5555',
            blue: '#5555ff',
            green: '#55ff55',
            yellow: '#ffff55'
        }
        const target = store.rouletteTargetColor || store.currentColor
        return { 
            color: colorMap[target] || '#fff',
            fontSize: '1rem',
            textShadow: `0 0 10px ${colorMap[target] || '#fff'}`
        }
    }
    return {}
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
  if (!isMyTurn.value || store.turnState !== 'WAITING_FOR_ACTION') return
  if (store.actionInProgress) return
  // Only allow drawing when no playable cards exist (except during draw stack)
  if (store.drawStack === 0 && store.topCard && myPlayer.value) {
    const hasPlayable = myPlayer.value.hand.some(c =>
      canPlayCard(c, store.topCard!, store.currentColor, 0, store.stackingMode)
    )
    if (hasPlayable) return
  }
  soundEffects.playCardPick()
  store.drawCardsForCurrentPlayer()
}

function toggleSound() {
  soundEffects.toggleMute()
}

function getWinnerName() {
  const w = store.players.find(p => p.id === store.winnerId)
  return w ? w.name : 'UNKNOWN_ENTITY'
}

// The human is always 'p-0' in single-player.
const isWinner = computed(() => store.winnerId === 'p-0')

// Pull the per-player stats and shape them for the modal.
const gameStats = computed(() => {
  const s = (store as any).playerStats?.['p-0']
  if (!s) return undefined
  return {
    cardsPlayed: s.cardsPlayedTotal || 0,
    biggestStack: s.biggestStackSurvived || 0,
    unosCalled: s.unoCalls || 0,
    peakHand: s.peakCards || 0,
  }
})

function restart() {
  store.initializeGame(['You', 'Terminator'])
}

function getGameOverShareText() {
  const won = store.winnerId === 'p-0'
  return won
    ? `Just destroyed the bot in UNO No Mercy. No mercy given. Play me if you dare.`
    : `The bot just wrecked me in UNO No Mercy. This game is brutal. Try it yourself.`
}

function shareToTwitter() {
  const text = encodeURIComponent(getGameOverShareText())
  const url = encodeURIComponent('https://uno-no-mercy.com')
  window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
}

function shareToWhatsApp() {
  const text = encodeURIComponent(getGameOverShareText() + '\n\nhttps://uno-no-mercy.com')
  window.open(`https://wa.me/?text=${text}`, '_blank')
}

async function handleUpgrade() {
  store.returnToLobby()
  await authStore.signOut()
}
function onOpponentClick(playerId: string) {
  if (store.turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn.value) {
    store.swapHands(playerId)
  }
}
</script>

<style>
@import '../../assets/game-shared.css';
</style>

<style scoped>
/* Component-specific styles only */
.hand-container-wrapper {
  min-height: 180px;
  position: relative;
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

@media (max-width: 768px) {
  .hand-container-wrapper {
    min-height: 140px;
  }
}

@media (max-width: 480px) {
  .hand-container-wrapper {
    min-height: 100px;
  }

  .btn-hazard {
    padding: 0.5rem 1rem;
    min-height: 44px;
  }
}
</style>
