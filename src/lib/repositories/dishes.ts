import { supabase } from '@/lib/supabase'
import type { Dish, DishStatus, Place } from '@/lib/database.types'
import { isHttpUrl } from '@/lib/linkPreview'

export type DishWithPlace = Dish & {
  place: Pick<Place, 'id' | 'name' | 'city' | 'cuisine' | 'lat' | 'lng'> | null
}

/** What list screens need from a dish (search returns exactly this; DishWithPlace is a superset). */
export type DishListItem = Pick<
  Dish,
  'id' | 'name' | 'rating' | 'note' | 'tags' | 'photo_path' | 'eaten_at' | 'status' | 'source_url' | 'place_id'
> & {
  place: Pick<Place, 'id' | 'name' | 'city' | 'cuisine' | 'lat' | 'lng'> | null
}

export const WITH_PLACE = '*, place:places(id, name, city, cuisine, lat, lng)'

export interface NewDish {
  name: string
  placeId: string
  rating: number
  note?: string
  tags?: string[]
  photoPath?: string | null
  eatenAt?: string
}

export interface NewWantToTry {
  name: string
  placeId?: string | null
  sourceUrl?: string | null
  note?: string
  tags?: string[]
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

/** Saves an idea to try later. The place and link are optional; the link must be http(s). */
export async function addWantToTry(input: NewWantToTry): Promise<Dish> {
  const url = input.sourceUrl?.trim()
  if (url && !isHttpUrl(url)) throw new Error('That link doesn’t look right. It should start with http:// or https://')
  const { data, error } = await supabase
    .from('dishes')
    .insert({
      name: input.name.trim(),
      place_id: input.placeId ?? null,
      rating: null,
      note: input.note?.trim() || null,
      tags: normalizeTags(input.tags ?? []),
      source_url: url || null,
      status: 'want_to_try',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Converts a want-to-try row into a logged dish: same row, so its link and history are kept. */
export async function markTried(id: string, input: NewDish): Promise<Dish> {
  const { data, error } = await supabase
    .from('dishes')
    .update({
      name: input.name.trim(),
      place_id: input.placeId,
      rating: input.rating,
      note: input.note?.trim() || null,
      tags: normalizeTags(input.tags ?? []),
      photo_path: input.photoPath ?? null,
      eaten_at: input.eatenAt ?? new Date().toISOString(),
      status: 'tried',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteDish(id: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', id)
  if (error) throw error
}

export async function getDish(id: string): Promise<DishWithPlace> {
  const { data, error } = await supabase.from('dishes').select(WITH_PLACE).eq('id', id).single()
  if (error) throw error
  return data as DishWithPlace
}

/** The signed-in user's dishes, newest first (RLS scopes it to them). */
export async function listDishes(opts: { status?: DishStatus } = {}): Promise<DishWithPlace[]> {
  const base = supabase.from('dishes').select(WITH_PLACE)
  const filtered = opts.status ? base.eq('status', opts.status) : base
  const { data, error } = await filtered.order('eaten_at', { ascending: false })
  if (error) throw error
  return data as DishWithPlace[]
}
