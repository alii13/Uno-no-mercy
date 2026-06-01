/**
 * Dealer intro — a brief ceremony before the deal animation starts.
 *
 * The opening of a game is the FIRST impression. Without ceremony it reads
 * as "cards just exist." Hearthstone-tier games invest 1-2 seconds of
 * choreography here. We can't do voice acting on a free CC0 budget, but a
 * visible deck riffle + a synchronized "DEAL" title sweep gets ~80% of
 * the feel.
 *
 * Sequence (~1.0s total):
 *   0.0s  – 0.05s   title swoops in from off-screen
 *   0.05s – 0.75s   deck cards riffle (shuffle motion) under the title
 *   0.75s – 1.0s    title fades, deck settles, return → caller starts the deal
 *
 * Respects prefers-reduced-motion: returns immediately, no riffle, no title.
 * Robust to missing DOM (returns silently if the deck or title slot aren't
 * mounted yet).
 */

import gsap from 'gsap'

const TITLE_ID = 'uno-dealer-intro-title'
const TITLE_TEXT = 'DEAL'

const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function ensureTitleEl(): HTMLElement | null {
    if (typeof document === 'undefined') return null
    let el = document.getElementById(TITLE_ID) as HTMLElement | null
    if (el) return el
    el = document.createElement('div')
    el.id = TITLE_ID
    el.textContent = TITLE_TEXT
    Object.assign(el.style, {
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%) scale(0.8)',
        pointerEvents: 'none',
        zIndex: '60',
        opacity: '0',
        color: '#ffcc00',
        fontFamily: "'Black Ops One', 'Impact', sans-serif",
        fontSize: 'clamp(4rem, 12vw, 9rem)',
        letterSpacing: '0.5em',
        textShadow: '0 0 30px rgba(255, 204, 0, 0.55), 0 0 4px rgba(255, 204, 0, 0.9)',
        textTransform: 'uppercase',
        userSelect: 'none',
    })
    document.body.appendChild(el)
    return el
}

function removeTitle(): void {
    document.getElementById(TITLE_ID)?.remove()
}

/**
 * Plays the dealer intro. Resolves when finished. If reduced motion is on,
 * resolves immediately so the deal starts without delay.
 */
export async function playDealerIntro(): Promise<void> {
    if (reducedMotion) return

    // Pull the deck card-back elements rendered by CardPile via BattlePit.
    // Selector is the same in both SP (GameView) and MP (MultiplayerGameView)
    // since both wrap CardPile in a .draw-station.
    const drawCards = document.querySelectorAll('.draw-station .stacked-card')
    if (drawCards.length === 0) return

    const cards = Array.from(drawCards) as HTMLElement[]

    const title = ensureTitleEl()
    const tl = gsap.timeline()

    // 1. Title swoops in
    if (title) {
        tl.to(title, {
            opacity: 1,
            scale: 1,
            duration: 0.25,
            ease: 'back.out(2)',
        })
    }

    // 2. Deck riffle — each card pops out, then snaps back into the stack.
    //    Stagger across cards so it reads as a wave, not a synchronized shake.
    tl.to(cards, {
        x: () => gsap.utils.random(-18, 18),
        y: () => gsap.utils.random(-8, 8),
        rotation: () => gsap.utils.random(-12, 12),
        duration: 0.12,
        ease: 'power1.inOut',
        stagger: { each: 0.025, from: 'random' },
    }, 0.05)

    tl.to(cards, {
        x: 0,
        y: 0,
        rotation: (i: number) => i * 0.4,
        duration: 0.3,
        ease: 'back.out(1.6)',
        stagger: 0.015,
    }, '>0.05')

    // 3. Title fades + scales out
    if (title) {
        tl.to(title, {
            opacity: 0,
            scale: 1.4,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: removeTitle,
        }, '>-0.05')
    }

    await tl
}
