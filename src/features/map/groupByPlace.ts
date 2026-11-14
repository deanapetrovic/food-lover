import type { DishListItem } from '@/lib/repositories/dishes'

export interface PlaceGroup {
  placeId: string
  name: string
  city: string | null
  lat: number
  lng: number
  tried: number
  want: number
  /** Highest rating among tried dishes here, if any. */
  bestRating: number | null
  bestDish: string | null
}

export interface Grouped {
  groups: PlaceGroup[]
  /** Dishes whose place has no coordinates (e.g. added by name), so they can't be pinned. */
  unlocatedPlaces: number
}

/** One pin per place: counts, and the best dish there. Places without coordinates are counted, not pinned. */
export function groupByPlace(dishes: DishListItem[]): Grouped {
  const byPlace = new Map<string, PlaceGroup>()
  const unlocated = new Set<string>()

  for (const d of dishes) {
    const p = d.place
    if (!p) continue
    if (p.lat == null || p.lng == null) {
      unlocated.add(p.id)
      continue
    }
    let g = byPlace.get(p.id)
    if (!g) {
      g = { placeId: p.id, name: p.name, city: p.city, lat: p.lat, lng: p.lng, tried: 0, want: 0, bestRating: null, bestDish: null }
      byPlace.set(p.id, g)
    }
    if (d.status === 'tried') {
      g.tried += 1
      if (d.rating != null && (g.bestRating == null || d.rating > g.bestRating)) {
        g.bestRating = d.rating
        g.bestDish = d.name
      }
    } else {
      g.want += 1
    }
  }

  return { groups: [...byPlace.values()], unlocatedPlaces: unlocated.size }
}
