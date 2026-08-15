<template>
  <Transition name="invite-toast">
    <div v-if="showing" class="invite" role="status">
      <Users class="invite-glyph" :size="16" :stroke-width="2.25" aria-hidden="true" />
      <span class="invite-text">
        <strong class="invite-who">{{ showing.from_username }}</strong>
        wants you at their table
      </span>
      <button class="invite-join" :disabled="joining" @click="join">
        {{ joining ? 'JOINING…' : 'JOIN' }}
      </button>
      <button class="invite-dismiss" aria-label="Ignore invite" @click="invitesStore.dismiss(showing.id)">
        <X :size="14" :stroke-width="2.5" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Users, X } from 'lucide-vue-next'
import { useInviteStore } from '../stores/inviteStore'
import { useMultiplayerStore } from '../stores/multiplayerStore'

/** Matches the ten-minute window in my_invites, which matches the public-room
 *  GC window - an invite must never outlive the room it points at. */
const INVITE_LIFE_MS = 10 * 60 * 1000

const invitesStore = useInviteStore()
const mpStore = useMultiplayerStore()
const joining = ref(false)

// Not during a match. JOIN would abandon the game in progress, and a toast
// over the table is noise at the worst moment. The invite keeps for ten
// minutes, so it is still there when the game ends.
const inMatch = computed(() => {
  const s = mpStore.currentGame?.status
  return s === 'playing' || s === 'finished'
})

// An invite outlives its room after ten minutes, and a tab left open all
// afternoon would otherwise still be offering it. The clock ticks so the
// toast retires itself without a reload.
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null
onMounted(() => { tick = setInterval(() => { now.value = Date.now() }, 30_000) })
onUnmounted(() => { if (tick) clearInterval(tick) })

const showing = computed(() => {
  const invite = invitesStore.current
  if (!invite || inMatch.value) return null
  return now.value - new Date(invite.created_at).getTime() < INVITE_LIFE_MS ? invite : null
})

async function join() {
  const invite = showing.value
  if (!invite || joining.value) return
  joining.value = true
  try {
    // Dismiss first: whether the room is still alive or not, this invite has
    // been answered, and a dead code must not leave the toast on screen.
    await invitesStore.dismiss(invite.id)
    await mpStore.joinGame(invite.room_code, 'link')
  } finally {
    joining.value = false
  }
}
</script>

<style scoped>
/* Bottom edge, unlike the sign-in toast at the top. The note on that one -
   "the landing page owns the bottom edge with its sticky mobile CTA" - does
   not reach here, because an invite needs an account and never renders on the
   landing page. Measured on a 390x667 waiting room: it clears LEAVE ROOM and
   PLAY VS BOT INSTEAD, and covers only the site footer. Bottom wins because
   JOIN is an action for a thumb, where a sign-in failure is a message to
   read. */
.invite {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom, 0px) + var(--spacing-4));
  transform: translateX(-50%);
  z-index: 2200;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  width: min(26rem, calc(100vw - var(--spacing-6)));
  padding: var(--spacing-3);
  background: rgba(10, 12, 14, 0.96);
  border: 1px solid rgba(0, 243, 255, 0.4);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.55);
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.invite-glyph {
  flex: none;
  color: var(--color-neon-blue);
}

.invite-text {
  flex: 1;
  min-width: 0;
}

.invite-who {
  color: var(--text-primary);
  font-weight: 600;
}

.invite-join {
  flex: none;
  padding: var(--spacing-1) var(--spacing-3);
  background: rgba(0, 243, 255, 0.12);
  border: 1px solid rgba(0, 243, 255, 0.5);
  border-radius: var(--radius-sm);
  color: var(--color-neon-blue);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  cursor: pointer;
}

.invite-join:hover:not(:disabled) {
  background: rgba(0, 243, 255, 0.2);
}

.invite-join:disabled {
  opacity: 0.6;
  cursor: default;
}

.invite-dismiss {
  flex: none;
  display: inline-flex;
  padding: var(--spacing-1);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.invite-dismiss:hover {
  color: var(--text-primary);
}

.invite-toast-enter-active,
.invite-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.invite-toast-enter-from,
.invite-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

@media (prefers-reduced-motion: reduce) {
  .invite-toast-enter-active,
  .invite-toast-leave-active { transition: none; }
}
</style>
