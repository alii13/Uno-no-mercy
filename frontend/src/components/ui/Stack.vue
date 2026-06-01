<script setup lang="ts">
import { computed } from 'vue'

type Gap = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '24'
type Align = 'start' | 'center' | 'end' | 'stretch'

const props = withDefaults(
  defineProps<{
    gap?: Gap
    align?: Align
    as?: string
  }>(),
  {
    gap: '4',
    align: 'stretch',
    as: 'div',
  },
)

const alignItems = computed(() => {
  switch (props.align) {
    case 'start':
      return 'flex-start'
    case 'end':
      return 'flex-end'
    default:
      return props.align
  }
})
</script>

<template>
  <component
    :is="as"
    class="stack"
    :style="{
      gap: `var(--spacing-${gap})`,
      alignItems,
    }"
  >
    <slot />
  </component>
</template>

<style scoped>
.stack {
  display: flex;
  flex-direction: column;
}
</style>
