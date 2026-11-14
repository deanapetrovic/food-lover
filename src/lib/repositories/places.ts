import { supabase } from '@/lib/supabase'
import type { Place } from '@/lib/database.types'
import type { PlaceCandidate } from '@/lib/places'
import { WITH_PLACE, type DishListItem } from './dishes'

/** Saves a suggestion to our places table (de-duplicated server-side) and returns its id. */
export async function savePlace(c: PlaceCandidate): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_place', {
    p_provider: c.provider,
    p_external_place_id: c.externalPlaceId ?? '',
    p_name: c.name,
    p_address: c.address ?? undefined,
    p_city: c.city ?? undefined,
    p_country: c.country ?? undefined,
    p_lat: c.lat ?? undefined,
    p_lng: c.lng ?? undefined,
    p_cuisine: c.cuisine ?? undefined,
  })
  if (error) throw error
  return data
}

/** A place by id, or null if it doesn't exist or isn't visible to this user (row-level security). */
export async function getPlace(id: string): Promise<Place | null> {
  const { data, error } = await supabase.from('places').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** The signed-in user's dishes at one place, best rated first (want-to-try items have no rating, so they sort last). */
export async function listDishesAtPlace(placeId: string): Promise<DishListItem[]> {
  const { data, error } = await supabase
    .from('dishes')
    .select(WITH_PLACE)
    .eq('place_id', placeId)
    .order('rating', { ascending: false, nullsFirst: false })
    .order('eaten_at', { ascending: false })
  if (error) throw error
  return data as DishListItem[]
}
