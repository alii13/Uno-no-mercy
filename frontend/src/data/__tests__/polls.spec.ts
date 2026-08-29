import { describe, it, expect } from 'vitest'
import { nextPoll, POLLS, type Poll } from '../polls'

const poll = (id: string): Poll => ({ id, question: 'q', body: 'b', options: ['Yes', 'No'] })

describe('nextPoll', () => {
    it('asks the first question that is not answered', () => {
        expect(nextPoll([poll('a'), poll('b')], [])?.id).toBe('a')
    })

    it('asks the next one once the first is closed', () => {
        expect(nextPoll([poll('a'), poll('b')], ['a'])?.id).toBe('b')
    })

    // The whole promise of the card: answering or dismissing retires it. A
    // question that comes back is worse than a lost answer.
    it('asks nothing once every question is closed', () => {
        expect(nextPoll([poll('a'), poll('b')], ['a', 'b'])).toBeNull()
    })

    it('ships ids that are unique, since the id is the answered flag', () => {
        expect(new Set(POLLS.map(p => p.id)).size).toBe(POLLS.length)
    })
})
