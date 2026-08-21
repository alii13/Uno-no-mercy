<template>
  <!-- Hidden entirely until friends.sql is run: an empty panel that cannot
       work is worse than no panel. -->
  <section v-if="!social.unavailable" class="friends">
    <h3 class="section-title">
      FRIENDS
      <span v-if="social.friends.length" class="friends-count">{{ social.friends.length }}</span>
    </h3>

    <!-- Requests first: they are the only rows that need an answer. -->
    <ul v-if="social.incoming.length" class="friend-list">
      <li v-for="r in social.incoming" :key="r.user_id" class="friend-row friend-row--request">
        <span class="friend-name">{{ r.username }}</span>
        <span class="friend-note">wants to be friends</span>
        <div class="friend-actions">
          <button class="friend-btn friend-btn--yes" @click="social.respond(r.user_id, true)">ACCEPT</button>
          <button class="friend-btn" @click="social.respond(r.user_id, false)">DECLINE</button>
        </div>
      </li>
    </ul>

    <ul v-if="social.friends.length" class="friend-list">
      <li v-for="f in sortedFriends" :key="f.user_id" class="friend-row">
        <PresenceDot :last-seen-at="f.last_seen_at" />
        <button class="friend-name friend-name--link" @click="openProfile(f)">{{ f.username }}</button>
        <span class="friend-seen">{{ seenLabel(f) }}</span>
        <button
          class="friend-btn friend-btn--play"
          :disabled="busy === f.user_id || !!asked[f.user_id]"
          @click="playWith(f)"
        >{{ asked[f.user_id] ?? (busy === f.user_id ? '…' : 'PLAY') }}</button>
        <!-- Two taps, no dialog. Blocking deletes the friendship, and the
             button now sits in reach of every thumb on a touch device. -->
        <button
          class="friend-more"
          :aria-expanded="menuFor === f.user_id"
          :aria-label="`More for ${f.username}`"
          @click="toggleMenu(f.user_id)"
        >
          <MoreHorizontal :size="14" :stroke-width="2" aria-hidden="true" />
        </button>
        <!-- The destructive pair lives behind the toggle: hover cannot carry
             them on a phone, and keeping them in the row squeezed the name to
             an ellipsis on a 390px screen. -->
        <div v-if="menuFor === f.user_id" class="friend-more-row">
          <button
            class="friend-btn"
            :class="{ 'friend-btn--danger': confirming === `remove:${f.user_id}` }"
            @click="arm(`remove:${f.user_id}`, () => social.remove(f.user_id))"
          >{{ confirming === `remove:${f.user_id}` ? 'CONFIRM?' : 'REMOVE FRIEND' }}</button>
          <button
            class="friend-btn"
            :class="{ 'friend-btn--danger': confirming === `block:${f.user_id}` }"
            @click="arm(`block:${f.user_id}`, () => social.block(f.user_id))"
          >{{ confirming === `block:${f.user_id}` ? 'CONFIRM?' : 'BLOCK' }}</button>
        </div>
      </li>
    </ul>

    <p v-else-if="!social.incoming.length" class="friend-empty">
      No friends yet. The quickest way in is the game-over screen - add whoever you just played.
    </p>

    <p v-if="social.outgoing.length" class="friend-pending">
      {{ social.outgoing.length }} request{{ social.outgoing.length > 1 ? 's' : '' }} waiting on a reply
    </p>

    <details v-if="social.blocked.length" class="friend-blocked">
      <summary>BLOCKED ({{ social.blocked.length }})</summary>
      <p class="friend-blocked-note">A blocked player cannot invite you or send you a request.</p>
      <ul class="friend-list">
        <li v-for="b in social.blocked" :key="b.user_id" class="friend-row">
          <span class="friend-name">{{ b.username }}</span>
          <button class="friend-btn" @click="social.unblock(b.user_id)">UNBLOCK</button>
        </li>
      </ul>
    </details>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useSocialStore, type FriendRow } from '../stores/socialStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'
import { isOnline, relativeTime, byPresence } from '../utils/relativeTime'
import { useNow, usePoll } from '../composables/useClock'
import PresenceDot from './PresenceDot.vue'
import { MoreHorizontal } from 'lucide-vue-next'
import { navigate } from '../utils/routes'

const social = useSocialStore()
const mpStore = useMultiplayerStore()
const emit = defineEmits<{ (e: 'opened-room'): void }>()

// Sitting in a room already? Just ask them in. Otherwise make one first -
// "create a game, wait, find the strip, invite" was four steps for the thing
// this list exists to do.
const busy = ref<string | null>(null)
const asked = ref<Record<string, string>>({})

async function playWith(f: FriendRow) {
  if (busy.value) return
  busy.value = f.user_id
  try {
    if (!mpStore.roomCode) {
      const code = await mpStore.createGame()
      if (!code) { asked.value = { ...asked.value, [f.user_id]: 'TRY AGAIN' }; return }
    }
    const result = await mpStore.sendInvite(f.user_id)
    asked.value = {
      ...asked.value,
      [f.user_id]: result === 'sent' ? 'INVITED'
        : result === 'too_soon' ? 'ALREADY ASKED'
        : result === 'rate_limited' ? 'TOO MANY'
        : result === 'blocked' ? 'BLOCKED'
        : 'TRY AGAIN',
    }
    // The room is open behind this screen; take them to it.
    if (result === 'sent') emit('opened-room')
  } finally {
    busy.value = null
    if (asked.value[f.user_id] === 'TRY AGAIN') {
      setTimeout(() => {
        const next = { ...asked.value }
        delete next[f.user_id]
        asked.value = next
      }, 2500)
    }
  }
}

// Labels age on the shared clock; the list itself re-reads while it is on
// screen, because a friend coming online is the whole point of this panel and
// the clock alone can only ever grey someone out.
const now = useNow()
onMounted(() => { void social.refresh() })
usePoll(() => { void social.refresh() }, 60_000)

// Ordered when the data changes, not when the clock moves: these rows carry
// ACCEPT, DECLINE and BLOCK, and a list that reshuffles on a timer is how
// someone declines the request they meant to accept.
const sortedFriends = ref<FriendRow[]>([])
watch(() => social.friends, (rows) => { sortedFriends.value = byPresence(rows) }, { immediate: true })

function seenLabel(f: FriendRow): string {
  if (isOnline(f.last_seen_at, now.value)) return 'ONLINE'
  const rel = relativeTime(f.last_seen_at, now.value)
  return rel ? rel.toUpperCase() : ''
}

function openProfile(f: FriendRow): void {
  if (f.share_code) navigate({ name: 'profile', code: f.share_code })
}

// Both exits ask once. The armed state clears itself, so a stray tap does not
// leave a loaded button sitting there for the next visit to this screen.
const confirming = ref<string | null>(null)
const menuFor = ref<string | null>(null)

function toggleMenu(userId: string): void {
  menuFor.value = menuFor.value === userId ? null : userId
  confirming.value = null
}
let armedTimer: ReturnType<typeof setTimeout> | null = null

function arm(key: string, action: () => void): void {
  if (armedTimer) { clearTimeout(armedTimer); armedTimer = null }
  if (confirming.value === key) {
    confirming.value = null
    action()
    return
  }
  confirming.value = key
  armedTimer = setTimeout(() => { confirming.value = null }, 4000)
}

onUnmounted(() => { if (armedTimer) clearTimeout(armedTimer) })
</script>

<style scoped>
.friends {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.friends-count {
  color: var(--color-neon-blue);
}

.friend-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.friend-row {
  display: flex;
  align-items: center;
  /* Three actions and a name do not fit a 390px row, and a touch device shows
     all three at once. The name keeps its width and the buttons drop to a
     second line rather than squeezing it to "Step…". */
  flex-wrap: wrap;
  gap: var(--spacing-2) var(--spacing-1);
  padding: var(--spacing-2);
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-sm);
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.85rem;
}

.friend-row--request {
  border-color: rgba(0, 243, 255, 0.28);
  flex-wrap: wrap;
}

.friend-name {
  flex: 1 1 9rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.friend-name--link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.friend-name--link:hover {
  color: var(--color-neon-blue);
}

.friend-note,
.friend-seen {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  white-space: nowrap;
}

.friend-actions {
  display: flex;
  gap: var(--spacing-1);
}

.friend-btn {
  padding: 2px 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.friend-btn:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: var(--text-primary);
}

.friend-btn--play {
  border-color: rgba(0, 243, 255, 0.45);
  color: var(--color-neon-blue);
}

.friend-blocked-note {
  margin: var(--spacing-1) 0;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.72rem;
  letter-spacing: normal;
  color: var(--text-muted);
}

.friend-btn--yes {
  border-color: rgba(0, 243, 255, 0.45);
  color: var(--color-neon-blue);
}

/* :hover on .friend-btn is one class deeper, so the armed state has to match
   it or the confirm reads plain white under the pointer that just armed it. */
.friend-btn--danger,
.friend-btn--danger:hover {
  border-color: rgba(255, 68, 68, 0.6);
  color: #ff6666;
  opacity: 1;
}

.friend-more {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
}

.friend-more:hover,
.friend-more[aria-expanded='true'] {
  border-color: rgba(255, 255, 255, 0.4);
  color: var(--text-primary);
}

.friend-more-row {
  flex: 1 0 100%;
  display: flex;
  gap: var(--spacing-1);
  padding-top: var(--spacing-1);
}

.friend-empty,
.friend-pending {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.friend-blocked {
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.friend-blocked summary {
  cursor: pointer;
  padding: var(--spacing-1) 0;
}
</style>
