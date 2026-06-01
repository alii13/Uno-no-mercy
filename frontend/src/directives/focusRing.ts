import type { Directive } from 'vue'

/**
 * v-focus-ring — opt-in keyboard accessibility ring. Components that own
 * a focusable surface (Button, custom interactive cards, etc.) apply this
 * directive to get a consistent :focus-visible outline driven by the
 * --focus-ring-color token. Native buttons that haven't been migrated to
 * the design system are unaffected.
 *
 * Pairs with the .focus-ring CSS rule in src/style.css.
 */
export const vFocusRing: Directive<HTMLElement> = {
  mounted(el) {
    el.classList.add('focus-ring')
  },
}
