<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'

/**
 * Modal shell — centered overlay with focus management, Esc-to-close,
 * backdrop-click (opt-in), reduced-motion path. Each consuming modal keeps
 * its own bespoke container styling (color picker neon-yellow border, etc.)
 * and just gets the shared overlay + behavior baseline.
 *
 * Layout: full-viewport flex centre + scrollable container so tall content
 * stays usable on small screens. Teleported to body to escape any ancestor
 * containing-block from transforms/filters/contain — same fix as the
 * sticky CTA in Phase 1.
 */

const props = withDefaults(
  defineProps<{
    open?: boolean
    closeOnBackdrop?: boolean
    closeOnEsc?: boolean
    ariaLabel?: string
  }>(),
  {
    open: true,
    closeOnBackdrop: false,
    closeOnEsc: true,
  },
)

const emit = defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLElement | null>(null)
const lastFocused = ref<HTMLElement | null>(null)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.closeOnEsc && props.open) {
    emit('close')
  }
}

function onBackdropClick(e: MouseEvent) {
  if (!props.closeOnBackdrop) return
  if (e.target === e.currentTarget) emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      lastFocused.value = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      requestAnimationFrame(() => {
        const focusable = containerRef.value?.querySelector<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )
        focusable?.focus()
      })
    } else {
      document.removeEventListener('keydown', onKeydown)
      lastFocused.value?.focus?.()
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div
        v-if="open"
        class="modal-overlay"
        :aria-label="ariaLabel"
        role="dialog"
        aria-modal="true"
        @click="onBackdropClick"
      >
        <div ref="containerRef" class="modal-shell" @click.stop>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--spacing-4);
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--spacing-2);
  }
}

.modal-shell {
  max-height: calc(100vh - var(--spacing-8));
  max-height: calc(100dvh - var(--spacing-8));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-soft) var(--ease-soft);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active {
    transition: none;
  }
}
</style>
