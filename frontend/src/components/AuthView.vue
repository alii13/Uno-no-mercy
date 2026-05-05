<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Back Button -->
      <button @click="$emit('back')" class="back-btn">
        ← BACK
      </button>
      
      <h1 class="title glitch-text" data-text="UNO">UNO</h1>
      <h2 class="subtitle">NO MERCY</h2>
      
      <div class="auth-form">
        <div class="form-tabs" v-if="mode !== 'forgot'">
          <button
            :class="{ active: mode === 'login' }"
            @click="mode = 'login'; error = ''; successMsg = ''"
          >
            LOGIN
          </button>
          <button
            :class="{ active: mode === 'signup' }"
            @click="mode = 'signup'; error = ''; successMsg = ''"
          >
            SIGN UP
          </button>
        </div>

        <!-- Forgot password mode -->
        <template v-if="mode === 'forgot'">
          <h3 class="form-title">RESET PASSWORD</h3>
          <p class="form-desc">Enter your email to receive a reset link.</p>
          <form @submit.prevent="handleForgotPassword">
            <div class="input-group">
              <label>EMAIL</label>
              <input
                v-model="email"
                type="email"
                placeholder="Enter your email"
                required
              />
            </div>

            <div v-if="error" class="error-message">{{ error }}</div>
            <div v-if="successMsg" class="success-message">{{ successMsg }}</div>

            <button type="submit" class="submit-btn" :disabled="loading">
              <span v-if="loading">SENDING...</span>
              <span v-else>SEND RESET LINK</span>
            </button>
          </form>
          <button class="forgot-link" @click="mode = 'login'; error = ''; successMsg = ''">
            BACK TO LOGIN
          </button>
        </template>

        <!-- Login / Signup mode -->
        <template v-else>
          <form @submit.prevent="handleSubmit">
            <div v-if="mode === 'signup'" class="input-group">
              <label>USERNAME</label>
              <input
                v-model="username"
                type="text"
                placeholder="Choose a username"
                required
                minlength="3"
              />
            </div>

            <div class="input-group">
              <label>EMAIL</label>
              <input
                v-model="email"
                type="email"
                placeholder="Enter your email"
                required
              />
            </div>

            <div class="input-group">
              <label>PASSWORD</label>
              <input
                v-model="password"
                type="password"
                placeholder="Enter password"
                required
                minlength="6"
              />
            </div>

            <div v-if="error" class="error-message">{{ error }}</div>

            <button type="submit" class="submit-btn" :disabled="loading">
              <span v-if="loading">PROCESSING...</span>
              <span v-else>{{ mode === 'login' ? 'ENGAGE' : 'CREATE ACCOUNT' }}</span>
            </button>
          </form>

          <button v-if="mode === 'login'" class="forgot-link" @click="mode = 'forgot'; error = ''">
            FORGOT PASSWORD?
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/authStore'

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
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-concrete);
  padding: 2rem;
}

.auth-card {
  background: rgba(0, 0, 0, 0.6);
  border: 2px solid #333;
  padding: 3rem;
  max-width: 400px;
  width: 100%;
}

.title {
  font-family: var(--font-display);
  font-size: 5rem;
  text-align: center;
  margin: 0;
  color: var(--text-primary);
}

.subtitle {
  font-family: var(--font-display);
  font-size: 1.5rem;
  text-align: center;
  color: var(--color-alert);
  margin: 0 0 2rem 0;
}

.form-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 2rem;
}

.form-tabs button {
  flex: 1;
  padding: 1rem;
  background: transparent;
  border: 1px solid #333;
  color: var(--text-muted);
  font-family: var(--font-display);
  cursor: pointer;
  transition: all 0.2s;
}

.form-tabs button.active {
  background: var(--color-alert);
  color: black;
  border-color: var(--color-alert);
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-bottom: 0.5rem;
  letter-spacing: 1px;
}

.input-group input {
  width: 100%;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid #444;
  color: white;
  font-size: 1rem;
}

.input-group input:focus {
  outline: none;
  border-color: var(--color-neon-blue);
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
}

.error-message {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid #ff4444;
  color: #ff6666;
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.submit-btn {
  width: 100%;
  padding: 1.2rem;
  background: linear-gradient(145deg, #ff4444 0%, #cc0000 100%);
  border: none;
  color: white;
  font-family: var(--font-display);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}

.submit-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(255, 0, 0, 0.4);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.back-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem;
  margin-bottom: 1rem;
  transition: color 0.2s;
}

.back-btn:hover {
  color: var(--color-neon-blue);
}

.forgot-link {
  display: block;
  width: 100%;
  margin-top: 1rem;
  padding: 0.5rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  text-align: center;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: var(--color-neon-blue);
}

.form-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  text-align: center;
  margin: 0 0 0.5rem 0;
  color: var(--color-hazard);
}

.form-desc {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
  margin: 0 0 1.5rem 0;
}

.success-message {
  background: rgba(0, 255, 100, 0.1);
  border: 1px solid var(--color-neon-green);
  color: var(--color-neon-green);
  padding: 1rem;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

@media (max-width: 480px) {
  .auth-container {
    padding: 1rem;
  }

  .auth-card {
    padding: 1.5rem;
  }

  .title {
    font-size: 3rem;
  }

  .subtitle {
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
  }

  .form-tabs button {
    padding: 0.75rem;
    font-size: 0.85rem;
  }

  .input-group {
    margin-bottom: 1rem;
  }

  .input-group input {
    padding: 0.75rem;
  }

  .submit-btn {
    padding: 1rem;
    font-size: 1rem;
  }
}
</style>
