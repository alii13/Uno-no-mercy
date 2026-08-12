<template>
    <section class="climb">
        <div class="climb-head">
            <h3 class="climb-title">YOUR CLIMB</h3>
            <div class="climb-toggle" role="tablist" aria-label="Time range">
                <button
                    v-for="b in BUCKETS"
                    :key="b.key"
                    class="climb-tab"
                    :class="{ active: bucket === b.key }"
                    role="tab"
                    :aria-selected="bucket === b.key"
                    @click="bucket = b.key"
                >{{ b.label }}</button>
            </div>
        </div>

        <p v-if="points.length < 2" class="climb-empty">
            Play a few more games to see your points climb.
        </p>
        <div v-else class="climb-canvas">
            <Line :data="chartData" :options="chartOptions" />
        </div>
    </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Filler,
    Tooltip,
    type ChartData,
    type ChartOptions,
    type ScriptableContext,
} from 'chart.js'
import { pointsTimeline, bucketTimeline, type Bucket, type HistoryRow } from '../utils/pointsHistory'

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const props = withDefaults(
    defineProps<{
        rows: HistoryRow[]
        /** Line/area colour — the player's badge colour. */
        color?: string
    }>(),
    { color: '#ffcc00' },
)

const BUCKETS: { key: Bucket; label: string; max: number }[] = [
    { key: 'day', label: 'DAILY', max: 30 },
    { key: 'week', label: 'WEEKLY', max: 26 },
    { key: 'month', label: 'MONTHLY', max: 12 },
]

const bucket = ref<Bucket>('day')
const timeline = computed(() => pointsTimeline(props.rows))
const points = computed(() => {
    const max = BUCKETS.find(b => b.key === bucket.value)!.max
    return bucketTimeline(timeline.value, bucket.value, max)
})

function withAlpha(hex: string, a: number): string {
    const h = hex.replace('#', '')
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

const chartData = computed<ChartData<'line'>>(() => ({
    labels: points.value.map(p => p.label),
    datasets: [
        {
            data: points.value.map(p => p.points),
            borderColor: props.color,
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: props.color,
            pointHoverBorderColor: '#0a0a0b',
            backgroundColor: (ctx: ScriptableContext<'line'>) => {
                const { chart } = ctx
                const area = chart.chartArea
                if (!area) return 'transparent'
                const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
                g.addColorStop(0, withAlpha(props.color, 0.34))
                g.addColorStop(1, withAlpha(props.color, 0))
                return g
            },
        },
    ],
}))

const chartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 700, easing: 'easeOutCubic' },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(11,11,13,0.96)',
            borderColor: withAlpha(props.color, 0.5),
            borderWidth: 1,
            titleColor: 'rgba(255,255,255,0.6)',
            bodyColor: '#fff',
            padding: 8,
            displayColors: false,
            callbacks: { label: (c) => `${Number(c.parsed.y).toLocaleString()} points` },
        },
    },
    scales: {
        x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
                color: 'rgba(255,255,255,0.4)',
                font: { size: 10, family: 'var(--font-mono, monospace)' },
                maxRotation: 0,
                autoSkipPadding: 16,
            },
        },
        y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            border: { display: false },
            ticks: {
                color: 'rgba(255,255,255,0.4)',
                font: { size: 10, family: 'var(--font-mono, monospace)' },
                maxTicksLimit: 4,
                callback: (v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : `${v}`),
            },
        },
    },
}))
</script>

<style scoped>
.climb {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
}
.climb-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-3);
    flex-wrap: wrap;
}
.climb-title {
    font-family: var(--font-display);
    font-size: var(--text-sm);
    letter-spacing: 0.14em;
    color: var(--text-primary);
    margin: 0;
}
.climb-toggle {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
}
.climb-tab {
    padding: 4px 12px;
    background: none;
    border: none;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    cursor: pointer;
}
.climb-tab.active {
    background: rgba(255, 204, 0, 0.14);
    color: var(--color-hazard, #ffcc00);
}
.climb-canvas {
    position: relative;
    height: 190px;
}
.climb-empty {
    margin: 0;
    padding: var(--spacing-6) 0;
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
}
</style>
