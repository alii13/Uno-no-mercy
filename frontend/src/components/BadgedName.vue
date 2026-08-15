<template>
    <span class="badged-name">
        <!-- Presence rides on the shield, so one component puts the same mark
             in every place a badge appears. Without a badge there is nothing
             to sit on, and the dot stands beside the name instead. -->
        <Badge
            v-if="badge"
            :badge="badge"
            size="mark"
            :points="points"
            :progress="progress"
            :link="link"
            :presence="presence"
            class="bn-badge"
        />
        <PresenceDot v-else-if="presence !== undefined" :last-seen-at="presence" class="bn-dot" />
        <span class="bn-name"><slot>{{ name }}</slot></span>
    </span>
</template>

<script setup lang="ts">
import Badge from './Badge.vue'
import PresenceDot from './PresenceDot.vue'
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
        /**
         * Last-seen timestamp, or null for a player who never checked in.
         * Leave it undefined to render no dot at all - which is what a
         * surface without presence data should do, rather than showing
         * everyone as offline.
         */
        presence?: string | null
    }>(),
    { name: '', badge: undefined, points: undefined, progress: undefined, link: true, presence: undefined },
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
.bn-dot {
    margin-left: 0.15em;
}
.bn-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
