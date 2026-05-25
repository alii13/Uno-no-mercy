<template>
  <div class="scroll-sections">

    <!-- Section 1: Stack or Suffer -->
    <section class="scroll-section" ref="stackSection">
      <div class="section-inner">
        <div class="section-label">01</div>
        <h2 class="section-heading">STACK <span class="accent-red">OR SUFFER</span></h2>
        <p class="section-desc">Draw cards stack. +2 becomes +6 becomes +12. The pile grows until someone can't respond.</p>
        <div class="stack-arena">
          <div class="stack-pile">
            <div class="stack-card" ref="stackCard1">
              <Card :card="{ id: 's1', color: 'red', type: 'draw2' }" :size="cardSize" />
            </div>
            <div class="stack-card" ref="stackCard2">
              <Card :card="{ id: 's2', color: 'wild', type: 'draw4' }" :size="cardSize" />
            </div>
            <div class="stack-card" ref="stackCard3">
              <Card :card="{ id: 's3', color: 'wild', type: 'draw6' }" :size="cardSize" />
            </div>
            <div class="stack-card" ref="stackCard4">
              <Card :card="{ id: 's4', color: 'wild', type: 'draw10' }" :size="cardSize" />
            </div>
          </div>
          <div class="stack-counter" ref="stackCounter">+0</div>
        </div>
      </div>
    </section>

    <!-- Section 2: Skip Everyone -->
    <section class="scroll-section" ref="skipSection">
      <div class="section-inner">
        <div class="section-label">02</div>
        <h2 class="section-heading">SKIP <span class="accent-blue">EVERYONE</span></h2>
        <p class="section-desc">One card. Every opponent skipped. You play again. No mercy.</p>
        <div class="skip-arena">
          <div class="skip-center-card" ref="skipCenterCard">
            <Card :card="{ id: 'skip1', color: 'red', type: 'skipEveryone' }" :size="cardSize" />
          </div>
          <div class="skip-opponents">
            <div v-for="i in 4" :key="i" class="skip-opponent" :ref="el => setSkipRef(i, el)">
              <div class="opponent-avatar">{{ ['A','B','C','D'][i-1] }}</div>
              <div class="skip-stamp" :ref="el => setStampRef(i, el)">SKIPPED</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Color Roulette -->
    <section class="scroll-section" ref="rouletteSection">
      <div class="section-inner">
        <div class="section-label">03</div>
        <h2 class="section-heading">COLOR <span class="accent-yellow">ROULETTE</span></h2>
        <p class="section-desc">Draw until you hit the chosen color. Could be 1 card. Could be 15. Pure chaos.</p>
        <div class="roulette-arena">
          <div class="roulette-target">
            <Card :card="{ id: 'r0', color: 'wild', type: 'wildColorRoulette' }" :size="cardSize" />
          </div>
          <div class="roulette-draws">
            <div v-for="(c, i) in rouletteCards" :key="i" class="roulette-card" :ref="el => setRouletteCardRef(i, el)">
              <Card :card="c" :size="smallCardSize" />
            </div>
          </div>
          <div class="roulette-label" ref="rouletteLabel">SEEKING: GREEN</div>
        </div>
      </div>
    </section>

    <!-- Section 4: Mercy Rule -->
    <section class="scroll-section" ref="mercySection">
      <div class="section-inner">
        <div class="section-label">04</div>
        <h2 class="section-heading">25 CARDS? <span class="accent-red">ELIMINATED</span></h2>
        <p class="section-desc">Hold 25 cards and you're out. The mercy rule ends your suffering.</p>
        <div class="mercy-arena">
          <div class="mercy-hand">
            <CardBack v-for="i in 25" :key="i" :size="tinyCardSize" class="mercy-card-item" :ref="el => setMercyCardRef(i, el)" />
          </div>
          <div class="mercy-counter" ref="mercyCounter">7</div>
          <div class="mercy-stamp" ref="mercyStamp">ELIMINATED</div>
        </div>
      </div>
    </section>

    <!-- Section 5: CTA -->
    <section class="scroll-section cta-section" ref="ctaSection">
      <div class="section-inner cta-inner">
        <h2 class="cta-heading" ref="ctaHeading">READY?</h2>
        <button @click="$emit('playGuest')" class="cta-btn" ref="ctaBtn">PLAY NOW</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Card from './game/Card.vue'
import CardBack from './game/CardBack.vue'
import type { Card as CardType } from '../types/card'

gsap.registerPlugin(ScrollTrigger)

defineEmits<{
  (e: 'playGuest'): void
}>()

const isMobile = ref(window.innerWidth <= 768)
function onResize() { isMobile.value = window.innerWidth <= 768 }

const cardSize = computed(() => isMobile.value ? { width: 80, height: 112 } : { width: 120, height: 168 })
const smallCardSize = computed(() => isMobile.value ? { width: 55, height: 77 } : { width: 70, height: 98 })
const tinyCardSize = computed(() => isMobile.value ? { width: 35, height: 49 } : { width: 45, height: 63 })

// Refs
const stackSection = ref<HTMLElement>()
const stackCard1 = ref<HTMLElement>()
const stackCard2 = ref<HTMLElement>()
const stackCard3 = ref<HTMLElement>()
const stackCard4 = ref<HTMLElement>()
const stackCounter = ref<HTMLElement>()
const skipSection = ref<HTMLElement>()
const skipCenterCard = ref<HTMLElement>()
const rouletteSection = ref<HTMLElement>()
const rouletteLabel = ref<HTMLElement>()
const mercySection = ref<HTMLElement>()
const mercyCounter = ref<HTMLElement>()
const mercyStamp = ref<HTMLElement>()
const ctaSection = ref<HTMLElement>()
const ctaHeading = ref<HTMLElement>()
const ctaBtn = ref<HTMLElement>()

const skipOpponentRefs: Record<number, HTMLElement> = {}
const skipStampRefs: Record<number, HTMLElement> = {}
const rouletteCardRefs: Record<number, HTMLElement> = {}
const mercyCardRefs: Record<number, HTMLElement> = {}

function setSkipRef(i: number, el: any) { if (el) skipOpponentRefs[i] = el as HTMLElement }
function setStampRef(i: number, el: any) { if (el) skipStampRefs[i] = el as HTMLElement }
function setRouletteCardRef(i: number, el: any) { if (el) rouletteCardRefs[i] = el as HTMLElement }
function setMercyCardRef(i: number, el: any) { if (el) mercyCardRefs[i] = el as HTMLElement }

const rouletteCards: CardType[] = [
  { id: 'r1', color: 'red', type: 'number', value: 3 },
  { id: 'r2', color: 'blue', type: 'number', value: 7 },
  { id: 'r3', color: 'yellow', type: 'number', value: 5 },
  { id: 'r4', color: 'red', type: 'number', value: 9 },
  { id: 'r5', color: 'blue', type: 'number', value: 2 },
  { id: 'r6', color: 'green', type: 'number', value: 4 },
]

let triggers: ScrollTrigger[] = []

onMounted(() => {
  window.addEventListener('resize', onResize)
  requestAnimationFrame(() => {
    requestAnimationFrame(initAnimations)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  triggers.forEach(t => t.kill())
  triggers = []
  ScrollTrigger.getAll().forEach(t => t.kill())
})

function initAnimations() {
  // Section 1: Stack cards fly in one by one
  const stackCards = [stackCard1.value, stackCard2.value, stackCard3.value, stackCard4.value]
  const stackValues = [2, 6, 12, 22]

  stackCards.forEach(c => {
    if (c) gsap.set(c, { opacity: 0, y: 80, rotation: gsap.utils.random(-30, 30), scale: 0.5 })
  })

  if (stackSection.value) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stackSection.value,
        start: 'top 70%',
        end: 'center center',
        scrub: 1,
        onEnter: () => {},
      }
    })

    stackCards.forEach((card, i) => {
      if (!card) return
      tl.to(card, {
        opacity: 1,
        y: -(i * 8),
        x: i * 3,
        rotation: gsap.utils.random(-10, 10),
        scale: 1,
        duration: 0.3,
        ease: 'back.out(1.5)',
        onStart: () => {
          if (stackCounter.value) stackCounter.value.textContent = `+${stackValues[i]}`
        }
      }, i * 0.15)
    })

    triggers.push(tl.scrollTrigger!)
  }

  // Section 2: Skip Everyone - card slams in, opponents get stamped
  if (skipCenterCard.value) gsap.set(skipCenterCard.value, { scale: 0, rotation: -180 })
  Object.values(skipStampRefs).forEach(s => gsap.set(s, { scale: 0, opacity: 0 }))

  if (skipSection.value && skipCenterCard.value) {
    const tl2 = gsap.timeline({
      scrollTrigger: {
        trigger: skipSection.value,
        start: 'top 60%',
        end: 'center center',
        scrub: 1,
      }
    })

    tl2.to(skipCenterCard.value, {
      scale: 1,
      rotation: 0,
      duration: 0.4,
      ease: 'back.out(2)',
    })

    for (let i = 1; i <= 4; i++) {
      const stamp = skipStampRefs[i]
      const opp = skipOpponentRefs[i]
      if (!stamp || !opp) continue

      tl2.to(stamp, {
        scale: 1,
        opacity: 1,
        duration: 0.15,
        ease: 'back.out(3)',
      }, 0.3 + i * 0.1)
      tl2.to(opp, {
        opacity: 0.3,
        filter: 'grayscale(1)',
        duration: 0.15,
      }, 0.3 + i * 0.1)
    }

    triggers.push(tl2.scrollTrigger!)
  }

  // Section 3: Roulette - cards flip up one by one
  Object.values(rouletteCardRefs).forEach(c => gsap.set(c, { opacity: 0, y: 40, scale: 0.7 }))
  if (rouletteLabel.value) gsap.set(rouletteLabel.value, { opacity: 0 })

  if (rouletteSection.value) {
    const tl3 = gsap.timeline({
      scrollTrigger: {
        trigger: rouletteSection.value,
        start: 'top 60%',
        end: 'center center',
        scrub: 1,
      }
    })

    if (rouletteLabel.value) {
      tl3.to(rouletteLabel.value, { opacity: 1, duration: 0.2 }, 0)
    }

    rouletteCards.forEach((card, i) => {
      const el = rouletteCardRefs[i]
      if (!el) return

      const isMatch = card.color === 'green'
      tl3.to(el, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: isMatch ? () => {
          gsap.to(el, { boxShadow: '0 0 30px rgba(0, 255, 100, 0.8)', duration: 0.3 })
        } : undefined,
      }, 0.15 + i * 0.12)
    })

    triggers.push(tl3.scrollTrigger!)
  }

  // Section 4: Mercy rule - cards fan out, counter goes up, stamp slams
  // Cards 1-7 visible, 8-25 hidden
  for (let i = 1; i <= 25; i++) {
    const c = mercyCardRefs[i]
    if (c) gsap.set(c, { opacity: i <= 7 ? 1 : 0, x: 0, y: 0, rotation: 0 })
  }
  if (mercyStamp.value) gsap.set(mercyStamp.value, { scale: 0, opacity: 0, rotation: -15 })

  if (mercySection.value) {
    const tl4 = gsap.timeline({
      scrollTrigger: {
        trigger: mercySection.value,
        start: 'top 60%',
        end: 'bottom 60%',
        scrub: 1,
      }
    })

    // Cards appear one by one from 8 to 25
    for (let i = 8; i <= 25; i++) {
      const card = mercyCardRefs[i]
      if (!card) continue
      tl4.to(card, {
        opacity: 1,
        duration: 0.05,
        onStart: () => {
          if (mercyCounter.value) mercyCounter.value.textContent = String(i)
        }
      }, (i - 8) * 0.04)
    }

    // Stamp slams in
    if (!mercyStamp.value) return
    tl4.to(mercyStamp.value, {
      scale: 1,
      opacity: 1,
      rotation: 0,
      duration: 0.2,
      ease: 'back.out(2)',
      onStart: () => {
        if (mercyCounter.value) mercyCounter.value.textContent = '25'
      }
    })

    // Cards scatter
    for (let i = 1; i <= 25; i++) {
      const card = mercyCardRefs[i]
      if (!card) continue
      tl4.to(card, {
        x: gsap.utils.random(-200, 200),
        y: gsap.utils.random(-100, 100),
        rotation: gsap.utils.random(-60, 60),
        opacity: 0,
        duration: 0.3,
      }, '>-0.1')
    }

    triggers.push(tl4.scrollTrigger!)
  }

  // Section 5: CTA fade in
  if (ctaHeading.value) gsap.set(ctaHeading.value, { opacity: 0, y: 30 })
  if (ctaBtn.value) gsap.set(ctaBtn.value, { opacity: 0, y: 20 })

  if (ctaSection.value && ctaHeading.value && ctaBtn.value) {
    const tl5 = gsap.timeline({
      scrollTrigger: {
        trigger: ctaSection.value,
        start: 'top 70%',
        end: 'top 40%',
        scrub: 1,
      }
    })

    tl5.to(ctaHeading.value, { opacity: 1, y: 0, duration: 0.3 })
    tl5.to(ctaBtn.value, { opacity: 1, y: 0, duration: 0.3 }, 0.1)
    triggers.push(tl5.scrollTrigger!)
  }
}
</script>

<style scoped>
.scroll-sections {
  position: relative;
  z-index: 5;
}

.scroll-section {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  position: relative;
}

.section-inner {
  max-width: 800px;
  width: 100%;
  text-align: center;
}

.section-label {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-muted);
  letter-spacing: 4px;
  margin-bottom: 1rem;
}

.section-heading {
  font-family: var(--font-display);
  font-size: 3.5rem;
  margin: 0 0 1rem;
  color: var(--text-primary);
  line-height: 1.1;
}

.accent-red { color: var(--color-alert); }
.accent-blue { color: var(--color-neon-blue); }
.accent-yellow { color: var(--color-hazard); }

.section-desc {
  color: var(--text-muted);
  font-size: 1.1rem;
  margin: 0 0 3rem;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

/* Stack Arena */
.stack-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.stack-pile {
  position: relative;
  width: 120px;
  height: 168px;
}

.stack-card {
  position: absolute;
  top: 0;
  left: 0;
}

.stack-counter {
  font-family: var(--font-display);
  font-size: 4rem;
  color: var(--color-alert);
  text-shadow: 0 0 20px rgba(255, 42, 42, 0.5);
}

/* Skip Arena */
.skip-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.skip-center-card {
  position: relative;
  z-index: 2;
}

.skip-opponents {
  display: flex;
  gap: 2rem;
  justify-content: center;
}

.skip-opponent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  transition: all 0.3s;
}

.opponent-avatar {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #222;
  border: 2px solid #444;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  color: var(--text-secondary);
  font-family: var(--font-display);
}

.skip-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-family: var(--font-display);
  font-size: 0.65rem;
  color: var(--color-alert);
  border: 2px solid var(--color-alert);
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.8);
  white-space: nowrap;
  z-index: 5;
}

/* Roulette Arena */
.roulette-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.roulette-draws {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.roulette-card {
  transition: box-shadow 0.3s;
  border-radius: 6px;
}

.roulette-label {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: var(--color-neon-green);
  letter-spacing: 3px;
}

/* Mercy Arena */
.mercy-arena {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  position: relative;
  min-height: 200px;
}

.mercy-hand {
  display: flex;
  justify-content: center;
  position: relative;
}

.mercy-card-item {
  margin-right: -20px;
  transition: all 0.1s;
}

.mercy-card-item:last-child {
  margin-right: 0;
}

.mercy-counter {
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-hazard);
}

.mercy-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 3rem;
  color: var(--color-alert);
  border: 4px solid var(--color-alert);
  padding: 0.5rem 2rem;
  background: rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  z-index: 10;
}

/* CTA Section */
.cta-section {
  min-height: 60vh;
}

.cta-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.cta-heading {
  font-family: var(--font-display);
  font-size: 5rem;
  margin: 0;
  color: var(--text-primary);
}

.cta-btn {
  padding: 1.5rem 4rem;
  font-family: var(--font-display);
  font-size: 1.3rem;
  background: linear-gradient(145deg, var(--color-alert) 0%, var(--color-alert-dim) 100%);
  border: 2px solid var(--color-alert);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.cta-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 0 40px rgba(255, 42, 42, 0.5);
}

/* Mobile */
@media (max-width: 768px) {
  .section-heading { font-size: 2.5rem; }
  .section-desc { font-size: 0.95rem; }
  .stack-counter { font-size: 3rem; }
  .stack-pile { width: 80px; height: 112px; }
  .skip-opponents { gap: 1rem; }
  .opponent-avatar { width: 40px; height: 40px; font-size: 0.85rem; }
  .cta-heading { font-size: 3.5rem; }
  .cta-btn { padding: 1rem 3rem; font-size: 1.1rem; }
  .mercy-stamp { font-size: 2rem; padding: 0.3rem 1rem; }
  .scroll-section { padding: 3rem 1rem; }
}

@media (max-width: 480px) {
  .section-heading { font-size: 2rem; }
  .section-desc { font-size: 0.85rem; margin-bottom: 2rem; }
  .stack-counter { font-size: 2.5rem; }
  .skip-opponents { gap: 0.5rem; flex-wrap: wrap; }
  .opponent-avatar { width: 35px; height: 35px; font-size: 0.75rem; }
  .roulette-draws { gap: 0.3rem; }
  .cta-heading { font-size: 2.5rem; }
  .cta-btn { padding: 1rem 2rem; font-size: 1rem; }
  .mercy-card-item { margin-right: -25px; }
  .mercy-stamp { font-size: 1.5rem; }
}
</style>
