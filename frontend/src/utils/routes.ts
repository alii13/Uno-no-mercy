/**
 * Minimal URL routing for the two shareable screens (leaderboard, profiles).
 * The app is a screen state machine in App.vue, not a router SPA — this shim
 * only translates between location.pathname and a reactive route so shared
 * links land on the right screen and browser back works.
 */

import { ref, readonly } from 'vue'

export type Route =
    | { name: 'home' }
    | { name: 'leaderboard' }
    | { name: 'badges' }
    | { name: 'profile'; code: string }
    | { name: 'kill'; code: string }

const SHARE_CODE = /^[A-Za-z0-9]{4,32}$/

export function parseRoute(pathname: string): Route {
    if (pathname === '/leaderboard') return { name: 'leaderboard' }
    if (pathname === '/badges') return { name: 'badges' }
    if (pathname.startsWith('/p/')) {
        const code = pathname.slice(3)
        if (SHARE_CODE.test(code)) return { name: 'profile', code }
    }
    // Shared kill card. The edge rewrites this path's meta tags for the link
    // preview; this is the screen the human who clicks it actually lands on.
    if (pathname.startsWith('/k/')) {
        const code = pathname.slice(3)
        if (SHARE_CODE.test(code)) return { name: 'kill', code }
    }
    return { name: 'home' }
}

export function routePath(route: Route): string {
    if (route.name === 'leaderboard') return '/leaderboard'
    if (route.name === 'badges') return '/badges'
    if (route.name === 'profile') return `/p/${route.code}`
    if (route.name === 'kill') return `/k/${route.code}`
    return '/'
}

const current = ref<Route>(
    typeof window === 'undefined' ? { name: 'home' } : parseRoute(window.location.pathname),
)

if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
        current.value = parseRoute(window.location.pathname)
    })
}

export const currentRoute = readonly(current)

/** Navigate to a route, preserving the query string (invite links ride on it). */
export function navigate(route: Route): void {
    current.value = route
    const path = routePath(route) + window.location.search
    if (window.location.pathname !== routePath(route)) {
        window.history.pushState({}, '', path)
    }
}
