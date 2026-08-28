<template>
  <div class="pp-page">
    <header class="pp-topbar">
      <button class="back-link" @click="$emit('back')">
        <ChevronLeft :size="14" :stroke-width="2" aria-hidden="true" />
        BACK
      </button>
      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">OPEN</span>
        <span class="brand-mark-nomercy">MERCY</span>
      </a>
      <button v-if="p" class="share-btn" @click="onShare">
        <Check v-if="shareState === 'copied'" :size="14" :stroke-width="2" aria-hidden="true" />
        {{ shareState === 'copied' ? 'COPIED' : 'SHARE' }}
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
      <!-- WHO — name first, so you know whose page this is before the badge -->
      <header class="pp-who">
        <h1 class="pp-name">
          {{ p.username }}<span v-if="flagEmoji(p.country)" class="pp-flag" :title="p.country ?? ''">{{ flagEmoji(p.country) }}</span>
        </h1>
        <p class="pp-meta">
          <span v-if="presenceOnline" class="pp-live">Online now</span>
          <span v-else-if="lastSeenLabel">Last seen {{ lastSeenLabel }}</span>
          <span class="pp-sep" aria-hidden="true"></span>
          <span>{{ p.games }} games</span>
          <span class="pp-sep" aria-hidden="true"></span>
          <span>Since {{ memberSince }}</span>
        </p>
      </header>

      <!-- RAIL — the badge is the hero of this page -->
      <aside class="pp-rail">
        <Badge
          v-if="badgeInfo"
          class="pp-rail-badge"
          :badge="badgeInfo.badge"
          :points="badgeInfo.points"
          :progress="badgeInfo.progress"
          :presence="lastSeen"
          size="full"
          link
        />
        <p v-if="badgeInfo" class="pp-rail-tier">TIER {{ badgeInfo.badge.tier }} OF {{ BADGES.length }}</p>

        <div v-if="badgeInfo" class="pp-rail-points">
          <span class="pp-rail-points-value">{{ badgeInfo.points.toLocaleString() }}</span>
          <span class="pp-rail-points-label">POINTS EARNED</span>
        </div>

        <p v-if="badgeInfo" class="pp-ladder-title">THE LADDER</p>
        <ol v-if="badgeInfo" class="pp-ladder">
          <li
            v-for="tier in BADGES"
            :key="tier.tier"
            class="pp-ladder-row"
            :class="{
              'pp-ladder-row--current': tier.tier === badgeInfo.badge.tier,
              'pp-ladder-row--locked': tier.tier > badgeInfo.badge.tier,
            }"
          >
            <Badge class="pp-ladder-mark" :badge="tier" size="mark" aria-hidden="true" />
            <span class="pp-ladder-name">{{ tier.title }}</span>
            <span class="pp-ladder-threshold">{{ tier.threshold.toLocaleString() }}</span>
          </li>
        </ol>
      </aside>

      <div class="pp-record">
      <div v-if="p.games === 0" class="pp-empty">First game pending. The deck is waiting.</div>

      <template v-else>
        <!-- Where they stand in the field. Hidden rather than guessed at when
             profile-dossier.sql has not been run. -->
        <section v-if="dossier.standing.value" class="pp-standing-section">
          <h3 class="pp-section-title">STANDING</h3>
          <div class="pp-standing">
            <div class="pp-standing-cell">
              <p class="pp-standing-label">GLOBAL RANK</p>
              <p class="pp-standing-value pp-standing-value--global">#{{ dossier.standing.value.globalRank!.toLocaleString() }}</p>
              <p class="pp-standing-sub">
                of {{ dossier.standing.value.globalTotal.toLocaleString() }}<template v-if="topPercent"> · top {{ topPercent }}%</template>
              </p>
            </div>
            <div v-if="dossier.standing.value.countryRank && flagEmoji(p.country)" class="pp-standing-cell">
              <p class="pp-standing-label">
                <span class="pp-standing-flag" aria-hidden="true">{{ flagEmoji(p.country) }}</span> COUNTRY
              </p>
              <p class="pp-standing-value">#{{ dossier.standing.value.countryRank.toLocaleString() }}</p>
              <p class="pp-standing-sub">of {{ dossier.standing.value.countryTotal.toLocaleString() }}</p>
            </div>
          </div>
        </section>

        <!-- Every badge they have taken, and when -->
        <section v-if="dossier.promotions.value.length" class="pp-upgrades-section">
          <h3 class="pp-section-title">UPGRADES</h3>
          <ol class="pp-upgrades">
            <li
              v-for="(promotion, i) in dossier.promotions.value"
              :key="promotion.badge.tier"
              class="pp-upgrade"
              :class="{ 'pp-upgrade--current': promotion.badge.tier === badgeInfo?.badge.tier }"
            >
              <span v-if="i > 0" class="pp-upgrade-link" aria-hidden="true"></span>
              <Badge class="pp-upgrade-mark" :badge="promotion.badge" size="mark" aria-hidden="true" />
              <span class="pp-upgrade-name">{{ promotion.badge.title }}</span>
              <span class="pp-upgrade-when">{{ shortDate(promotion.at) }}</span>
            </li>
          </ol>
        </section>

        <!-- Play-day calendar: green = win day, red = loss day -->
        <section v-if="pp.activity.value.length" class="pp-activity">
          <h3 class="pp-section-title">
            ACTIVITY <span class="pp-title-note">{{ activityTotal }} GAMES · LAST 6 MONTHS</span>
          </h3>
          <ActivityHeatmap :activity="pp.activity.value" />
        </section>

        <section class="pp-panel">
          <h3 class="pp-section-title">SERVICE RECORD</h3>
          <ul class="pp-records">
            <li v-for="r in records" :key="r.label" class="pp-record-card">
              <p class="pp-record-label">{{ r.label }}</p>
              <p class="pp-record-value" :class="{ 'pp-record-value--hazard': r.hazard }">{{ r.value }}</p>
            </li>
          </ul>
        </section>

        <!-- Last 10 games. The detailed rows need profile-dossier.sql; without
             it the page falls back to the W/L strip public_profile returns. -->
        <section v-if="dossier.games.value.length" class="pp-games">
          <h3 class="pp-section-title">
            RECENT GAMES <span class="pp-title-note">LATEST FIRST</span>
          </h3>
          <ul class="pp-game-rows">
            <li v-for="(g, i) in dossier.games.value" :key="i" class="pp-game-row">
              <span class="pp-game-result" :class="'pp-game-result--' + g.result">
                {{ g.result.charAt(0).toUpperCase() }}
              </span>
              <span class="pp-game-mode">{{ g.is_bot_game ? 'BOT' : 'PVP' }}</span>
              <span class="pp-game-line">{{ gameSummary(g) }}</span>
              <span class="pp-game-points" :class="{ 'pp-game-points--win': g.result === 'won' }">+{{ g.points }}</span>
              <span class="pp-game-date">{{ shortDate(g.played_at) }}</span>
            </li>
          </ul>
        </section>
        <section v-else-if="p.recent_form.length" class="pp-form">
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
          <UserPlus :size="14" :stroke-width="2" aria-hidden="true" />
          {{ addLabel }}
        </button>
        <p class="pp-cta-line">Think you can beat {{ p.username }}?</p>
        <Button variant="primary" size="lg" block @click="$emit('back')">PLAY OPEN MERCY — FREE</Button>
      </section>
      <section v-else class="pp-cta pp-cta--own">
        <p v-if="authStore.isAnonymous" class="pp-cta-line">This is your guest profile - claim it from the lobby (CLAIM ACCOUNT) and everything here is yours forever.</p>
        <Button v-if="authStore.isAnonymous" variant="secondary" size="md" block @click="$emit('back')">GO TO LOBBY</Button>
        <!-- The one owner tool that is not on the page already: a PNG of these
             numbers, worth posting. Renaming lives in the lobby. -->
        <button v-if="p.games > 0" class="pp-own-link" @click="showShareCard = true">
          SHARE A STATS CARD <ArrowRight :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
      </section>
      </div>
    </div>

    <ShareStatsCard
      v-if="p && badgeInfo"
      :open="showShareCard"
      :username="p.username"
      :badge="badgeInfo.badge"
      :games="p.games"
      :wins="p.wins"
      :losses="Math.max(0, p.games - p.wins)"
      :eliminated="0"
      :win-rate="winRate"
      :best-streak="p.best_win_streak"
      :biggest-stack="p.max_stack_survived"
      :peak-cards="p.max_peak_cards"
      :share-url="shareUrl"
      @close="showShareCard = false"
    />

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { ArrowRight, Check, ChevronLeft, UserPlus } from 'lucide-vue-next'
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
import { useProfileDossier, type ProfileGame } from '../composables/useProfileDossier'
import { BADGES } from '../utils/badges'
import ActivityHeatmap from './ActivityHeatmap.vue'
import SiteFooter from './SiteFooter.vue'
import Button from './ui/Button.vue'
import Badge from './Badge.vue'
import ShareStatsCard from './ShareStatsCard.vue'

const props = defineProps<{ code: string }>()
defineEmits<{ (e: 'back'): void }>()

const pp = useProfile()
const dossier = useProfileDossier()
const showShareCard = ref(false)
const shareUrl = computed(() => `${window.location.origin}/p/${props.code}`)
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

interface RecordRow {
    label: string
    value: string
    hazard?: boolean
}

const records = computed<RecordRow[]>(() => {
    const v = p.value
    if (!v) return []
    // The five the dossier shows. A record a player has not set yet renders as
    // a dash rather than vanishing, so the row keeps its shape.
    return [
        { label: 'FASTEST WIN', value: v.min_duration_won ? clock(v.min_duration_won) : '—', hazard: true },
        { label: 'STACK EATEN', value: v.max_stack_survived > 0 ? `+${v.max_stack_survived}` : '—' },
        { label: 'LEANEST WIN', value: v.min_cards_won ? `${v.min_cards_won}` : '—' },
        { label: 'PEAK HELD', value: v.max_peak_cards > 0 ? `${v.max_peak_cards}` : '—' },
        { label: 'BEST RUN', value: `${v.best_win_streak}` },
    ]
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

/** Rounded up, so the very top of the board never reads "top 0%". */
const topPercent = computed(() => {
    const st = dossier.standing.value
    if (!st?.globalRank || st.globalTotal <= 0) return 0
    return Math.max(1, Math.ceil((st.globalRank / st.globalTotal) * 100))
})

function shortDate(iso: string): string {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** One line on what actually happened, from the fields the row carries. */
function gameSummary(g: ProfileGame): string {
    switch (g.result) {
        case 'won': {
            // opponent_count is 1 in a one-bot game, so this cannot be hardcoded plural.
            const who = g.opponent_count === 1 ? '1 opponent' : `${g.opponent_count} players`
            return g.biggest_stack_survived > 0
                ? `Beat ${who} · ate a +${g.biggest_stack_survived} stack`
                : `Beat ${who} in ${g.cards_played_total} cards`
        }
        case 'lost':
            return `Held ${g.cards_remaining} cards at the buzzer`
        case 'eliminated':
            return `Eliminated at ${g.peak_cards} cards`
        default:
            return `Walked away after ${g.cards_played_total} cards`
    }
}

onMounted(() => {
    void pp.fetchProfile(props.code)
    void dossier.fetchDossier(props.code)
})
watch(() => props.code, (code) => {
    void pp.fetchProfile(code)
    void dossier.fetchDossier(code)
})
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
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
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
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
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

/* After .pp-chip, not before: both are one class deep, so source order is
   what decides the colour. */
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

.pp-record-row:last-child { border-bottom: none; }

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
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
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
}

/* ---- Dossier sections (standing, ladder, upgrades, games) ---------------- */

.pp-standing {
  display: flex;
  flex-wrap: wrap;
}

.pp-standing-cell {
  flex: 1 1 180px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-right: var(--spacing-6);
}

.pp-standing-cell + .pp-standing-cell {
  padding-left: var(--spacing-6);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}

.pp-standing-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: var(--text-muted);
}

.pp-standing-flag { font-size: 1em; line-height: 1; }

.pp-standing-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  line-height: 1;
  color: var(--text-primary);
}

/* One cyan moment: the number this panel exists for. */
.pp-standing-value--global { color: var(--color-neon-blue); }

.pp-standing-sub {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.pp-ladder {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.pp-ladder-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-1) var(--spacing-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pp-ladder-row--current {
  border-color: color-mix(in srgb, var(--color-hazard) 35%, transparent);
  background: rgba(255, 204, 0, 0.08);
  color: var(--text-primary);
}

.pp-ladder-row--locked { color: var(--text-muted); }
.pp-ladder-row--locked .pp-ladder-mark { opacity: 0.4; }

.pp-ladder-mark { flex: none; }
.pp-ladder-mark :deep(.badge-emblem) { width: 22px; height: 22px; }

.pp-ladder-name { flex: 1; min-width: 0; }

.pp-ladder-threshold {
  flex: none;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* A chain you read left to right, each node joined to the last. */
.pp-upgrades {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: flex-start;
}

.pp-upgrade {
  flex: 1 1 0;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding-top: var(--spacing-4);
  font-family: var(--font-mono);
  text-align: center;
}

.pp-upgrade-link {
  position: absolute;
  top: calc(var(--spacing-4) + 11px);
  right: 50%;
  width: 100%;
  height: 1px;
  background: #27272a;
}

.pp-upgrade-mark :deep(.badge-emblem) { width: 22px; height: 22px; }
.pp-upgrade--current .pp-upgrade-mark :deep(.badge-emblem) { width: 30px; height: 30px; }

.pp-upgrade-name {
  max-width: 100%;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
  color: var(--text-secondary);
}

.pp-upgrade--current .pp-upgrade-name { color: var(--color-hazard); }

.pp-upgrade-when {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.pp-game-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.pp-game-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
}

.pp-game-result {
  flex: none;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: var(--text-xs);
}

.pp-game-result--won { background: var(--color-neon-green); color: var(--bg-concrete); }
.pp-game-result--lost { background: var(--color-alert); color: #ffffff; }
.pp-game-result--eliminated { background: var(--text-muted); color: #ffffff; }
.pp-game-result--abandoned { background: rgba(255, 255, 255, 0.1); color: var(--text-muted); }

.pp-game-mode {
  flex: none;
  width: 34px;
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.pp-game-line {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pp-game-points {
  flex: none;
  width: 56px;
  text-align: right;
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-muted);
}

.pp-game-points--win { color: var(--color-hazard); }

.pp-game-date {
  flex: none;
  width: 56px;
  text-align: right;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

@media (max-width: 600px) {
  .pp-standing-cell { flex: 1 1 100%; padding-right: 0; }

  .pp-standing-cell + .pp-standing-cell {
    padding-left: 0;
    padding-top: var(--spacing-3);
    margin-top: var(--spacing-3);
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* A chain has no room on a phone; the nodes become rows. */
  .pp-upgrades { flex-direction: column; align-items: stretch; gap: var(--spacing-1); }

  .pp-upgrade {
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-3);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: var(--radius-sm);
    text-align: left;
  }

  .pp-upgrade--current { border-color: color-mix(in srgb, var(--color-hazard) 30%, transparent); }
  .pp-upgrade-link { display: none; }
  .pp-upgrade-name { flex: 1; min-width: 0; }
  .pp-upgrade--current .pp-upgrade-mark :deep(.badge-emblem) { width: 22px; height: 22px; }

  .pp-game-mode { display: none; }
  .pp-game-line { font-size: var(--text-xs); }
}
/* ---- Dossier layout ------------------------------------------------------
   One page for every profile: your own and everyone else's. The rail carries
   the badge beside the record on desktop and drops below the name on a phone,
   which is why this is a grid and not two columns. */
.pp-content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-12);
  display: grid;
  grid-template-columns: 340px 1fr;
  grid-template-areas:
    'rail who'
    'rail record';
  align-content: start;
  gap: var(--spacing-6) var(--spacing-8);
}

.pp-who { grid-area: who; }
.pp-rail { grid-area: rail; }
.pp-record { grid-area: record; }

.pp-who {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.pp-name {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-3);
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-display);
  font-weight: 400;
  line-height: 1.05;
  color: var(--text-primary);
  overflow-wrap: anywhere;
}

/* 1em from painted pixels, matching the all-time board's measurement. */
.pp-flag {
  flex: none;
  font-size: 1em;
  line-height: 1;
}

.pp-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.pp-live { color: var(--color-neon-green); }

.pp-sep {
  width: 3px;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--text-muted);
  opacity: 0.6;
}

.pp-rail {
  align-self: start;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-6) var(--spacing-4);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
}

.pp-rail-badge :deep(.badge-emblem) { width: 132px; height: 132px; }
.pp-rail-badge :deep(.badge-label) { font-size: var(--text-2xl); }

.pp-rail-tier,
.pp-rail-points-label,
.pp-ladder-title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.pp-rail-points {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  width: 100%;
  padding-top: var(--spacing-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.pp-rail-points-value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1;
  color: var(--text-primary);
}

.pp-ladder-title {
  width: 100%;
  padding-top: var(--spacing-4);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.pp-ladder { width: 100%; }

/* The rail spans both grid rows, so a tall rail stretches the record's row.
   Pin the record to the top of it, or a short record (a new player with no
   games) floats in the middle of the gap. */
.pp-record {
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  min-width: 0;
}

.pp-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Five cards across, matching the dossier's service record. */
.pp-records {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
}

.pp-record-card {
  flex: 1 1 120px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
}

/* Uniform white labels; one value carries the colour instead. */
.pp-record-label {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: #ffffff;
}

.pp-record-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  line-height: 1;
  color: var(--text-primary);
}

.pp-record-value--hazard { color: var(--color-hazard); }

@media (max-width: 900px) {
  .pp-content {
    grid-template-columns: 1fr;
    grid-template-areas: 'who' 'rail' 'record';
    gap: var(--spacing-4);
    padding: var(--spacing-4) var(--spacing-3) var(--spacing-8);
  }

  .pp-rail-badge :deep(.badge-emblem) { width: 104px; height: 104px; }
  .pp-record-card { flex: 1 1 calc(50% - var(--spacing-2)); }
}

</style>
