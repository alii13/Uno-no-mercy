import { describe, it, expect } from 'vitest'
import { buildShareText } from '../share'

describe('buildShareText', () => {
    it('brags in first person on your own profile', () => {
        const text = buildShareText({
            username: 'ShadowStriker',
            wins: 87,
            max_stack_survived: 24,
            isOwn: true,
            url: 'https://uno-no-mercy.com/p/9f3ac21b',
        })
        expect(text).toContain('87 wins')
        expect(text).toContain('+24 stack')
        expect(text).toContain('beat me')
        expect(text).toContain('https://uno-no-mercy.com/p/9f3ac21b')
    })

    it('names the player on someone else\'s profile', () => {
        const text = buildShareText({
            username: 'IronWall',
            wins: 12,
            max_stack_survived: 0,
            isOwn: false,
            url: 'https://uno-no-mercy.com/p/abc123',
        })
        expect(text).toContain('IronWall')
        expect(text).not.toContain('+0 stack')
        expect(text).toContain('https://uno-no-mercy.com/p/abc123')
    })

    it('skips the wins brag at zero wins', () => {
        const text = buildShareText({
            username: 'Fresh', wins: 0, max_stack_survived: 0, isOwn: true,
            url: 'https://uno-no-mercy.com/p/x1y2z3w4',
        })
        expect(text).not.toContain('0 wins')
    })
})
