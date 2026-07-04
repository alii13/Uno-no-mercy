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

// The "NO MERCY" back, kept in sync with CardBack.vue. Gradient/pattern ids are
// prefixed so they can't collide with the CardBack instances already in the DOM
// (duplicate SVG ids in one document break url() references).
const CARD_BACK_SVG = `<svg width="100%" height="100%" viewBox="0 0 250 350" xmlns="http://www.w3.org/2000/svg" style="display:block">
  <rect x="0" y="0" width="250" height="350" rx="16" ry="16" fill="#111" />
  <rect x="6" y="6" width="238" height="338" rx="12" ry="12" fill="url(#fcPlate)" stroke="#333" stroke-width="2" />
  <path d="M 6 40 L 244 40" stroke="url(#fcHazard)" stroke-width="12" />
  <path d="M 6 310 L 244 310" stroke="url(#fcHazard)" stroke-width="12" />
  <circle cx="125" cy="175" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2" stroke-dasharray="10 5" />
  <circle cx="125" cy="175" r="75" fill="#000" stroke="#ff3333" stroke-width="4" />
  <text x="125" y="165" font-family="Black Ops One, cursive" font-size="42" fill="#ff3333" text-anchor="middle" dominant-baseline="middle">NO</text>
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

    /**
     * Animate a card being drawn from deck to hand
     */
    function animateCardDraw(
        cardEl: HTMLElement,
        fromEl: HTMLElement,
        toEl: HTMLElement,
        options: AnimationOptions = {}
    ): gsap.core.Tween {
        const fromRect = fromEl.getBoundingClientRect()
        const toRect = toEl.getBoundingClientRect()

        // Set initial position at deck. `left`/`top` are static — animation rides on transform.
        gsap.set(cardEl, {
            position: 'fixed',
            left: fromRect.left,
            top: fromRect.top,
            x: 0,
            y: 0,
            zIndex: 1000,
            scale: 1,
            rotation: 0,
            willChange: 'transform'
        })

        return gsap.to(cardEl, {
            x: toRect.left - fromRect.left,
            y: toRect.top - fromRect.top,
            rotation: gsap.utils.random(-5, 5),
            duration: options.duration || 0.5,
            ease: options.ease || 'power2.out',
            onComplete: () => {
                gsap.set(cardEl, { clearProps: 'all' })
            }
        })
    }

    /**
     * Animate a card being played to discard pile
     */
    function animateCardPlay(
        cardEl: HTMLElement,
        toEl: HTMLElement,
        options: AnimationOptions = {}
    ): gsap.core.Tween {
        const cardRect = cardEl.getBoundingClientRect()
        const toRect = toEl.getBoundingClientRect()

        const clone = cardEl.cloneNode(true) as HTMLElement
        spawnFlyingCard(clone)

        const targetX = toRect.left + toRect.width / 2 - cardRect.width / 2
        const targetY = toRect.top + toRect.height / 2 - cardRect.height / 2

        gsap.set(clone, {
            position: 'fixed',
            left: cardRect.left,
            top: cardRect.top,
            width: cardRect.width,
            height: cardRect.height,
            x: 0,
            y: 0,
            zIndex: 1000,
            willChange: 'transform'
        })

        return gsap.to(clone, {
            x: targetX - cardRect.left,
            y: targetY - cardRect.top,
            rotation: gsap.utils.random(-15, 15),
            scale: 0.8,
            duration: options.duration || 0.4,
            ease: options.ease || 'power2.out',
            onComplete: () => {
                despawnFlyingCard(clone)
            }
        })
    }

    /**
     * Animate card flip
     */
    function animateCardFlip(
        cardEl: HTMLElement,
        options: AnimationOptions = {}
    ): gsap.core.Timeline {
        const tl = gsap.timeline()

        tl.to(cardEl, {
            rotationY: 90,
            duration: (options.duration || 0.4) / 2,
            ease: 'power2.in'
        })
            .to(cardEl, {
                rotationY: 0,
                duration: (options.duration || 0.4) / 2,
                ease: 'power2.out'
            })

        return tl
    }

    /**
     * Animate pile "landing" effect - card drops onto pile with bounce
     */
    function animatePileLanding(
        cardEl: HTMLElement,
        options: AnimationOptions = {}
    ): gsap.core.Tween {
        return gsap.from(cardEl, {
            y: -50,
            scale: 1.2,
            rotation: gsap.utils.random(-20, 20),
            duration: options.duration || 0.32,
            ease: 'back.out(1.7)'
        })
    }

    /**
     * Animate shuffle effect on a pile of cards
     */
    function animateShuffle(
        cards: HTMLElement[],
        _options: AnimationOptions = {}
    ): gsap.core.Timeline {
        const tl = gsap.timeline()

        cards.forEach((card, i) => {
            tl.to(card, {
                x: gsap.utils.random(-30, 30),
                y: gsap.utils.random(-10, 10),
                rotation: gsap.utils.random(-15, 15),
                duration: 0.1,
                ease: 'power1.inOut'
            }, i * 0.05)
        })

        tl.to(cards, {
            x: 0,
            y: 0,
            rotation: (i) => i * 0.5,
            duration: 0.3,
            ease: 'power2.out',
            stagger: 0.02
        })

        return tl
    }

    /**
     * Create staggered entrance animation for multiple cards
     */
    function animateCardsEntrance(
        cards: HTMLElement[],
        options: AnimationOptions = {}
    ): gsap.core.Tween {
        return gsap.from(cards, {
            y: 100,
            opacity: 0,
            scale: 0.8,
            rotation: gsap.utils.random(-10, 10),
            duration: options.duration || 0.5,
            ease: options.ease || 'back.out(1.7)',
            stagger: 0.05
        })
    }

    /**
     * Pulse/glow animation for playable cards
     */
    function animatePlayableGlow(cardEl: HTMLElement): gsap.core.Tween {
        return gsap.to(cardEl, {
            boxShadow: '0 0 20px 5px rgba(255, 215, 0, 0.6)',
            duration: 0.8,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1
        })
    }

    /**
     * Stop all animations on an element
     */
    function killAnimations(el: HTMLElement): void {
        gsap.killTweensOf(el)
        gsap.set(el, { clearProps: 'all' })
    }

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
     * Animate multiple cards being dealt sequentially
     * @param deckEl - The deck element to animate from
     * @param targetEl - The target element to animate to
     * @param count - Number of cards to deal
     * @param options - Animation options
     * @param onEachCard - Optional callback after each card animation
     */
    async function animateDealCards(
        deckEl: HTMLElement,
        targetEl: HTMLElement,
        count: number,
        options: { delayBetween?: number } & AnimationOptions = {},
        onEachCard?: (index: number) => void
    ): Promise<void> {
        const delayBetween = options.delayBetween ?? 80

        for (let i = 0; i < count; i++) {
            await animateFlyingCard(deckEl, targetEl, {
                duration: options.duration,
                ease: options.ease
            })
            onEachCard?.(i)
            if (i < count - 1 && delayBetween > 0) {
                await new Promise(r => setTimeout(r, delayBetween))
            }
        }
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
        // Original animation functions
        animateCardDraw,
        animateCardPlay,
        animateCardFlip,
        animatePileLanding,
        animateShuffle,
        animateCardsEntrance,
        animatePlayableGlow,
        killAnimations,
        // UNO-specific flying card animations
        animateFlyingCard,
        animateDealCards,
        animateDrawCardsStaggered,
        killAllFlyingCards,
        // Utilities
        createCardBackElement
    }
}
