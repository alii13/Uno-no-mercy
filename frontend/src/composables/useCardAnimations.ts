/**
 * GSAP-based card animation composable for UNO No Mercy
 * Handles card movements, flips, and pile animations
 */

import gsap from 'gsap'

export interface AnimationOptions {
    duration?: number
    ease?: string
    delay?: number
}

// ============================================================
// UNO Card Back Element Factory
// ============================================================

/**
 * Style configuration for the UNO card back element. Mirrors CardBack.vue's
 * shell so the flying clone reads as the same physical card that leaves the deck.
 */
const UNO_CARD_BACK_STYLES = {
    width: '60px',
    height: '84px',
    borderRadius: '6px',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: '0 10px 20px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
    pointerEvents: 'none'
} as const

// The "OPEN MERCY" back, kept in sync with CardBack.vue. Gradient/pattern ids are
// prefixed so they can't collide with the CardBack instances already in the DOM
// (duplicate SVG ids in one document break url() references).
const CARD_BACK_SVG = `<svg width="100%" height="100%" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <rect x="0" y="0" width="250" height="350" rx="16" ry="16" fill="#111" />
  <rect x="6" y="6" width="238" height="338" rx="12" ry="12" fill="url(#fcPlate)" stroke="#333" stroke-width="2" />
  <path d="M 6 40 L 244 40" stroke="url(#fcHazard)" stroke-width="12" />
  <path d="M 6 310 L 244 310" stroke="url(#fcHazard)" stroke-width="12" />
  <circle cx="125" cy="175" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-dasharray="10 5" />
  <circle cx="125" cy="175" r="75" fill="#000" stroke="#ff3333" stroke-width="4" />
  <text x="125" y="165" font-family="Black Ops One, cursive" font-size="42" fill="#ff3333" text-anchor="middle" dominant-baseline="middle">OPEN</text>
  <text x="125" y="205" font-family="Black Ops One, cursive" font-size="32" fill="#e6e6e6" text-anchor="middle" dominant-baseline="middle">MERCY</text>
  <defs>
    <linearGradient id="fcPlate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2a2a2a" />
      <stop offset="100%" style="stop-color:#1a1a1a" />
    </linearGradient>
    <pattern id="fcHazard" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect x="0" y="0" width="10" height="20" fill="#ffcc00" />
      <rect x="10" y="0" width="10" height="20" fill="#000" />
    </pattern>
  </defs>
</svg>`

const CARD_BACK_SCRATCHES = '<div style="position:absolute;inset:0;pointer-events:none;opacity:0.5;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.03) 0px,rgba(255,255,255,0.03) 1px,transparent 1px,transparent 10px);"></div>'

/**
 * Create a styled UNO card back element for animations
 */
function createCardBackElement(): HTMLElement {
    const cardEl = document.createElement('div')
    cardEl.className = 'flying-card-anim'
    Object.assign(cardEl.style, UNO_CARD_BACK_STYLES)
    cardEl.innerHTML = CARD_BACK_SVG + CARD_BACK_SCRATCHES
    return cardEl
}

/**
 * Position an element at a fixed location
 */
function positionAtRect(el: HTMLElement, rect: DOMRect, zIndex = 2000): void {
    Object.assign(el.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        zIndex: String(zIndex)
    })
}

// Flying clones are appended to document.body, outside any component tree —
// if the game view unmounts mid-flight (player leaves during a big draw) the
// tweens and their card-back nodes would keep sailing over the lobby. Track
// the live ones so the view can kill them on unmount.
const activeFlyingCards = new Set<HTMLElement>()

function spawnFlyingCard(el: HTMLElement): void {
    activeFlyingCards.add(el)
    document.body.appendChild(el)
}

function despawnFlyingCard(el: HTMLElement): void {
    activeFlyingCards.delete(el)
    el.remove()
}

function killAllFlyingCards(): void {
    for (const el of activeFlyingCards) {
        gsap.killTweensOf(el)
        el.remove()
    }
    activeFlyingCards.clear()
}

// ============================================================
// Main composable
// ============================================================

export function useCardAnimations() {

    // ============================================================
    // UNO-specific animations (flying card from deck to hand)
    // ============================================================

    /**
     * Animate a single card being dealt from deck to target
     * Creates a temporary card element, animates it, then removes it
     */
    function animateFlyingCard(
        deckEl: HTMLElement,
        targetEl: HTMLElement,
        options: AnimationOptions = {}
    ): Promise<void> {
        const deckRect = deckEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()

        const cardEl = createCardBackElement()
        positionAtRect(cardEl, deckRect)
        spawnFlyingCard(cardEl)

        const targetLeft = targetRect.left + targetRect.width / 2 - 30
        const targetTop = targetRect.top + targetRect.height / 2 - 42

        gsap.set(cardEl, { x: 0, y: 0, willChange: 'transform' })

        return new Promise<void>((resolve) => {
            gsap.to(cardEl, {
                x: targetLeft - deckRect.left,
                y: targetTop - deckRect.top,
                rotation: gsap.utils.random(-10, 10),
                duration: options.duration || 0.3,
                delay: options.delay || 0,
                ease: options.ease || 'power2.out',
                onComplete: () => {
                    despawnFlyingCard(cardEl)
                    resolve()
                }
            })
        })
    }

    /**
     * Animate multiple cards being drawn with stagger (non-blocking)
     * Cards animate with delay between each, but function returns immediately
     */
    function animateDrawCardsStaggered(
        deckEl: HTMLElement,
        targetEl: HTMLElement,
        count: number,
        options: { staggerDelay?: number } & AnimationOptions = {},
        onEachComplete?: (index: number) => void
    ): void {
        const deckRect = deckEl.getBoundingClientRect()
        const targetRect = targetEl.getBoundingClientRect()
        const staggerDelay = options.staggerDelay ?? 0.12

        const targetLeft = targetRect.left + targetRect.width / 2 - 30
        const targetTop = targetRect.top + targetRect.height / 2 - 42

        for (let i = 0; i < count; i++) {
            const cardEl = createCardBackElement()
            positionAtRect(cardEl, deckRect)
            spawnFlyingCard(cardEl)
            gsap.set(cardEl, { x: 0, y: 0, willChange: 'transform' })

            gsap.to(cardEl, {
                x: targetLeft - deckRect.left,
                y: targetTop - deckRect.top,
                rotation: gsap.utils.random(-10, 10),
                duration: options.duration || 0.3,
                delay: i * staggerDelay,
                ease: options.ease || 'power2.out',
                onComplete: () => {
                    despawnFlyingCard(cardEl)
                    onEachComplete?.(i)
                }
            })
        }
    }

    return {
        // Flying card animations (deck ↔ hand ↔ discard)
        animateFlyingCard,
        animateDrawCardsStaggered,
        killAllFlyingCards,
        // Utilities
        createCardBackElement
    }
}
