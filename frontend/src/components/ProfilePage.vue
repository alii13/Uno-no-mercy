<template>
  <div class="pp-page">
    <header class="pp-topbar">
      <button class="back-link" @click="$emit('back')">&larr; BACK</button>
      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">UNO</span>
        <span class="brand-mark-nomercy">NO MERCY</span>
      </a>
      <button v-if="p" class="share-btn" @click="onShare">
        {{ shareState === 'copied' ? 'COPIED ✓' : 'SHARE' }}
      </button>
      <span v-else class="pp-topbar-spacer" aria-hidden="true"></span>
    </header>

    <div v-if="pp.loading.value" class="pp-state">
      <p class="pp-state-text">LOADING PROFILE…</p>
    </div>

    <div v-else-if="pp.unavailable.value || pp.notFound.value" class="pp-state">
      <h2 class="pp-state-title">{{ pp.notFound.value ? 'PLAYER NOT FOUND' : 'PROFILES ARE WARMING UP' }}</h2>
      <p class="pp-state-desc">
        {{ pp.notFound.value
          ? 'This profile link doesn\'t match any player.'
          : 'Public profiles aren\'t live yet. The game definitely is.' }}
      </p>
      <Button variant="primary" size="lg" @click="$emit('back')">PLAY UNO NO MERCY — FREE</Button>
    </div>

    <div v-else-if="p" ref="contentEl" class="pp-content">
      <!-- Identity hero: their skin, name, rank ladder position -->
      <section class="pp-hero">
        <CardBack
          class="pp-skin"
          :size="{ width: 74, height: 104 }"
          :accent="skinColors(p.skin ?? undefined).accent"
          :stripe="skinColors(p.skin ?? undefined).stripe"
          aria-hidden="true"
        />
        <div class="pp-identity">
          <div class="pp-name-row">
            <h1 class="pp-name">{{ p.username }}</h1>
            <span v-if="flagEmoji(p.country)" class="pp-flag" :title="p.country ?? ''">{{ flagEmoji(p.country) }}</span>
          </div>
          <div class="pp-rank" :style="{ color: rank.color }">⭐ {{ rank.title.toUpperCase() }}</div>
          <div v-if="nextRank" class="pp-progress">
            <div class="pp-progress-bar" role="img" :aria-label="`${nextRank.winsNeeded} wins to ${nextRank.title}`">
              <div class="pp-progress-fill" :style="{ width: progressPct + '%', background: rank.color }"></div>
            </div>
            <span class="pp-progress-label">{{ nextRank.winsNeeded }} WINS TO {{ nextRank.title.toUpperCase() }}</span>
          </div>
          <div class="pp-since">PLAYING SINCE {{ memberSince }}</div>
        </div>
      </section>

      <div v-if="p.games === 0" class="pp-empty">First game pending. The deck is waiting.</div>

      <template v-else>
        <!-- Headline numbers -->
        <section class="pp-stats">
          <div class="pp-stat"><span class="pp-stat-value">{{ p.wins }}</span><span class="pp-stat-label">WINS</span></div>
          <div class="pp-stat"><span class="pp-stat-value">{{ p.games }}</span><span class="pp-stat-label">GAMES</span></div>
          <div class="pp-stat"><span class="pp-stat-value">{{ winRate }}%</span><span class="pp-stat-label">WIN RATE</span></div>
          <div class="pp-stat"><span class="pp-stat-value pp-fire">{{ p.best_win_streak }}</span><span class="pp-stat-label">BEST STREAK</span></div>
        </section>

        <!-- The brag stats unique to No Mercy -->
        <section v-if="records.length" class="pp-records">
          <h3 class="pp-section-title">NO MERCY RECORD</h3>
          <ul class="pp-record-list">
            <li v-for="r in records" :key="r" class="pp-record">{{ r }}</li>
          </ul>
        </section>

        <!-- Last 10 games -->
        <section v-if="p.recent_form.length" class="pp-form">
          <h3 class="pp-section-title">RECENT FORM</h3>
          <div class="pp-form-dots">
            <span
              v-for="(f, i) in p.recent_form"
              :key="i"
              class="pp-dot"
              :class="'pp-dot--' + f"
              :title="f"
            ></span>
          </div>
        </section>

        <!-- Badge case -->
        <section class="pp-badges">
          <h3 class="pp-section-title">
            BADGE CASE <span class="pp-badge-count">{{ earned.size }}/{{ ACHIEVEMENTS.length }}</span>
          </h3>
          <div class="pp-badge-grid">
            <div
              v-for="a in ACHIEVEMENTS"
              :key="a.id"
              class="pp-badge"
              :class="{ earned: earned.has(a.id) }"
            >
              <span class="pp-badge-title">{{ a.title.toUpperCase() }}</span>
              <span class="pp-badge-desc">{{ a.desc }}</span>
            </div>
          </div>
        </section>
      </template>

      <!-- The growth loop: visitors get the challenge, the owner gets tools -->
      <section v-if="!isOwn" class="pp-cta">
        <p class="pp-cta-line">Think you can beat {{ p.username }}?</p>
        <Button variant="primary" size="lg" block @click="$emit('back')">PLAY UNO NO MERCY — FREE</Button>
      </section>
      <section v-else-if="authStore.isAnonymous" class="pp-cta pp-cta--own">
        <p class="pp-cta-line">This is your guest profile — create an account from the lobby to keep your name on it.</p>
        <Button variant="secondary" size="md" block @click="$emit('back')">GO TO LOBBY</Button>
      </section>
      <section v-else class="pp-cta pp-cta--own">
        <button class="pp-own-link" @click="$emit('dashboard')">EDIT NAME · CHANGE CARD BACK · FULL STATS &rarr;</button>
      </section>
    </div>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useProfile } from '../composables/useProfile'
import { useMotion } from '../composables/useMotion'
import { useAuthStore } from '../stores/authStore'
import { ACHIEVEMENTS, earnedFromAggregates } from '../utils/achievements'
import { skinColors } from '../utils/cosmetics'
import { flagEmoji } from '../utils/country'
import { shareProfile } from '../utils/share'
import { track } from '../utils/analytics'
import { RANKS, rankFor } from '../utils/ranks'
import CardBack from './game/CardBack.vue'
import SiteFooter from './SiteFooter.vue'
import Button from './ui/Button.vue'

const props = defineProps<{ code: string }>()
defineEmits<{ (e: 'back'): void; (e: 'dashboard'): void }>()

const pp = useProfile()
const authStore = useAuthStore()
const motion = useMotion()
const contentEl = ref<HTMLElement | null>(null)

const p = computed(() => pp.profile.value)
const isOwn = computed(() => !!authStore.profile?.share_code && authStore.profile.share_code === props.code)

const rank = computed(() => rankFor(p.value?.wins ?? 0))
const nextRank = computed(() => {
    const wins = p.value?.wins ?? 0
    const next = RANKS.find(r => r.threshold > wins)
    return next ? { title: next.title, winsNeeded: next.threshold - wins, threshold: next.threshold } : null
})
const progressPct = computed(() => {
    if (!nextRank.value) return 100
    const wins = p.value?.wins ?? 0
    const cur = rank.value.threshold
    return Math.round(((wins - cur) / (nextRank.value.threshold - cur)) * 100)
})

const winRate = computed(() => {
    if (!p.value || p.value.games === 0) return 0
    return Math.round((p.value.wins / p.value.games) * 100)
})

const memberSince = computed(() => {
    if (!p.value) return ''
    return new Date(p.value.member_since)
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        .toUpperCase()
})

function clock(secs: number): string {
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

const records = computed<string[]>(() => {
    if (!p.value) return []
    const out: string[] = []
    if (p.value.max_stack_survived > 0) out.push(`Survived a +${p.value.max_stack_survived} stack`)
    if (p.value.min_duration_won) out.push(`Fastest win ${clock(p.value.min_duration_won)}`)
    if (p.value.max_peak_cards > 0) out.push(`Held ${p.value.max_peak_cards} cards and lived`)
    if (p.value.sum_skips > 0) out.push(`${p.value.sum_skips} skips dealt`)
    if (p.value.sum_draw_cards > 0) out.push(`${p.value.sum_draw_cards} draw cards inflicted`)
    return out
})

const earned = computed(() => new Set(p.value ? earnedFromAggregates(p.value).map(a => a.id) : []))

const shareState = ref<'idle' | 'copied'>('idle')

async function onShare() {
    if (!p.value) return
    const outcome = await shareProfile({
        username: p.value.username,
        wins: p.value.wins,
        max_stack_survived: p.value.max_stack_survived,
        isOwn: isOwn.value,
        url: `${window.location.origin}/p/${props.code}`,
    })
    track('profile_shared', { method: outcome, own: isOwn.value })
    if (outcome === 'copied') {
        shareState.value = 'copied'
        setTimeout(() => { shareState.value = 'idle' }, 2000)
    }
}

// Stat blocks rise in once — final state matches natural layout, inline
// props cleared so GSAP never fights Vue.
function animateIn() {
    const blocks = contentEl.value?.querySelectorAll('section')
    if (!blocks?.length || motion.reduced) return
    gsap.set(blocks, { opacity: 0, y: 10 })
    motion.soft(blocks, { opacity: 1, y: 0, stagger: 0.06, clearProps: 'all' })
}

watch(p, async (val) => {
    if (val) {
        await nextTick()
        animateIn()
    }
})

onMounted(() => { void pp.fetchProfile(props.code) })
watch(() => props.code, (code) => { void pp.fetchProfile(code) })
</script>

<style scoped>
.pp-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-void, #0a0a0a);
}

.pp-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-4) var(--spacing-6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.back-link {
  background: none;
  border: none;
  padding: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 44px;
}

.back-link:hover { color: var(--color-neon-blue); }

.brand-mark {
  font-family: var(--font-display);
  letter-spacing: 0.08em;
  text-decoration: none;
  font-size: 1rem;
}
.brand-mark-uno { color: var(--text-primary); }
.brand-mark-nomercy { color: var(--color-alert); margin-left: 0.4ch; }

.pp-topbar-spacer { width: 72px; }

.share-btn {
  background: none;
  border: 1px solid var(--color-neon-blue);
  border-radius: var(--radius-sm);
  padding: var(--spacing-2) var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--color-neon-blue);
  cursor: pointer;
  min-height: 36px;
}

.share-btn:hover {
  background: rgba(0, 229, 255, 0.08);
}

.pp-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-4);
  padding: var(--spacing-8) var(--spacing-4);
  text-align: center;
}

.pp-state-text,
.pp-state-desc {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
}

.pp-state-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  letter-spacing: 0.12em;
  color: var(--text-primary);
  margin: 0;
}

.pp-content {
  flex: 1;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-8);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.pp-hero {
  display: flex;
  align-items: center;
  gap: var(--spacing-6);
  padding: var(--spacing-4);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
}

.pp-skin { flex-shrink: 0; }

.pp-identity {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  min-width: 0;
}

.pp-name-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 0;
}

.pp-name {
  font-family: var(--font-display);
  font-size: 1.4rem;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-flag { font-size: 1.1rem; line-height: 1; flex-shrink: 0; }

.pp-rank {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.16em;
}

.pp-progress {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.pp-progress-bar {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
}

.pp-progress-fill {
  height: 100%;
  border-radius: 999px;
}

.pp-progress-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  color: var(--text-muted);
}

.pp-since {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.pp-empty {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--spacing-6);
}

.pp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-2);
}

.pp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-3) var(--spacing-2);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
}

.pp-stat-value {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--text-primary);
}

.pp-fire { color: var(--color-hazard, #ffcc00); }

.pp-stat-label {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.pp-section-title {
  font-family: var(--font-display);
  font-size: 0.95rem;
  letter-spacing: 0.14em;
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-3);
}

.pp-records {
  padding: var(--spacing-4);
  background: rgba(255, 42, 42, 0.04);
  border: 1px solid rgba(255, 42, 42, 0.25);
  border-radius: var(--radius-sm);
}

.pp-record-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2) var(--spacing-4);
}

.pp-record {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pp-record::before {
  content: '▸ ';
  color: var(--color-alert);
}

.pp-form-dots {
  display: flex;
  gap: var(--spacing-2);
}

.pp-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}

.pp-dot--won { background: #00ff66; box-shadow: 0 0 6px rgba(0, 255, 102, 0.5); }
.pp-dot--lost { background: rgba(255, 255, 255, 0.25); }
.pp-dot--eliminated { background: var(--color-alert); }
.pp-dot--abandoned { background: rgba(255, 255, 255, 0.12); }

.pp-badge-count {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-hazard);
  margin-left: var(--spacing-2);
}

.pp-badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-2);
}

.pp-badge {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  opacity: 0.35;
}

.pp-badge.earned {
  opacity: 1;
  border-color: rgba(255, 204, 0, 0.4);
  background: rgba(255, 204, 0, 0.04);
}

.pp-badge-title {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--text-primary);
}

.pp-badge.earned .pp-badge-title { color: var(--color-hazard); }

.pp-badge-desc {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.pp-cta {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-6);
  text-align: center;
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: var(--radius-md);
}

.pp-cta--own {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}

.pp-cta-line {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.pp-own-link {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--spacing-2);
}

.pp-own-link:hover { color: var(--color-neon-blue); }

@media (max-width: 480px) {
  .pp-stats { grid-template-columns: repeat(2, 1fr); }
  .pp-hero { flex-direction: column; text-align: center; }
  .pp-name-row { justify-content: center; }
  .pp-progress { width: 100%; }
}
</style>
