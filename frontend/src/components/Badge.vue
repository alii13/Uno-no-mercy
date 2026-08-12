<template>
    <span
        ref="rootEl"
        class="badge"
        :class="[`badge--${size}`, { 'badge--foil': badge.tier >= 9, 'badge--dormant': dormant, 'badge--link': link }]"
        :style="{ '--badge-color': badge.color }"
        :role="link ? 'button' : undefined"
        :tabindex="link ? 0 : undefined"
        :aria-label="ariaLabel"
        @mouseenter="openTip"
        @mouseleave="scheduleClose"
        @focusin="openTip"
        @focusout="scheduleClose"
        @click="onActivate"
        @keydown.enter.prevent="onActivate"
        @keydown.space.prevent="onActivate"
    >
        <span class="badge-emblem" aria-hidden="true">
            <svg class="badge-shield" viewBox="0 0 40 44" preserveAspectRatio="xMidYMid meet">
                <path d="M20 1.5 L37 9 V22 C37 32.5 28.7 39.6 20 42.5 C11.3 39.6 3 32.5 3 22 V9 Z" />
            </svg>
            <Crown v-if="badge.tier === 10" class="badge-crown" :size="crownSize" />
            <span v-else class="badge-tier">{{ badge.tier }}</span>
            <span class="badge-sheen"></span>
        </span>
        <span v-if="showLabel" class="badge-label">{{ badge.title }}</span>
        <span v-if="size === 'full' && progress && progress.next" class="badge-progress">
            <span class="badge-progress-bar">
                <span class="badge-progress-fill" :style="{ width: pctText }"></span>
            </span>
            <span class="badge-progress-label">{{ needed }} to {{ progress.next.title }}</span>
        </span>

        <Teleport to="body">
            <span
                v-if="tipOpen"
                class="badge-tip"
                :style="tipStyle"
                role="tooltip"
                @mouseenter="cancelClose"
                @mouseleave="scheduleClose"
            >
                <span class="badge-tip-name">{{ badge.title }}</span>
                <span class="badge-tip-rank">Rank {{ badge.tier }} of 10</span>
                <span v-if="points != null" class="badge-tip-line">{{ points.toLocaleString() }} points</span>
                <span v-if="progress && progress.next" class="badge-tip-line">{{ needed }} to {{ progress.next.title }}</span>
                <span v-else-if="points != null" class="badge-tip-line badge-tip-apex">Top rank reached</span>
                <button v-if="link" type="button" class="badge-tip-cta" @click="goToBadges">How badges work &rarr;</button>
            </span>
        </Teleport>
    </span>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { Crown } from 'lucide-vue-next'
import type { Badge, Progress } from '../utils/badges'
import { navigate } from '../utils/routes'

const props = withDefaults(
    defineProps<{
        badge: Badge
        size?: 'mark' | 'chip' | 'full'
        /** Show the tier name next to the emblem. Defaults on except for `mark`. */
        label?: boolean
        /** The owner's points — shown in the hover tooltip when provided. */
        points?: number
        /** Progress-to-next, used by the tooltip and the `full` size bar. */
        progress?: Progress
        /** Apex-only: an idle No Mercy King renders dimmed. */
        dormant?: boolean
        /** Make the badge a button that opens the /badges explainer. */
        link?: boolean
    }>(),
    { size: 'chip', label: undefined, points: undefined, progress: undefined, dormant: false, link: false },
)

const showLabel = computed(() => (props.label ?? props.size !== 'mark'))
const crownSize = computed(() => (props.size === 'full' ? 20 : props.size === 'chip' ? 12 : 10))
const pctText = computed(() => `${Math.round((props.progress?.pct ?? 0) * 100)}%`)
const needed = computed(() => (props.progress?.needed ?? 0).toLocaleString())

const ariaLabel = computed(() => {
    const parts = [`${props.badge.title}, rank ${props.badge.tier} of 10`]
    if (props.points != null) parts.push(`${props.points} points`)
    if (props.progress?.next) parts.push(`${props.progress.needed} to ${props.progress.next.title}`)
    if (props.dormant) parts.push('dormant')
    if (props.link) parts.push('opens how badges work')
    return parts.join(', ')
})

// Hover/focus tooltip, teleported to body so it never clips inside tight seats
// or overflow-hidden rows. Positioned from the badge's live rect. A short close
// delay + the tooltip's own hover keep it alive while the pointer travels onto
// it, so its "how badges work" link is actually reachable.
const rootEl = ref<HTMLElement | null>(null)
const tipOpen = ref(false)
const tipStyle = ref<Record<string, string>>({})
let closeTimer: ReturnType<typeof setTimeout> | null = null

function cancelClose() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null }
}
function openTip() {
    cancelClose()
    const el = rootEl.value
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = r.top < 96
    tipStyle.value = {
        '--badge-color': props.badge.color,
        left: `${Math.round(r.left + r.width / 2)}px`,
        top: `${Math.round(below ? r.bottom + 8 : r.top - 8)}px`,
        transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    }
    tipOpen.value = true
}
function scheduleClose() {
    cancelClose()
    closeTimer = setTimeout(() => { tipOpen.value = false }, 160)
}
function goToBadges() {
    cancelClose()
    tipOpen.value = false
    navigate({ name: 'badges' })
}
function onActivate(e: Event) {
    if (!props.link) return
    e.stopPropagation()
    cancelClose()
    tipOpen.value = false
    navigate({ name: 'badges' })
}
onUnmounted(cancelClose)
</script>

<style scoped>
.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
    color: var(--badge-color);
    font-family: var(--font-mono);
    line-height: 1;
    vertical-align: middle;
}
.badge--full {
    flex-direction: column;
    gap: 0.5em;
}

/* Emblem: a solid shield in the tier colour, a metallic rim, the tier number
   (or a crown at the apex), and a sheen that sweeps on hover. */
.badge-emblem {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: var(--emblem-size, 22px);
    height: calc(var(--emblem-size, 22px) * 1.1);
    flex: none;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55));
}
.badge--mark { --emblem-size: 20px; }
.badge--chip { --emblem-size: 22px; }
.badge--full { --emblem-size: 64px; }

.badge-shield {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}
.badge-shield path {
    fill: var(--badge-color);
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.4;
    paint-order: stroke fill;
}

.badge-tier,
.badge-crown {
    position: relative;
    z-index: 1;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
.badge-tier {
    font-family: var(--font-display), var(--font-mono);
    font-weight: 800;
    font-size: calc(var(--emblem-size, 22px) * 0.5);
}
.badge-crown { filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5)); }

/* Diagonal sheen — parked off-emblem, sweeps across on hover. */
.badge-sheen {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(115deg, transparent 30%, rgba(255, 255, 255, 0.75) 50%, transparent 70%);
    background-size: 220% 100%;
    background-position: 140% 0;
    mix-blend-mode: screen;
    opacity: 0;
    pointer-events: none;
    clip-path: polygon(50% 0, 92% 18%, 92% 52%, 50% 98%, 8% 52%, 8% 18%);
}
.badge:hover .badge-sheen {
    opacity: 1;
    transition: background-position 0.55s ease, opacity 0.2s ease;
    background-position: -40% 0;
}

/* Top two tiers get a slow, always-on foil shimmer so they read as earned. */
.badge--foil .badge-shield path {
    stroke: rgba(255, 255, 255, 0.9);
}
.badge--foil .badge-sheen {
    opacity: 0.9;
    animation: badge-foil 3.4s ease-in-out infinite;
}
@keyframes badge-foil {
    0%, 100% { background-position: 140% 0; }
    50% { background-position: -40% 0; }
}

.badge--dormant {
    filter: grayscale(0.7) brightness(0.7);
}
.badge--dormant .badge-sheen { animation: none; opacity: 0; }

.badge-label {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    white-space: nowrap;
}
.badge--full .badge-label {
    font-size: 0.85rem;
    letter-spacing: 0.16em;
}

.badge-progress {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 100%;
    max-width: 180px;
}
.badge-progress-bar {
    width: 100%;
    height: 5px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    overflow: hidden;
}
.badge-progress-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--badge-color);
    box-shadow: 0 0 8px var(--badge-color);
    transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.badge-progress-label {
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.65);
}

.badge--link {
    cursor: pointer;
    border-radius: 6px;
}
.badge--link:hover .badge-emblem,
.badge--link:focus-visible .badge-emblem {
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 6px var(--badge-color));
}
.badge--link:focus-visible {
    outline: 2px solid var(--badge-color);
    outline-offset: 2px;
}

/* Teleported hover tooltip — fixed, above all game/FX layers. --badge-color is
   set inline on the element so color-mix resolves outside the badge subtree. */
.badge-tip {
    position: fixed;
    z-index: 3200;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    min-width: 132px;
    background: rgba(11, 11, 13, 0.97);
    border: 1px solid color-mix(in srgb, var(--badge-color) 50%, transparent);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    font-family: var(--font-mono);
    line-height: 1.35;
    white-space: nowrap;
    pointer-events: auto;
}
.badge-tip-name {
    font-family: var(--font-display), sans-serif;
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    color: var(--badge-color);
    text-transform: uppercase;
}
.badge-tip-rank {
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
}
.badge-tip-line {
    font-size: 0.72rem;
    color: #e6e6e6;
}
.badge-tip-apex { color: var(--badge-color); }
.badge-tip-cta {
    margin-top: 3px;
    padding: 0;
    background: none;
    border: none;
    text-align: left;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    color: rgba(255, 204, 0, 0.85);
    cursor: pointer;
}
.badge-tip-cta:hover { color: #ffcc00; }

@media (prefers-reduced-motion: reduce) {
    .badge-sheen,
    .badge--foil .badge-sheen { animation: none; transition: none; }
    .badge:hover .badge-sheen { transition: opacity 0.2s ease; }
    .badge-progress-fill { transition: none; }
}
</style>
