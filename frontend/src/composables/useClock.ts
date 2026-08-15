/**
 * Two things every ageing surface needs, and neither is worth a timer of its
 * own.
 *
 * `useNow` is one interval for the whole app. Before this, each presence dot
 * ran its own - fifty on a full leaderboard, plus one each in the profile, the
 * friends panel and the invite toast, all waking up to agree on what time it
 * is.
 *
 * `usePoll` is the other half of the same problem: a screen that stays open
 * needs to re-read, and a hidden tab does not. Presence decays on the clock,
 * but only a fresh read can bring a dot back to green.
 */

import { onMounted, onUnmounted, ref } from 'vue'

/** Slower than a second, faster than the shortest presence threshold. */
const TICK_MS = 30_000

const now = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | null = null
let tickerUsers = 0

/** A shared clock. Every caller gets the same ref, and the interval exists
 *  only while at least one component is mounted. */
export function useNow() {
    onMounted(() => {
        if (++tickerUsers === 1) {
            now.value = Date.now()
            ticker = setInterval(() => { now.value = Date.now() }, TICK_MS)
        }
    })
    onUnmounted(() => {
        if (--tickerUsers === 0 && ticker) {
            clearInterval(ticker)
            ticker = null
        }
    })
    return now
}

/**
 * Run `fn` on an interval while the component is mounted and the tab is
 * visible, and once immediately when the tab comes back.
 *
 * The visibility rule matters twice over: a background tab asking for data
 * nobody can see is waste, and the moment a player returns is exactly when
 * what they are looking at is most out of date.
 */
export function usePoll(fn: () => void, intervalMs: number) {
    let timer: ReturnType<typeof setInterval> | null = null

    const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible'
    const run = () => { if (visible()) fn() }
    const onVisibility = () => { if (visible()) fn() }

    onMounted(() => {
        timer = setInterval(run, intervalMs)
        if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
    })
    onUnmounted(() => {
        if (timer) { clearInterval(timer); timer = null }
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    })
}
