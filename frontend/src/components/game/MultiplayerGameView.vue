<template>
  <div class="game-view" :class="{ 'shake-screen': isShakeActive }">
    <!-- Shared Background Elements -->
    <GameBackground :direction="direction" />

    <!-- Top Bar: All Opponents + audio/settings -->
    <SurveillanceBar>
      <div
        v-for="opp in allOpponents"
        :key="opp.user_id"
        :data-uid="opp.user_id"
        class="opponent-card"
        :class="{
          active: currentGame?.current_player_id === opp.user_id,
          eliminated: opp.is_eliminated
        }"
      >
        <div class="avatar" :class="{ 'avatar-active': currentGame?.current_player_id === opp.user_id }">
          {{ opp.name.charAt(0).toUpperCase() }}
        </div>
        <div class="opponent-info">
          <span class="name">{{ opp.name }}</span>
          <span class="card-count" v-if="!opp.is_eliminated">{{ (opp.hand as Card[])?.length || 0 }} INTEL</span>
          <span class="card-count eliminated-text" v-else>ELIMINATED</span>
        </div>
        <div class="status-indicator" :class="{ active: currentGame?.current_player_id === opp.user_id }"></div>
      </div>
      <template #controls>
        <button
          class="hud-audio"
          :class="{ active: !soundEffects.isMuted.value }"
          @click="toggleSound"
          :aria-label="soundEffects.isMuted.value ? 'Unmute audio' : 'Mute audio'"
        >
          <span class="hud-audio-label">AUDIO</span>
          <span class="hud-audio-dot"></span>
        </button>
        <SettingsButton />
      </template>
    </SurveillanceBar>

    <!-- Main Game Table -->
    <BattlePit
      ref="battlePitRef"
      :show-draw-hint="isMyTurn && turnState === 'WAITING_FOR_ACTION'"
      :is-muted="soundEffects.isMuted.value"
      :current-color="currentColor"
      :direction="direction"
      :draw-stack="drawStack"
      :my-card-count="myHand.length"
      @draw="handleDraw"
    >
      <template #draw-pile>
        <CardPile :cards="deckDisplay" />
      </template>
      
      <template #discard-pile>
        <CardPile :cards="discardPile" :is-discard="true" :large="true" />
      </template>
      
      <template #status-panel>
        <StatusPanel
          :current-player-name="currentPlayerName"
          :direction="direction"
          :draw-stack="drawStack"
          :current-color="currentColor"
          :message="statusMessage"
          :message-style="statusMessageStyle"
          :stacking-mode="mpStore.stackingMode"
        />
      </template>
    </BattlePit>

    <!-- My Hand -->
    <div
      class="floating-hand-wrapper"
      :class="{ 'is-my-turn': isMyTurn && turnState === 'WAITING_FOR_ACTION' }"
      ref="playerHandRef"
    >
      <MultiplayerPlayerHand
        v-if="visibleHand.length > 0 && showHand"
        :hand="visibleHand"
        :is-my-turn="isMyTurn"
        :current-color="currentColor"
        :top-card="topCard"
        :draw-stack="drawStack"
        :stacking-mode="mpStore.stackingMode"
        @play-card="handlePlayCard"
      />
    </div>

    <!-- Player Console Bar -->
    <PlayerConsoleBar
      :player-name="myPlayer?.name || 'Unknown'"
      :card-count="myHand.length"
      :is-my-turn="isMyTurn"
      :show-uno-button="(myHand.length === 2 || myHand.length === 1) && isMyTurn && !myPlayer?.has_called_uno"
      :show-leave-button="true"
      @call-uno="handleCallUno"
      @leave="leaveGame"
    />

    <!-- Animated Card Layer (for flying cards) -->
    <div class="animation-layer" ref="animationLayer"></div>

    <!-- Color Picker Modal (for regular Wild cards) -->
    <ColorPickerModal 
      v-if="showColorPicker"
      title="WILD CARD"
      subtitle="CHOOSE COLOR"
      @select="handleColorSelect"
    />

    <!-- Roulette Color Picker Modal (for victim choosing color) -->
    <ColorPickerModal
      v-if="turnState === 'CHOOSING_ROULETTE_COLOR' && isMyTurn"
      title="ROULETTE TRAP DETECTED"
      subtitle="CHOOSE YOUR FATE"
      :is-roulette="true"
      @select="handleRouletteColorSelect"
    />

    <!-- Drawn Wild Card Color Picker -->
    <ColorPickerModal
      v-if="mpStore.pendingDrawnWildCard"
      title="WILD CARD DRAWN"
      subtitle="CHOOSE COLOR TO PLAY"
      @select="handleDrawnWildColorSelect"
    />

    <!-- Player Select Modal (for Number 7 swap - shows all active opponents) -->
    <PlayerSelectModal
      v-if="turnState === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn"
      :eligible-players="allOpponents.filter(o => !o.is_eliminated).map(o => ({ id: o.user_id, name: o.name, hand: (o.hand as Card[]) || [], isEliminated: false }))"
      @select="handleSwapPlayer"
      @skip="mpStore.skipSwap()"
    />

    <!-- Discard All Top Card Picker -->
    <DiscardAllPickerModal
      v-if="mpStore.pendingDiscardAllCards.length > 0"
      :cards="mpStore.pendingDiscardAllCards"
      @select="handleDiscardAllTopSelect"
    />

    <!-- Realtime reconnect pill -->
    <Transition name="rt-pill">
      <div
        v-if="mpStore.realtimeStatus !== 'SUBSCRIBED' && !opponentLeft"
        class="reconnect-pill"
        role="status"
        aria-live="polite"
      >
        <span class="rt-dot"></span>
        {{ mpStore.realtimeStatus === 'CONNECTING' ? 'CONNECTING…' : 'RECONNECTING…' }}
      </div>
    </Transition>

    <!-- Opponent Left -->
    <div v-if="opponentLeft" class="overlay">
      <div class="modal terminal-modal">
        <h1 class="glitch-text" data-text="DISCONNECTED">DISCONNECTED</h1>
        <p class="winner-text">OPPONENT LEFT THE GAME</p>
        <button @click="leaveGame" class="btn-primary">RETURN TO LOBBY</button>
      </div>
    </div>

    <GameOverModal
      v-if="gameStatus === 'finished' && !opponentLeft"
      :is-winner="isMpWinner"
      :winner-name="winnerName"
      :opponent-name="opponentDisplayName"
      :stats="mpGameStats"
      :is-anonymous="authStore.isAnonymous"
      mode="mp"
      @rematch="leaveGame"
      @back-to-lobby="leaveGame"
      @upgrade-account="handleUpgrade"
      @share-twitter="shareToTwitter"
      @share-whatsapp="shareToWhatsApp"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, provide, onMounted, onUnmounted } from 'vue'
import { music } from '../../composables/useMusic'
import { useMultiplayerStore } from '../../stores/multiplayerStore'
import { useAuthStore } from '../../stores/authStore'
import { soundEffects } from '../../composables/useSoundEffects'
import { useCardAnimations } from '../../composables/useCardAnimations'
import CardPile from './CardPile.vue'
import MultiplayerPlayerHand from './MultiplayerPlayerHand.vue'
import ColorPickerModal from './ColorPickerModal.vue'
import PlayerSelectModal from './PlayerSelectModal.vue'
import DiscardAllPickerModal from './DiscardAllPickerModal.vue'
import GameBackground from './GameBackground.vue'
import SurveillanceBar from './SurveillanceBar.vue'
import SettingsButton from '../SettingsButton.vue'
import BattlePit from './BattlePit.vue'
import StatusPanel from './StatusPanel.vue'
import PlayerConsoleBar from './PlayerConsoleBar.vue'
import GameOverModal from './GameOverModal.vue'
import type { Card, CardColor } from '../../types/card'
import { useStackEscalation } from '../../composables/useStackEscalation'
import { playDealerIntro } from '../../composables/useDealerIntro'
import { useRetentionStore } from '../../stores/retentionStore'

const mpStore = useMultiplayerStore()
const authStore = useAuthStore()
const { animateFlyingCard, animateDrawCardsStaggered } = useCardAnimations()

const isShakeActive = ref(false)
const showColorPicker = ref(false)
const pendingCard = ref<Card | null>(null)

// Animation refs
const battlePitRef = ref<InstanceType<typeof BattlePit> | null>(null)
const discardAreaRef = computed(() => battlePitRef.value?.discardAreaRef || null)
const animationLayer = ref<HTMLElement | null>(null)
const playerHandRef = ref<HTMLElement | null>(null)

// Provide refs for child components
provide('discardAreaRef', discardAreaRef)
provide('animationLayer', animationLayer)

// Track previous hand sizes for animation detection
const prevMyHandLength = ref(0)
const prevOpponentHandLengths = ref<Record<string, number>>({})

// Track if we're in initial deal animation mode
const isInitialDeal = ref(false)
const showHand = ref(false)  // Controls hand visibility during initial deal animation
const visibleCardCount = ref(0)  // How many cards to show (for progressive reveal during draw)

// Visible hand - only show cards up to visibleCardCount
const visibleHand = computed(() => {
  const hand = myHand.value
  // If not animating, show all cards
  if (visibleCardCount.value >= hand.length || visibleCardCount.value === 0) {
    return hand
  }
  // During animation, show only the visible portion
  return hand.slice(0, visibleCardCount.value)
})

// Computed from store
const myPlayer = computed(() => mpStore.myPlayer)
const allOpponents = computed(() => mpStore.opponents)
const myHand = computed(() => (myPlayer.value?.hand as Card[]) || [])
const isMyTurn = computed(() => mpStore.isMyTurn)
const gameStatus = computed(() => mpStore.gameStatus)
const opponentLeft = computed(() => mpStore.opponentLeft)

const currentGame = computed(() => mpStore.currentGame)
const direction = computed(() => currentGame.value?.direction || 1)
const drawStack = computed(() => currentGame.value?.draw_stack || 0)
useStackEscalation(drawStack)
const currentColor = computed(() => (currentGame.value?.current_color || 'red') as CardColor)
const turnState = computed(() => currentGame.value?.turn_state || 'WAITING_FOR_ACTION')
const discardPile = computed(() => (currentGame.value?.discard_pile as Card[]) || [])
const topCard = computed(() => discardPile.value[discardPile.value.length - 1])

const currentPlayerName = computed(() => {
  if (!currentGame.value?.current_player_id) return 'Unknown'
  if (currentGame.value.current_player_id === authStore.user?.id) return 'You'
  const player = mpStore.gamePlayers.find(p => p.user_id === currentGame.value?.current_player_id)
  return player?.name || 'Opponent'
})

const winnerName = computed(() => {
  if (!currentGame.value?.winner_id) return 'Unknown'
  if (currentGame.value.winner_id === authStore.user?.id) return 'YOU!'
  const winner = mpStore.gamePlayers.find(p => p.user_id === currentGame.value?.winner_id)
  return winner?.name || 'Opponent'
})

// Always the "other side" — loser when we won, winner when we lost. Used in
// the share-image sub-line so it never reads "I broke You."
const opponentDisplayName = computed(() => {
  const meId = authStore.user?.id
  if (!meId) return 'opponent'
  const winnerId = currentGame.value?.winner_id
  const otherId = winnerId === meId
    ? mpStore.gamePlayers.find(p => p.user_id !== meId)?.user_id
    : winnerId
  const other = mpStore.gamePlayers.find(p => p.user_id === otherId)
  return other?.name || 'opponent'
})

const isMpWinner = computed(() => currentGame.value?.winner_id === authStore.user?.id)

const mpGameStats = computed(() => {
  const s = mpStore.mpStats
  if (!s) return undefined
  return {
    cardsPlayed: s.cardsPlayedTotal || 0,
    biggestStack: s.biggestStackSurvived || 0,
    unosCalled: s.unoCalls || 0,
    peakHand: s.peakCards || 0,
  }
})

// Display deck (just show a placeholder array for the pile)
const deckDisplay = computed(() => {
  const count = (currentGame.value?.deck as any[])?.length || 0
  return Array(count).fill({ id: 'deck', color: 'wild', type: 'wild' })
})

const statusMessage = computed(() => {
  if (turnState.value === 'CHOOSING_PLAYER_TO_SWAP' && isMyTurn.value) return 'SELECT PLAYER TO SWAP HANDS'
  if (turnState.value === 'CHOOSING_PLAYER_TO_SWAP' && !isMyTurn.value) return 'OPPONENT IS CHOOSING SWAP TARGET...'
  if (turnState.value === 'CHOOSING_ROULETTE_COLOR' && isMyTurn.value) return 'INCOMING ROULETTE! CHOOSE YOUR FATE'
  if (turnState.value === 'CHOOSING_ROULETTE_COLOR' && !isMyTurn.value) return 'ROULETTE: WAITING FOR VICTIM...'
  if (turnState.value === 'ROULETTE_DRAWING') {
    const target = (currentGame.value?.roulette_target_color || currentColor.value).toUpperCase()
    return isMyTurn.value ? `DANGER: SEEKING ${target}` : `${currentPlayerName.value} SEEKING ${target}...`
  }
  if (drawStack.value > 0 && isMyTurn.value) return `WARNING: DRAW ${drawStack.value} OR STACK HIGHER!`
  if (drawStack.value > 0 && !isMyTurn.value) return `DRAW STACK: +${drawStack.value} PENDING`
  return ''
})

const statusMessageStyle = computed(() => {
  if (turnState.value === 'ROULETTE_DRAWING') {
    const colorMap: Record<string, string> = {
      red: '#ff5555', blue: '#5555ff', green: '#55ff55', yellow: '#ffff55'
    }
    const target = currentGame.value?.roulette_target_color || currentColor.value
    return { color: colorMap[target] || '#fff', textShadow: `0 0 10px ${colorMap[target] || '#fff'}` }
  }
  if (drawStack.value > 0) {
    return { color: '#ff3333', textShadow: '0 0 10px rgba(255, 51, 51, 0.6)' }
  }
  return {}
})

// Watch for draw stack increases - shake screen on any increase
watch(drawStack, (newVal, oldVal) => {
  if (newVal > oldVal && newVal >= 2) {
    isShakeActive.value = true
    soundEffects.playSpecialCard()
    setTimeout(() => isShakeActive.value = false, 500)
  }
})

// Auto-close modals on game end or opponent leaving
watch([gameStatus, opponentLeft], () => {
  if (gameStatus.value === 'finished' || opponentLeft.value) {
    showColorPicker.value = false
    pendingCard.value = null
  }
})

// Flying card animation function - now async and syncs with card reveal
async function triggerDrawAnimation(targetEl: HTMLElement | null, count: number, startingVisibleCount: number): Promise<void> {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!targetEl || !deckEl) {
    // No animation possible, just show all cards
    visibleCardCount.value = startingVisibleCount + count
    return
  }

  // Animate each card one by one using composable
  for (let i = 0; i < count; i++) {
    // Play sound for this card
    soundEffects.playCardPick()

    // Animate using composable
    await animateFlyingCard(deckEl, targetEl, { duration: 0.3 })
    
    // Increment visible count so the real card appears
    visibleCardCount.value = startingVisibleCount + i + 1

    // Small delay between cards
    if (i < count - 1) {
      await new Promise(r => setTimeout(r, 50))
    }
  }
}

// Animate initial deal: deal cards one by one with staggered timing
async function animateInitialDeal(target: HTMLElement | null, cardCount: number): Promise<void> {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!target || !deckEl) return

  // Animate each card with sound played before animation
  for (let i = 0; i < cardCount; i++) {
    soundEffects.playCardPick()
    await animateFlyingCard(deckEl, target, { duration: 0.3 })
    
    // Small delay between cards
    if (i < cardCount - 1) {
      await new Promise(r => setTimeout(r, 80))
    }
  }
}

// Local flag to prevent duplicate initial deal animations
let hasRunInitialDealAnimation = false

// Watch for game status change to trigger initial deal animation
watch(gameStatus, async (newStatus, oldStatus) => {
  if (oldStatus === 'waiting' && newStatus === 'playing' && !hasRunInitialDealAnimation) {
    hasRunInitialDealAnimation = true
    isInitialDeal.value = true

    // Wait a moment for DOM to update
    await new Promise(r => setTimeout(r, 200))

    // Dealer ceremony before the deal
    await playDealerIntro()

    // Animate dealing to player hand
    const myHandCount = myHand.value.length
    if (myHandCount > 0 && playerHandRef.value) {
      await animateInitialDeal(playerHandRef.value, myHandCount)
    }

    // Update tracking after initial deal
    prevMyHandLength.value = myHand.value.length
    for (const opp of allOpponents.value) {
      prevOpponentHandLengths.value[opp.user_id] = (opp.hand as Card[])?.length || 0
    }

    isInitialDeal.value = false
  }
})

// Watch for my hand size increases to animate draws
// Use getter function to watch the length directly for more reliable detection
watch(
  () => myHand.value.length,
  (newLen, oldLen) => {
    
    // Skip animation during initial deal animation
    if (isInitialDeal.value) {
      return
    }
    
    // Only animate if cards increased (a draw happened) and we had cards before
    if (newLen > (oldLen ?? 0) && (oldLen ?? 0) > 0) {
      const count = newLen - (oldLen ?? 0)
      // Set visible count to old value (freeze current display)
      const startingCount = oldLen ?? 0
      visibleCardCount.value = startingCount
      // Animate draw and progressively reveal cards
      triggerDrawAnimation(playerHandRef.value, count, startingCount)
    }
  }
)

// Watch all opponents for hand size changes to animate their draws
watch(
  () => allOpponents.value.map(o => ({ id: o.user_id, len: (o.hand as Card[])?.length || 0 })),
  (newVals) => {
    if (isInitialDeal.value) return

    for (const { id, len } of newVals) {
      const oldLen = prevOpponentHandLengths.value[id] || 0
      if (len > oldLen && oldLen > 0) {
        const count = len - oldLen
        // Target the specific opponent's card element
        const opponentEl = document.querySelector(`.opponent-card[data-uid="${id}"]`) as HTMLElement
          || document.querySelector('.opponent-card') as HTMLElement
        if (opponentEl) {
          triggerOpponentDrawAnimation(opponentEl, count)
        }
      }
      prevOpponentHandLengths.value[id] = len
    }
  },
  { deep: true }
)

// Separate animation for opponent (visual only, no card reveal sync)
function triggerOpponentDrawAnimation(targetEl: HTMLElement, count: number) {
  const deckEl = document.querySelector('.draw-station .card-pile') as HTMLElement
  if (!targetEl || !deckEl) return

  // Play sound once for the draw action
  soundEffects.playCardPick()

  // Use composable for staggered animation (visual only)
  animateDrawCardsStaggered(deckEl, targetEl, count, {
    duration: 0.3,
    staggerDelay: 0.12
  })
}

// Stop music on unmount (game exit, opponent leaves, etc.)
onUnmounted(() => {
  music.stop()
})

// Music starts when game enters 'playing'; ducks on 'finished'.
const retention = useRetentionStore()
watch(gameStatus, (now, prev) => {
  if (now === 'playing' && prev !== 'playing') {
    music.start()
  } else if (now === 'finished' && prev !== 'finished') {
    music.duck()
    // Persist lifetime stats once per game-end.
    const s: any = (mpStore as any).mpStats?.value || (mpStore as any).mpStats
    if (s) {
      retention.recordGameResult({
        won: isMpWinner.value,
        cardsPlayed: s.cardsPlayedTotal || 0,
        biggestStackSurvived: s.biggestStackSurvived || 0,
        unoCalls: s.unoCalls || 0,
        peakHand: s.peakCards || 0,
        mode: 'mp',
      })
    }
  }
})

// Initialize component and run initial deal animation if needed
onMounted(async () => {
  // If we landed straight into a playing game (refresh / deep link), kick off music.
  if (gameStatus.value === 'playing') music.start()

  // If game is already playing and we have cards, run initial deal animation
  if (gameStatus.value === 'playing' && myHand.value.length > 0) {
    isInitialDeal.value = true
    showHand.value = false  // Hide cards initially

    // Wait for DOM to be ready
    await new Promise(r => setTimeout(r, 100))

    // Dealer ceremony — riffle the deck before any cards fly to the hand
    await playDealerIntro()

    // Animate dealing cards to player hand
    const cardCount = myHand.value.length
    if (playerHandRef.value) {
      await animateInitialDeal(playerHandRef.value, cardCount)
    }
    
    // Show the real hand after animation
    showHand.value = true
    isInitialDeal.value = false
  } else {
    // No animation needed, just show hand
    showHand.value = true
  }
})

async function handlePlayCard(card: Card) {
  if (!isMyTurn.value) return
  
  // Check if wild card needs color selection
  if (card.color === 'wild' && card.type !== 'wildColorRoulette') {
    pendingCard.value = card
    showColorPicker.value = true
    return
  }
  
  soundEffects.playCardThrow()
  mpStore.suppressDiscardSlam = true
  await mpStore.playCard(card)
  soundEffects.playCardLand()
}

async function handleColorSelect(color: CardColor) {
  showColorPicker.value = false
  if (pendingCard.value) {
    soundEffects.playCardThrow()
    mpStore.suppressDiscardSlam = true
    await mpStore.playCard(pendingCard.value, color)
    soundEffects.playCardLand()
    pendingCard.value = null
  }
}

// Handler for roulette color selection (victim choosing their fate)
async function handleRouletteColorSelect(color: CardColor) {
  await mpStore.setRouletteColor(color)
}

// Handler for drawn wild card color selection
async function handleDrawnWildColorSelect(color: CardColor) {
  await mpStore.playDrawnWildCard(color)
}

// Handler for player swap (Number 7 card)
async function handleSwapPlayer(playerId: string) {
  await mpStore.swapHands(playerId)
}

// Handler for Discard All top card selection
async function handleDiscardAllTopSelect(cardId: string) {
  await mpStore.selectDiscardAllTop(cardId)
}

async function handleDraw() {
  if (!isMyTurn.value) return
  // Sound is now played by the animation watcher
  await mpStore.drawCard()
}

async function handleCallUno() {
  await mpStore.callUno()
}

function toggleSound() {
  // Keep SFX and music mutes in step until the proper settings drawer ships.
  soundEffects.toggleMute()
  music.toggleMute()
}

function getGameOverShareText() {
  const won = currentGame.value?.winner_id === authStore.user?.id
  return won
    ? `Just won a multiplayer UNO No Mercy game. No mercy given. Think you can beat me?`
    : `Just played UNO No Mercy multiplayer. This game is absolute chaos. Try it.`
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

async function leaveGame() {
  await mpStore.leaveGame()
}

async function handleUpgrade() {
  await mpStore.leaveGame()
  await authStore.signOut()
}
</script>

<style>
@import '../../assets/game-shared.css';
</style>

<style scoped>
.opponent-card.eliminated {
  opacity: 0.35;
  filter: grayscale(1);
}
.eliminated-text {
  color: var(--color-alert) !important;
  font-size: 0.7rem;
}

/* Realtime reconnect pill — top-center floating indicator */
.reconnect-pill {
  position: fixed;
  top: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 42, 42, 0.9);
  color: #fff;
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  z-index: 150;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 16px rgba(255, 42, 42, 0.4);
}

.rt-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fff;
  animation: rt-pulse 1.1s ease-in-out infinite;
}

@keyframes rt-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.6); }
}

.rt-pill-enter-active, .rt-pill-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}
.rt-pill-enter-from, .rt-pill-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (prefers-reduced-motion: reduce) {
  .rt-dot { animation: none; }
}
</style>
