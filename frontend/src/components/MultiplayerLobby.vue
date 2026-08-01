<template>
  <div class="lobby-container">
    <!-- Top bar — slim, brand left, identity + auth controls right. No scan-line. -->
    <header class="lobby-top-bar">
      <a class="brand-mark" href="#" @click.prevent>
        <span class="brand-mark-uno">UNO</span>
        <span class="brand-mark-nomercy">NO MERCY</span>
      </a>

      <div class="top-bar-cta">
        <input
          v-if="authStore.isAnonymous && editingName && editTarget === 'bar'"
          v-model="nameInput"
          v-focus-ring
          class="username-edit-input"
          maxlength="20"
          aria-label="Edit nickname"
          @keyup.enter="saveName"
          @keyup.esc="editingName = false"
          @blur="saveName"
        />
        <button
          v-else-if="authStore.isAnonymous"
          class="username-chip username-chip-editable"
          title="Tap to rename"
          @click="startEditName('bar')"
        >
          {{ authStore.username }}
          <Pencil class="chip-edit-icon" :stroke-width="2" aria-hidden="true" />
        </button>
        <!-- Signed in, so the nickname isn't editable here — the chip becomes
             the way into your own stats instead. -->
        <button
          v-else
          class="username-chip username-chip-action"
          title="View your stats"
          @click="$emit('showStats')"
        >
          {{ authStore.username }}
          <ChevronRight class="chip-edit-icon" :stroke-width="2" aria-hidden="true" />
        </button>
        <button
          v-if="authStore.isAnonymous"
          class="text-link upgrade-link"
          @click="upgradeAccount"
        >
          {{ authStore.claimPending ? 'CONFIRM YOUR EMAIL' : 'CREATE ACCOUNT' }}
        </button>
        <button class="text-link" @click="requestSignOut">
          SIGN OUT
        </button>
      </div>
    </header>

    <div class="lobby-content" :class="{ 'lobby-content--top': !mpStore.currentGame }">
      <!-- Dead invite/room code: rooms close when everyone leaves, so a stale
           link can never succeed — offer escape hatches instead of a retry trap. -->
      <div v-if="roomEnded" class="room-ended-card" role="alert">
        <h2 class="room-ended-title">THIS ROOM HAS ENDED</h2>
        <p class="room-ended-sub">Rooms close when everyone leaves. Start a fresh one or jump into a live match.</p>
        <div class="room-ended-actions">
          <Button variant="primary" size="md" block :disabled="mpStore.loading" @click="handleCreateGame">
            {{ mpStore.loading ? 'CREATING...' : 'CREATE A NEW ROOM' }}
          </Button>
          <Button variant="secondary" size="md" block :disabled="mpStore.loading" @click="handleQuickMatch">
            QUICK MATCH
          </Button>
        </div>
      </div>
      <div v-else-if="friendlyError" class="error-banner">
        {{ friendlyError }}
      </div>

      <!-- No active game — focused entry view with one primary CTA -->
      <div v-if="!mpStore.currentGame" class="lobby-entry">
        <h1 class="entry-heading">HOW DO YOU WANT TO PLAY?</h1>

        <!-- The daily loop: the deal is the reason to play today, the board is
             the reason to come back tomorrow. Deliberately flat siblings
             rather than per-column wrappers — the desktop grid places each
             card into a shared row, and that shared row is what lines the card
             borders up across both columns. -->
        <div class="daily-card" :class="{ done: !!dailyRecord }">
          <div class="daily-head">
            <span class="daily-title">TODAY'S DEAL</span>
            <span class="daily-date">{{ dailyDateLabel }}</span>
          </div>
          <div
            v-if="retention.effectiveStreak > 0"
            class="streak-chip"
            :class="{ 'at-risk': !retention.playedToday }"
            role="status"
          >
            <Flame class="streak-flame" :stroke-width="2.5" aria-hidden="true" />
            <span class="streak-count">{{ retention.effectiveStreak }}-day streak</span>
            <span v-if="!retention.playedToday" class="streak-state streak-state--warn">Play today to keep it</span>
          </div>
          <template v-if="!dailyRecord">
            <p class="daily-desc">The same shuffle for every player in the world. One scored attempt.</p>
            <Button variant="secondary" size="md" block @click="$emit('playDaily')">
              PLAY
            </Button>
          </template>
          <p v-else class="daily-desc daily-result">
            {{ dailyRecord.result === 'won' ? `Cleared in ${dailyRecord.turns} turns` : dailyRecord.result === 'eliminated' ? 'Mercy got you today' : 'Lost today' }}
            — new deal tomorrow.
          </p>
        </div>

        <!-- Feature-detected the same way the leaderboard link always was:
             absent until the definer SQL is installed. -->
        <div v-if="lb.available.value" class="board-card">
          <div class="board-head">
            <span class="board-title">Today's top</span>
            <span v-if="dailyPlayerCount" class="board-count">{{ dailyPlayerCount }} played</span>
          </div>
          <ol v-if="lb.daily.value.length" class="board-list">
            <li
              v-for="row in lb.daily.value.slice(0, 5)"
              :key="row.rank"
              class="board-row"
              :class="{ mine: row.is_me }"
            >
              <span class="board-rank">{{ row.rank }}</span>
              <!-- share_code only exists once the v2 SQL is installed, so the
                   name falls back to plain text rather than a dead button. -->
              <component
                :is="row.share_code ? 'button' : 'span'"
                class="board-name"
                :class="{ clickable: !!row.share_code }"
                @click="openProfile(row)"
              >
                {{ row.username }}
              </component>
              <span
                class="board-metric"
                :class="row.result === 'won' ? 'board-metric--won' : 'board-metric--out'"
              >
                {{ row.result === 'won' ? `${row.effort} moves` : row.result === 'eliminated' ? 'Eliminated' : 'Lost' }}
              </span>
            </li>
          </ol>
          <p v-else class="board-empty">No scores yet today. Be the first on the board.</p>
          <p v-if="myDailyRank" class="board-mine">{{ myDailyRank }}</p>
          <button class="lb-link" @click="openLeaderboard">Full leaderboard &rarr;</button>
        </div>

        <!-- Primary action: create a room. The rules choice only applies to
             created games, so it lives inside the same card, above the button
             that consumes it. -->
        <div class="create-card">
          <div class="mode-row">
            <span class="mode-label">Rules</span>
            <div class="mode-pills">
              <button
                v-for="m in stackingModes"
                :key="m.value"
                class="mode-pill"
                :class="{ active: selectedStackingMode === m.value }"
                @click="selectedStackingMode = m.value"
              >
                {{ m.label }}
              </button>
            </div>
          </div>
          <p class="mode-desc">{{ currentModeDesc }}</p>
          <Button
            variant="primary"
            size="lg"
            block
            :disabled="mpStore.loading"
            @click="handleCreateGame"
          >
            {{ mpStore.loading ? 'CREATING...' : 'CREATE GAME' }}
          </Button>
        </div>

        <!-- Other ways in: icon-led list rows, one identity color per mode -->
        <div class="mode-list" role="group" aria-label="Other ways to play">
          <span class="mode-overline">Or jump in</span>
          <button class="mode-item" :disabled="mpStore.loading" @click="handleQuickMatch">
            <span class="mode-glyph mode-glyph--cyan"><Zap :size="17" :stroke-width="2.25" aria-hidden="true" /></span>
            <span class="mode-text">
              <span class="mode-name">{{ mpStore.loading ? 'Matching…' : 'Quick match' }}</span>
              <span class="mode-hint">Dropped into a room with a stranger</span>
            </span>
            <ChevronRight class="mode-chev" :size="16" aria-hidden="true" />
          </button>
          <button class="mode-item" @click="showJoinModal = true">
            <span class="mode-glyph mode-glyph--cyan"><Hash :size="17" :stroke-width="2.25" aria-hidden="true" /></span>
            <span class="mode-text">
              <span class="mode-name">Join with code</span>
              <span class="mode-hint">Enter a friend's six-character room code</span>
            </span>
            <ChevronRight class="mode-chev" :size="16" aria-hidden="true" />
          </button>
          <button class="mode-item" @click="$emit('playLocal', selectedStackingMode)">
            <span class="mode-glyph mode-glyph--dim"><Bot :size="17" :stroke-width="2.25" aria-hidden="true" /></span>
            <span class="mode-text">
              <span class="mode-name">Play vs bot</span>
              <span class="mode-hint">Practise solo, nothing on the line</span>
            </span>
            <ChevronRight class="mode-chev" :size="16" aria-hidden="true" />
          </button>
        </div>

        <!-- Guest investment hook: streaks and scores die with the guest
             session — the moment they have something to lose is the moment
             an account makes sense. -->
        <button
          v-if="authStore.isAnonymous && (retention.effectiveStreak > 1 || dailyRecord)"
          class="streak-keep-link"
          @click="upgradeAccount"
        >
          Your streak and scores live on this guest session - create an account to keep them
        </button>
      </div>

      <!-- Waiting room — after creating, before starting -->
      <div v-else-if="mpStore.gameStatus === 'waiting'" class="waiting-room">
        <div class="room-code-card">
          <span class="room-code-label">ROOM CODE</span>
          <span class="room-code-value">{{ mpStore.roomCode }}</span>
          <div class="room-code-actions">
            <button class="code-action-btn" @click="copyLink">
              <Copy v-if="!copied" class="code-action-icon" :stroke-width="2" aria-hidden="true" />
              <Check v-else class="code-action-icon" :stroke-width="2.5" aria-hidden="true" />
              {{ copied ? 'LINK COPIED' : 'COPY LINK' }}
            </button>
          </div>
          <!-- Same content, structured: the rule set is card metadata, so it
               reads as a hairline-separated footer instead of floating in the
               same stack as the code and its action. -->
          <div class="room-mode-footer">
            <span class="room-mode-tag">{{ modeLabel(mpStore.stackingMode) }} RULES</span>
            <p class="room-mode-desc">{{ modeDesc(mpStore.stackingMode) }}</p>
          </div>
        </div>

        <div class="players-section">
          <div class="players-count">
            <span class="players-count-num">{{ mpStore.gamePlayers.length }}</span>
            <span class="players-count-of">of 20 players</span>
          </div>

          <div class="players-list">
            <div
              v-for="player in mpStore.gamePlayers"
              :key="player.id"
              class="player-chip"
            >
              <div class="player-avatar">
                {{ player.name?.charAt(0) }}
                <span
                  class="presence-dot"
                  :class="{ connected: isPlayerConnected(player.user_id) }"
                  :title="isPlayerConnected(player.user_id) ? 'Connected' : 'Connecting…'"
                ></span>
              </div>
              <!-- Their equipped card back — the show-off surface. Explicit
                   colors so an unset skin reads as the default, never as
                   the viewer's own. -->
              <CardBack
                class="seat-skin"
                :size="{ width: 20, height: 28 }"
                :accent="skinColors(seatSkins[player.user_id]).accent"
                :stripe="skinColors(seatSkins[player.user_id]).stripe"
                aria-hidden="true"
              />
              <!-- My own seat is renamable (guests); others render plain. -->
              <input
                v-if="player.user_id === authStore.user?.id && authStore.isAnonymous && editingName && editTarget === 'room'"
                v-model="nameInput"
                :ref="(el: any) => el && el.focus && el.focus()"
                class="username-edit-input seat-edit-input"
                maxlength="20"
                aria-label="Edit nickname"
                @keyup.enter="saveName"
                @keyup.esc="editingName = false"
                @blur="saveName"
              />
              <button
                v-else-if="player.user_id === authStore.user?.id && authStore.isAnonymous"
                class="player-name player-name-editable"
                title="Tap to rename"
                @click="startEditName('room')"
              >
                {{ player.name }}
                <Pencil class="seat-edit-icon" :stroke-width="2" aria-hidden="true" />
              </button>
              <span v-else class="player-name">{{ player.name }}</span>
              <span
                v-if="seatRanks[player.user_id]"
                class="rank-chip"
                :style="{ color: seatRanks[player.user_id]!.color, borderColor: seatRanks[player.user_id]!.color }"
                :title="`Rank: ${seatRanks[player.user_id]!.title}`"
              >
                {{ seatRanks[player.user_id]!.title.toUpperCase() }}
              </span>
              <span
                v-if="voiceStore.voiceUserIds.has(player.user_id)"
                class="voice-dot"
                :class="{ speaking: voiceStore.speakingUserIds.has(player.user_id) }"
                title="In voice"
              ></span>
              <button
                v-if="canVoiceMute(player.user_id)"
                class="seat-voice-btn"
                :class="{ 'is-muted': voiceStore.localMutedUserIds.has(player.user_id) }"
                :title="voiceMuteTitle(player.user_id)"
                :aria-label="voiceMuteTitle(player.user_id)"
                @click="handleVoiceMute(player.user_id)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" aria-hidden="true">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path v-if="!voiceStore.localMutedUserIds.has(player.user_id)" d="M15.5 8.5a5 5 0 0 1 0 7" />
                  <line v-if="voiceStore.localMutedUserIds.has(player.user_id)" x1="15" y1="9" x2="21" y2="15" />
                  <line v-if="voiceStore.localMutedUserIds.has(player.user_id)" x1="21" y1="9" x2="15" y2="15" />
                </svg>
              </button>
              <span
                v-if="player.user_id === mpStore.currentGame?.host_id"
                class="player-badge"
              >HOST</span>
              <button
                v-else-if="mpStore.isHost"
                class="player-kick-btn"
                title="Remove player"
                aria-label="Remove player"
                @click="mpStore.kickPlayer(player.user_id)"
              >
                <X class="player-kick-icon" :stroke-width="2.5" aria-hidden="true" />
              </button>
            </div>
            <div
              v-if="mpStore.gamePlayers.length < 10"
              class="player-chip player-chip-empty"
            >
              <div class="player-avatar empty">+</div>
              <span class="player-name muted">Waiting…</span>
            </div>
          </div>
        </div>

        <div class="waiting-actions">
          <div v-if="voiceStore.available" class="waiting-voice">
            <VoiceMicCluster :can-moderate="mpStore.isHost" />
            <span class="waiting-voice-hint">Talk while you play</span>
          </div>
          <p
            v-if="mpStore.isHost && mpStore.gamePlayers.length < 2"
            class="waiting-nudge"
          >
            Share the code above to bring a friend in — the game starts the moment they join.
          </p>
          <Button
            v-if="mpStore.isHost"
            variant="primary"
            size="lg"
            block
            :disabled="mpStore.gamePlayers.length < 2"
            @click="startGame"
          >
            {{
              mpStore.gamePlayers.length < 2
                ? 'WAITING FOR PLAYERS…'
                : `START GAME (${mpStore.gamePlayers.length})`
            }}
          </Button>
          <p v-else class="waiting-text">
            Waiting for host to start the game…
          </p>
          <div class="waiting-escape">
            <button class="leave-link" @click="showLeaveConfirm = true">LEAVE ROOM</button>
            <span class="waiting-sep">·</span>
            <button class="leave-link" @click="playBotInstead">PLAY VS BOT INSTEAD</button>
          </div>
        </div>
      </div>
    </div>


    <!-- Guests only: plain sign-out abandons the guest profile and its
         server-side stats. Claiming (CREATE ACCOUNT) is the safe exit. -->
    <ConfirmDialog
      :open="showSignOutConfirm"
      title="Sign out of this guest profile?"
      message="Signing out abandons this guest profile and its stats. CREATE ACCOUNT claims it first — free, and everything you've earned stays."
      confirm-label="SIGN OUT ANYWAY"
      cancel-label="GO BACK"
      @confirm="confirmSignOut"
      @cancel="showSignOutConfirm = false"
    />

    <ConfirmDialog
      :open="showLeaveConfirm"
      title="Leave the room?"
      message="Players you've invited will see the room close. You can create a new one anytime."
      confirm-label="LEAVE"
      cancel-label="STAY"
      @confirm="confirmLeave"
      @cancel="showLeaveConfirm = false"
    />

    <!-- Join Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showJoinModal"
          class="modal-overlay"
          @click.self="showJoinModal = false"
        >
          <div class="join-modal">
            <h2 class="join-modal-title">JOIN GAME</h2>
            <p class="join-modal-desc">Enter the 6-character room code</p>

            <input
              v-model="joinCode"
              type="text"
              placeholder="ABC123"
              maxlength="6"
              class="room-input"
              @keyup.enter="joinGame"
              autofocus
            />

            <div v-if="mpStore.error" class="error-banner">
              {{ mpStore.error }}
            </div>

            <div class="join-modal-actions">
              <Button
                variant="ghost"
                size="md"
                block
                :disabled="mpStore.loading"
                @click="showJoinModal = false"
              >
                CANCEL
              </Button>
              <Button
                variant="primary"
                size="md"
                block
                :disabled="joinCode.length < 4 || mpStore.loading"
                @click="joinGame"
              >
                {{ mpStore.loading ? 'JOINING...' : 'JOIN' }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>

    </Teleport>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Copy, Check, Flame, Pencil, X, Zap, Hash, Bot, ChevronRight } from 'lucide-vue-next'
import { useRetentionStore } from '../stores/retentionStore'
import { getDailyRecord } from '../utils/dailyChallenge'
import { useLeaderboard } from '../composables/useLeaderboard'
import { navigate } from '../utils/routes'
import { useRanks } from '../composables/useRanks'
import { skinColors } from '../utils/cosmetics'
import CardBack from './game/CardBack.vue'
import { vFocusRing } from '../directives/focusRing'
import { preloadCardImages } from '../utils/preloadCardImages'
import { useAuthStore } from '../stores/authStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useGameStore } from '../stores/gameStore'
import SiteFooter from './SiteFooter.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import Button from './ui/Button.vue'
import VoiceMicCluster from './game/VoiceMicCluster.vue'
import type { StackingMode } from '../utils/gameRules'

const emit = defineEmits<{
  (e: 'playLocal', mode: StackingMode): void
  (e: 'playDaily'): void
  (e: 'showAuth'): void
  (e: 'showStats'): void
}>()

const authStore = useAuthStore()
const mpStore = useMultiplayerStore()
const retention = useRetentionStore()

// Re-read on every mount: the lobby unmounts while the daily game plays, so
// returning from it always shows the fresh done state.
const dailyRecord = ref(getDailyRecord())
const dailyDateLabel = new Date()
  .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  .toUpperCase()

const lb = useLeaderboard()

const dailyPlayerCount = computed(() => lb.dailyContext.value?.total_players ?? 0)

// Only worth saying once the viewer is actually on the board — a rank of null
// means they haven't played today, which the deal card above already says.
const myDailyRank = computed(() => {
  const ctx = lb.dailyContext.value
  if (!ctx?.my_rank) return ''
  return `You're #${ctx.my_rank} of ${ctx.total_players} today`
})

function openLeaderboard() {
  navigate({ name: 'leaderboard' })
}

function openProfile(row: { share_code?: string | null }) {
  if (row.share_code) navigate({ name: 'profile', code: row.share_code })
}

// Eager availability probe: until the SQL functions exist on the project the
// rpc fails and the VIEW LEADERBOARD link never renders.
onMounted(() => { void lb.fetchBoards() })

// Equipped skins per seat, straight from live presence (server echoes what
// each client reported at auth).
const seatSkins = computed<Record<string, string | undefined>>(() =>
  Object.fromEntries(mpStore.presence.map(p => [p.userId, p.skin])),
)

// Rank chips for waiting-room seats. Being seen by rank is the point of
// having one — feature-detects until supabase/ranks.sql is installed.
const { ranks: seatRanks, fetchRanks } = useRanks()
watch(
  () => mpStore.gamePlayers.map(p => p.user_id),
  (ids) => { if (ids.length) void fetchRanks(ids) },
  { immediate: true },
)
const voiceStore = useVoiceStore()
const gameStore = useGameStore()

const showJoinModal = ref(false)
// A join hit a room the server no longer knows — show the ended card, not a retry trap.
const roomEnded = ref(false)
const showLeaveConfirm = ref(false)
const showSignOutConfirm = ref(false)
const editingName = ref(false)
const editTarget = ref<'bar' | 'room' | null>(null)
const nameInput = ref('')
const joinCode = ref('')
const copied = ref(false)
const selectedStackingMode = ref<StackingMode>(gameStore.stackingMode)

// When the page loads with ?join=ABCDEF, pre-fill the join input and
// fire the join automatically. Friends sharing the invite URL drop
// straight into the room instead of copy-pasting the code manually.
onMounted(() => {
  // Warm the deck art while the player is still in the lobby.
  preloadCardImages()
  const params = new URLSearchParams(window.location.search)
  const code = params.get('join')?.toUpperCase().trim()
  if (!code) return

  // Strip the param so a reload doesn't re-trigger.
  params.delete('join')
  const newSearch = params.toString()
  const newUrl =
    window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
  window.history.replaceState({}, '', newUrl)

  // Only auto-join if the user isn't already in a game and the code
  // shape is plausible. Anything weird falls through to the user
  // opening the join modal themselves.
  if (mpStore.currentGame) return
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return

  joinCode.value = code
  void mpStore.joinGame(code, 'link').then((res) => {
    if (!res && mpStore.error === 'Room not found') roomEnded.value = true
  })
})

// Speaker button per seat: host cuts the mic room-wide, others mute locally.
function canVoiceMute(userId: string): boolean {
  if (userId === authStore.user?.id) return false
  if (!voiceStore.voiceUserIds.has(userId)) return false
  return mpStore.isHost ? voiceStore.unmutedUserIds.has(userId) : true
}
function voiceMuteTitle(userId: string): string {
  if (mpStore.isHost) return 'Mute for everyone'
  return voiceStore.localMutedUserIds.has(userId) ? 'Unmute for me' : 'Mute for me'
}
function handleVoiceMute(userId: string) {
  if (mpStore.isHost) void voiceStore.muteParticipant(userId)
  else voiceStore.toggleMuteForMe(userId)
}

const stackingModes: { value: StackingMode; label: string; desc: string }[] = [
  { value: 'official', label: 'OFFICIAL', desc: 'Printed rules — stack a draw only with equal or higher value' },
  { value: 'house', label: 'HOUSE', desc: 'Wild draws (+4 / +6 / +10) stack on anything; colored draws stay strict' },
  { value: 'casual', label: 'CASUAL', desc: 'Anything goes — any draw card stacks on any other draw card' },
]

function modeLabel(m: StackingMode) {
  return stackingModes.find((x) => x.value === m)?.label || 'OFFICIAL'
}

function modeDesc(m: StackingMode) {
  return stackingModes.find((x) => x.value === m)?.desc || ''
}

// A connected player is one we currently see in realtime presence. Self always
// counts. Falls back to "connected" if presence hasn't reported anyone yet
// (e.g. a peer on an older build that doesn't broadcast presence).
function isPlayerConnected(userId: string) {
  if (userId === authStore.user?.id) return true
  const present = mpStore.presentUserIds
  if (!present.length) return true
  return present.includes(userId)
}

// Turn raw store errors into friendly, actionable copy.
const friendlyError = computed(() => {
  const e = mpStore.error
  if (!e) return ''
  const map: Record<string, string> = {
    'Game not found': "That room code didn't match any game. Double-check it and try again.",
    'Game already started': 'That game already kicked off. Ask the host for a new room, or start your own.',
    'Game is full (max 20 players)': 'That room is full (20 players max). Start your own instead.',
  }
  if (map[e]) return map[e]
  if (/full/i.test(e)) return 'That room is full. Start your own instead.'
  if (/not found|already started/i.test(e)) return "Couldn't join that room. Check the code or start a new game."
  if (/logged in|profile/i.test(e)) return 'Something went wrong with your session. Try refreshing the page.'
  // Raw Postgres errors (e.g. a missing column before a migration ran) should
  // never reach the player verbatim.
  if (/column|relation|constraint|violates|pgrst/i.test(e)) return 'Something went wrong on our side. Try again in a moment.'
  return e
})

const currentModeDesc = computed(
  () => stackingModes.find((x) => x.value === selectedStackingMode.value)?.desc || '',
)

async function handleCreateGame() {
  roomEnded.value = false
  await mpStore.createGame(selectedStackingMode.value)
}

async function handleQuickMatch() {
  roomEnded.value = false
  await mpStore.quickMatch(selectedStackingMode.value)
}

async function joinGame() {
  if (mpStore.loading) return
  roomEnded.value = false
  const result = await mpStore.joinGame(joinCode.value)
  if (result || mpStore.error === 'Room not found') {
    showJoinModal.value = false
    joinCode.value = ''
  }
  if (!result && mpStore.error === 'Room not found') roomEnded.value = true
}

async function startGame() {
  await mpStore.startGame()
}

// Escape hatch from a dead waiting room — leave the room cleanly, then start a
// local bot game so the player isn't stuck staring at an empty lobby.
async function playBotInstead() {
  const mode = mpStore.stackingMode
  await mpStore.leaveGame()
  emit('playLocal', mode)
}

async function confirmLeave() {
  showLeaveConfirm.value = false
  await mpStore.leaveGame()
}

// Rename can be triggered from the top-bar chip ('bar') or the waiting-room
// seat ('room'); editTarget controls which one shows the inline input.
function startEditName(target: 'bar' | 'room' = 'bar') {
  const current = authStore.username
  nameInput.value = current && current !== 'Player' ? current : ''
  editTarget.value = target
  editingName.value = true
}

async function saveName() {
  if (!editingName.value) return
  editingName.value = false
  editTarget.value = null
  const name = nameInput.value.trim()
  if (name && name !== authStore.username) {
    await authStore.updateUsername(name)
    // If we're already in a game (e.g. the waiting room), also update our seat
    // so other players see the new name, not just future games.
    if (mpStore.currentGame) await mpStore.updateMyName(name)
  }
}

function upgradeAccount() {
  // In-place claim: the guest keeps their user id, so stats, badges and the
  // profile link survive. Nothing destructive — no confirm needed.
  emit('showAuth')
}

function requestSignOut() {
  if (authStore.isAnonymous) {
    showSignOutConfirm.value = true
    return
  }
  void authStore.signOut()
}

async function confirmSignOut() {
  showSignOutConfirm.value = false
  await authStore.signOut()
}

// Auto-join URL friends tap to drop straight into the room.
function inviteUrl() {
  const u = new URL(window.location.href)
  u.search = ''
  u.hash = ''
  u.searchParams.set('join', mpStore.roomCode)
  return u.toString()
}

// Copy the full invite link (not just the code) — tapping it opens the join
// lobby directly, which is what people actually share.
function copyLink() {
  // clipboard is unavailable / throws on an insecure context — only flip the
  // "copied" state when the write actually succeeds, so the UI doesn't lie.
  navigator.clipboard?.writeText(inviteUrl())
    .then(() => {
      copied.value = true
      setTimeout(() => (copied.value = false), 2000)
    })
    .catch(() => { /* no clipboard access — leave the UI unchanged */ })
}
</script>

<style scoped>
.lobby-container {
  min-height: 100vh;
  background: var(--bg-concrete);
  color: var(--text-primary);
  position: relative;
  display: flex;
  flex-direction: column;
}

/* TOP BAR — mirrors landing top bar pattern */
.lobby-top-bar {
  position: relative;
  z-index: var(--z-hud);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-3) var(--spacing-4);
  border-bottom: 1px solid rgba(255, 204, 0, 0.08);
  background: linear-gradient(180deg, rgba(10, 10, 11, 0.95), rgba(10, 10, 11, 0.7));
  flex-wrap: wrap;
}

.brand-mark {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-2);
  text-decoration: none;
  color: var(--text-primary);
}

.brand-mark-uno {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0.05em;
}

.brand-mark-nomercy {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  letter-spacing: 0.2em;
  color: var(--color-alert);
  text-shadow: 0 0 12px rgba(255, 42, 42, 0.5);
}

.top-bar-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-3);
}

.username-chip {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  letter-spacing: 0.15em;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
}

.username-chip-editable,
.username-chip-action {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.username-chip-editable:hover,
.username-chip-action:hover {
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.25);
}

.chip-edit-icon {
  width: 12px;
  height: 12px;
  opacity: 0.6;
}

.username-edit-input {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-primary);
  letter-spacing: 0.15em;
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-neon-blue);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.4);
  width: 9rem;
  text-transform: uppercase;
}

.username-edit-input:focus {
  outline: none;
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
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.text-link:hover {
  color: var(--color-neon-blue);
}

.upgrade-link {
  color: var(--color-neon-blue);
}

.upgrade-link:hover {
  color: var(--color-hazard);
}

/* CONTENT */
.lobby-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: var(--spacing-8) var(--spacing-4);
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  gap: var(--spacing-6);
}

/* The entry view starts from the top. Centring it vertically left a void above
   and below on a tall screen and made the whole page read as floating. Declared
   after the base rule on purpose — same specificity, so source order decides.
   The waiting room and dead-room card stay centred; they're short. */
.lobby-content--top {
  justify-content: flex-start;
}

.error-banner {
  background: rgba(255, 42, 42, 0.1);
  border: 1px solid var(--color-alert);
  color: var(--color-alert);
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  text-align: center;
  border-radius: var(--radius-sm);
}

/* The daily ritual wears the streak's hazard yellow — one retention loop,
   one color family, visually distinct from the red create zone and the
   cyan multiplayer world. */
/* Raised surface, not an outline on black. Elevation does the grouping in
   every dark UI worth copying; a bright border on pure black reads as a
   wireframe. The hazard tint is what keeps this the daily zone. */
.daily-card {
  background: linear-gradient(180deg, rgba(255, 204, 0, 0.05), rgba(255, 255, 255, 0.02));
  border: 1px solid rgba(255, 204, 0, 0.14);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Today's board — the reason to come back tomorrow, next to the reason to
   play today. */
.board-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.board-head {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-2);
}

.board-title {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
}

.board-count {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.board-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.board-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) 0;
  font-size: var(--text-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.board-row:last-child {
  border-bottom: none;
}

.board-rank {
  width: 1.25rem;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.board-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  /* Renders as a <button> when the player has a shareable profile, so it
     needs the button chrome stripped back to plain text. */
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  text-align: left;
}

.board-name.clickable {
  cursor: pointer;
}

.board-name.clickable:hover {
  color: var(--text-primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* The outcome is the interesting part of each row, so it carries colour:
   cleared in N moves reads as a score, elimination reads as a casualty. */
.board-metric {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.board-metric--won {
  color: var(--color-neon-green);
}

.board-metric--out {
  color: var(--color-alert);
}

.board-row.mine .board-name,
.board-row.mine .board-rank {
  color: var(--color-hazard);
}

.board-empty,
.board-mine {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.5;
}

.board-mine {
  color: var(--text-secondary);
}

.daily-card :deep(.btn--secondary) {
  border-color: var(--color-hazard);
  color: var(--color-hazard);
}

.daily-card :deep(.btn--secondary:hover:not(:disabled)) {
  background: var(--color-hazard);
  color: #000;
}

.daily-card.done {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.daily-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  flex-wrap: wrap;
}

.daily-card .streak-chip {
  align-self: flex-start;
}

.daily-title {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.12em;
  color: var(--text-primary);
}

.daily-date {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: var(--text-muted);
}

.daily-desc {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.daily-result {
  color: rgba(255, 204, 0, 0.85);
  letter-spacing: 0.06em;
}

.seat-skin {
  flex-shrink: 0;
  border-radius: 3px;
  box-shadow: none;
}

.rank-chip {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  border: 1px solid;
  border-radius: 999px;
  padding: 1px 8px;
  white-space: nowrap;
  opacity: 0.85;
}

.lb-link {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: rgba(255, 204, 0, 0.75);
  cursor: pointer;
}

.lb-link:hover {
  color: var(--color-hazard);
}

.streak-keep-link {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  text-align: center;
}

.streak-keep-link:hover {
  color: var(--text-primary);
}

.streak-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-3);
  background: rgba(255, 204, 0, 0.08);
  border: 1px solid rgba(255, 204, 0, 0.3);
  border-radius: 999px;
  font-family: var(--font-body);
  white-space: nowrap;
}

.streak-flame {
  width: 14px;
  height: 14px;
  color: #ffcc00;
  flex-shrink: 0;
}

.streak-count {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--text-primary);
}

.streak-state {
  font-size: 0.6rem;
  letter-spacing: 0.14em;
}

.streak-chip.at-risk {
  background: rgba(255, 42, 42, 0.07);
  border-color: var(--color-alert);
}

.streak-chip.at-risk .streak-flame {
  color: var(--color-alert);
  animation: streak-pulse 1.4s ease-in-out infinite;
}

.streak-state--warn {
  color: var(--color-alert);
}

@keyframes streak-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.88); }
}

@media (prefers-reduced-motion: reduce) {
  .streak-chip.at-risk .streak-flame { animation: none; }
}

.room-ended-card {
  background: rgba(255, 42, 42, 0.08);
  border: 1px solid var(--color-alert);
  border-radius: var(--radius-sm);
  padding: var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  text-align: center;
}

.room-ended-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.12em;
  color: var(--color-alert);
  margin: 0;
}

.room-ended-sub {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

/* Stacked full-width, matching every other entry-view CTA. */
.room-ended-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

/* ENTRY */
.lobby-entry {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

/* Today's board reads as a footnote on a phone, not a headline: on narrow
   screens it drops below the ways to play. Inert on the desktop grid, where
   every card is placed explicitly. */
.board-card { order: 2; }
.streak-keep-link { order: 3; }

/* Two real columns on wide screens. Each card is placed into an explicit grid
   row rather than stacked inside a per-column wrapper, so row 1 is as tall as
   the taller of (deal, create) and row 2 as tall as the taller of (board,
   list) — which is what makes the card borders line up across the two
   columns. The pair is centred as a unit, so there's no lone void. */
@media (min-width: 1180px) {
  /* Widened to hold rail + gap + the original 600px column, still centred.
     Scoped to the entry state (--top) — the waiting room and every other
     lobby view are single 600px columns and stretch into hollow slabs at
     this width. */
  .lobby-content--top {
    max-width: 964px;
  }

  .lobby-entry {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    column-gap: var(--spacing-8);
    row-gap: var(--spacing-4);
    align-items: stretch;
  }

  /* Extra air under the title — the row-gap that separates the two card rows
     is too tight to also serve as the space below a heading. Compound
     selector because the base `.entry-heading { margin: 0 }` is declared
     later in this file and would otherwise win on source order. */
  .lobby-entry .entry-heading {
    grid-column: 1 / -1;
    grid-row: 1;
    margin-bottom: var(--spacing-6);
  }
  .daily-card       { grid-column: 1; grid-row: 2; }
  .create-card      { grid-column: 2; grid-row: 2; }
  .board-card       { grid-column: 1; grid-row: 3; }
  .mode-list        { grid-column: 2; grid-row: 3; }
  .streak-keep-link { grid-column: 1 / -1; grid-row: 4; }

  /* Whichever card is shorter gets stretched to its row, so pin the board's
     link to the bottom — the slack then lands in the list, where more entries
     would go, instead of above a floating footer. */
  .board-card .lb-link { margin-top: auto; }
}


/* Grouped on a neutral surface. Unboxing this left the rules control and its
   caption floating as loose fragments under a bare slab — the container was
   doing real grouping work. Neutral rather than red-tinted so the button is
   still the only saturated thing here. */
.create-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
}

.mode-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.mode-desc {
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.5;
}

.mode-label {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex-shrink: 0;
}

/* One hairline container holds all three options, so the group reads as a
   single control instead of three chips floating in a row — and the mobile
   full-width stretch below lands inside a frame rather than as loose text. */
.mode-pills {
  display: flex;
  gap: 2px;
  margin-left: auto;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
}

/* Reads as one segmented control, not three outlined chips: only the
   selected rule set is drawn, the alternatives are plain text until
   hovered. */
.mode-pill {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  padding: var(--spacing-1) var(--spacing-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-snap) var(--ease-snap);
}

.mode-pill:hover {
  color: var(--text-primary);
}

.mode-pill.active {
  color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.1);
}

/* MODE LIST — the secondary ways in, on their own surface with internal
   hairlines. Rows carry a name and a description stacked, so there's no dead
   middle between a left-aligned label and a right-aligned hint. */
.mode-list {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-md);
  padding: var(--spacing-2);
}

.mode-overline {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--spacing-1) var(--spacing-2) var(--spacing-2);
}

.mode-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  min-height: 60px;
  padding: var(--spacing-3);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  cursor: pointer;
  transition: background var(--duration-snap) var(--ease-snap);
}

.mode-item + .mode-item {
  box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.055);
}

.mode-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.045);
}

.mode-item:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

/* Bare glyphs, no chip. The icon's own shape already separates the rows;
   a tinted box and border around each one added three more containers to a
   column that had too many. Colour still carries the zone (cyan =
   multiplayer, neutral = practice) per the palette convention. */
.mode-glyph--cyan {
  color: var(--color-neon-blue);
}

.mode-glyph--dim {
  color: var(--text-muted);
}

/* Weight and colour carry the hierarchy here, not caps and tracking. The
   screen had fifteen wide-tracked uppercase labels competing at once; display
   caps now belong to the brand and the primary button only. */
.mode-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.mode-name {
  font-family: var(--font-body);
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.mode-hint {
  font-family: var(--font-body);
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
}

.mode-chev {
  color: var(--text-muted);
  flex-shrink: 0;
  transition:
    transform var(--duration-snap) var(--ease-snap),
    color var(--duration-snap) var(--ease-snap);
}

.mode-item:hover:not(:disabled) .mode-chev {
  transform: translateX(3px);
  color: var(--text-secondary);
}

/* WAITING ROOM */
.waiting-room {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  align-items: center;
}

.room-code-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6) var(--spacing-4) var(--spacing-4);
  background: rgba(255, 204, 0, 0.04);
  border: 1px solid var(--color-hazard-dim);
  border-radius: var(--radius-md);
  width: 100%;
}

.room-code-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.3em;
}

.room-code-value {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 9vw, 3.5rem);
  letter-spacing: 0.4rem;
  line-height: 1.1;
  color: var(--color-hazard);
  text-shadow: 0 0 20px rgba(255, 204, 0, 0.4);
}

.room-code-actions {
  display: flex;
  gap: var(--spacing-2);
  width: 100%;
  justify-content: center;
  flex-wrap: wrap;
}

.code-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  background: var(--color-hazard);
  border: none;
  color: var(--bg-concrete);
  padding: var(--spacing-2) var(--spacing-4);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 44px;
  transition: filter var(--duration-snap) var(--ease-snap);
}

.code-action-btn:hover {
  filter: brightness(1.1);
}

.code-action-share {
  background: transparent;
  color: var(--color-hazard);
  border: 1px solid var(--color-hazard);
}

.code-action-share:hover {
  background: rgba(255, 204, 0, 0.08);
  filter: none;
}

.code-action-icon {
  width: 14px;
  height: 14px;
}

/* Rule-set metadata as the card's footer: one hairline in the card's own
   hazard family separates it from the code + action above. */
.room-mode-footer {
  width: 100%;
  margin-top: var(--spacing-2);
  padding-top: var(--spacing-3);
  border-top: 1px solid rgba(255, 204, 0, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
}

.room-mode-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.2em;
}

.players-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.players-count {
  text-align: center;
  font-family: var(--font-mono);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  font-size: var(--text-sm);
}

.players-count-num {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin-right: var(--spacing-2);
}

.players-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
}

.player-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-pill);
}

.player-chip-empty {
  border-style: dashed;
  opacity: 0.5;
}

.player-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-neon-blue);
  color: var(--bg-concrete);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: var(--text-sm);
}

.player-avatar.empty {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

.player-name {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.player-name.muted {
  color: var(--text-muted);
}

.player-badge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--color-hazard);
  color: var(--bg-concrete);
  padding: 2px var(--spacing-2);
  border-radius: var(--radius-sm);
  letter-spacing: 0.1em;
  font-weight: bold;
}

.player-kick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin-left: 2px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 42, 42, 0.15);
  color: var(--color-alert);
  cursor: pointer;
  transition: background 0.15s;
}

.player-kick-btn:hover {
  background: rgba(255, 42, 42, 0.35);
}

.player-kick-icon {
  width: 13px;
  height: 13px;
}

.player-name-editable {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: 0;
}
.player-name-editable:hover { color: var(--color-neon-blue, #2ad4ff); }

.seat-edit-icon {
  width: 11px;
  height: 11px;
  opacity: 0.6;
}

.seat-edit-input {
  width: 7rem;
  font-size: var(--text-sm);
  padding: var(--spacing-1) var(--spacing-2);
}

.entry-heading {
  font-family: var(--font-display);
  font-size: 1.9rem;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  text-align: center;
  margin: 0;
}

.room-mode-desc {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
  margin: 0;
  max-width: 60ch;
}

.player-avatar {
  position: relative;
}

.presence-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--text-muted);
  border: 2px solid var(--bg-concrete);
  transition: background var(--duration-snap) var(--ease-snap);
}

.presence-dot.connected {
  background: #00ff66;
}

@media (max-width: 560px) {
  .entry-heading { font-size: 1.4rem; }
  .mode-desc { line-height: 1.8; }
}

.waiting-nudge {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
  margin: 0 0 var(--spacing-3);
  max-width: 34ch;
}

.waiting-escape {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  margin-top: var(--spacing-2);
  flex-wrap: wrap;
}

.waiting-sep { color: var(--text-muted); }

.waiting-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
}

.waiting-voice {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

/* The discovery nudge is right-anchored for the in-game top bar; here the
   button sits mid-page, so anchor it left instead of letting it clip
   off-screen. */
.waiting-voice :deep(.voice-nudge) {
  right: auto;
  left: 0;
}

/* The nudge is an overlay hung below the mic button. Over the game board
   that's free space; in this column it lands exactly on the nudge text and
   button below, so reserve its footprint for the one render it's visible. */
.waiting-voice:has(.voice-nudge) {
  margin-bottom: 64px;
}

.waiting-voice-hint {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--text-secondary);
}

.seat-voice-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: transparent;
  border: 1px solid var(--color-neon-green);
  color: var(--color-neon-green);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.85;
}

.seat-voice-btn:hover { opacity: 1; }

.seat-voice-btn.is-muted {
  border-color: var(--color-alert);
  color: var(--color-alert);
}

/* Green presence dot on seats connected to voice; pulses while they talk. */
.voice-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-neon-green);
  opacity: 0.5;
  flex-shrink: 0;
}

.voice-dot.speaking {
  opacity: 1;
  box-shadow: 0 0 8px var(--color-neon-green);
  animation: voice-dot-pulse 0.9s ease-in-out infinite;
}

@keyframes voice-dot-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.5); }
}

@media (prefers-reduced-motion: reduce) {
  .voice-dot.speaking { animation: none; }
}

.waiting-text {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.15em;
  text-align: center;
}

.leave-link {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  cursor: pointer;
  padding: var(--spacing-2);
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.leave-link:hover {
  color: var(--color-alert);
}

/* JOIN MODAL */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-soft) var(--ease-soft);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active {
    transition: none;
  }
}

.join-modal {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(0, 243, 255, 0.25);
  border-radius: var(--radius-md);
  padding: var(--spacing-8) var(--spacing-6);
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 0 40px rgba(0, 243, 255, 0.12);
}

.join-modal-title {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  letter-spacing: 0.1em;
  color: var(--text-primary);
  margin: 0 0 var(--spacing-2);
}

.join-modal-desc {
  font-family: var(--font-body);
  color: var(--text-muted);
  margin: 0 0 var(--spacing-6);
  font-size: var(--text-sm);
}

.room-input {
  width: 100%;
  padding: var(--spacing-4);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  text-align: center;
  letter-spacing: 0.4rem;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  margin-bottom: var(--spacing-4);
  border-radius: var(--radius-sm);
  transition: border-color var(--duration-snap) var(--ease-snap);
}

.room-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.join-modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

/* MOBILE TWEAKS */
@media (max-width: 600px) {
  .lobby-top-bar {
    padding: var(--spacing-3);
  }

  .brand-mark-uno {
    font-size: var(--text-lg);
  }

  .brand-mark-nomercy {
    font-size: var(--text-xs);
    letter-spacing: 0.15em;
  }

  .username-chip {
    display: none;
  }

  /* Brand + account links share one row; compact the links so they fit,
     and right-anchor the cluster so a worst-case wrap still looks placed. */
  .top-bar-cta {
    gap: var(--spacing-1);
    margin-left: auto;
  }

  .lobby-top-bar .text-link {
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: var(--spacing-1) var(--spacing-2);
    min-height: 36px;
    white-space: nowrap;
  }

  .lobby-content {
    padding: var(--spacing-6) var(--spacing-4);
    gap: var(--spacing-4);
  }

  .mode-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-2);
  }

  /* Label stacks above the control here, so the control spans the column
     rather than right-anchoring away from its own label. */
  .mode-pills {
    width: 100%;
    margin-left: 0;
  }

  .mode-pill {
    flex: 1;
  }
}
</style>
