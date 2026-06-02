import gsap from 'gsap'

/**
 * Four named tween presets that wrap GSAP with a fixed easing + duration
 * vocabulary. Picks one of snap / soft / bounce / strut per call site; no
 * ad-hoc back.out(3) or elastic.out(1, 0.5) values scattered across the
 * codebase.
 *
 * Honours prefers-reduced-motion and the in-app settings-drawer override
 * (uno:motion-override event dispatched from src/main.ts). When reduced,
 * tweens jump-cut to their final state instead of animating.
 */

const DURATION = {
  snap: 0.18,
  soft: 0.32,
  bounce: 0.5,
  strut: 0.8,
} as const

const EASE = {
  snap: 'power2.out',
  soft: 'power2.inOut',
  bounce: 'back.out(1.7)',
  strut: 'expo.out',
} as const

type Speed = keyof typeof DURATION

let reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener?.('change', (e) => {
      reducedMotion = e.matches
    })
  window.addEventListener('uno:motion-override', ((
    e: CustomEvent<{ reduced: boolean }>,
  ) => {
    reducedMotion = e.detail.reduced
  }) as EventListener)
}

function run(speed: Speed, target: gsap.TweenTarget, vars: gsap.TweenVars) {
  if (reducedMotion) {
    return gsap.set(target, vars)
  }
  return gsap.to(target, {
    duration: DURATION[speed],
    ease: EASE[speed],
    ...vars,
  })
}

export function useMotion() {
  return {
    snap: (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
      run('snap', target, vars),
    soft: (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
      run('soft', target, vars),
    bounce: (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
      run('bounce', target, vars),
    strut: (target: gsap.TweenTarget, vars: gsap.TweenVars) =>
      run('strut', target, vars),
    get reduced() {
      return reducedMotion
    },
  }
}

export type Motion = ReturnType<typeof useMotion>
