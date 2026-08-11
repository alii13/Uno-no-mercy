import { describe, it, expect } from 'vitest'
import { startGame, applyIntent } from './game'

// The client can't derive who ate a penalty stack (the snapshot arrives after
// the turn has advanced and drawStack is back to 0), so the server tags it with
// a STACK_EATEN event carrying the victim and the +N. Guard that contract.
describe('STACK_EATEN signal', () => {
  it('fires with the victim and the stack size when a penalty stack is drawn', () => {
    const { game } = startGame(
      [
        { userId: 'u1', name: 'Alice' },
        { userId: 'u2', name: 'Bob' },
      ],
      'official',
    )
    // Current player (seat 0) faces a pending +8 and chooses to draw it.
    game.engine.drawStack = 8
    const victim = game.engine.players[game.engine.currentPlayerIndex]!.id

    const res = applyIntent(game, victim, { kind: 'DRAW' })

    expect(res.ok).toBe(true)
    const eaten = res.events.find((e) => e.t === 'STACK_EATEN')
    expect(eaten).toEqual({ t: 'STACK_EATEN', playerId: victim, amount: 8 })
    // The stack is consumed.
    expect(game.engine.drawStack).toBe(0)
  })

  it('does not fire on an ordinary draw-until-playable (no stack)', () => {
    const { game } = startGame(
      [
        { userId: 'u1', name: 'Alice' },
        { userId: 'u2', name: 'Bob' },
      ],
      'official',
    )
    const player = game.engine.players[game.engine.currentPlayerIndex]!.id
    const res = applyIntent(game, player, { kind: 'DRAW' })

    expect(res.ok).toBe(true)
    expect(res.events.some((e) => e.t === 'STACK_EATEN')).toBe(false)
  })
})
