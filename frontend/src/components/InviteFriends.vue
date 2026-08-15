<template>
  <!-- Nothing to show is the common case at this traffic, and an empty
       "invite your friends" box in a room you are already sitting alone in
       is a reminder that nobody is there. -->
  <section v-if="online.length" class="inv">
    <span class="inv-label">FRIENDS ONLINE</span>
    <ul class="inv-list">
      <li v-for="f in online" :key="f.user_id" class="inv-row">
        <span class="inv-dot" aria-hidden="true" />
        <span class="inv-name">{{ f.username }}</span>
        <button
          class="inv-btn"
          :disabled="invitesStore.sending.has(f.user_id) || !!sent[f.user_id]"
          @click="invite(f.user_id)"
        >{{ sent[f.user_id] ?? 'INVITE' }}</button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSocialStore } from '../stores/socialStore'
import { useInviteStore } from '../stores/inviteStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'
import { isOnline } from '../utils/relativeTime'

const social = useSocialStore()
const invitesStore = useInviteStore()
const mpStore = useMultiplayerStore()
const sent = ref<Record<string, string>>({})

onMounted(() => { void social.refresh() })

// Only friends who could actually answer. An invite to someone who left an
// hour ago is a notification they will read tomorrow, in a room that GC'd
// ten minutes after it was sent.
const online = computed(() =>
  social.unavailable || invitesStore.unavailable
    ? []
    : social.friends.filter(f => isOnline(f.last_seen_at)).slice(0, 5),
)

async function invite(userId: string) {
  const code = mpStore.roomCode
  if (!code) return
  const result = await invitesStore.send(userId, code)
  sent.value = {
    ...sent.value,
    [userId]: result === 'sent' ? 'INVITED'
      : result === 'too_soon' ? 'ALREADY ASKED'
      : result === 'rate_limited' ? 'TOO MANY'
      : result === 'blocked' ? 'BLOCKED'
      : 'TRY AGAIN',
  }
  // TRY AGAIN has to stay pressable, so it clears itself.
  if (!['INVITED', 'ALREADY ASKED', 'TOO MANY', 'BLOCKED'].includes(sent.value[userId]!)) {
    setTimeout(() => {
      const next = { ...sent.value }
      delete next[userId]
      sent.value = next
    }, 2000)
  }
}
</script>

<style scoped>
.inv {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  width: 100%;
  margin-top: var(--spacing-2);
}

.inv-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  color: var(--text-muted);
}

.inv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.inv-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  background: rgba(0, 243, 255, 0.04);
  border: 1px solid rgba(0, 243, 255, 0.16);
  border-radius: var(--radius-sm);
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.8rem;
}

.inv-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-neon-green);
}

.inv-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}

.inv-btn {
  flex: none;
  padding: 2px 8px;
  background: transparent;
  border: 1px solid rgba(0, 243, 255, 0.4);
  border-radius: var(--radius-sm);
  color: var(--color-neon-blue);
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.inv-btn:hover:not(:disabled) {
  background: rgba(0, 243, 255, 0.1);
}

.inv-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
