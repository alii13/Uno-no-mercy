<template>
  <div class="auth-container">
    <div class="auth-card">
      <button class="back-link" @click="$emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        BACK
      </button>

      <header class="auth-header">
        <h1 class="auth-brand">
          <span class="auth-brand-uno">UNO</span>
          <span class="auth-brand-nomercy">NO MERCY</span>
        </h1>
        <p class="auth-tagline">
          {{ mode === 'forgot' ? 'Reset your password' : mode === 'signup' ? 'Track every brutal stat' : 'Pick up where you left off' }}
        </p>
      </header>

      <!-- Login / Signup tabs (hidden in forgot mode) -->
      <div v-if="mode !== 'forgot'" class="tab-row" role="tablist">
        <button
          class="tab"
          :class="{ active: mode === 'login' }"
          role="tab"
          :aria-selected="mode === 'login'"
          @click="setMode('login')"
        >
          SIGN IN
        </button>
        <button
          class="tab"
          :class="{ active: mode === 'signup' }"
          role="tab"
          :aria-selected="mode === 'signup'"
          @click="setMode('signup')"
        >
          SIGN UP
        </button>
      </div>

      <!-- Forgot mode -->
      <form v-if="mode === 'forgot'" class="auth-form" @submit.prevent="handleForgotPassword">
        <label class="field">
          <span class="field-label">EMAIL</span>
          <input
            v-model="email"
            v-focus-ring
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
            class="field-input"
          />
        </label>

        <p v-if="error" class="msg msg-error">{{ error }}</p>
        <p v-if="successMsg" class="msg msg-success">{{ successMsg }}</p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          :disabled="loading"
        >
          {{ loading ? 'SENDING...' : 'SEND RESET LINK' }}
        </Button>

        <button class="link" type="button" @click="setMode('login')">
          ← Back to sign in
        </button>
      </form>

      <!-- Login / Signup forms -->
      <form v-else class="auth-form" @submit.prevent="handleSubmit">
        <label v-if="mode === 'signup'" class="field">
          <span class="field-label">USERNAME</span>
          <input
            v-model="username"
            v-focus-ring
            type="text"
            placeholder="Pick a battle name"
            required
            minlength="3"
            autocomplete="username"
            class="field-input"
          />
        </label>

        <label class="field">
          <span class="field-label">EMAIL</span>
          <input
            v-model="email"
            v-focus-ring
            type="email"
            placeholder="you@example.com"
            required
            autocomplete="email"
            class="field-input"
          />
        </label>

        <label class="field">
          <span class="field-label">PASSWORD</span>
          <input
            v-model="password"
            v-focus-ring
            type="password"
            :placeholder="mode === 'signup' ? 'At least 6 characters' : 'Your password'"
            required
            minlength="6"
            :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            class="field-input"
          />
        </label>

        <p v-if="error" class="msg msg-error">{{ error }}</p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          :disabled="loading"
        >
          {{ loading ? 'PROCESSING...' : mode === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN' }}
        </Button>

        <button
          v-if="mode === 'login'"
          class="link"
          type="button"
          @click="setMode('forgot')"
        >
          Forgot password?
        </button>
      </form>

      <!-- Trust microcopy at the foot of the card -->
      <ul class="trust-list" aria-label="What you get">
        <li>Free forever</li>
        <li>·</li>
        <li>No download</li>
        <li>·</li>
        <li>Anonymous OK</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { vFocusRing } from '../directives/focusRing'
import Button from './ui/Button.vue'

const props = defineProps<{
  initialMode?: 'login' | 'signup'
}>()

defineEmits<{
  (e: 'back'): void
}>()

const authStore = useAuthStore()

const mode = ref<'login' | 'signup' | 'forgot'>('login')
const email = ref('')
const password = ref('')
const username = ref('')
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

onMounted(() => {
  if (props.initialMode) {
    mode.value = props.initialMode
  }
})

function setMode(next: 'login' | 'signup' | 'forgot') {
  mode.value = next
  error.value = ''
  successMsg.value = ''
}

async function handleSubmit() {
  loading.value = true
  error.value = ''

  try {
    if (mode.value === 'signup') {
      const result = await authStore.signUp(email.value, password.value, username.value)
      if (!result.success) {
        error.value = result.error || 'Sign up failed'
      }
    } else {
      const result = await authStore.signIn(email.value, password.value)
      if (!result.success) {
        error.value = result.error || 'Login failed'
      }
    }
  } finally {
    loading.value = false
  }
}

async function handleForgotPassword() {
  loading.value = true
  error.value = ''
  successMsg.value = ''

  try {
    const result = await authStore.sendPasswordReset(email.value)
    if (result.success) {
      successMsg.value = 'Reset link sent. Check your email.'
    } else {
      error.value = result.error || 'Failed to send reset link'
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-concrete);
  padding: var(--spacing-4);
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: linear-gradient(180deg, #18191b 0%, #0a0a0b 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  padding: var(--spacing-8) var(--spacing-6);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  cursor: pointer;
  padding: var(--spacing-1) 0;
  align-self: flex-start;
  transition: color var(--duration-snap) var(--ease-snap);
}

.back-link:hover {
  color: var(--color-neon-blue);
}

.auth-header {
  text-align: center;
}

.auth-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
}

.auth-brand-uno {
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 4rem);
  letter-spacing: 0.05em;
  line-height: 1;
  color: var(--text-primary);
}

.auth-brand-nomercy {
  font-family: var(--font-display);
  font-size: clamp(1rem, 3.5vw, 1.5rem);
  letter-spacing: 0.25em;
  color: var(--color-alert);
  text-shadow: 0 0 14px rgba(255, 42, 42, 0.5);
}

.auth-tagline {
  margin: var(--spacing-3) 0 0;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  letter-spacing: 0.18em;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.tab-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-1);
  background: rgba(0, 0, 0, 0.4);
  padding: var(--spacing-1);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  padding: var(--spacing-3);
  cursor: pointer;
  border-radius: var(--radius-sm);
  min-height: 44px;
  transition:
    background var(--duration-snap) var(--ease-snap),
    color var(--duration-snap) var(--ease-snap);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  background: var(--color-alert);
  color: white;
  font-weight: bold;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
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
  padding: var(--spacing-3) var(--spacing-4);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: var(--text-base);
  border-radius: var(--radius-sm);
  transition: border-color var(--duration-snap) var(--ease-snap);
  min-height: 44px;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
}

.msg {
  margin: 0;
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  border-radius: var(--radius-sm);
  border: 1px solid;
  text-align: center;
}

.msg-error {
  background: rgba(255, 42, 42, 0.08);
  border-color: var(--color-alert);
  color: var(--color-alert);
}

.msg-success {
  background: rgba(0, 255, 102, 0.08);
  border-color: var(--color-neon-green);
  color: var(--color-neon-green);
}

.link {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.15em;
  cursor: pointer;
  padding: var(--spacing-2);
  text-align: center;
  transition: color var(--duration-snap) var(--ease-snap);
}

.link:hover {
  color: var(--color-neon-blue);
}

.trust-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  justify-content: center;
  gap: var(--spacing-2);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  letter-spacing: 0.15em;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: var(--spacing-3);
}

@media (max-width: 480px) {
  .auth-card {
    padding: var(--spacing-6) var(--spacing-4);
    gap: var(--spacing-4);
  }

  .auth-tagline {
    font-size: var(--text-xs);
  }
}
</style>
