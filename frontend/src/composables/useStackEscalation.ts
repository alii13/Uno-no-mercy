/**
 * Stack-chain visual escalation.
 *
 * When the draw stack grows (+2 → +4 → +6 → +10 chains), the game itself
 * should feel like it's getting angrier. Pure number on the status panel
 * isn't enough — the player needs to FEEL the pressure building.
 *
 * Three escalation layers, gated by stack thresholds:
 *
 *   drawStack >= 4   →  red screen vignette pulse at the edges
 *   drawStack >= 8   →  vignette intensifies + screen shake on each addition
 *   drawStack >= 14  →  full-screen red flash + maximum shake
 *
 * Implementation note: we don't mount any DOM elements here. The
 * vignette is a fixed div managed by this composable. Shake is added
 * via classList on document.body. Both respect prefers-reduced-motion.
 */

import { onUnmounted, ref, watch } from 'vue'

const VIGNETTE_ID = 'uno-stack-vignette'

const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ensureVignetteEl(): HTMLElement | null {
    if (typeof document === 'undefined') return null
    let el = document.getElementById(VIGNETTE_ID) as HTMLElement | null
    if (el) return el
    el = document.createElement('div')
    el.id = VIGNETTE_ID
    Object.assign(el.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: '50',
        opacity: '0',
        transition: 'opacity 0.35s ease-out',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(255, 42, 42, 0.55) 100%)',
        mixBlendMode: 'screen',
        willChange: 'opacity',
    })
    document.body.appendChild(el)
    return el
}

function setVignetteIntensity(intensity: number): void {
    // intensity 0 = invisible, 1 = full red pulse
    const el = ensureVignetteEl()
    if (!el) return
    if (reducedMotion) {
        el.style.opacity = String(Math.min(intensity * 0.5, 0.4))
        return
    }
    el.style.opacity = String(Math.min(intensity, 1))
}

let shakeTimer: number | null = null

function triggerShake(intensity: 'light' | 'heavy'): void {
    if (reducedMotion) return
    if (typeof document === 'undefined') return
    const body = document.body
    if (shakeTimer) window.clearTimeout(shakeTimer)
    body.classList.remove('uno-shake-light', 'uno-shake-heavy')
    // Force a reflow so the same class restarts the animation cleanly
    void body.offsetWidth
    body.classList.add(intensity === 'heavy' ? 'uno-shake-heavy' : 'uno-shake-light')
    shakeTimer = window.setTimeout(() => {
        body.classList.remove('uno-shake-light', 'uno-shake-heavy')
        shakeTimer = null
    }, intensity === 'heavy' ? 600 : 350)
}

// Inject the shake keyframes + classes once at module init so we don't
// depend on game-shared.css picking them up.
function injectShakeStyles(): void {
    if (typeof document === 'undefined') return
    if (document.getElementById('uno-shake-styles')) return
    const style = document.createElement('style')
    style.id = 'uno-shake-styles'
    style.textContent = `
      @keyframes uno-shake-light {
        0%, 100% { transform: translate(0, 0); }
        20% { transform: translate(-2px, 1px); }
        40% { transform: translate(2px, -1px); }
        60% { transform: translate(-1px, 2px); }
        80% { transform: translate(1px, -2px); }
      }
      @keyframes uno-shake-heavy {
        0%, 100% { transform: translate(0, 0); }
        10% { transform: translate(-6px, 2px) rotate(-0.3deg); }
        25% { transform: translate(5px, -3px) rotate(0.4deg); }
        40% { transform: translate(-4px, 4px) rotate(-0.2deg); }
        55% { transform: translate(6px, -2px) rotate(0.3deg); }
        70% { transform: translate(-3px, 3px) rotate(-0.2deg); }
        85% { transform: translate(2px, -1px); }
      }
      .uno-shake-light { animation: uno-shake-light 0.35s ease-in-out; }
      .uno-shake-heavy { animation: uno-shake-heavy 0.6s ease-in-out; }
      @media (prefers-reduced-motion: reduce) {
        .uno-shake-light, .uno-shake-heavy { animation: none !important; }
      }
    `
    document.head.appendChild(style)
}

injectShakeStyles()

export function useStackEscalation(drawStack: { value: number }) {
    const lastStack = ref(0)

    watch(
        () => drawStack.value,
        (now) => {
            const prev = lastStack.value
            lastStack.value = now

            // Tier intensities for the vignette (drives the red pulse at edges)
            if (now >= 14)      setVignetteIntensity(1.0)
            else if (now >= 8)  setVignetteIntensity(0.7)
            else if (now >= 4)  setVignetteIntensity(0.4)
            else                setVignetteIntensity(0)

            // Shake fires only on an INCREASE (so the victim's eat-the-stack
            // resolution, which sets drawStack back to 0, doesn't shake).
            if (now > prev) {
                if (now >= 14) triggerShake('heavy')
                else if (now >= 8) triggerShake('heavy')
                else if (now >= 4) triggerShake('light')
            }
        },
        { immediate: true }
    )

    // The vignette div and shake classes live on document.body, outside the
    // component tree. Exiting the game with a high stack would otherwise leave
    // the red overlay tinting the lobby until some future game dimmed it.
    onUnmounted(() => {
        const el = document.getElementById(VIGNETTE_ID)
        if (el) el.style.opacity = '0'
        if (shakeTimer) {
            window.clearTimeout(shakeTimer)
            shakeTimer = null
        }
        document.body.classList.remove('uno-shake-light', 'uno-shake-heavy')
    })

    return { lastStack }
}
