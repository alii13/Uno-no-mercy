<template>
  <div class="pp-page">
    <header class="pp-topbar">
      <button class="back-link" @click="$emit('back')">&larr; BACK</button>
      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">OPEN</span>
        <span class="brand-mark-nomercy">MERCY</span>
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
      <Button variant="primary" size="lg" @click="$emit('back')">PLAY OPEN MERCY — FREE</Button>
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
          <div class="pp-chips">
            <span class="pp-chip pp-chip--rank" :style="{ color: rank.color, borderColor: rank.color }">
              <Star :size="11" aria-hidden="true" /> {{ rank.title.toUpperCase() }}
            </span>
            <span class="pp-chip">{{ p.wins }} WINS</span>
            <span class="pp-chip">SINCE {{ memberSince }}</span>
          </div>
          <div v-if="nextRank" class="pp-progress">
            <div class="pp-progress-bar" role="img" :aria-label="`${nextRank.winsNeeded} wins to ${nextRank.title}`">
              <div class="pp-progress-fill" :style="{ width: progressPct + '%', background: rank.color }"></div>
            </div>
            <span class="pp-progress-label">{{ nextRank.winsNeeded }} WINS TO {{ nextRank.title.toUpperCase() }}</span>
          </div>
        </div>
      </section>

      <div v-if="p.games === 0" class="pp-empty">First game pending. The deck is waiting.</div>

      <template v-else>
        <!-- Headline numbers -->
        <section class="pp-stats">
          <div class="pp-stat">
            <Trophy class="pp-stat-icon" :size="14" aria-hidden="true" />
            <span class="pp-stat-value">{{ p.wins }}</span><span class="pp-stat-label">WINS</span>
          </div>
          <div class="pp-stat">
            <Swords class="pp-stat-icon" :size="14" aria-hidden="true" />
            <span class="pp-stat-value">{{ p.games }}</span><span class="pp-stat-label">GAMES</span>
          </div>
          <div class="pp-stat">
            <Target class="pp-stat-icon" :size="14" aria-hidden="true" />
            <span class="pp-stat-value">{{ winRate }}%</span><span class="pp-stat-label">WIN RATE</span>
          </div>
          <div class="pp-stat">
            <Flame class="pp-stat-icon pp-stat-icon--fire" :size="14" aria-hidden="true" />
            <span class="pp-stat-value pp-fire">{{ p.best_win_streak }}</span><span class="pp-stat-label">BEST STREAK</span>
          </div>
        </section>

        <!-- Play-day calendar: green = win day, red = loss day -->
        <section v-if="pp.activity.value.length" class="pp-activity">
          <h3 class="pp-section-title">
            ACTIVITY <span class="pp-title-note">{{ activityTotal }} GAMES · LAST 6 MONTHS</span>
          </h3>
          <ActivityHeatmap :activity="pp.activity.value" />
        </section>

        <!-- The brag stats unique to No Mercy -->
        <section v-if="records.length" class="pp-records">
          <h3 class="pp-section-title">NO MERCY RECORD</h3>
          <ul class="pp-record-rows">
            <li v-for="r in records" :key="r.label" class="pp-record-row">
              <component :is="r.icon" class="pp-record-icon" :size="13" aria-hidden="true" />
              <span class="pp-record-label">{{ r.label }}</span>
              <span class="pp-record-value">{{ r.value }}</span>
            </li>
          </ul>
        </section>

        <!-- Last 10 games, most recent first -->
        <section v-if="p.recent_form.length" class="pp-form">
          <h3 class="pp-section-title">
            RECENT FORM <span class="pp-title-note">LATEST FIRST</span>
          </h3>
          <div class="pp-form-strip">
            <span
              v-for="(f, i) in p.recent_form"
              :key="i"
              class="pp-form-chip"
              :class="'pp-form-chip--' + f"
              :title="f"
            >{{ FORM_LETTER[f] ?? '·' }}</span>
          </div>
        </section>

        <!-- Badge case: earned medallions lit, locked ones grayed out -->
        <section class="pp-badges">
          <div class="pp-badges-head">
            <h3 class="pp-section-title pp-section-title--flush">BADGE CASE</h3>
            <span class="pp-badge-count">{{ earned.size }}/{{ ACHIEVEMENTS.length }}</span>
          </div>
          <div
            class="pp-badges-bar"
            role="img"
            :aria-label="`${earned.size} of ${ACHIEVEMENTS.length} badges earned`"
          >
            <div class="pp-badges-fill" :style="{ width: (earned.size / ACHIEVEMENTS.length) * 100 + '%' }"></div>
          </div>
          <div class="pp-badge-grid">
            <div
              v-for="a in visibleBadges"
              :key="a.id"
              class="pp-badge"
              :class="{ earned: earned.has(a.id) }"
            >
              <span class="pp-badge-disc">
                <component :is="badgeIcon(a.id)" :size="16" aria-hidden="true" />
              </span>
              <span class="pp-badge-text">
                <span class="pp-badge-title">{{ a.title.toUpperCase() }}</span>
                <span class="pp-badge-desc">{{ a.desc }}</span>
              </span>
            </div>
          </div>
          <button
            v-if="sortedBadges.length > visibleBadges.length || showAllBadges"
            class="pp-badges-toggle"
            @click="showAllBadges = !showAllBadges"
          >
            {{ showAllBadges ? 'SHOW FEWER' : `SHOW ALL ${ACHIEVEMENTS.length} BADGES` }}
          </button>
        </section>
      </template>

      <!-- The growth loop: visitors get the challenge, the owner gets tools -->
      <section v-if="!isOwn" class="pp-cta">
        <p class="pp-cta-line">Think you can beat {{ p.username }}?</p>
        <Button variant="primary" size="lg" block @click="$emit('back')">PLAY OPEN MERCY — FREE</Button>
      </section>
      <section v-else-if="authStore.isAnonymous" class="pp-cta pp-cta--own">
        <p class="pp-cta-line">This is your guest profile — claim it from the lobby (CREATE ACCOUNT) and everything here is yours forever.</p>
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
import { ref, computed, onMounted, watch, nextTick, type FunctionalComponent } from 'vue'
import {
    Star, Trophy, Swords, Target, Flame, Zap, Shield, Layers, SkipForward, Plus,
    Droplet, Medal, Award, Crown, Gem, ShieldCheck, TrendingUp, Axe, Skull,
    Sparkles, Megaphone, Crosshair, Hourglass, ArrowLeftRight, CalendarCheck,
} from 'lucide-vue-next'
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
import ActivityHeatmap from './ActivityHeatmap.vue'
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

interface RecordRow { icon: FunctionalComponent; label: string; value: string }

const records = computed<RecordRow[]>(() => {
    if (!p.value) return []
    const out: RecordRow[] = []
    if (p.value.min_duration_won) out.push({ icon: Zap, label: 'FASTEST WIN', value: clock(p.value.min_duration_won) })
    if (p.value.max_stack_survived > 0) out.push({ icon: Shield, label: 'BIGGEST STACK SURVIVED', value: `+${p.value.max_stack_survived}` })
    if (p.value.max_peak_cards > 0) out.push({ icon: Layers, label: 'MOST CARDS HELD & LIVED', value: `${p.value.max_peak_cards}` })
    if (p.value.sum_skips > 0) out.push({ icon: SkipForward, label: 'SKIPS DEALT', value: `${p.value.sum_skips}` })
    if (p.value.sum_draw_cards > 0) out.push({ icon: Plus, label: 'DRAW CARDS INFLICTED', value: `${p.value.sum_draw_cards}` })
    return out
})

const FORM_LETTER: Record<string, string> = { won: 'W', lost: 'L', eliminated: 'E', abandoned: '–' }

const activityTotal = computed(() => pp.activity.value.reduce((n, d) => n + d.games, 0))

const sortedBadges = computed(() =>
    [...ACHIEVEMENTS].sort((a, b) => Number(earned.value.has(b.id)) - Number(earned.value.has(a.id))),
)

// Collapsed: everything earned plus the next locked goals — enough to
// tease the ladder without a 100-cell wall.
const showAllBadges = ref(false)
const visibleBadges = computed(() => {
    if (showAllBadges.value) return sortedBadges.value
    return sortedBadges.value.slice(0, Math.max(earned.value.size + 6, 12))
})

/** Tier ladders share a family icon, resolved by id prefix. */
const BADGE_FAMILY_ICONS: Array<[string, FunctionalComponent]> = [
    ['wins_', Trophy], ['games_', Swords], ['streak_', Flame], ['stack_', Shield],
    ['peak_', Layers], ['comeback_', TrendingUp], ['skips_', SkipForward], ['draw_', Plus],
    ['wild_', Sparkles], ['uno_', Megaphone], ['swap_', ArrowLeftRight], ['daily_', CalendarCheck],
    ['eff_', Crosshair], ['speed_', Zap], ['marathon_', Hourglass], ['rate_', Target],
]

function badgeIcon(id: string): FunctionalComponent {
    return BADGE_ICONS[id]
        ?? BADGE_FAMILY_ICONS.find(([prefix]) => id.startsWith(prefix))?.[1]
        ?? Medal
}

const BADGE_ICONS: Record<string, FunctionalComponent> = {
    first_blood: Droplet,
    first_win: Trophy,
    hat_trick: Medal,
    pentakill: Swords,
    ten_wins: Award,
    fifty_wins: Crown,
    hundred_wins: Gem,
    stack_16: Shield,
    stack_24: ShieldCheck,
    hoarder: Layers,
    dragon: Flame,
    comeback: TrendingUp,
    executioner: Axe,
    sadist: Skull,
    wild_thing: Sparkles,
    town_crier: Megaphone,
    clean_win: Crosshair,
    speed_demon: Zap,
    marathon: Hourglass,
    swap_meet: ArrowLeftRight,
    daily_devotee: CalendarCheck,
}

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
  gap: var(--spacing-8);
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

.pp-chips {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.pp-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  padding: 2px 10px;
  white-space: nowrap;
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

.pp-title-note {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin-left: var(--spacing-2);
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

.pp-stat-icon {
  color: var(--text-muted);
}

.pp-stat-icon--fire {
  color: var(--color-hazard, #ffcc00);
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
  margin: 0 0 var(--spacing-4);
}

.pp-records {
  border-left: 2px solid var(--color-alert, #ff2a2a);
  padding-left: var(--spacing-4);
}

.pp-record-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}

.pp-record-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3) 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.pp-record-row:last-child { border-bottom: none; }

.pp-record-icon {
  flex-shrink: 0;
  color: var(--color-alert, #ff2a2a);
}

.pp-record-label {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.pp-record-value {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  color: var(--text-primary);
}

.pp-form-strip {
  display: flex;
  gap: var(--spacing-2);
}

.pp-form-chip {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.pp-form-chip--won {
  background: rgba(0, 255, 102, 0.18);
  color: #00ff66;
  box-shadow: inset 0 0 0 1px rgba(0, 255, 102, 0.4);
}

.pp-form-chip--eliminated {
  background: rgba(255, 42, 42, 0.15);
  color: var(--color-alert, #ff2a2a);
  box-shadow: inset 0 0 0 1px rgba(255, 42, 42, 0.35);
}

.pp-form-chip--lost {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.pp-badges-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-2);
}

.pp-section-title--flush { margin: 0; }

.pp-badge-count {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--color-hazard);
}

.pp-badges-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: var(--spacing-4);
}

.pp-badges-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--color-hazard, #ffcc00);
}

.pp-badge-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--spacing-3);
}

.pp-badge {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.015);
  opacity: 0.45;
}

.pp-badge.earned {
  opacity: 1;
  border-color: rgba(255, 204, 0, 0.25);
}

.pp-badge-disc {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-muted);
}

.pp-badge.earned .pp-badge-disc {
  border-color: rgba(255, 204, 0, 0.45);
  background: rgba(255, 204, 0, 0.08);
  color: var(--color-hazard, #ffcc00);
  box-shadow: 0 0 10px rgba(255, 204, 0, 0.15);
}

.pp-badge-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
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
  line-height: 1.45;
}

.pp-badges-toggle {
  width: 100%;
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  background: none;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: var(--text-secondary);
  cursor: pointer;
  min-height: 40px;
}

.pp-badges-toggle:hover {
  border-color: rgba(255, 204, 0, 0.4);
  color: var(--color-hazard, #ffcc00);
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
