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
        <!-- Two taps, no dialog. Blocking deletes the friendship, and the
             button now sits in reach of every thumb on a touch device. -->
        <button
          class="friend-btn friend-btn--quiet"
          :class="{ 'friend-btn--danger': confirming === f.user_id }"
          :title="`Block ${f.username}`"
          @click="onBlock(f.user_id)"
        >{{ confirming === f.user_id ? 'CONFIRM?' : 'BLOCK' }}</button>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useSocialStore, type FriendRow } from '../stores/socialStore'
import { isOnline, relativeTime, presenceState } from '../utils/relativeTime'
import PresenceDot from './PresenceDot.vue'
import { navigate } from '../utils/routes'

const social = useSocialStore()

// Presence ages while the panel is open, so the labels tick on their own.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  void social.refresh()
  timer = setInterval(() => { now.value = Date.now() }, 30_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

// Whoever can play right now, first. A list ordered by when the friendship
// was made answers a question nobody is asking.
const RANK: Record<string, number> = { online: 0, recent: 1, offline: 2 }
const sortedFriends = computed(() => [...social.friends].sort((a, b) => {
  const byState = RANK[presenceState(a.last_seen_at, now.value)]! - RANK[presenceState(b.last_seen_at, now.value)]!
  if (byState !== 0) return byState
  return (b.last_seen_at ?? '').localeCompare(a.last_seen_at ?? '')
}))

function seenLabel(f: FriendRow): string {
  if (isOnline(f.last_seen_at, now.value)) return 'ONLINE'
  const rel = relativeTime(f.last_seen_at, now.value)
  return rel ? rel.toUpperCase() : ''
}

function openProfile(f: FriendRow): void {
  if (f.share_code) navigate({ name: 'profile', code: f.share_code })
}

// Block asks once. The armed state clears itself, so a stray tap does not
// leave a loaded button sitting there for the next visit to this screen.
const confirming = ref<string | null>(null)
let armed: ReturnType<typeof setTimeout> | null = null

function onBlock(userId: string): void {
  if (armed) { clearTimeout(armed); armed = null }
  if (confirming.value === userId) {
    confirming.value = null
    void social.block(userId)
    return
  }
  confirming.value = userId
  armed = setTimeout(() => { confirming.value = null }, 4000)
}

onUnmounted(() => { if (armed) clearTimeout(armed) })
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
  gap: var(--spacing-2);
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
  flex: 1;
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

.friend-btn--quiet {
  opacity: 0;
  transition: opacity 0.15s;
}

.friend-row:hover .friend-btn--quiet,
.friend-btn--quiet:focus-visible {
  opacity: 1;
}

/* A touch device never hovers, so hiding behind hover hides it for good. */
@media (hover: none) {
  .friend-btn--quiet { opacity: 1; }
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
