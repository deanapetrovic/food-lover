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

import { getPlace, listDishesAtPlace } from './places'

const call = (name: string) => calls.filter(([n]) => n === name).map(([, a]) => a)

beforeEach(() => {
  calls.length = 0
  result.data = null
  result.error = null
  from.mockClear()
})

describe('getPlace', () => {
  it('fetches one place by id', async () => {
    result.data = { id: 'p1', name: 'Zlatni' }
    expect(await getPlace('p1')).toEqual({ id: 'p1', name: 'Zlatni' })
    expect(from).toHaveBeenCalledWith('places')
    expect(call('eq')).toEqual([['id', 'p1']])
    expect(call('maybeSingle')).toHaveLength(1)
  })

  it('returns null when the place is missing or hidden by row-level security', async () => {
    result.data = null
    expect(await getPlace('nope')).toBeNull()
  })

  it('throws the database error', async () => {
    result.error = new Error('boom')
    await expect(getPlace('p1')).rejects.toThrow('boom')
  })
})

describe('listDishesAtPlace', () => {
  it('asks for that place’s dishes, best rated first, unrated last', async () => {
    result.data = [{ id: 'd1' }]
    expect(await listDishesAtPlace('p1')).toEqual([{ id: 'd1' }])
    expect(from).toHaveBeenCalledWith('dishes')
    expect(call('eq')).toEqual([['place_id', 'p1']])
    expect(call('order')).toEqual([
      ['rating', { ascending: false, nullsFirst: false }],
      ['eaten_at', { ascending: false }],
    ])
  })

  it('throws the database error', async () => {
    result.error = new Error('rls')
    await expect(listDishesAtPlace('p1')).rejects.toThrow('rls')
  })
})
