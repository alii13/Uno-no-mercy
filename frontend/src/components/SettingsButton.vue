<template>
  <button
    type="button"
    class="settings-btn"
    @click="settings.open()"
    aria-label="Open settings"
    title="Settings"
  >
    <Settings :size="20" :stroke-width="2" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { Settings } from 'lucide-vue-next'
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
