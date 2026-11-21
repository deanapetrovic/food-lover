import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calls, result, from } = vi.hoisted(() => {
  const calls: Array<[string, unknown[]]> = []
  const result: { data: unknown; error: unknown } = { data: null, error: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve(result)
      return (...args: unknown[]) => { calls.push([String(prop), args]); return chain }
    },
  })
  return { calls, result, from: vi.fn(() => chain) }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import { getMyDisplayName, setMyDisplayName } from './profile'

const call = (name: string) => calls.filter(([n]) => n === name).map(([, a]) => a)

beforeEach(() => { calls.length = 0; result.data = null; result.error = null; from.mockClear() })

describe('getMyDisplayName', () => {
  it('reads the name from your profile row', async () => {
    result.data = { display_name: 'Maja' }
    expect(await getMyDisplayName('u1')).toBe('Maja')
    expect(from).toHaveBeenCalledWith('profiles')
    expect(call('eq')).toEqual([['id', 'u1']])
  })
  it('returns null when there is no name or no row', async () => {
    result.data = { display_name: null }
    expect(await getMyDisplayName('u1')).toBeNull()
    result.data = null
    expect(await getMyDisplayName('u1')).toBeNull()
  })
})

describe('setMyDisplayName', () => {
  it('saves a trimmed name on your own row', async () => {
    expect(await setMyDisplayName('u1', '  Maja P.  ')).toBe('Maja P.')
    expect(call('update')).toEqual([[{ display_name: 'Maja P.' }]])
    expect(call('eq')).toEqual([['id', 'u1']])
  })
  it('clears the name when blank', async () => {
    expect(await setMyDisplayName('u1', '   ')).toBeNull()
    expect(call('update')).toEqual([[{ display_name: null }]])
  })
  it('caps the length at 80', async () => {
    const saved = await setMyDisplayName('u1', 'x'.repeat(200))
    expect(saved).toHaveLength(80)
  })
  it('throws database errors', async () => {
    result.error = new Error('rls')
    await expect(setMyDisplayName('u1', 'x')).rejects.toThrow('rls')
  })
})
