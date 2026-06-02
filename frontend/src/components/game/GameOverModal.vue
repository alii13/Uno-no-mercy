<template>
  <Teleport to="body">
    <div class="game-over-overlay" :class="{ 'is-win': isWinner, 'is-loss': !isWinner }" @click.self="$emit('back-to-lobby')">
      <!-- Confetti only on win, rendered as CSS particles -->
      <div v-if="isWinner" class="confetti-layer" aria-hidden="true">
        <span v-for="i in 30" :key="i" class="confetti-piece" :style="confettiStyle(i)"></span>
      </div>

      <div class="modal-card" ref="modalRef">
        <!-- Stamp title -->
        <div class="stamp" :class="{ 'stamp-win': isWinner, 'stamp-loss': !isWinner }">
          <h1>{{ isWinner ? 'VICTORY' : 'DEFEATED' }}</h1>
          <div class="stamp-sub">{{ isWinner ? 'NO MERCY DEALT' : 'NO MERCY SHOWN' }}</div>
        </div>

        <p class="tagline">
          <template v-if="isWinner">You showed no mercy.</template>
          <template v-else>{{ villainQuote }}</template>
        </p>

        <!-- Stats grid -->
        <div class="stats-grid" v-if="hasStats">
          <div class="stat-cell">
            <div class="stat-value">{{ animated.cardsPlayed }}</div>
            <div class="stat-label">CARDS PLAYED</div>
          </div>
          <div class="stat-cell">
            <div class="stat-value">{{ animated.biggestStack }}</div>
            <div class="stat-label">BIGGEST STACK</div>
          </div>
          <div class="stat-cell">
            <div class="stat-value">{{ animated.unosCalled }}</div>
            <div class="stat-label">UNOS CALLED</div>
          </div>
          <div class="stat-cell">
            <div class="stat-value">{{ animated.peakHand }}</div>
            <div class="stat-label">PEAK HAND</div>
          </div>
        </div>

        <!-- Primary CTA: dominant, color-matched to state -->
        <button class="cta-primary" :class="isWinner ? 'cta-win' : 'cta-loss'" @click="$emit('rematch')">
          {{ mode === 'sp' ? 'REMATCH' : 'BACK TO LOBBY' }}
        </button>

        <!-- Share row (win only — sharing a loss is tone-deaf) -->
        <div v-if="isWinner && mode === 'sp'" class="share-row">
          <button class="share-btn share-x" @click="$emit('share-twitter')">
            <span class="share-icon">𝕏</span> X
          </button>
          <button class="share-btn share-wa" @click="$emit('share-whatsapp')">
            <span class="share-icon">⬤</span> WhatsApp
          </button>
          <button class="share-btn share-image" @click="onShareImage" :disabled="generatingImage">
            <span class="share-icon">📷</span> {{ generatingImage ? '…' : 'Image' }}
          </button>
        </div>

        <!-- Footer: small dismissible links, not heavy CTAs -->
        <div class="footer-links">
          <button v-if="mode === 'sp'" class="link-btn" @click="$emit('back-to-lobby')">Back to menu</button>
          <button v-if="isAnonymous" class="link-btn upgrade-link" @click="$emit('upgrade-account')">Save your stats →</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import gsap from 'gsap'
import { generateShareImage, shareOrDownload } from '../../utils/shareImage'

interface Stats {
  cardsPlayed: number
  biggestStack: number
  unosCalled: number
  peakHand: number
}

const props = defineProps<{
  isWinner: boolean
  winnerName: string
  opponentName: string
  stats?: Stats
  isAnonymous: boolean
  mode: 'sp' | 'mp'
}>()

defineEmits<{
  (e: 'rematch'): void
  (e: 'back-to-lobby'): void
  (e: 'upgrade-account'): void
  (e: 'share-twitter'): void
  (e: 'share-whatsapp'): void
}>()

const modalRef = ref<HTMLElement | null>(null)
const generatingImage = ref(false)

// Rotating villain quotes on loss. Builds character without voice acting and
// stops the "{winner} walks away. You don't." line from grinding through
// every session. Picked once per mount so refreshing the loss screen doesn't
// shuffle the line mid-read.
const LOSS_QUOTES = [
  'Mercy is for cowards.',
  'You played. You lost. That’s the entire story.',
  'The bot does not forgive.',
  'Run it back. Or don’t. The deck doesn’t care.',
  'Some hands you fold. This was one of them.',
  'You came for a card game. You got a beatdown.',
  'Defeat tastes like every other day.',
  'The house always wins. Today the house was a bot.',
] as const

const villainQuote = LOSS_QUOTES[Math.floor(Math.random() * LOSS_QUOTES.length)]

async function onShareImage() {
  if (generatingImage.value) return
  generatingImage.value = true
  try {
    const blob = await generateShareImage({
      isWinner: props.isWinner,
      opponentName: props.opponentName,
      cardsPlayed: props.stats?.cardsPlayed ?? 0,
      biggestStack: props.stats?.biggestStack ?? 0,
      unosCalled: props.stats?.unosCalled ?? 0,
      peakHand: props.stats?.peakHand ?? 0,
      siteUrl: 'uno-no-mercy.com',
    })
    if (blob) await shareOrDownload(blob)
  } finally {
    generatingImage.value = false
  }
}

// Animated stat values — tick up from 0 to target over ~900ms.
const animated = ref<Stats>({ cardsPlayed: 0, biggestStack: 0, unosCalled: 0, peakHand: 0 })
const hasStats = computed(() => !!props.stats)

function tickUpStats() {
  if (!props.stats) return
  const target = props.stats
  gsap.to(animated.value, {
    cardsPlayed: target.cardsPlayed,
    biggestStack: target.biggestStack,
    unosCalled: target.unosCalled,
    peakHand: target.peakHand,
    duration: 0.9,
    delay: 0.3,
    ease: 'power2.out',
    snap: { cardsPlayed: 1, biggestStack: 1, unosCalled: 1, peakHand: 1 }
  })
}

onMounted(() => {
  // Entrance animation — stamp scales/rotates in, modal fades.
  if (modalRef.value) {
    gsap.from(modalRef.value, { opacity: 0, y: 30, duration: 0.35, ease: 'power3.out' })
  }
  tickUpStats()
})

watch(() => props.stats, tickUpStats, { deep: true })

// Deterministic confetti positioning so it doesn't reshuffle on re-render.
function confettiStyle(i: number) {
  const colors = ['#ffcc00', '#ff2a2a', '#00f3ff', '#00ff66', '#ffffff']
  const seed = i * 37
  return {
    left: `${(seed % 100)}%`,
    background: colors[i % colors.length],
    animationDelay: `${(seed % 1000) / 1000}s`,
    animationDuration: `${2.2 + ((seed % 800) / 1000)}s`,
  }
}
</script>

<style scoped>
.game-over-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  background: rgba(0, 0, 0, 0.75);
  animation: overlay-in 0.25s ease-out;
}

.game-over-overlay.is-win {
  background: radial-gradient(ellipse at center, rgba(255, 204, 0, 0.18) 0%, rgba(0, 0, 0, 0.85) 60%);
}
.game-over-overlay.is-loss {
  background: radial-gradient(ellipse at center, rgba(255, 42, 42, 0.18) 0%, rgba(0, 0, 0, 0.88) 60%);
}

@keyframes overlay-in { from { opacity: 0 } to { opacity: 1 } }

.modal-card {
  width: 100%;
  max-width: 440px;
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2rem 1.75rem 1.5rem;
  text-align: center;
  position: relative;
  font-family: 'Chakra Petch', sans-serif;
}

.is-win .modal-card {
  box-shadow: 0 0 50px rgba(255, 204, 0, 0.18), inset 0 0 1px rgba(255, 204, 0, 0.25);
}
.is-loss .modal-card {
  box-shadow: 0 0 50px rgba(255, 42, 42, 0.18), inset 0 0 1px rgba(255, 42, 42, 0.25);
}

/* Stamp title — the emotional anchor of the screen */
.stamp {
  position: relative;
  margin: 0.5rem 0 0.75rem;
  display: inline-block;
  padding: 0.5rem 1.5rem;
  animation: stamp-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes stamp-in {
  0%   { opacity: 0; transform: scale(2.5) rotate(-8deg); }
  60%  { opacity: 1; transform: scale(0.92) rotate(-3deg); }
  100% { opacity: 1; transform: scale(1) rotate(-4deg); }
}

.stamp h1 {
  font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: clamp(2.4rem, 8vw, 3.6rem);
  letter-spacing: 0.06em;
  line-height: 0.95;
  margin: 0;
}
.stamp-win h1 {
  color: #ffcc00;
  text-shadow: 0 0 25px rgba(255, 204, 0, 0.6), 0 0 4px rgba(255, 204, 0, 0.9);
}
.stamp-loss h1 {
  color: #ff2a2a;
  text-shadow: 0 0 25px rgba(255, 42, 42, 0.6), 0 0 4px rgba(255, 42, 42, 0.9);
}

.stamp-sub {
  font-size: 0.72rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.25rem;
}

.tagline {
  color: #a1a1aa;
  margin: 0.75rem 0 1.5rem;
  font-size: 0.95rem;
}
.tagline strong { color: #e6e6e6; }

/* Stats grid — 4 cells, 2x2 on mobile and a single row on wider modals */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
  margin: 0 -0.25rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  padding: 0.85rem 0;
}
.stat-cell {
  padding: 0.25rem 0.4rem;
}
.stat-value {
  font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: 1.6rem;
  color: #e6e6e6;
  line-height: 1;
}
.is-win .stat-value { color: #ffcc00; }
.stat-label {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #52525b;
  margin-top: 0.35rem;
}

/* Primary CTA — the obvious next action, dominant and glowing */
.cta-primary {
  width: 100%;
  font-family: 'Black Ops One', 'Impact', sans-serif;
  font-size: 1.1rem;
  letter-spacing: 0.15em;
  padding: 1rem 1rem;
  border: 2px solid;
  background: transparent;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, background 0.2s;
}
.cta-primary:hover { transform: translateY(-1px); }
.cta-primary:active { transform: translateY(0); }

.cta-win {
  color: #0a0a0b;
  background: #ffcc00;
  border-color: #ffcc00;
  box-shadow: 0 0 30px rgba(255, 204, 0, 0.45);
}
.cta-win:hover {
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.7);
}

.cta-loss {
  color: #ffffff;
  background: #ff2a2a;
  border-color: #ff2a2a;
  box-shadow: 0 0 30px rgba(255, 42, 42, 0.45);
}
.cta-loss:hover {
  box-shadow: 0 0 40px rgba(255, 42, 42, 0.7);
}

/* Share row — win only */
.share-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.85rem;
}
.share-btn {
  flex: 1;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 0.65rem 0.5rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.share-btn:hover { border-color: rgba(255, 255, 255, 0.3); color: #ffffff; }
.share-icon { display: inline-block; margin-right: 0.35rem; }
.share-x:hover { border-color: #1d9bf0; color: #1d9bf0; }
.share-wa:hover { border-color: #25d366; color: #25d366; }
.share-image:hover { border-color: #ffcc00; color: #ffcc00; }
.share-image:disabled { opacity: 0.5; cursor: wait; }

/* Footer links — minimal, doesn't compete with the primary */
.footer-links {
  margin-top: 1.5rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.link-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: #52525b;
  text-transform: uppercase;
  padding: 0.25rem 0;
  transition: color 0.15s;
}
.link-btn:hover { color: #a1a1aa; }
.upgrade-link:hover { color: #00f3ff; }

/* Confetti — pure CSS particles, no library */
.confetti-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.confetti-piece {
  position: absolute;
  top: -10px;
  width: 8px;
  height: 14px;
  opacity: 0;
  animation: confetti-fall linear forwards;
}
@keyframes confetti-fall {
  0%   { opacity: 0; transform: translateY(0) rotate(0deg); }
  10%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
}

@media (prefers-reduced-motion: reduce) {
  .game-over-overlay { animation: none; }
  .stamp { animation: none; }
  .confetti-piece { animation: none; opacity: 0; }
}
</style>
