<template>
    <span class="badged-name">
        <Badge
            v-if="badge"
            :badge="badge"
            size="mark"
            :points="points"
            :progress="progress"
            :link="link"
            class="bn-badge"
        />
        <span class="bn-name"><slot>{{ name }}</slot></span>
    </span>
</template>

<script setup lang="ts">
import Badge from './Badge.vue'
import type { Badge as BadgeType, Progress } from '../utils/badges'

withDefaults(
    defineProps<{
        /** Plain-text name; or use the default slot for custom markup. */
        name?: string
        badge?: BadgeType
        points?: number
        progress?: Progress
        /** Emblem opens the /badges explainer on click. */
        link?: boolean
    }>(),
    { name: '', badge: undefined, points: undefined, progress: undefined, link: true },
)
</script>

<style scoped>
.badged-name {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    min-width: 0;
}
.bn-badge {
    flex: none;
}
.bn-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
