<script setup lang="ts">
import { computed } from 'vue'

type Gap = '0' | '1' | '2' | '3' | '4' | '6' | '8'
type Justify = 'start' | 'center' | 'end' | 'between'
type Align = 'start' | 'center' | 'end' | 'baseline'

const props = withDefaults(
  defineProps<{
    gap?: Gap
    justify?: Justify
    align?: Align
    wrap?: boolean
    as?: string
  }>(),
  {
    gap: '2',
    justify: 'start',
    align: 'center',
    wrap: false,
    as: 'div',
  },
)

const justifyContent = computed(() => {
  switch (props.justify) {
    case 'start':
      return 'flex-start'
    case 'end':
      return 'flex-end'
    case 'between':
      return 'space-between'
    default:
      return 'center'
  }
})

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
    class="cluster"
    :style="{
      gap: `var(--spacing-${gap})`,
      justifyContent,
      alignItems,
      flexWrap: wrap ? 'wrap' : 'nowrap',
    }"
  >
    <slot />
  </component>
</template>

<style scoped>
.cluster {
  display: flex;
}
</style>
