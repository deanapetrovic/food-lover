import { supabase } from '@/lib/supabase'
import type { DishStatus } from '@/lib/database.types'
import type { DishListItem } from './dishes'

export type SortMode = 'best' | 'recent'

export interface SearchParams {
  /** Free text. Every word must match the name, note, tags, place, city or cuisine; accents and case are ignored. */
  q?: string
  /** Only dishes rated at least this. */
  minRating?: number | null
  city?: string | null
  status?: DishStatus | null
  sort?: SortMode
}

/** Searches the signed-in user's dishes (the database function runs under their row-level security). */
export async function searchDishes(params: SearchParams = {}): Promise<DishListItem[]> {
  const { data, error } = await supabase.rpc('search_dishes', {
    p_q: params.q?.trim() || undefined,
    p_min_rating: params.minRating ?? undefined,
    p_city: params.city ?? undefined,
    p_status: params.status ?? undefined,
    p_sort: params.sort,
  })
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    name: r.name,
    rating: r.rating,
    note: r.note,
    tags: r.tags,
    photo_path: r.photo_path,
    eaten_at: r.eaten_at,
    status: r.status,
    source_url: r.source_url,
    place_id: r.place_id,
    place: r.place_id
      ? { id: r.place_id, name: r.place_name ?? '', city: r.place_city, cuisine: r.place_cuisine, lat: r.place_lat, lng: r.place_lng }
      : null,
  }))
}

/** Cities the user has dishes in, most-used first. */
export async function listMyCities(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_my_cities')
  if (error) throw error
  return data ?? []
}
