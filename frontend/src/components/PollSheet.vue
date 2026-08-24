<template>
  <Modal v-if="poll" sheet aria-label="Quick question" @close="dismiss">
    <div class="poll-card">
      <header class="poll-header">
        <h3 class="poll-title">QUICK QUESTION</h3>
        <button class="close-btn" @click="dismiss" aria-label="Close">
          <X :size="18" />
        </button>
      </header>

      <template v-if="!voted">
        <p class="poll-question">{{ poll.question }}</p>

        <div class="poll-options" role="radiogroup" :aria-label="poll.question">
          <button
            v-for="opt in poll.options"
            :key="opt"
            v-focus-ring
            class="poll-option"
            :class="{ 'is-picked': choice === opt }"
            role="radio"
            :aria-checked="choice === opt"
            :disabled="submitting"
            @click="choice = opt"
          >
            {{ opt }}
          </button>
        </div>

        <label v-if="poll.allow_note" class="field">
          <span class="field-label">{{ noteLabel }}</span>
          <textarea
            v-model="note"
            v-focus-ring
            class="field-input"
            :placeholder="'Optional'"
            :disabled="submitting"
            maxlength="500"
            rows="2"
          ></textarea>
        </label>

        <p v-if="error" class="msg-error">{{ error }}</p>

        <Button
          variant="primary"
          size="lg"
          block
          :disabled="!choice || submitting"
          @click="submit"
        >
          {{ submitting ? 'SENDING...' : 'SEND' }}
        </Button>

        <button class="skip-btn" :disabled="submitting" @click="dismiss">Not now</button>
      </template>

      <div v-else class="poll-done">
        <Check :size="36" />
        <h4 class="done-title">{{ alreadyAnswered ? 'ALREADY ANSWERED' : 'GOT IT' }}</h4>
        <p class="done-desc">
          {{ alreadyAnswered
            ? 'You answered this one already - your first answer stands.'
            : 'Thanks - this decides what gets built next.' }}
        </p>
        <Button variant="primary" size="md" @click="dismiss">CLOSE</Button>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
/**
 * The active poll from the `polls` table, rendered in the game's own theme.
 *
 * The question is content, not code: it is pushed by flipping `active` on a row
 * in the Supabase Table Editor, so asking something new needs no deploy.
 *
 * Every failure path ends with the sheet simply not appearing. That is
 * deliberate and it is what lets this component ship before polls.sql is run -
 * a missing table reads as "no poll to ask", same as an empty table.
 */
import { computed, onMounted, ref } from 'vue'
import { Check, X } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useRetentionStore } from '../stores/retentionStore'
import { vFocusRing } from '../directives/focusRing'
import { hasLookedUp, isEligible, markDismissed, markLookedUp, type Poll } from '../utils/pollGate'
import { track } from '../utils/analytics'
import Modal from './ui/Modal.vue'
import Button from './ui/Button.vue'

const authStore = useAuthStore()
const retentionStore = useRetentionStore()

const poll = ref<Poll | null>(null)
const choice = ref('')
const note = ref('')
const submitting = ref(false)
const voted = ref(false)
const alreadyAnswered = ref(false)
const error = ref('')

const noteLabel = computed(() => (poll.value?.note_label || 'Anything else').toUpperCase())

onMounted(async () => {
    if (!authStore.user || hasLookedUp()) return
    markLookedUp()

    const { data, error: dbError } = await supabase
        .from('polls')
        .select('id, question, options, min_games, allow_note, note_label')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (dbError || !data) return
    if (!isEligible(data as Poll, retentionStore.gamesPlayed)) return

    poll.value = data as Poll
    track('poll_shown', { poll_id: poll.value.id })
})

async function submit() {
    if (!poll.value || !choice.value || !authStore.user) return
    submitting.value = true
    error.value = ''

    const { error: dbError } = await supabase.from('poll_votes').insert({
        poll_id: poll.value.id,
        user_id: authStore.user.id,
        choice: choice.value,
        note: note.value.trim() || null,
    })

    submitting.value = false

    // 23505: this player already answered on another device. Their first answer
    // stands, so do not claim this one was recorded - it was not, and it may
    // have been a different option.
    if (dbError && dbError.code !== '23505') {
        error.value = 'Could not send that. Try again?'
        return
    }

    if (!dbError) track('poll_voted', { poll_id: poll.value.id, choice: choice.value })
    alreadyAnswered.value = !!dbError
    markDismissed(poll.value.id)
    voted.value = true
}

function dismiss() {
    if (poll.value) {
        if (!voted.value) track('poll_dismissed', { poll_id: poll.value.id })
        markDismissed(poll.value.id)
    }
    poll.value = null
}
</script>

<style scoped>
.poll-card {
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 204, 0, 0.18);
  border-radius: var(--radius-md);
  padding: var(--spacing-6);
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  box-shadow: 0 0 40px rgba(255, 204, 0, 0.08);
}

.poll-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
  padding-bottom: var(--spacing-3);
  flex-shrink: 0;
}

.poll-title {
  font-family: var(--font-display);
  color: var(--color-hazard);
  margin: 0;
  font-size: var(--text-lg);
  letter-spacing: 0.15em;
}

.close-btn {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-muted);
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    border-color var(--duration-snap) var(--ease-snap),
    color var(--duration-snap) var(--ease-snap);
}

.close-btn:hover {
  border-color: var(--color-alert);
  color: var(--color-alert);
}

.poll-question {
  font-size: var(--text-base);
  color: var(--text-primary);
  margin: 0;
  line-height: 1.5;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.poll-option {
  width: 100%;
  min-height: 44px;
  padding: var(--spacing-3);
  text-align: left;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    border-color var(--duration-snap) var(--ease-snap),
    background var(--duration-snap) var(--ease-snap);
}

.poll-option:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.28);
}

.poll-option.is-picked {
  border-color: var(--color-neon-blue);
  background: rgba(0, 243, 255, 0.1);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.field-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.18em;
}

.field-input {
  width: 100%;
  padding: var(--spacing-3);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  border-radius: var(--radius-sm);
  resize: vertical;
  transition: border-color var(--duration-snap) var(--ease-snap);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.msg-error {
  margin: 0;
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-alert);
  background: rgba(255, 42, 42, 0.08);
  color: var(--color-alert);
  text-align: center;
}

.skip-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  cursor: pointer;
  padding: var(--spacing-2);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.skip-btn:hover {
  color: var(--text-secondary);
}

.poll-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-3);
  padding: var(--spacing-6) 0;
  color: var(--color-neon-green);
}

.done-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  margin: 0;
  letter-spacing: 0.15em;
}

.done-desc {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

@media (max-width: 480px) {
  .poll-card {
    padding: var(--spacing-4);
  }

  .poll-title {
    font-size: var(--text-base);
  }
}
</style>
