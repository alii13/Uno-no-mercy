<template>
  <div class="scroll-sections">

    <!-- Section 1: Stack or Suffer -->
    <section class="scroll-section stack-section" ref="stackSection">
      <div class="section-inner">
        <div class="section-label">01</div>
        <h2 class="section-heading">STACK <span class="accent-red">OR SUFFER</span></h2>
        <p class="section-desc">Draw cards stack. The pile grows until someone breaks.</p>

        <div class="stack-stage">
          <div class="stack-counter" ref="stackCounter">
            <span class="counter-plus">+</span><span class="counter-num" ref="counterNum">0</span>
          </div>
          <div class="stack-pile-wrap">
            <div class="stack-card sc-1" ref="sc1">
              <Card :card="{ id: 's1', color: 'red', type: 'draw2' }" :size="heroCardSize" />
            </div>
            <div class="stack-card sc-2" ref="sc2">
              <Card :card="{ id: 's2', color: 'wild', type: 'draw4' }" :size="heroCardSize" />
            </div>
            <div class="stack-card sc-3" ref="sc3">
              <Card :card="{ id: 's3', color: 'wild', type: 'draw6' }" :size="heroCardSize" />
            </div>
            <div class="stack-card sc-4" ref="sc4">
              <Card :card="{ id: 's4', color: 'wild', type: 'draw10' }" :size="heroCardSize" />
            </div>
          </div>
          <div class="impact-flash" ref="impactFlash"></div>
        </div>
      </div>
    </section>

    <!-- Section 2: Skip Everyone -->
    <section class="scroll-section skip-section" ref="skipSection">
      <div class="section-inner">
        <div class="section-label">02</div>
        <h2 class="section-heading">SKIP <span class="accent-blue">EVERYONE</span></h2>
        <p class="section-desc">One card. Every opponent skipped. You play again.</p>

        <div class="skip-stage">
          <div class="skip-victims">
            <div v-for="i in 4" :key="i" class="skip-victim" :ref="el => setRef('victim', i, el)">
              <div class="victim-avatar">{{ ['A','B','C','D'][i-1] }}</div>
              <div class="victim-name">PLAYER {{ i }}</div>
              <div class="victim-stamp" :ref="el => setRef('stamp', i, el)">SKIPPED</div>
            </div>
          </div>
          <div class="skip-card-hero" ref="skipCard">
            <Card :card="{ id: 'skip1', color: 'red', type: 'skipEveryone' }" :size="heroCardSize" />
          </div>
        </div>
      </div>
    </section>

    <!-- Section 3: Color Roulette -->
    <section class="scroll-section roulette-section" ref="rouletteSection">
      <div class="section-inner">
        <div class="section-label">03</div>
        <h2 class="section-heading">COLOR <span class="accent-yellow">ROULETTE</span></h2>
        <p class="section-desc">Draw until you hit the chosen color. Could be 1 card. Could be 15.</p>

        <div class="roulette-stage">
          <div class="roulette-target-label" ref="rouletteLabel">SEEKING: <span class="accent-green">GREEN</span></div>
          <div class="roulette-stream">
            <div v-for="(c, i) in rouletteCards" :key="i" class="roulette-card-wrap" :ref="el => setRef('rcard', i, el)">
              <Card :card="c" :size="medCardSize" />
              <div v-if="c.color !== 'green'" class="roulette-miss">MISS</div>
              <div v-else class="roulette-hit">HIT</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Section 4: Mercy Rule -->
    <section class="scroll-section mercy-section" ref="mercySection">
      <div class="section-inner">
        <div class="section-label">04</div>
        <h2 class="section-heading">25 CARDS? <span class="accent-red">ELIMINATED</span></h2>
        <p class="section-desc">Hold 25 cards and you're out. The mercy rule ends your suffering.</p>

        <div class="mercy-stage">
          <div class="mercy-counter-big" ref="mercyNum">7</div>
          <div class="mercy-hand-wrap">
            <CardBack v-for="i in 25" :key="i" :size="tinyCardSize" class="mercy-c" :ref="el => setRef('mc', i, el)" />
          </div>
          <div class="mercy-boom" ref="mercyBoom">ELIMINATED</div>
        </div>
      </div>
    </section>

    <!-- Section 5: CTA -->
    <section class="scroll-section cta-section" ref="ctaSection">
      <div class="section-inner cta-inner">
        <h2 class="cta-heading" ref="ctaH">READY?</h2>
        <p class="cta-sub" ref="ctaSub">No downloads. No login. Just chaos.</p>
        <button @click="reportAndPlay" class="cta-btn" ref="ctaBtn">PLAY NOW</button>
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

const emit = defineEmits<{ (e: 'playGuest'): void }>()

function reportAndPlay() {
  const fn = (window as any).gtag_report_conversion
  if (typeof fn === 'function') {
    try { fn() } catch (e) { /* noop */ }
  }
  emit('playGuest')
}

const isMobile = ref(window.innerWidth <= 768)
function onResize() { isMobile.value = window.innerWidth <= 768 }

const heroCardSize = computed(() => isMobile.value ? { width: 120, height: 168 } : { width: 180, height: 252 })
const medCardSize = computed(() => isMobile.value ? { width: 90, height: 126 } : { width: 130, height: 182 })
const tinyCardSize = computed(() => isMobile.value ? { width: 30, height: 42 } : { width: 50, height: 70 })

// Section refs
const stackSection = ref<HTMLElement>()
const sc1 = ref<HTMLElement>()
const sc2 = ref<HTMLElement>()
const sc3 = ref<HTMLElement>()
const sc4 = ref<HTMLElement>()
const stackCounter = ref<HTMLElement>()
const counterNum = ref<HTMLElement>()
const impactFlash = ref<HTMLElement>()
const skipSection = ref<HTMLElement>()
const skipCard = ref<HTMLElement>()
const rouletteSection = ref<HTMLElement>()
const rouletteLabel = ref<HTMLElement>()
const mercySection = ref<HTMLElement>()
const mercyNum = ref<HTMLElement>()
const mercyBoom = ref<HTMLElement>()
const ctaSection = ref<HTMLElement>()
const ctaH = ref<HTMLElement>()
const ctaSub = ref<HTMLElement>()
const ctaBtn = ref<HTMLElement>()

const dynamicRefs: Record<string, Record<number, HTMLElement>> = {}
function setRef(group: string, i: number, el: any) {
  if (!dynamicRefs[group]) dynamicRefs[group] = {}
  if (el) dynamicRefs[group][i] = el as HTMLElement
}
function getRef(group: string, i: number) { return dynamicRefs[group]?.[i] }

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
  requestAnimationFrame(() => requestAnimationFrame(init))
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  triggers.forEach(t => t.kill())
  ScrollTrigger.getAll().forEach(t => t.kill())
})

function init() {
  initStack()
  initSkip()
  initRoulette()
  initMercy()
  initCta()
}

function initStack() {
  const cards = [sc1.value, sc2.value, sc3.value, sc4.value]
  const values = [2, 6, 12, 22]
  if (!stackSection.value) return

  cards.forEach(c => { if (c) gsap.set(c, { opacity: 0, scale: 2.5, rotation: gsap.utils.random(-40, 40), y: -300, x: gsap.utils.random(-100, 100) }) })
  if (stackCounter.value) gsap.set(stackCounter.value, { scale: 0.5, opacity: 0 })
  if (impactFlash.value) gsap.set(impactFlash.value, { opacity: 0, scale: 0.5 })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: stackSection.value, start: 'top 80%', end: 'bottom 20%', scrub: 0.8 }
  })

  // Counter fades in
  if (stackCounter.value) {
    tl.to(stackCounter.value, { scale: 1, opacity: 1, duration: 0.15, ease: 'power2.out' }, 0)
  }

  cards.forEach((card, i) => {
    if (!card) return
    const t = 0.1 + i * 0.2

    // Card slams down from above with rotation
    tl.to(card, {
      opacity: 1, scale: 1, y: i * -6, x: i * 4,
      rotation: gsap.utils.random(-8, 8),
      duration: 0.2, ease: 'power4.in',
    }, t)

    // Impact flash on each card
    if (impactFlash.value) {
      tl.to(impactFlash.value, { opacity: 0.6, scale: 1.5, duration: 0.05 }, t + 0.18)
      tl.to(impactFlash.value, { opacity: 0, scale: 0.5, duration: 0.1 }, t + 0.23)
    }

    // Counter pulses up
    if (counterNum.value) {
      tl.call(() => { if (counterNum.value) counterNum.value.textContent = String(values[i]) }, [], t + 0.18)
    }
    if (stackCounter.value) {
      tl.to(stackCounter.value, { scale: 1.3, duration: 0.05, ease: 'power2.out' }, t + 0.18)
      tl.to(stackCounter.value, { scale: 1, duration: 0.1, ease: 'elastic.out(1, 0.5)' }, t + 0.23)
    }
  })

  triggers.push(tl.scrollTrigger!)
}

function initSkip() {
  if (!skipSection.value || !skipCard.value) return

  gsap.set(skipCard.value, { scale: 0, rotation: -720, opacity: 0 })
  for (let i = 1; i <= 4; i++) {
    const stamp = getRef('stamp', i)
    if (stamp) gsap.set(stamp, { scale: 0, rotation: -20 })
  }

  const tl = gsap.timeline({
    scrollTrigger: { trigger: skipSection.value, start: 'top 70%', end: 'bottom 30%', scrub: 0.8 }
  })

  // Card spins in dramatically
  tl.to(skipCard.value, { scale: 1, rotation: 0, opacity: 1, duration: 0.4, ease: 'power4.out' }, 0)

  // Overshoots then settles
  tl.to(skipCard.value, { scale: 1.15, duration: 0.1, ease: 'power2.out' }, 0.4)
  tl.to(skipCard.value, { scale: 1, duration: 0.15, ease: 'elastic.out(1, 0.4)' }, 0.5)

  // Victims get stamped with stagger
  for (let i = 1; i <= 4; i++) {
    const stamp = getRef('stamp', i)
    const victim = getRef('victim', i)
    if (!stamp) continue
    const t = 0.45 + i * 0.08

    tl.to(stamp, { scale: 1, rotation: gsap.utils.random(-5, 5), duration: 0.08, ease: 'back.out(3)' }, t)
    if (victim) {
      tl.to(victim, { opacity: 0.25, duration: 0.1 }, t)
    }
  }

  triggers.push(tl.scrollTrigger!)
}

function initRoulette() {
  if (!rouletteSection.value) return

  if (rouletteLabel.value) gsap.set(rouletteLabel.value, { opacity: 0, y: 20 })

  rouletteCards.forEach((_, i) => {
    const el = getRef('rcard', i)
    if (el) gsap.set(el, { opacity: 0, rotateY: -180, scale: 0.6 })
  })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: rouletteSection.value, start: 'top 70%', end: 'bottom 30%', scrub: 0.8 }
  })

  if (rouletteLabel.value) {
    tl.to(rouletteLabel.value, { opacity: 1, y: 0, duration: 0.15 }, 0)
  }

  // Cards flip in one by one with 3D rotation
  rouletteCards.forEach((card, i) => {
    const el = getRef('rcard', i)
    if (!el) return
    const isHit = card.color === 'green'
    const t = 0.1 + i * 0.14

    tl.to(el, {
      opacity: 1, rotateY: 0, scale: 1,
      duration: 0.15, ease: 'power3.out',
    }, t)

    // Miss cards shake, hit card glows
    if (!isHit) {
      tl.to(el, { x: -8, duration: 0.03 }, t + 0.15)
      tl.to(el, { x: 8, duration: 0.03 }, t + 0.18)
      tl.to(el, { x: 0, duration: 0.03 }, t + 0.21)
    } else {
      tl.to(el, { scale: 1.15, duration: 0.1, ease: 'power2.out' }, t + 0.15)
      tl.to(el, { scale: 1.05, duration: 0.2, ease: 'elastic.out(1, 0.3)' }, t + 0.25)
    }
  })

  triggers.push(tl.scrollTrigger!)
}

function initMercy() {
  if (!mercySection.value) return

  for (let i = 1; i <= 25; i++) {
    const c = getRef('mc', i)
    if (c) gsap.set(c, { opacity: i <= 7 ? 1 : 0, x: 0, y: 0, rotation: 0, scale: 1 })
  }
  if (mercyBoom.value) gsap.set(mercyBoom.value, { scale: 0, opacity: 0, rotation: -20 })
  if (mercyNum.value) gsap.set(mercyNum.value, { opacity: 1 })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: mercySection.value, start: 'top 60%', end: 'bottom 30%', scrub: 0.8 }
  })

  // Cards appear 8 through 25
  for (let i = 8; i <= 25; i++) {
    const c = getRef('mc', i)
    if (!c) continue
    tl.to(c, { opacity: 1, duration: 0.03 }, (i - 8) * 0.03)
    tl.call(() => { if (mercyNum.value) mercyNum.value.textContent = String(i) }, [], (i - 8) * 0.03)
  }

  // Counter turns red at 20+
  if (mercyNum.value) {
    tl.to(mercyNum.value, { color: '#ff2a2a', scale: 1.2, duration: 0.1 }, 0.36)
  }

  // ELIMINATED stamp
  if (mercyBoom.value) {
    tl.to(mercyBoom.value, { scale: 1, opacity: 1, rotation: 0, duration: 0.1, ease: 'back.out(3)' }, 0.52)
  }

  // Explosion scatter
  for (let i = 1; i <= 25; i++) {
    const c = getRef('mc', i)
    if (!c) continue
    tl.to(c, {
      x: gsap.utils.random(-300, 300),
      y: gsap.utils.random(-200, 200),
      rotation: gsap.utils.random(-90, 90),
      scale: 0,
      opacity: 0,
      duration: 0.2,
    }, 0.55 + Math.random() * 0.05)
  }

  // Counter fades
  if (mercyNum.value) {
    tl.to(mercyNum.value, { opacity: 0, duration: 0.1 }, 0.55)
  }

  triggers.push(tl.scrollTrigger!)
}

function initCta() {
  if (!ctaSection.value || !ctaH.value || !ctaBtn.value || !ctaSub.value) return

  gsap.set(ctaH.value, { opacity: 0, scale: 0.5, y: 60 })
  gsap.set(ctaSub.value, { opacity: 0, y: 30 })
  gsap.set(ctaBtn.value, { opacity: 0, scale: 0.8, y: 20 })

  const tl = gsap.timeline({
    scrollTrigger: { trigger: ctaSection.value, start: 'top 70%', end: 'top 30%', scrub: 0.8 }
  })

  tl.to(ctaH.value, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'power3.out' }, 0)
  tl.to(ctaSub.value, { opacity: 1, y: 0, duration: 0.2 }, 0.15)
  tl.to(ctaBtn.value, { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'back.out(2)' }, 0.25)

  triggers.push(tl.scrollTrigger!)
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
  padding: 6rem 2rem;
  position: relative;
  overflow: hidden;
}

.section-inner {
  max-width: 900px;
  width: 100%;
  text-align: center;
}

.section-label {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: #333;
  letter-spacing: 6px;
  margin-bottom: 1.5rem;
}

.section-heading {
  font-family: var(--font-display);
  font-size: 4rem;
  margin: 0 0 1rem;
  color: var(--text-primary);
  line-height: 1;
}

.accent-red { color: var(--color-alert); }
.accent-blue { color: var(--color-neon-blue); }
.accent-yellow { color: var(--color-hazard); }
.accent-green { color: var(--color-neon-green); }

.section-desc {
  color: var(--text-muted);
  font-size: 1.15rem;
  margin: 0 auto 4rem;
  max-width: 450px;
  line-height: 1.6;
}

/* ========== STACK ========== */
.stack-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  position: relative;
}

.stack-pile-wrap {
  position: relative;
  width: 180px;
  height: 252px;
}

.stack-card {
  position: absolute;
  top: 0;
  left: 0;
  filter: drop-shadow(0 10px 30px rgba(0,0,0,0.5));
}

.stack-counter {
  font-family: var(--font-display);
  font-size: 6rem;
  color: var(--color-alert);
  text-shadow: 0 0 40px rgba(255, 42, 42, 0.6);
  display: flex;
  align-items: baseline;
}

.counter-plus { font-size: 4rem; margin-right: 0.2rem; }

.impact-flash {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,42,42,0.4), transparent 70%);
  pointer-events: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* ========== SKIP ========== */
.skip-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3rem;
}

.skip-card-hero {
  filter: drop-shadow(0 20px 60px rgba(0, 243, 255, 0.3));
}

.skip-victims {
  display: flex;
  gap: 2.5rem;
  justify-content: center;
}

.skip-victim {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  transition: opacity 0.3s;
}

.victim-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #1a1a1a;
  border: 2px solid #444;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-size: 1.2rem;
}

.victim-name {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 1px;
}

.victim-stamp {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-family: var(--font-display);
  font-size: 0.8rem;
  color: var(--color-alert);
  border: 2px solid var(--color-alert);
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  z-index: 5;
  text-shadow: 0 0 10px var(--color-alert);
}

/* ========== ROULETTE ========== */
.roulette-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
}

.roulette-target-label {
  font-family: 'Courier New', monospace;
  font-size: 1.1rem;
  color: var(--text-muted);
  letter-spacing: 4px;
}

.roulette-stream {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  perspective: 800px;
}

.roulette-card-wrap {
  position: relative;
  filter: drop-shadow(0 8px 20px rgba(0,0,0,0.4));
  transform-style: preserve-3d;
}

.roulette-miss {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 0.7rem;
  color: var(--color-alert);
  opacity: 0.8;
  pointer-events: none;
}

.roulette-hit {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--color-neon-green);
  text-shadow: 0 0 20px var(--color-neon-green);
  pointer-events: none;
}

/* ========== MERCY ========== */
.mercy-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  position: relative;
  min-height: 250px;
  overflow: hidden;
  padding: 2rem 0;
}

.mercy-counter-big {
  font-family: var(--font-display);
  font-size: 5rem;
  color: var(--color-hazard);
  text-shadow: 0 0 30px rgba(255, 204, 0, 0.4);
  transition: color 0.2s;
}

.mercy-hand-wrap {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  max-width: 100%;
  overflow: hidden;
}

.mercy-c {
  margin-right: -22px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  flex-shrink: 0;
}

.mercy-c:last-child { margin-right: 0; }

.mercy-boom {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  font-family: var(--font-display);
  font-size: 3.5rem;
  color: var(--color-alert);
  border: 4px solid var(--color-alert);
  padding: 0.5rem 2.5rem;
  background: rgba(0, 0, 0, 0.95);
  white-space: nowrap;
  z-index: 10;
  text-shadow: 0 0 30px var(--color-alert);
  box-shadow: 0 0 60px rgba(255, 42, 42, 0.4);
  max-width: 90vw;
}

/* ========== CTA ========== */
.cta-section { min-height: 70vh; }

.cta-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.cta-heading {
  font-family: var(--font-display);
  font-size: 6rem;
  margin: 0;
  color: var(--text-primary);
  text-shadow: 0 0 40px rgba(255,255,255,0.1);
}

.cta-sub {
  color: var(--text-muted);
  font-size: 1.1rem;
  margin: 0;
  letter-spacing: 2px;
}

.cta-btn {
  padding: 1.5rem 5rem;
  font-family: var(--font-display);
  font-size: 1.4rem;
  background: linear-gradient(145deg, var(--color-alert) 0%, var(--color-alert-dim) 100%);
  border: 2px solid var(--color-alert);
  color: white;
  cursor: pointer;
  transition: all 0.3s;
}

.cta-btn:hover {
  transform: scale(1.08);
  box-shadow: 0 0 50px rgba(255, 42, 42, 0.6);
}

/* ========== MOBILE ========== */
@media (max-width: 768px) {
  .section-heading { font-size: 2.8rem; }
  .section-desc { font-size: 1rem; margin-bottom: 3rem; }
  .stack-counter { font-size: 4rem; }
  .counter-plus { font-size: 2.5rem; }
  .stack-pile-wrap { width: 120px; height: 168px; }
  .skip-victims { gap: 1.5rem; }
  .victim-avatar { width: 45px; height: 45px; font-size: 1rem; }
  .roulette-stream { gap: 0.5rem; }
  .mercy-counter-big { font-size: 3.5rem; }
  .mercy-boom { font-size: 2.2rem; padding: 0.3rem 1.5rem; }
  .mercy-c { margin-right: -26px; }
  .cta-heading { font-size: 4rem; }
  .cta-btn { padding: 1.2rem 3rem; font-size: 1.1rem; }
  .scroll-section { padding: 4rem 1.5rem; }
}

@media (max-width: 480px) {
  .section-heading { font-size: 2rem; }
  .section-desc { font-size: 0.9rem; margin-bottom: 2rem; }
  .stack-counter { font-size: 3rem; }
  .counter-plus { font-size: 2rem; }
  .skip-victims { gap: 0.75rem; flex-wrap: wrap; }
  .victim-avatar { width: 38px; height: 38px; }
  .victim-name { font-size: 0.6rem; }
  .roulette-stream { gap: 0.3rem; }
  .mercy-boom { font-size: 1.3rem; padding: 0.2rem 0.8rem; }
  .mercy-c { margin-right: -32px; }
  .cta-heading { font-size: 3rem; }
  .cta-btn { padding: 1rem 2.5rem; font-size: 1rem; }
  .scroll-section { padding: 3rem 1rem; }
  .impact-flash { width: 200px; height: 200px; }
}
</style>
