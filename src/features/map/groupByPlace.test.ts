import { describe, expect, it } from 'vitest'
import type { DishListItem } from '@/lib/repositories/dishes'
import { groupByPlace } from './groupByPlace'

const zlatni = { id: 'p1', name: 'Zlatni', city: 'Belgrade', cuisine: null, lat: 44.8, lng: 20.4 }
const pistacchio = { id: 'p2', name: 'Pistacchio', city: 'Belgrade', cuisine: null, lat: 44.81, lng: 20.46 }
const byName = { id: 'p3', name: 'Added by name', city: null, cuisine: null, lat: null, lng: null }

const dish = (over: Partial<DishListItem>): DishListItem => ({
  id: Math.random().toString(36).slice(2), name: 'Dish', rating: 7, note: null, tags: [], photo_path: null,
  eaten_at: '2026-11-07T12:00:00Z', status: 'tried', source_url: null, place_id: null, place: null, ...over,
})

describe('groupByPlace', () => {
  it('makes one pin per place with tried and want counts', () => {
    const { groups } = groupByPlace([
      dish({ place: zlatni, status: 'tried' }),
      dish({ place: zlatni, status: 'tried' }),
      dish({ place: zlatni, status: 'want_to_try', rating: null }),
      dish({ place: pistacchio, status: 'want_to_try', rating: null }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups.find((g) => g.placeId === 'p1')).toMatchObject({ tried: 2, want: 1, lat: 44.8, lng: 20.4 })
    expect(groups.find((g) => g.placeId === 'p2')).toMatchObject({ tried: 0, want: 1, bestRating: null })
  })

  it('remembers the best rated dish at each place', () => {
    const { groups } = groupByPlace([
      dish({ name: 'Kajmak', rating: 7, place: zlatni }),
      dish({ name: 'Ćevapi', rating: 9, place: zlatni }),
      dish({ name: 'Fries', rating: 3, place: zlatni }),
    ])
    expect(groups[0]).toMatchObject({ bestRating: 9, bestDish: 'Ćevapi' })
  })

  it('ignores want-to-try items when choosing the best dish', () => {
    const { groups } = groupByPlace([
      dish({ name: 'Idea', rating: null, status: 'want_to_try', place: zlatni }),
      dish({ name: 'Kajmak', rating: 6, place: zlatni }),
    ])
    expect(groups[0]).toMatchObject({ bestRating: 6, bestDish: 'Kajmak' })
  })

  it('counts places without coordinates instead of pinning them', () => {
    const result = groupByPlace([
      dish({ place: byName }),
      dish({ place: byName }),
      dish({ place: zlatni }),
    ])
    expect(result.groups.map((g) => g.placeId)).toEqual(['p1'])
    expect(result.unlocatedPlaces).toBe(1)
  })

  it('skips dishes with no place at all', () => {
    expect(groupByPlace([dish({ place: null })])).toEqual({ groups: [], unlocatedPlaces: 0 })
  })

  it('handles an empty list', () => {
    expect(groupByPlace([])).toEqual({ groups: [], unlocatedPlaces: 0 })
  })
})
