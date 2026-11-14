import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc } }))

import { listMyCities, searchDishes } from './search'

const row = {
  id: 'd1', name: 'Ćevapi', rating: 9, note: null, tags: ['grill'], photo_path: null,
  eaten_at: '2026-11-07T12:00:00Z', status: 'tried', source_url: null, place_id: 'p1',
  place_name: 'Zlatni', place_city: 'Belgrade', place_cuisine: 'balkan', place_lat: 44.8, place_lng: 20.4,
}

beforeEach(() => rpc.mockReset())

describe('searchDishes', () => {
  it('passes the filters to the database function, leaving unset ones out', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await searchDishes({ q: '  cevapi ', minRating: 8, city: 'Belgrade', status: 'tried', sort: 'best' })
    expect(rpc).toHaveBeenCalledWith('search_dishes', {
      p_q: 'cevapi', p_min_rating: 8, p_city: 'Belgrade', p_status: 'tried', p_sort: 'best',
    })
  })

  it('sends nothing for empty filters', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await searchDishes({ q: '   ', minRating: null, city: null, status: null })
    expect(rpc).toHaveBeenCalledWith('search_dishes', {
      p_q: undefined, p_min_rating: undefined, p_city: undefined, p_status: undefined, p_sort: undefined,
    })
  })

  it('shapes flat rows into dishes with a nested place', async () => {
    rpc.mockResolvedValue({ data: [row], error: null })
    const [dish] = await searchDishes()
    expect(dish).toMatchObject({ id: 'd1', name: 'Ćevapi', rating: 9, tags: ['grill'] })
    expect(dish.place).toEqual({ id: 'p1', name: 'Zlatni', city: 'Belgrade', cuisine: 'balkan', lat: 44.8, lng: 20.4 })
  })

  it('gives a dish with no place a null place', async () => {
    rpc.mockResolvedValue({ data: [{ ...row, place_id: null, place_name: null, status: 'want_to_try', rating: null }], error: null })
    const [dish] = await searchDishes()
    expect(dish.place).toBeNull()
    expect(dish.rating).toBeNull()
  })

  it('throws the database error', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(searchDishes()).rejects.toThrow('boom')
  })
})

describe('listMyCities', () => {
  it('returns the cities', async () => {
    rpc.mockResolvedValue({ data: ['Belgrade', 'Novi Sad'], error: null })
    expect(await listMyCities()).toEqual(['Belgrade', 'Novi Sad'])
    expect(rpc).toHaveBeenCalledWith('list_my_cities')
  })
  it('returns an empty list when there is no data', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await listMyCities()).toEqual([])
  })
})
