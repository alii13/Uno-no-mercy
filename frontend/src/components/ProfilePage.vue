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
        <Badge
          v-if="badgeInfo"
          :badge="badgeInfo.badge"
          :points="badgeInfo.points"
          :progress="badgeInfo.progress"
          :presence="lastSeen"
          size="mark"
          link
          class="pp-emblem"
        />
        <div class="pp-identity">
          <div class="pp-name-row">
            <h1 class="pp-name">{{ p.username }}</h1>
            <span v-if="flagEmoji(p.country)" class="pp-flag" :title="p.country ?? ''">{{ flagEmoji(p.country) }}</span>
          </div>
          <div class="pp-chips">
            <!-- Presence answers the only question a visitor has here: can I
                 play this person now, or is it worth leaving an invite? -->
            <span v-if="presenceOnline" class="pp-chip pp-chip--live">ONLINE</span>
            <span v-else-if="lastSeenLabel" class="pp-chip">LAST SEEN {{ lastSeenLabel }}</span>
            <span class="pp-chip">{{ p.wins }} WINS</span>
            <span class="pp-chip">SINCE {{ memberSince }}</span>
          </div>
          <div v-if="badgeInfo?.progress.next" class="pp-progress">
            <div class="pp-progress-bar" role="img" :aria-label="`${badgeInfo.progress.needed} points to ${badgeInfo.progress.next.title}`">
              <div class="pp-progress-fill" :style="{ width: Math.round(badgeInfo.progress.pct * 100) + '%', background: badgeInfo.badge.color }"></div>
            </div>
            <span class="pp-progress-label">{{ badgeInfo.progress.needed.toLocaleString() }} POINTS TO {{ badgeInfo.progress.next.title.toUpperCase() }}</span>
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

      </template>

      <!-- The growth loop: visitors get the challenge, the owner gets tools -->
      <section v-if="!isOwn" class="pp-cta">
        <!-- Only for a signed-in visitor: a friend request needs an account
             to come from, and a guest account counts. -->
        <button
          v-if="canAddFriend"
          class="pp-add-friend"
          :disabled="social.pendingIds.has(p.user_id!)"
          @click="addFriend"
        >
          <UserPlus :size="15" :stroke-width="2.25" aria-hidden="true" />
          {{ addLabel }}
        </button>
        <p class="pp-cta-line">Think you can beat {{ p.username }}?</p>
        <Button variant="primary" size="lg" block @click="$emit('back')">PLAY OPEN MERCY — FREE</Button>
      </section>
      <section v-else-if="authStore.isAnonymous" class="pp-cta pp-cta--own">
        <p class="pp-cta-line">This is your guest profile - claim it from the lobby (CLAIM ACCOUNT) and everything here is yours forever.</p>
        <Button variant="secondary" size="md" block @click="$emit('back')">GO TO LOBBY</Button>
        <!-- Guests own their stats and card back too; withholding the tools
             left them with no route to the dashboard at all. -->
        <button class="pp-own-link" @click="$emit('dashboard')">EDIT NAME · CHANGE CARD BACK · FULL STATS &rarr;</button>
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
    Trophy, Swords, Target, Flame, Zap, Shield, Layers, SkipForward, Plus, UserPlus,
} from 'lucide-vue-next'
import gsap from 'gsap'
import { useProfile } from '../composables/useProfile'
import { useMotion } from '../composables/useMotion'
import { useAuthStore } from '../stores/authStore'
import { flagEmoji } from '../utils/country'
import { usePresence } from '../composables/usePresence'
import { useNow } from '../composables/useClock'
import { isOnline, relativeTime } from '../utils/relativeTime'
import { useSocialStore, type SendResult } from '../stores/socialStore'
import { shareProfile } from '../utils/share'
import { track } from '../utils/analytics'
import { useBadges } from '../composables/useBadges'
import ActivityHeatmap from './ActivityHeatmap.vue'
import SiteFooter from './SiteFooter.vue'
import Button from './ui/Button.vue'
import Badge from './Badge.vue'

const props = defineProps<{ code: string }>()
defineEmits<{ (e: 'back'): void; (e: 'dashboard'): void }>()

const pp = useProfile()
const authStore = useAuthStore()
const motion = useMotion()
const contentEl = ref<HTMLElement | null>(null)

const p = computed(() => pp.profile.value)
const isOwn = computed(() => !!authStore.profile?.share_code && authStore.profile.share_code === props.code)

const { badges, fetchBadges } = useBadges()
watch(() => p.value?.user_id, (id) => { if (id) void fetchBadges([id]) }, { immediate: true })
const badgeInfo = computed(() => (p.value?.user_id ? badges.value[p.value.user_id] : undefined))

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

// The page can sit open for an hour, and a chip that still reads ONLINE after
// the player left is a small lie.
const presenceNow = useNow()

// Friends. The list is read once so the button can say what it already is,
// rather than offering ADD to someone you asked yesterday.
const social = useSocialStore()
const sendResult = ref<SendResult | null>(null)
onMounted(() => { if (authStore.isAuthenticated) void social.refresh() })

const canAddFriend = computed(() =>
    !!p.value?.user_id && authStore.isAuthenticated && !social.unavailable && !isOwn.value,
)

const addLabel = computed(() => {
    const id = p.value?.user_id
    const known = id ? social.rows.find(r => r.user_id === id) : undefined
    if (known?.status === 'accepted') return 'FRIENDS'
    if (known?.status === 'blocked') return 'BLOCKED'
    if (known?.status === 'pending') return known.incoming ? 'ACCEPT REQUEST' : 'REQUEST SENT'
    if (sendResult.value === 'rate_limited') return 'TRY AGAIN TOMORROW'
    if (sendResult.value === 'declined') return 'ASK LATER'
    if (sendResult.value === 'failed') return 'TRY AGAIN'
    return 'ADD FRIEND'
})

async function addFriend() {
    const id = p.value?.user_id
    if (!id) return
    const known = social.rows.find(r => r.user_id === id)
    // Their request is already waiting: the same button accepts it.
    if (known?.status === 'pending' && known.incoming) {
        await social.respond(id, true)
        return
    }
    if (known) return
    sendResult.value = await social.sendRequest(id)
}

// Same batched lookup and same cache the leaderboard and the friends list
// use - one presence path, so the dot cannot disagree with itself.
const { presence, fetchPresence } = usePresence()
watch(() => p.value?.user_id, (id) => { if (id) void fetchPresence([id]) }, { immediate: true })
const lastSeen = computed(() => (p.value?.user_id ? presence.value[p.value.user_id] ?? null : null))

const presenceOnline = computed(() => isOnline(lastSeen.value, presenceNow.value))
const lastSeenLabel = computed(() => relativeTime(lastSeen.value, presenceNow.value).toUpperCase())

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

.pp-emblem { flex: none; }
.pp-emblem :deep(.badge-emblem) { width: 88px; height: 88px; }

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

/* After .pp-chip, not before: both are one class deep, so source order is
   what decides the colour. */
.pp-chip--live {
  color: var(--color-neon-green);
  border-color: rgba(0, 255, 102, 0.35);
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

.pp-add-friend {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  align-self: center;
  padding: var(--spacing-2) var(--spacing-4);
  background: transparent;
  border: 1px solid rgba(0, 243, 255, 0.35);
  border-radius: var(--radius-sm);
  color: var(--color-neon-blue);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.pp-add-friend:hover:not(:disabled) {
  background: rgba(0, 243, 255, 0.08);
  border-color: rgba(0, 243, 255, 0.6);
}

.pp-add-friend:disabled {
  opacity: 0.55;
  cursor: default;
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
