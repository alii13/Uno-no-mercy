<template>
  <button
    type="button"
    class="settings-btn"
    @click="settings.open()"
    aria-label="Open settings"
    title="Settings"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
import { useSettingsStore } from '../stores/settingsStore'
const settings = useSettingsStore()
</script>

<style scoped>
.settings-btn {
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 204, 0, 0.3);
  color: #ffcc00;
  width: 44px;  /* touch target ≥ 44px */
  height: 44px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.18s, color 0.18s, background 0.18s, transform 0.18s;
  padding: 0;
}

.settings-btn:hover {
  border-color: #ffcc00;
  background: rgba(255, 204, 0, 0.08);
  transform: rotate(30deg);
}

.settings-btn:active {
  transform: rotate(60deg) scale(0.95);
}

@media (prefers-reduced-motion: reduce) {
  .settings-btn,
  .settings-btn:hover,
  .settings-btn:active { transform: none; }
}
</style>
