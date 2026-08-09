import { describe, expect, it } from 'vitest'
import { unlockedBots, nextBot, ladderProgress, isLadderComplete } from '../botLadder'
import { BOT_LADDER } from '@engine/bot'

const ids = BOT_LADDER.map(b => b.id)

describe('unlockedBots', () => {
    it('offers only the first rung to a new player', () => {
        expect(unlockedBots([]).map(b => b.id)).toEqual([ids[0]])
    })

    it('opens the next rung once the current one falls', () => {
        expect(unlockedBots([ids[0]!]).map(b => b.id)).toEqual([ids[0], ids[1]])
    })

    it('does not unlock past a rung that is still standing', () => {
        // Beating a later bot by some other route must not skip the wall.
        const out = unlockedBots([ids[0]!, ids[4]!])
        expect(out.map(b => b.id)).toEqual([ids[0], ids[1]])
    })

    it('returns the whole ladder once every rung is beaten', () => {
        expect(unlockedBots(ids).map(b => b.id)).toEqual(ids)
    })

    it('ignores ids that are not on the ladder', () => {
        expect(unlockedBots(['ghost']).map(b => b.id)).toEqual([ids[0]])
    })
})

describe('nextBot', () => {
    it('offers the first rung to a new player', () => {
        expect(nextBot([]).id).toBe(ids[0])
    })

    it('offers the first unbeaten rung, not the one after the highest beaten', () => {
        expect(nextBot([ids[0]!, ids[2]!]).id).toBe(ids[1])
    })

    it('stays on the last rung once the ladder is done, rather than returning nothing', () => {
        expect(nextBot(ids).id).toBe(ids[ids.length - 1])
    })
})

describe('ladderProgress', () => {
    it('counts only real rungs', () => {
        expect(ladderProgress([ids[0]!, 'ghost'])).toEqual({ beaten: 1, total: 8 })
    })

    it('counts a duplicate once', () => {
        expect(ladderProgress([ids[0]!, ids[0]!])).toEqual({ beaten: 1, total: 8 })
    })
})

describe('isLadderComplete', () => {
    it('is false while anything remains', () => {
        expect(isLadderComplete(ids.slice(0, -1))).toBe(false)
    })

    it('is true when every rung has fallen', () => {
        expect(isLadderComplete(ids)).toBe(true)
    })
})
