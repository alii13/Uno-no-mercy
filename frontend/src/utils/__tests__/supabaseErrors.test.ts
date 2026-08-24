import { describe, expect, it } from 'vitest'
import { isFatalSchemaError } from '../supabaseErrors'

describe('isFatalSchemaError', () => {
    it('latches on a schema that cannot answer differently next time', () => {
        expect(isFatalSchemaError({ code: '42703' })).toBe(true) // undefined column
        expect(isFatalSchemaError({ code: '42883' })).toBe(true) // undefined function
        expect(isFatalSchemaError({ code: 'PGRST202' })).toBe(true)
        expect(isFatalSchemaError({ code: 'PGRST204' })).toBe(true)
    })

    it('does not latch on 42501, which means a stale JWT rather than a broken schema', () => {
        expect(isFatalSchemaError({ code: '42501' })).toBe(false)
    })

    it('does not latch on a dropped connection or an unknown failure', () => {
        expect(isFatalSchemaError({ code: '08006' })).toBe(false)
        expect(isFatalSchemaError({})).toBe(false)
        expect(isFatalSchemaError(null)).toBe(false)
        expect(isFatalSchemaError(undefined)).toBe(false)
        expect(isFatalSchemaError({ code: null })).toBe(false)
    })
})
