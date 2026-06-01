<template>
  <div class="landing-container">
    <!-- Atmosphere -->
    <div class="scan-line" aria-hidden="true"></div>
    <div class="noise-overlay" aria-hidden="true"></div>
    <div class="grid-bg" aria-hidden="true"></div>

    <!-- Settings -->
    <div class="settings-corner">
      <SettingsButton />
    </div>

    <!-- HERO — single column, mobile-first. Primary CTA above the fold. -->
    <section class="hero">
      <div class="danger-tape" aria-hidden="true">
        <div class="tape-content">
          <span v-for="i in 20" :key="i">// NO MERCY ZONE // ENTER AT YOUR OWN RISK //</span>
        </div>
      </div>

      <div class="hero-inner">
        <header class="brand">
          <h1 class="brand-title glitch-text" data-text="UNO">UNO</h1>
          <h2 class="brand-subtitle">NO MERCY</h2>
          <p class="brand-tagline">THE RUTHLESS CARD BATTLE</p>
        </header>

        <div class="status-line-row" aria-hidden="true">
          <span class="status-line">
            <span class="blink">▶</span> SYSTEM: <span class="online">ONLINE</span>
          </span>
          <span class="status-line">
            <span class="blink">▶</span> THREAT: <span class="critical">MAXIMUM</span>
          </span>
        </div>

        <LandingStatsBadge class="hero-stats" />

        <Stack gap="3" align="stretch" class="hero-cta">
          <Button variant="primary" size="lg" block @click="reportAndEmit('playGuest')">
            PLAY NOW
          </Button>
          <Cluster gap="3" justify="center" align="center" class="hero-secondary">
            <button class="text-link" @click="reportAndEmit('showAuth', 'signup')">
              CREATE ACCOUNT
            </button>
            <span class="text-link-sep" aria-hidden="true">·</span>
            <button class="text-link" @click="reportAndEmit('showAuth', 'login')">
              SIGN IN
            </button>
          </Cluster>
        </Stack>
      </div>

      <button class="scroll-cue" @click="scrollPastHero" type="button">
        <span class="scroll-text">SCROLL FOR THE RULES</span>
        <svg class="scroll-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div class="hazard-bar" aria-hidden="true">
        <div class="hazard-stripe"></div>
      </div>

      <!-- Sentinel for sticky-CTA IntersectionObserver -->
      <div ref="heroSentinel" class="hero-sentinel" aria-hidden="true"></div>
    </section>

    <!-- Feature spotlight strip — what was hidden inside the action card now
         lives at the top of the page so people see *why* it's no-mercy. -->
    <section class="feature-strip" aria-label="Game features">
      <div class="feature-strip-inner">
        <article class="feature">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 class="feature-title">Real-time Multiplayer</h3>
          <p class="feature-desc">Room codes, 2-10 players, instant draws</p>
        </article>

        <article class="feature">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" aria-hidden="true">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="3" />
            <line x1="12" y1="8" x2="12" y2="11" />
            <circle cx="8" cy="16" r="1" fill="currentColor" />
            <circle cx="16" cy="16" r="1" fill="currentColor" />
          </svg>
          <h3 class="feature-title">VS Ruthless AI</h3>
          <p class="feature-desc">Single-player chaos when no one's online</p>
        </article>

        <article class="feature">
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <h3 class="feature-title">Stack &amp; Skip Everyone</h3>
          <p class="feature-desc">Every official No Mercy rule, implemented</p>
        </article>
      </div>
    </section>

    <!-- Scroll Animated Sections (feature deep-dives) -->
    <LandingScrollSections
      @playGuest="reportAndEmit('playGuest')"
      @openFeedback="showFeedback = true"
    />

    <div class="hazard-bar" aria-hidden="true">
      <div class="hazard-stripe"></div>
      <p class="warning-text">// WARNING: FRIENDSHIPS MAY NOT SURVIVE //</p>
    </div>

    <SiteFooter />

    <!-- Sticky mobile CTA — slides up once user scrolls past hero -->
    <Transition name="sticky-cta">
      <div v-show="showStickyCta" class="sticky-cta-wrap">
        <Button variant="primary" size="lg" block @click="reportAndEmit('playGuest')">
          PLAY NOW
        </Button>
      </div>
    </Transition>

    <FeedbackModal v-if="showFeedback" @close="showFeedback = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LandingScrollSections from './LandingScrollSections.vue'
import SiteFooter from './SiteFooter.vue'
import FeedbackModal from './FeedbackModal.vue'
import SettingsButton from './SettingsButton.vue'
import LandingStatsBadge from './LandingStatsBadge.vue'
import Button from './ui/Button.vue'
import Stack from './ui/Stack.vue'
import Cluster from './ui/Cluster.vue'

const showFeedback = ref(false)
const showStickyCta = ref(false)
const heroSentinel = ref<HTMLElement>()

const emit = defineEmits<{
  (e: 'showAuth', mode: 'login' | 'signup'): void
  (e: 'playGuest'): void
}>()

function reportAndEmit(event: 'playGuest'): void
function reportAndEmit(event: 'showAuth', mode: 'login' | 'signup'): void
function reportAndEmit(event: 'playGuest' | 'showAuth', mode?: 'login' | 'signup') {
  const fn = (window as unknown as { gtag_report_conversion?: () => void }).gtag_report_conversion
  if (typeof fn === 'function') {
    try { fn() } catch { /* noop */ }
  }
  if (event === 'showAuth' && mode) emit('showAuth', mode)
  else if (event === 'playGuest') emit('playGuest')
}

function scrollPastHero() {
  const target = document.querySelector('.feature-strip')
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!heroSentinel.value) return
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry) showStickyCta.value = !entry.isIntersecting
    },
    { threshold: 0 },
  )
  observer.observe(heroSentinel.value)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
})
</script>

<style scoped>
.landing-container {
  background: var(--bg-concrete);
  color: var(--text-primary);
  position: relative;
  display: flex;
  flex-direction: column;
}

.settings-corner {
  position: fixed;
  top: var(--spacing-4);
  right: var(--spacing-4);
  z-index: var(--z-hud);
}

/* Atmosphere overlays — pulled forward visually but stay non-interactive */
.scan-line {
  position: fixed;
  inset: 0;
  background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.2) 51%);
  background-size: 100% 4px;
  pointer-events: none;
  z-index: var(--z-toast);
}

.noise-overlay {
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: calc(var(--z-toast) - 1);
  opacity: 0.4;
}

.grid-bg {
  position: fixed;
  inset: 0;
  background:
    repeating-linear-gradient(90deg, transparent, transparent 80px, rgba(255, 42, 42, 0.03) 80px, rgba(255, 42, 42, 0.03) 81px),
    repeating-linear-gradient(0deg, transparent, transparent 80px, rgba(255, 42, 42, 0.03) 80px, rgba(255, 42, 42, 0.03) 81px);
  pointer-events: none;
  z-index: 0;
}

/* HERO */
.hero {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: var(--z-base);
}

.danger-tape {
  background: repeating-linear-gradient(-45deg, var(--color-alert), var(--color-alert) 10px, #000 10px, #000 20px);
  padding: var(--spacing-1) 0;
  overflow: hidden;
  position: relative;
  z-index: var(--z-cards);
}

.tape-content {
  display: flex;
  white-space: nowrap;
  animation: scroll-tape 30s linear infinite;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: white;
  letter-spacing: 2px;
}

.tape-content span {
  padding: 0 var(--spacing-8);
}

@keyframes scroll-tape {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .tape-content { animation: none; }
}

.hero-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-6);
  padding: var(--spacing-8) var(--spacing-4);
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
  text-align: center;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
}

.brand-title {
  font-family: var(--font-display);
  font-size: clamp(3.5rem, 14vw, 6rem);
  margin: 0;
  line-height: 0.9;
  text-shadow: var(--shadow-glow-red);
}

.brand-subtitle {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 6vw, 2.5rem);
  color: var(--color-alert);
  margin: 0;
  text-shadow: var(--shadow-glow-red);
  line-height: 1;
}

.brand-tagline {
  color: var(--text-muted);
  font-size: var(--text-sm);
  letter-spacing: 0.25em;
  margin: var(--spacing-2) 0 0 0;
}

.status-line-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-4);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.1em;
}

.blink {
  animation: blink 1s step-end infinite;
  color: var(--color-neon-green);
  margin-right: var(--spacing-1);
}

@keyframes blink {
  50% { opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .blink { animation: none; }
}

.online {
  color: var(--color-neon-green);
  font-weight: bold;
}

.critical {
  color: var(--color-alert);
  font-weight: bold;
  animation: critical-pulse 1s ease-in-out infinite;
}

@keyframes critical-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@media (prefers-reduced-motion: reduce) {
  .critical { animation: none; }
}

.hero-stats {
  margin: 0 auto;
}

.hero-cta {
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
}

.hero-secondary {
  font-family: var(--font-mono);
}

.text-link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: var(--spacing-2);
  transition: color var(--duration-snap) var(--ease-snap);
}

.text-link:hover {
  color: var(--color-neon-blue);
}

.text-link-sep {
  color: var(--text-muted);
}

.scroll-cue {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-4) 0;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font-mono);
  position: relative;
  z-index: var(--z-base);
}

.scroll-text {
  font-size: var(--text-xs);
  letter-spacing: 0.25em;
}

.scroll-chevron {
  animation: bounce-down 2s ease-in-out infinite;
}

@keyframes bounce-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(6px); }
}

@media (prefers-reduced-motion: reduce) {
  .scroll-chevron { animation: none; }
}

.hero-sentinel {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

/* HAZARD BAR */
.hazard-bar {
  position: relative;
  z-index: var(--z-cards);
}

.hazard-stripe {
  height: 16px;
  background: repeating-linear-gradient(-45deg, var(--color-hazard), var(--color-hazard) 10px, #000 10px, #000 20px);
}

.warning-text {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  text-align: center;
  color: var(--color-alert);
  background: var(--bg-concrete);
  margin: 0;
  padding: var(--spacing-3);
  letter-spacing: 2px;
}

/* FEATURE STRIP */
.feature-strip {
  padding: var(--spacing-12) var(--spacing-4);
  background: var(--bg-concrete);
  position: relative;
  z-index: var(--z-base);
}

.feature-strip-inner {
  max-width: 960px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-6);
}

.feature {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-2);
  text-align: center;
  padding: var(--spacing-6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
}

.feature-icon {
  color: var(--color-neon-blue);
  margin-bottom: var(--spacing-2);
}

.feature-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  margin: 0;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.feature-desc {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

/* STICKY CTA — mobile only */
.sticky-cta-wrap {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-3) var(--spacing-4) calc(var(--spacing-3) + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--bg-concrete) 70%, transparent);
  z-index: var(--z-toast);
  pointer-events: auto;
}

.sticky-cta-enter-active,
.sticky-cta-leave-active {
  transition: transform var(--duration-soft) var(--ease-soft), opacity var(--duration-soft) var(--ease-soft);
}

.sticky-cta-enter-from,
.sticky-cta-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .sticky-cta-enter-active,
  .sticky-cta-leave-active {
    transition: none;
  }
}

/* DESKTOP */
@media (min-width: 768px) {
  .hero-inner {
    padding: var(--spacing-16) var(--spacing-8);
    gap: var(--spacing-8);
    max-width: 720px;
  }

  .feature-strip-inner {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-8);
  }

  .feature {
    padding: var(--spacing-8);
  }

  /* Hide sticky CTA on desktop — primary CTA is always visible above the fold */
  .sticky-cta-wrap {
    display: none;
  }
}
</style>
