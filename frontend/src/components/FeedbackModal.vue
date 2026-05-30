<template>
  <div class="feedback-overlay" @click.self="$emit('close')">
    <div class="feedback-modal">
      <div class="modal-header">
        <h3 class="modal-title">SEND FEEDBACK</h3>
        <button class="close-btn" @click="$emit('close')" aria-label="close">×</button>
      </div>

      <template v-if="!submitted">
        <p class="modal-desc">
          Found a bug? Got an idea? Want to say hi? Drop a message - we read everything.
        </p>

        <form @submit.prevent="submit" class="modal-form">
          <div class="form-row">
            <label class="form-label">MESSAGE</label>
            <textarea
              v-model="message"
              class="form-textarea"
              placeholder="Tell us anything..."
              required
              :disabled="submitting"
              maxlength="2000"
              rows="5"
            ></textarea>
          </div>

          <div class="form-row">
            <label class="form-label">EMAIL (optional)</label>
            <input
              v-model="email"
              type="email"
              class="form-input"
              placeholder="So we can reply"
              :disabled="submitting"
            />
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <button type="submit" class="submit-btn" :disabled="submitting || !message.trim()">
            <span v-if="submitting">SENDING...</span>
            <span v-else>SEND</span>
          </button>
        </form>
      </template>

      <template v-else>
        <div class="success-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h4 class="success-title">FEEDBACK SENT</h4>
          <p class="success-desc">Thanks for taking the time. We appreciate it.</p>
          <button class="submit-btn" @click="$emit('close')">CLOSE</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

defineEmits<{
  (e: 'close'): void
}>()

const authStore = useAuthStore()

const message = ref('')
const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

async function submit() {
  if (!message.value.trim()) return
  submitting.value = true
  error.value = ''

  const payload = {
    message: message.value.trim(),
    email: email.value.trim() || null,
    user_id: authStore.user?.id || null,
    page: window.location.pathname + window.location.hash,
    user_agent: navigator.userAgent,
  }

  try {
    // 1) Insert into Supabase (source of truth)
    const { error: dbError } = await supabase.from('feedback').insert(payload)
    if (dbError) throw dbError

    // 2) Fire-and-forget email via FormSubmit (don't block on this)
    //    FormSubmit will require a one-time confirmation on first email
    fetch('https://formsubmit.co/ajax/shekhaliul44@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        _subject: 'UNO No Mercy - New feedback',
        _template: 'box',
        message: payload.message,
        reply_to: payload.email || 'no-reply@uno-no-mercy.com',
        user_id: payload.user_id || 'guest',
        page: payload.page,
        user_agent: payload.user_agent,
      }),
    }).catch(() => { /* email is best-effort; supabase is the source of truth */ })

    submitted.value = true
  } catch (e: any) {
    error.value = e?.message || 'Could not send feedback. Try again?'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.feedback-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 3000;
  padding: 1rem;
}

.feedback-modal {
  background: #0e0e0f;
  border: 2px solid var(--color-hazard);
  width: 100%;
  max-width: 480px;
  box-shadow: 0 0 60px rgba(255, 204, 0, 0.15);
  padding: 1.5rem;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px dashed #333;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.modal-title {
  font-family: var(--font-display);
  color: var(--color-hazard);
  margin: 0;
  font-size: 1.1rem;
  letter-spacing: 2px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.4rem;
}

.close-btn:hover {
  color: var(--color-alert);
}

.modal-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-label {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: var(--text-muted);
  letter-spacing: 2px;
}

.form-textarea,
.form-input {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #333;
  color: var(--text-primary);
  padding: 0.75rem;
  font-family: inherit;
  font-size: 0.9rem;
  resize: vertical;
  transition: border-color 0.2s;
}

.form-textarea:focus,
.form-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.form-error {
  background: rgba(255, 42, 42, 0.1);
  border: 1px solid var(--color-alert);
  color: var(--color-alert);
  padding: 0.6rem 0.75rem;
  font-size: 0.85rem;
}

.submit-btn {
  background: linear-gradient(145deg, var(--color-alert) 0%, var(--color-alert-dim) 100%);
  border: 2px solid var(--color-alert);
  color: white;
  padding: 0.9rem 1.5rem;
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 2px;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 0 24px rgba(255, 42, 42, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
  padding: 1.5rem 0;
  color: var(--color-neon-green);
}

.success-title {
  font-family: var(--font-display);
  font-size: 1.2rem;
  margin: 0;
  letter-spacing: 2px;
}

.success-desc {
  color: var(--text-secondary);
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}

@media (max-width: 480px) {
  .feedback-modal { padding: 1rem; }
  .modal-title { font-size: 1rem; }
  .modal-desc { font-size: 0.8rem; }
}
</style>
