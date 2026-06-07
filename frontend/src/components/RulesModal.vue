<template>
  <Modal :open="true" :close-on-backdrop="true" aria-label="How to play" @close="$emit('close')">
    <div class="rules-card">
      <header class="rules-header">
        <h2 class="rules-title">HOW TO PLAY</h2>
        <button class="rules-close" aria-label="Close" @click="$emit('close')">✕</button>
      </header>

      <p class="rules-goal">
        Be the first to empty your hand. UNO No Mercy is brutal — penalties stack high
        and if you ever hold <strong>25 cards</strong>, you're <strong>eliminated</strong>.
      </p>

      <section class="rules-section">
        <h3 class="rules-subhead">BASICS</h3>
        <ul class="rules-list">
          <li>Play a card that matches the <strong>color</strong> or the <strong>number/symbol</strong> on the pile.</li>
          <li>Can't play? <strong>Draw</strong> from the deck. If the drawn card is playable it plays automatically.</li>
          <li>Down to one card? <strong>Call UNO!</strong> — forget and you're penalized.</li>
        </ul>
      </section>

      <section class="rules-section">
        <h3 class="rules-subhead">THE NO MERCY CARDS</h3>
        <ul class="rules-cards">
          <li><span class="chip chip-num">+2 +4</span> <span><strong>Draw cards.</strong> Stack them on the next player — they draw the whole pile or stack their own to pass it on.</span></li>
          <li><span class="chip chip-danger">+6 +10</span> <span><strong>Wild draws.</strong> Massive penalties that send a hand spiralling toward the 25-card mercy limit.</span></li>
          <li><span class="chip">SKIP</span> <span>Skip the next player's turn.</span></li>
          <li><span class="chip">REV</span> <span>Reverse the direction of play.</span></li>
          <li><span class="chip">SKIP ALL</span> <span><strong>Skip everyone</strong> — you immediately play again.</span></li>
          <li><span class="chip">DISCARD ALL</span> <span>Dump <strong>every card of that color</strong> from your hand at once.</span></li>
          <li><span class="chip chip-num">7</span> <span><strong>Swap hands</strong> with any player you choose.</span></li>
          <li><span class="chip chip-num">0</span> <span><strong>Everyone passes</strong> their whole hand in the direction of play.</span></li>
          <li><span class="chip chip-wild">ROULETTE</span> <span><strong>Wild Color Roulette.</strong> The victim draws until they hit the color you pick. Could be one card — could be ten.</span></li>
          <li><span class="chip chip-wild">WILD +4 REV</span> <span>Reverse direction <em>and</em> hit the next player with +4.</span></li>
        </ul>
      </section>

      <section class="rules-section">
        <h3 class="rules-subhead">STACKING RULES</h3>
        <ul class="rules-list">
          <li><strong>Official</strong> — stack a draw card only on an equal or higher value.</li>
          <li><strong>House</strong> — wild draws (+4/+6/+10) stack on anything; colored draws stay strict.</li>
          <li><strong>Casual</strong> — anything goes, any draw stacks on any draw.</li>
        </ul>
      </section>

      <button class="rules-got-it" @click="$emit('close')">GOT IT</button>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './ui/Modal.vue'

defineEmits<{ close: [] }>()
</script>

<style scoped>
.rules-card {
  background: #111;
  border: 2px solid var(--color-hazard);
  box-shadow: 0 0 50px rgba(255, 204, 0, 0.15);
  width: min(560px, 94vw);
  padding: var(--spacing-5);
  color: var(--text-primary);
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px dashed var(--color-hazard-dim, rgba(255, 204, 0, 0.3));
  padding-bottom: var(--spacing-3);
  margin-bottom: var(--spacing-4);
}

.rules-title {
  font-family: var(--font-display);
  font-size: 1.6rem;
  letter-spacing: 0.15em;
  color: var(--color-hazard);
  margin: 0;
}

.rules-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 1.1rem;
  cursor: pointer;
  padding: var(--spacing-2);
  line-height: 1;
}
.rules-close:hover { color: var(--text-primary); }

.rules-goal {
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0 0 var(--spacing-4);
  color: var(--text-secondary);
}
.rules-goal strong { color: var(--color-alert); }

.rules-section { margin-bottom: var(--spacing-4); }

.rules-subhead {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  color: var(--color-neon-blue, #2ad4ff);
  margin: 0 0 var(--spacing-2);
}

.rules-list {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--text-secondary);
}
.rules-list strong { color: var(--text-primary); }

.rules-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--text-secondary);
}
.rules-cards li {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: var(--spacing-3);
  align-items: start;
}
.rules-cards strong { color: var(--text-primary); }

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-align: center;
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.15);
  min-height: 24px;
}
.chip-num { background: rgba(42, 212, 255, 0.18); border-color: rgba(42, 212, 255, 0.4); }
.chip-danger { background: rgba(255, 42, 42, 0.18); border-color: rgba(255, 42, 42, 0.45); color: var(--color-alert); }
.chip-wild {
  background: linear-gradient(135deg, rgba(255,42,42,0.25), rgba(42,212,255,0.25));
  border-color: rgba(255, 204, 0, 0.4);
}

.rules-got-it {
  width: 100%;
  margin-top: var(--spacing-2);
  padding: var(--spacing-3);
  background: var(--color-hazard);
  color: #111;
  border: none;
  font-family: var(--font-display);
  font-size: 1rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: filter 0.15s;
}
.rules-got-it:hover { filter: brightness(1.1); }

@media (max-width: 480px) {
  .rules-card { padding: var(--spacing-4); }
  .rules-title { font-size: 1.3rem; }
  .rules-cards li { grid-template-columns: 74px 1fr; gap: var(--spacing-2); }
}
</style>
