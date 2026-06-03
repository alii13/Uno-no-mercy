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
          <button
            class="share-btn share-x"
            type="button"
            aria-label="Share on X"
            title="Share on X"
            @click="$emit('share-twitter')"
          >
            <!-- X (formerly Twitter) wordmark — inline SVG, brand mark is the label -->
            <svg class="share-icon-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </button>
          <button
            class="share-btn share-wa"
            type="button"
            :disabled="sharingWhatsapp"
            @click="onShareWhatsApp"
          >
            <!-- WhatsApp brand mark — Lucide doesn't ship brand icons, inlined -->
            <svg class="share-icon-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button
            class="share-btn share-image"
            type="button"
            :disabled="generatingImage"
            @click="onShareImage"
          >
            <ImageDown class="share-icon-svg" :stroke-width="1.75" aria-hidden="true" />
            {{ generatingImage ? '…' : 'Image' }}
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
import { ImageDown } from 'lucide-vue-next'
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
}>()

const modalRef = ref<HTMLElement | null>(null)
const generatingImage = ref(false)
const sharingWhatsapp = ref(false)

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

function sharePayload() {
  return {
    isWinner: props.isWinner,
    opponentName: props.opponentName,
    cardsPlayed: props.stats?.cardsPlayed ?? 0,
    biggestStack: props.stats?.biggestStack ?? 0,
    unosCalled: props.stats?.unosCalled ?? 0,
    peakHand: props.stats?.peakHand ?? 0,
    siteUrl: 'uno-no-mercy.com',
  }
}

async function onShareImage() {
  if (generatingImage.value) return
  generatingImage.value = true
  try {
    const blob = await generateShareImage(sharePayload())
    if (blob) await shareOrDownload(blob)
  } finally {
    generatingImage.value = false
  }
}

// WhatsApp share — on mobile (Web Share API + files), bundle the generated
// image along with the text. WhatsApp picks it up natively from the system
// share sheet. On desktop the API doesn't support files, fall back to the
// classic wa.me URL with text only (which is what the previous version did
// in every case).
async function onShareWhatsApp() {
  if (sharingWhatsapp.value) return
  sharingWhatsapp.value = true
  const text = 'Just destroyed the bot in UNO No Mercy. No mercy given. Play me if you dare.'
  const url = 'https://uno-no-mercy.com'
  try {
    const navAny = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean
      share?: (data: ShareData & { files?: File[] }) => Promise<void>
    }
    const blob = await generateShareImage(sharePayload())
    if (blob && navAny.canShare && navAny.share) {
      const file = new File([blob], 'uno-no-mercy-win.png', { type: 'image/png' })
      if (navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({
            files: [file],
            title: 'UNO No Mercy',
            text: `${text}\n\n${url}`,
          })
          return
        } catch {
          // User cancelled the share sheet — don't fall back, that's
          // a deliberate dismiss.
          return
        }
      }
    }
    // Desktop or unsupported: classic wa.me URL with text only.
    const encoded = encodeURIComponent(`${text}\n\n${url}`)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  } finally {
    sharingWhatsapp.value = false
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
.share-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}
.share-btn:hover { border-color: rgba(255, 255, 255, 0.3); color: #ffffff; }
.share-icon-svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.share-x:hover { border-color: #ffffff; color: #ffffff; }
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
