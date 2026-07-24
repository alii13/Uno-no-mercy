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
        <span v-else class="username-chip">{{ authStore.username }}</span>
        <button
          v-if="authStore.isAnonymous"
          class="text-link upgrade-link"
          @click="upgradeAccount"
        >
          CREATE ACCOUNT
        </button>
        <button class="text-link" @click="authStore.signOut()">
          SIGN OUT
        </button>
      </div>
    </header>

    <div class="lobby-content">
      <!-- Day streak: the reason to come back tomorrow. The at-risk state is
           the mechanic — a live streak that hasn't been fed today says so. -->
      <div
        v-if="retention.effectiveStreak > 0 && !mpStore.currentGame"
        class="streak-strip"
        :class="{ 'at-risk': !retention.playedToday }"
        role="status"
      >
        <Flame class="streak-flame" :stroke-width="2.5" aria-hidden="true" />
        <span class="streak-count">{{ retention.effectiveStreak }}-DAY STREAK</span>
        <span v-if="retention.playedToday" class="streak-state">SECURED FOR TODAY</span>
        <span v-else class="streak-state streak-state--warn">PLAY TODAY TO KEEP IT</span>
      </div>

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

        <!-- Daily challenge: the same date-seeded deal for everyone, once a day. -->
        <div class="daily-card" :class="{ done: !!dailyRecord }">
          <div class="daily-head">
            <span class="daily-title">TODAY'S DEAL</span>
            <span class="daily-date">{{ dailyDateLabel }}</span>
          </div>
          <template v-if="!dailyRecord">
            <p class="daily-desc">The same shuffle for every player in the world. One scored attempt.</p>
            <Button variant="secondary" size="md" block @click="$emit('playDaily')">
              PLAY TODAY'S DEAL
            </Button>
          </template>
          <p v-else class="daily-desc daily-result">
            {{ dailyRecord.result === 'won' ? `CLEARED IN ${dailyRecord.turns} TURNS` : dailyRecord.result === 'eliminated' ? 'MERCY GOT YOU TODAY' : 'LOST TODAY' }}
            — new deal tomorrow.
          </p>
        </div>

        <!-- Primary action: CREATE GAME -->
        <div class="primary-action">
          <Button
            variant="primary"
            size="lg"
            block
            :disabled="mpStore.loading"
            @click="handleCreateGame"
          >
            {{ mpStore.loading ? 'CREATING...' : 'CREATE GAME' }}
          </Button>

          <div class="mode-card">
            <div class="mode-row">
              <span class="mode-label">RULES</span>
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
          </div>
          <p class="action-hint">Create a room and share the code with friends.</p>
        </div>

        <div class="entry-divider" aria-hidden="true">OR</div>

        <!-- Secondary actions: equal weight, smaller -->
        <div class="secondary-actions">
          <Button variant="secondary" size="md" block :disabled="mpStore.loading" @click="handleQuickMatch">
            {{ mpStore.loading ? 'MATCHING…' : 'QUICK MATCH' }}
          </Button>
          <Button variant="secondary" size="md" block @click="showJoinModal = true">
            JOIN WITH CODE
          </Button>
          <Button variant="ghost" size="md" block @click="$emit('playLocal', selectedStackingMode)">
            PLAY VS BOT
          </Button>
        </div>
        <p class="action-hint">Quick Match drops you in with a stranger. Got a code? Join a friend. No one around? Practice vs the AI.</p>

        <!-- How to play -->
        <button class="howto-link" @click="showRules = true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="16" height="16" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          HOW TO PLAY
        </button>

        <!-- Tertiary: stats link -->
        <button class="stats-link" @click="handleStatsClick">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="16" height="16" aria-hidden="true">
            <rect x="3" y="12" width="4" height="9" />
            <rect x="10" y="7" width="4" height="14" />
            <rect x="17" y="3" width="4" height="18" />
          </svg>
          <span v-if="authStore.isAnonymous">CREATE ACCOUNT TO TRACK STATS</span>
          <span v-else>MY STATS &rarr;</span>
        </button>

        <LandingStatsBadge class="lobby-stats" />
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
          <span class="room-mode-tag">{{ modeLabel(mpStore.stackingMode) }} RULES</span>
          <p class="room-mode-desc">{{ modeDesc(mpStore.stackingMode) }}</p>
        </div>

        <div class="players-section">
          <div class="players-count">
            <span class="players-count-num">{{ mpStore.gamePlayers.length }}</span>
            <span class="players-count-of">of 10 players</span>
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

    <RulesModal v-if="showRules" @close="showRules = false" />

    <ConfirmDialog
      :open="showUpgradeConfirm"
      title="Create an account?"
      message="You'll sign up fresh and your current guest session will end. Stats earned as a guest stay on this device."
      confirm-label="CONTINUE"
      cancel-label="CANCEL"
      @confirm="confirmUpgrade"
      @cancel="showUpgradeConfirm = false"
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
import { ref, computed, onMounted } from 'vue'
import { Copy, Check, Flame, Pencil, X } from 'lucide-vue-next'
import { useRetentionStore } from '../stores/retentionStore'
import { getDailyRecord } from '../utils/dailyChallenge'
import { vFocusRing } from '../directives/focusRing'
import { preloadCardImages } from '../utils/preloadCardImages'
import { useAuthStore } from '../stores/authStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'
import { useVoiceStore } from '../stores/voiceStore'
import { useGameStore } from '../stores/gameStore'
import SiteFooter from './SiteFooter.vue'
import LandingStatsBadge from './LandingStatsBadge.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import RulesModal from './RulesModal.vue'
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
const voiceStore = useVoiceStore()
const gameStore = useGameStore()

const showJoinModal = ref(false)
// A join hit a room the server no longer knows — show the ended card, not a retry trap.
const roomEnded = ref(false)
const showLeaveConfirm = ref(false)
const showRules = ref(false)
const showUpgradeConfirm = ref(false)
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
    'Game is full (max 10 players)': 'That room is full (10 players max). Start your own instead.',
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
  // Don't silently nuke the guest session — warn first. (A proper anon→permanent
  // link that preserves stats is a larger auth change, tracked separately.)
  showUpgradeConfirm.value = true
}

async function confirmUpgrade() {
  showUpgradeConfirm.value = false
  await authStore.signOut()
  emit('showAuth')
}

function handleStatsClick() {
  if (authStore.isAnonymous) {
    upgradeAccount()
  } else {
    emit('showStats')
  }
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

.username-chip-editable {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.username-chip-editable:hover {
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
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  gap: var(--spacing-6);
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

.daily-card {
  background: rgba(0, 229, 255, 0.04);
  border: 1px solid rgba(0, 229, 255, 0.3);
  border-radius: var(--radius-sm);
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.daily-card.done {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.02);
}

.daily-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
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
  color: rgba(0, 229, 255, 0.85);
  letter-spacing: 0.06em;
}

.streak-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  background: rgba(255, 204, 0, 0.06);
  border: 1px solid rgba(255, 204, 0, 0.35);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
}

.streak-flame {
  width: 18px;
  height: 18px;
  color: #ffcc00;
}

.streak-count {
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.12em;
  color: var(--text-primary);
}

.streak-state {
  font-size: var(--text-xs);
  letter-spacing: 0.14em;
  color: rgba(255, 204, 0, 0.75);
}

.streak-strip.at-risk {
  background: rgba(255, 42, 42, 0.07);
  border-color: var(--color-alert);
}

.streak-strip.at-risk .streak-flame {
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
  .streak-strip.at-risk .streak-flame { animation: none; }
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

.room-ended-actions {
  display: flex;
  gap: var(--spacing-2);
}

/* ENTRY */
.lobby-entry {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.primary-action {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.mode-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  padding: var(--spacing-3);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.mode-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.mode-desc {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  line-height: 1.5;
  letter-spacing: 0.04em;
}

.mode-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  flex-shrink: 0;
}

.mode-pills {
  display: flex;
  gap: var(--spacing-1);
  flex: 1;
  justify-content: flex-end;
}

.mode-pill {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  padding: var(--spacing-1) var(--spacing-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--duration-snap) var(--ease-snap);
}

.mode-pill:hover {
  border-color: var(--color-hazard-dim);
  color: var(--text-primary);
}

.mode-pill.active {
  border-color: var(--color-hazard);
  color: var(--color-hazard);
  background: rgba(255, 204, 0, 0.06);
}

/* DIVIDER */
.entry-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.3em;
  position: relative;
}

.entry-divider::before,
.entry-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 0 var(--spacing-4);
}

/* SECONDARY ACTIONS */
.secondary-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

/* TERTIARY STATS LINK */
.stats-link,
.howto-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: var(--spacing-3);
  min-height: 44px;
  transition: color var(--duration-snap) var(--ease-snap);
}

.howto-link:hover {
  color: var(--color-neon-blue, #2ad4ff);
}

.stats-link:hover {
  color: var(--color-neon-blue);
}

.lobby-stats {
  align-self: center;
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
  gap: var(--spacing-2);
  padding: var(--spacing-6);
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

.room-mode-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.2em;
  margin-top: var(--spacing-2);
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
  font-size: 1.4rem;
  letter-spacing: 0.1em;
  color: var(--text-primary);
  text-align: center;
  margin: 0 0 var(--spacing-4);
}

.action-hint {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  letter-spacing: 0.04em;
  line-height: 1.5;
  margin: var(--spacing-2) 0 0;
}

.room-mode-desc {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
  margin: var(--spacing-2) 0 0;
  max-width: 32ch;
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

@media (max-width: 480px) {
  .entry-heading { font-size: 1.15rem; }
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

  .lobby-content {
    padding: var(--spacing-6) var(--spacing-4);
    gap: var(--spacing-4);
  }

  .mode-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-2);
  }

  .mode-pills {
    justify-content: stretch;
  }

  .mode-pill {
    flex: 1;
  }

  .secondary-actions {
    grid-template-columns: 1fr;
  }
}
</style>
