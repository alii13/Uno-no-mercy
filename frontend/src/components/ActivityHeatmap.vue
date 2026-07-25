<template>
  <div class="ah">
    <div class="ah-scroll">
      <div class="ah-grid">
        <div class="ah-daycol" aria-hidden="true">
          <span class="ah-monthslot"></span>
          <span v-for="(d, i) in DAY_LABELS" :key="i" class="ah-daylabel">{{ d }}</span>
        </div>
        <div v-for="(week, w) in grid" :key="w" class="ah-week">
          <span class="ah-monthslot">{{ week.label ?? '' }}</span>
          <span
            v-for="cell in week.cells"
            :key="cell.date"
            class="ah-cell"
            :class="cellClass(cell)"
            :title="tip(cell)"
          ></span>
        </div>
      </div>
    </div>
    <div class="ah-legend">
      <span class="ah-key"><i class="ah-swatch tone-win level-3"></i> WIN DAY</span>
      <span class="ah-key"><i class="ah-swatch tone-loss level-3"></i> LOSS DAY</span>
      <span class="ah-key"><i class="ah-swatch tone-even level-3"></i> SPLIT</span>
      <span class="ah-ramp">
        LESS
        <i class="ah-swatch"></i>
        <i class="ah-swatch tone-win level-1"></i>
        <i class="ah-swatch tone-win level-2"></i>
        <i class="ah-swatch tone-win level-3"></i>
        MORE
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildActivityGrid, type ActivityDay, type ActivityCell } from '../utils/activity'

const props = defineProps<{ activity: ActivityDay[]; weeks?: number }>()

const DAY_LABELS = ['MON', '', 'WED', '', 'FRI', '', '']

const grid = computed(() => buildActivityGrid(props.activity, props.weeks ?? 26, new Date()))

function cellClass(cell: ActivityCell): string[] {
    if (cell.future) return ['future']
    if (!cell.tone) return []
    return [`tone-${cell.tone}`, `level-${cell.level}`]
}

function tip(cell: ActivityCell): string {
    const date = new Date(cell.date + 'T00:00')
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        .toUpperCase()
    if (cell.future || !cell.games) return date
    return `${date} · ${cell.games} GAME${cell.games === 1 ? '' : 'S'} · ${cell.wins}W-${cell.losses}L`
}
</script>

<style scoped>
.ah {
  --ah-gap: 3px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Week columns flex to fill the section, cells stay square — the grid
   spans the same width as every other section instead of stranding
   dead space on wide screens. */
.ah-grid {
  display: flex;
  gap: var(--ah-gap);
  width: 100%;
}

.ah-daycol,
.ah-week {
  display: flex;
  flex-direction: column;
  gap: var(--ah-gap);
}

.ah-daycol { flex: none; }

.ah-week {
  flex: 1;
  min-width: 0;
}

.ah-monthslot {
  height: 12px;
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: visible;
  line-height: 1;
}

.ah-daylabel {
  flex: 1;
  display: flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.5rem;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding-right: var(--spacing-1);
}

.ah-cell {
  width: 100%;
  aspect-ratio: 1 / 1;
}

.ah-cell,
.ah-swatch {
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
}

.ah-cell.future { background: transparent; }

.tone-win.level-1 { background: rgba(0, 255, 102, 0.28); }
.tone-win.level-2 { background: rgba(0, 255, 102, 0.55); }
.tone-win.level-3 { background: #00ff66; box-shadow: 0 0 5px rgba(0, 255, 102, 0.4); }

.tone-loss.level-1 { background: rgba(255, 42, 42, 0.3); }
.tone-loss.level-2 { background: rgba(255, 42, 42, 0.55); }
.tone-loss.level-3 { background: var(--color-alert, #ff2a2a); box-shadow: 0 0 5px rgba(255, 42, 42, 0.4); }

.tone-even.level-1 { background: rgba(255, 204, 0, 0.3); }
.tone-even.level-2 { background: rgba(255, 204, 0, 0.55); }
.tone-even.level-3 { background: var(--color-hazard, #ffcc00); box-shadow: 0 0 5px rgba(255, 204, 0, 0.4); }

.ah-legend {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-2) var(--spacing-4);
  font-family: var(--font-mono);
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.ah-key,
.ah-ramp {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
}

.ah-ramp { margin-left: auto; }

.ah-swatch {
  width: 9px;
  height: 9px;
  box-shadow: none;
}

@media (max-width: 480px) {
  .ah { --ah-cell: 9px; }
}
</style>
