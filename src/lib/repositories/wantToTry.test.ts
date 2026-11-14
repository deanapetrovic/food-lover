import { beforeEach, describe, expect, it, vi } from 'vitest'

// A chainable, awaitable stand-in for the supabase query builder that records each call.
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

import { addWantToTry, deleteDish, listDishes, markTried } from './dishes'

const call = (name: string) => calls.find(([n]) => n === name)?.[1]

beforeEach(() => {
  calls.length = 0
  result.data = { id: 'd1' }
  result.error = null
  from.mockClear()
})

describe('addWantToTry', () => {
  it('inserts a want-to-try row with no rating and the source link', async () => {
    await addWantToTry({
      name: ' Pljeskavica ', placeId: null, sourceUrl: ' https://www.instagram.com/p/abc ', note: ' ', tags: ['#Grill'],
    })
    expect(from).toHaveBeenCalledWith('dishes')
    expect(call('insert')).toEqual([{
      name: 'Pljeskavica', place_id: null, rating: null, note: null, tags: ['grill'],
      source_url: 'https://www.instagram.com/p/abc', status: 'want_to_try',
    }])
  })

  it('stores no link when none is given', async () => {
    await addWantToTry({ name: 'Idea' })
    expect(call('insert')).toEqual([expect.objectContaining({ source_url: null, place_id: null })])
  })

  it('refuses non-http links before touching the database', async () => {
    await expect(addWantToTry({ name: 'x', sourceUrl: 'javascript:alert(1)' })).rejects.toThrow(/http/)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('markTried', () => {
  it('updates the same row to tried with the new details', async () => {
    await markTried('want-1', {
      name: ' Pljeskavica ', placeId: 'p1', rating: 8, note: 'juicy', tags: ['grill'], photoPath: 'u/a.jpg',
      eatenAt: '2026-11-08T12:00:00Z',
    })
    expect(call('update')).toEqual([{
      name: 'Pljeskavica', place_id: 'p1', rating: 8, note: 'juicy', tags: ['grill'],
      photo_path: 'u/a.jpg', eaten_at: '2026-11-08T12:00:00Z', status: 'tried',
    }])
    expect(call('eq')).toEqual(['id', 'want-1'])
    expect(call('insert')).toBeUndefined()
  })

  it('defaults eaten_at to now', async () => {
    await markTried('w', { name: 'x', placeId: 'p', rating: 5 })
    const [payload] = call('update') as [{ eaten_at: string }]
    expect(Number.isNaN(Date.parse(payload.eaten_at))).toBe(false)
  })

  it('throws the database error', async () => {
    result.error = new Error('rls')
    await expect(markTried('w', { name: 'x', placeId: 'p', rating: 5 })).rejects.toThrow('rls')
  })
})

describe('listDishes / deleteDish', () => {
  it('filters by status when asked', async () => {
    result.data = []
    await listDishes({ status: 'want_to_try' })
    expect(call('eq')).toEqual(['status', 'want_to_try'])
  })

  it('does not filter when no status is given', async () => {
    result.data = []
    await listDishes()
    expect(call('eq')).toBeUndefined()
  })

  it('deletes by id', async () => {
    await deleteDish('d9')
    expect(call('delete')).toEqual([])
    expect(call('eq')).toEqual(['id', 'd9'])
  })
})
