import { supabase } from '@/lib/supabase'
import type { PlaceCandidate } from '@/lib/places'

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
