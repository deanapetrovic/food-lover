import { supabase } from '@/lib/supabase'
import type { Dish, Place } from '@/lib/database.types'

export type DishWithPlace = Dish & {
  place: Pick<Place, 'id' | 'name' | 'city' | 'cuisine' | 'lat' | 'lng'> | null
}

export interface NewDish {
  name: string
  placeId: string
  rating: number
  note?: string
  tags?: string[]
  photoPath?: string | null
  eatenAt?: string
}

/** lower-case, strip leading '#', trim, drop empties and duplicates, cap at 10. */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  for (const raw of tags) {
    const tag = raw.trim().replace(/^#+/, '').trim().toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, 10)
}

export async function createDish(input: NewDish): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      name: input.name.trim(),
      place_id: input.placeId,
      rating: input.rating,
      note: input.note?.trim() || null,
      tags: normalizeTags(input.tags ?? []),
      photo_path: input.photoPath ?? null,
      ...(input.eatenAt && { eaten_at: input.eatenAt }),
      status: 'tried',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** The signed-in user's dishes, newest first (RLS scopes it to them). */
export async function listDishes(): Promise<DishWithPlace[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select('*, place:places(id, name, city, cuisine, lat, lng)')
    .order('eaten_at', { ascending: false })
  if (error) throw error
  return data as DishWithPlace[]
}
