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
 * Style configuration for the UNO card back element
 */
const UNO_CARD_BACK_STYLES = {
    width: '60px',
    height: '84px',
    background: 'linear-gradient(145deg, #2d0808 0%, #1a0505 50%, #0d0202 100%)',
    borderRadius: '6px',
    border: '2px solid #ff4444',
    boxShadow: '0 4px 15px rgba(255,0,0,0.3), inset 0 0 20px rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none'
} as const

/**
 * Create a styled UNO card back element for animations
 */
function createCardBackElement(): HTMLElement {
    const cardEl = document.createElement('div')
    cardEl.className = 'flying-card-anim'
    Object.assign(cardEl.style, UNO_CARD_BACK_STYLES)
    cardEl.innerHTML = '<span style="color:#ff6666;font-size:10px;font-weight:bold;font-family:sans-serif;">UNO</span>'
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

        // Set initial position at deck
        gsap.set(cardEl, {
            position: 'fixed',
            left: fromRect.left,
            top: fromRect.top,
            zIndex: 1000,
            scale: 1,
            rotation: 0
        })

        return gsap.to(cardEl, {
            left: toRect.left,
            top: toRect.top,
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
        document.body.appendChild(clone)

        gsap.set(clone, {
            position: 'fixed',
            left: cardRect.left,
            top: cardRect.top,
            width: cardRect.width,
            height: cardRect.height,
            zIndex: 1000
        })

        return gsap.to(clone, {
            left: toRect.left + toRect.width / 2 - cardRect.width / 2,
            top: toRect.top + toRect.height / 2 - cardRect.height / 2,
            rotation: gsap.utils.random(-15, 15),
            scale: 0.8,
            duration: options.duration || 0.4,
            ease: options.ease || 'power2.out',
            onComplete: () => {
                clone.remove()
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
            duration: options.duration || 0.3,
            ease: 'bounce.out'
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
        document.body.appendChild(cardEl)

        return new Promise<void>((resolve) => {
            gsap.to(cardEl, {
                left: targetRect.left + targetRect.width / 2 - 30,
                top: targetRect.top + targetRect.height / 2 - 42,
                rotation: gsap.utils.random(-10, 10),
                duration: options.duration || 0.3,
                delay: options.delay || 0,
                ease: options.ease || 'power2.out',
                onComplete: () => {
                    cardEl.remove()
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

        for (let i = 0; i < count; i++) {
            const cardEl = createCardBackElement()
            positionAtRect(cardEl, deckRect)
            document.body.appendChild(cardEl)

            gsap.to(cardEl, {
                left: targetRect.left + targetRect.width / 2 - 30,
                top: targetRect.top + targetRect.height / 2 - 42,
                rotation: gsap.utils.random(-10, 10),
                duration: options.duration || 0.3,
                delay: i * staggerDelay,
                ease: options.ease || 'power2.out',
                onComplete: () => {
                    cardEl.remove()
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
        // Utilities
        createCardBackElement
    }
}
