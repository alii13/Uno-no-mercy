import { describe, it, expect } from 'vitest'
import { parseRoute, routePath } from '../routes'

describe('parseRoute', () => {
    it('maps / to home', () => {
        expect(parseRoute('/')).toEqual({ name: 'home' })
    })

    it('maps /leaderboard to the leaderboard', () => {
        expect(parseRoute('/leaderboard')).toEqual({ name: 'leaderboard' })
    })

    it('maps /p/<code> to a profile', () => {
        expect(parseRoute('/p/9f3ac21b')).toEqual({ name: 'profile', code: '9f3ac21b' })
    })

    it('accepts mixed-case codes as-is', () => {
        expect(parseRoute('/p/Ab12Cd34')).toEqual({ name: 'profile', code: 'Ab12Cd34' })
    })

    it('rejects junk paths to home', () => {
        expect(parseRoute('/leaderboard/extra')).toEqual({ name: 'home' })
        expect(parseRoute('/p/')).toEqual({ name: 'home' })
        expect(parseRoute('/p/has spaces')).toEqual({ name: 'home' })
        expect(parseRoute('/p/way-too-long-to-be-a-share-code-way-too-long')).toEqual({ name: 'home' })
        expect(parseRoute('/anything-else')).toEqual({ name: 'home' })
    })
})

describe('routePath', () => {
    it('is the inverse of parseRoute', () => {
        expect(routePath({ name: 'home' })).toBe('/')
        expect(routePath({ name: 'leaderboard' })).toBe('/leaderboard')
        expect(routePath({ name: 'profile', code: '9f3ac21b' })).toBe('/p/9f3ac21b')
    })
})

