import { describe, it, expect, vi } from 'vitest'
import { useGameFx } from '../useGameFx'

// The bus is the contract every FX effect rides on: a missed delivery or a
// leaked handler silently breaks (or double-fires) animations. Guard it.
describe('useGameFx bus', () => {
  it('delivers an emit to a subscriber and stops after unsubscribe', () => {
    const { on, emit } = useGameFx()
    const seen: number[] = []
    const off = on('heat', ({ level }) => seen.push(level))

    emit('heat', { level: 0.5 })
    emit('heat', { level: 0.9 })
    off()
    emit('heat', { level: 0.1 }) // must not reach the handler

    expect(seen).toEqual([0.5, 0.9])
  })

  it('fans out to every subscriber of the same event', () => {
    const { on, emit } = useGameFx()
    const a = vi.fn()
    const b = vi.fn()
    on('heat', a)
    on('heat', b)

    emit('heat', { level: 1 })

    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })
})
