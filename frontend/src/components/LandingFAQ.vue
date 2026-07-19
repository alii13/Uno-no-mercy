<template>
  <section class="faq-section" aria-labelledby="faq-heading">
    <div class="faq-inner">
      <h2 id="faq-heading" class="faq-heading">
        <span class="faq-heading-line">FREQUENTLY ASKED</span>
        <span class="faq-heading-accent">QUESTIONS</span>
      </h2>

      <div class="faq-list">
        <details v-for="(item, i) in faqs" :key="i" class="faq-item">
          <summary class="faq-q">
            <span>{{ item.q }}</span>
            <span class="faq-icon" aria-hidden="true"></span>
          </summary>
          <p class="faq-a">{{ item.a }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Keep this list in sync with the FAQPage JSON-LD in index.html — the
// structured data must match the visible questions and answers exactly.
const faqs = [
  {
    q: 'Can I play UNO No Mercy online?',
    a: 'Yes. UNO No Mercy runs directly in your web browser at uno-no-mercy.com. There is nothing to install - open the page and play.',
  },
  {
    q: 'Is the game free?',
    a: 'Yes, it is completely free to play. No purchase is required to play a full game.',
  },
  {
    q: 'Do I need to download anything?',
    a: 'No. It is a browser game that works on any modern desktop or mobile browser. No app or download is needed.',
  },
  {
    q: 'Do I need an account?',
    a: 'No account is required to play. You can jump in as a guest. Creating a free account is optional and only used to save your stats.',
  },
  {
    q: 'Can I play with friends?',
    a: 'Yes. Create a multiplayer room, share the room code or invite link, and your friends join the same game in real time.',
  },
  {
    q: 'Can I play against AI?',
    a: "Yes. You can start a single-player game against AI opponents whenever you don't have other players.",
  },
  {
    q: 'How many players are supported?',
    a: 'Each game supports 2 to 10 players.',
  },
  {
    q: 'Does the game work on mobile?',
    a: 'Yes. It works on iPhone, Android, and desktop browsers, with a layout built for touch screens.',
  },
  {
    q: 'Does the game include Draw 6 and Draw 10?',
    a: 'Yes. Both Draw 6 and Draw 10 cards are included, along with the other No Mercy action cards.',
  },
  {
    q: 'Is stacking supported?',
    a: 'Yes. Draw cards stack onto each other, so a Draw 2 can build into a much larger penalty before someone finally picks up.',
  },
  {
    q: 'What is the 25-card Mercy Rule?',
    a: 'If a player\'s hand ever reaches 25 or more cards, that player is eliminated from the game. It is the "no mercy" twist that ends runaway hands.',
  },
  {
    q: 'Is this an official UNO or Mattel game?',
    a: 'No. This is an independent, fan-made project. It is not affiliated with, endorsed by, or associated with Mattel or the official UNO brand.',
  },
]
</script>

<style scoped>
.faq-section {
  background: var(--bg-concrete);
  color: var(--text-primary);
  padding: var(--spacing-16) var(--spacing-4);
  border-top: 1px solid rgba(255, 204, 0, 0.08);
}

.faq-inner {
  max-width: 760px;
  margin: 0 auto;
}

.faq-heading {
  font-family: var(--font-display);
  text-align: center;
  line-height: 1;
  margin: 0 0 var(--spacing-8);
  letter-spacing: 0.04em;
}

.faq-heading-line {
  display: block;
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  color: var(--text-primary);
}

.faq-heading-accent {
  display: block;
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  color: var(--color-alert);
  text-shadow: 0 0 24px rgba(255, 42, 42, 0.4);
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.faq-item {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: var(--bg-concrete-light);
  overflow: hidden;
}

.faq-item[open] {
  border-color: rgba(0, 243, 255, 0.35);
}

.faq-q {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  cursor: pointer;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  list-style: none;
  min-height: 44px;
}

.faq-q::-webkit-details-marker {
  display: none;
}

.faq-q:hover {
  color: var(--color-neon-blue);
}

.faq-icon {
  position: relative;
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

.faq-icon::before,
.faq-icon::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  background: currentColor;
  transform: translate(-50%, -50%);
}

.faq-icon::before {
  width: 14px;
  height: 2px;
}

.faq-icon::after {
  width: 2px;
  height: 14px;
  transition: transform var(--duration-snap, 0.2s) ease;
}

.faq-item[open] .faq-icon::after {
  transform: translate(-50%, -50%) scaleY(0);
}

.faq-a {
  margin: 0;
  padding: 0 var(--spacing-4) var(--spacing-4);
  font-family: var(--font-body);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .faq-icon::after {
    transition: none;
  }
}
</style>
