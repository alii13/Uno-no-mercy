<template>
  <div class="kill-page">
    <div v-if="loading" class="kill-state">Loading…</div>

    <!-- A dead or mistyped code should still sell the game rather than
         dead-end on an error. -->
    <div v-else-if="!kill" class="kill-card kill-card--gone">
      <p class="kill-gone">That card has expired.</p>
      <Button variant="primary" size="lg" block @click="playNow">PLAY OPEN MERCY</Button>
    </div>

    <div v-else class="kill-card">
      <img
        class="kill-image"
        :src="`/og/kill-${kill.tier}.jpg`"
        :alt="`Plus ${kill.amount} dealt in a single turn`"
        width="1200"
        height="630"
      />
      <h1 class="kill-line">
        <strong>{{ kill.dealer }}</strong> stacked
        <span class="kill-amount">+{{ kill.amount }}</span>
        on {{ kill.victim }}
      </h1>
      <p class="kill-sub">{{ kill.cards_played }} cards played in that game.</p>
      <Button variant="primary" size="lg" block @click="playNow">THINK YOU CAN SURVIVE WORSE?</Button>
      <button class="kill-secondary" @click="playNow">Play Open Mercy free, no download</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import { navigate } from '../utils/routes'
import { track } from '../utils/analytics'
import Button from './ui/Button.vue'

const props = defineProps<{ code: string }>()

interface KillRow {
    dealer: string
    victim: string
    amount: number
    tier: string
    cards_played: number
}

const kill = ref<KillRow | null>(null)
const loading = ref(true)

onMounted(async () => {
    try {
        // kill_cards is RLS-closed; kill_card() is the only read path, and it
        // is granted to anon so a stranger following the link can see it.
        const { data, error } = await supabase.rpc('kill_card', { p_code: props.code })
        const row = Array.isArray(data) ? data[0] : null
        if (!error && row) kill.value = row as KillRow
    } catch {
        // Leave it null — the expired-card state is a better dead end than a
        // stack trace, and it still offers the game.
    } finally {
        loading.value = false
        track('kill_card_viewed', { found: !!kill.value })
    }
})

function playNow() {
    track('kill_card_cta')
    navigate({ name: 'home' })
}
</script>

<style scoped>
.kill-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-6) var(--spacing-4);
}

.kill-card {
  width: 100%;
  max-width: 30rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.kill-image {
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 204, 0, 0.16);
}

.kill-line {
  margin: 0;
  font-family: 'Chakra Petch', sans-serif;
  font-size: 1.35rem;
  font-weight: 500;
  line-height: 1.35;
  color: #e6e6e6;
  text-align: center;
}

.kill-line strong { color: var(--color-hazard); font-weight: 700; }
.kill-amount { color: var(--color-alert); font-weight: 700; }

.kill-sub {
  margin: 0;
  text-align: center;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.45);
}

.kill-secondary {
  background: none;
  border: none;
  color: var(--color-neon-blue);
  font-family: 'Chakra Petch', sans-serif;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0;
}

.kill-state,
.kill-gone {
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Chakra Petch', sans-serif;
  text-align: center;
}

.kill-card--gone { gap: var(--spacing-6); }
</style>
