<template>
  <div class="cs" ref="rootEl">
    <button
      class="cs-trigger"
      type="button"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="open = !open"
    >
      <Globe v-if="!modelValue" :size="14" :stroke-width="2" aria-hidden="true" />
      <span v-else class="cs-flag" aria-hidden="true">{{ flagEmoji(modelValue) }}</span>
      <span class="cs-scope">{{ modelValue ? countryName(modelValue).toUpperCase() : 'GLOBAL' }}</span>
      <span class="cs-count">{{ activeCount.toLocaleString() }}</span>
      <ChevronDown :size="14" :stroke-width="2" aria-hidden="true" />
    </button>

    <div v-if="open" class="cs-scrim" @click="open = false"></div>

    <div v-if="open" ref="menuEl" class="cs-menu">
      <div class="cs-search">
        <Search :size="14" :stroke-width="2" aria-hidden="true" />
        <input
          ref="searchEl"
          v-model="query"
          class="cs-input"
          type="text"
          role="combobox"
          aria-controls="cs-listbox"
          aria-expanded="true"
          :aria-activedescendant="`cs-opt-${activeIndex}`"
          placeholder="Search country"
          aria-label="Search country"
          @keydown="onMenuKey"
        />
      </div>

      <div id="cs-listbox" role="listbox" aria-label="Country">
        <template v-for="(o, i) in options" :key="o.value ?? 'global'">
          <p v-if="o.group" class="cs-group">{{ o.group }}</p>
          <button
            :id="`cs-opt-${i}`"
            class="cs-option"
            :class="{ selected: modelValue === o.value, active: activeIndex === i }"
            role="option"
            type="button"
            tabindex="-1"
            :aria-selected="modelValue === o.value"
            @click="pick(o.value)"
            @mousemove="activeIndex = i"
          >
            <Globe v-if="o.value === null" class="cs-option-icon" :size="16" :stroke-width="2" aria-hidden="true" />
            <span v-else class="cs-option-icon" aria-hidden="true">{{ o.flag }}</span>
            <span class="cs-name">{{ o.label }}</span>
            <span class="cs-players">{{ o.players.toLocaleString() }}</span>
            <Check v-if="modelValue === o.value" :size="14" :stroke-width="2" aria-hidden="true" />
            <span v-else class="cs-check-slot" aria-hidden="true"></span>
          </button>
        </template>
      </div>

      <p v-if="options.length === 1" class="cs-none">No country matches that.</p>
      <p class="cs-note">Only countries with a ranked player are listed.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Globe, ChevronDown, Search, Check } from 'lucide-vue-next'
import { flagEmoji } from '../utils/country'
import { countryName } from '../utils/countryName'
import type { CountryOption } from '../composables/useLeaderboard'

const props = defineProps<{
    modelValue: string | null
    countries: CountryOption[]
    /** Field size of the global board, shown against the Global option. */
    total: number
    /** The viewer's own country, pinned above the rest when it has players. */
    myCountry: string | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string | null): void }>()

const open = ref(false)
const query = ref('')
const rootEl = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)
const activeIndex = ref(0)

const matches = computed(() => {
    const q = query.value.trim().toLowerCase()
    if (!q) return props.countries
    return props.countries.filter(c =>
        countryName(c.country).toLowerCase().includes(q) || c.country.toLowerCase().includes(q),
    )
})

// Derived from the filtered list, not the full one: a search for "brazil"
// must not keep the viewer's own country pinned at the top.
const mine = computed(() =>
    props.myCountry ? matches.value.find(c => c.country === props.myCountry) ?? null : null,
)

// The viewer's own country is pinned above, so it does not repeat in the list.
const rest = computed(() => matches.value.filter(c => c.country !== mine.value?.country))

interface Option {
    value: string | null
    label: string
    players: number
    flag: string
    /** Rendered as a heading above this option when the group starts here. */
    group?: string
}

/** One flat list so a keyboard index maps to exactly one row. */
const options = computed<Option[]>(() => {
    const list: Option[] = [
        { value: null, label: 'Global', players: props.total, flag: '' },
    ]
    if (mine.value) {
        list.push({
            value: mine.value.country,
            label: countryName(mine.value.country),
            players: mine.value.players,
            flag: flagEmoji(mine.value.country),
            group: 'YOUR COUNTRY',
        })
    }
    rest.value.forEach((c, i) => list.push({
        value: c.country,
        label: countryName(c.country),
        players: c.players,
        flag: flagEmoji(c.country),
        group: i === 0 ? 'ALL COUNTRIES' : undefined,
    }))
    return list
})

const activeCount = computed(() => {
    if (!props.modelValue) return props.total
    return props.countries.find(c => c.country === props.modelValue)?.players ?? 0
})

function pick(country: string | null) {
    emit('update:modelValue', country)
    open.value = false
    query.value = ''
}

/** Roving highlight: the input keeps focus, the arrows move the selection. */
function onMenuKey(e: KeyboardEvent) {
    const last = options.value.length - 1
    if (e.key === 'ArrowDown') {
        e.preventDefault()
        activeIndex.value = activeIndex.value >= last ? 0 : activeIndex.value + 1
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        activeIndex.value = activeIndex.value <= 0 ? last : activeIndex.value - 1
    } else if (e.key === 'Home') {
        e.preventDefault()
        activeIndex.value = 0
    } else if (e.key === 'End') {
        e.preventDefault()
        activeIndex.value = last
    } else if (e.key === 'Enter') {
        e.preventDefault()
        const opt = options.value[activeIndex.value]
        if (opt) pick(opt.value)
        return
    } else {
        return
    }
    void scrollActiveIntoView()
}

async function scrollActiveIntoView() {
    await nextTick()
    menuEl.value
        ?.querySelector(`#cs-opt-${activeIndex.value}`)
        ?.scrollIntoView({ block: 'nearest' })
}

// Typing reranks the list, so an index held from the previous list would point
// at an unrelated country.
watch(query, () => { activeIndex.value = 0 })

watch(open, async (isOpen) => {
    if (!isOpen) return
    // Open on whatever is already selected, so Enter is a no-op rather than a
    // surprise jump to Global.
    activeIndex.value = Math.max(0, options.value.findIndex(o => o.value === props.modelValue))
    await nextTick()
    searchEl.value?.focus()
    void scrollActiveIntoView()
})

function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') open.value = false
}

function onClickAway(e: MouseEvent) {
    if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClickAway)
})
onUnmounted(() => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('click', onClickAway)
})
</script>

<style scoped>
.cs { position: relative; }

.cs-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  min-height: 36px;
  padding: 0 var(--spacing-3);
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.025);
  color: var(--color-hazard);
  cursor: pointer;
}

.cs-trigger:hover { border-color: rgba(255, 204, 0, 0.4); }

.cs-flag { font-size: var(--text-sm); line-height: 1; }

.cs-scope {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  font-weight: 700;
  color: var(--text-primary);
}

.cs-count {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.cs-scrim { display: none; }

.cs-menu {
  position: absolute;
  top: calc(100% + var(--spacing-1));
  right: 0;
  z-index: 40;
  width: 320px;
  max-height: 60vh;
  overflow-y: auto;
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: var(--surface-metal-dark, #121416);
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.7);
}

.cs-search {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: 0 var(--spacing-3);
  height: 44px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  color: var(--text-muted);
}

.cs-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.cs-input::placeholder { color: var(--text-muted); }

.cs-group {
  margin: 0;
  padding: var(--spacing-3) var(--spacing-3) var(--spacing-1);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-family: var(--font-mono);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--text-muted);
}

/* Fixed slots for the leading glyph and the trailing check keep every row's
   name and count on the same two lanes, whatever the flag's width. */
.cs-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
  min-height: 44px;
  padding: 0 var(--spacing-3);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--color-hazard);
}

.cs-option:hover,
.cs-option.active { background: rgba(255, 255, 255, 0.06); }
.cs-option.selected { background: rgba(255, 204, 0, 0.07); }
.cs-option.selected.active { background: rgba(255, 204, 0, 0.13); }

.cs-option-icon {
  width: 16px;
  flex: none;
  font-size: var(--text-sm);
  line-height: 1;
}

.cs-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.cs-players {
  width: 56px;
  flex: none;
  text-align: right;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.cs-check-slot { width: 14px; flex: none; }

.cs-none,
.cs-note {
  margin: 0;
  padding: var(--spacing-3);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.cs-note { border-top: 1px solid rgba(255, 255, 255, 0.07); }

@media (max-width: 640px) {
  .cs-scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 39;
    background: rgba(0, 0, 0, 0.6);
  }

  .cs-menu {
    position: fixed;
    top: auto;
    right: var(--spacing-3);
    bottom: var(--spacing-3);
    left: var(--spacing-3);
    width: auto;
    max-height: 70vh;
    border-radius: var(--radius-lg);
  }
}
</style>
