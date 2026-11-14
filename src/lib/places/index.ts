import { supabase } from '@/lib/supabase'
import {
  PlacesUnavailableError,
  type Coords,
  type PlaceCandidate,
  type PlacesProvider,
} from './types'

export * from './types'

async function call(body: Record<string, unknown>): Promise<PlaceCandidate[]> {
  const { data, error } = await supabase.functions.invoke<{ places: PlaceCandidate[] }>(
    'places-nearby',
    { body },
  )
  if (error) throw new PlacesUnavailableError(error.message)
  return data?.places ?? []
}

/** Google Places (New), reached through the `places-nearby` Edge Function. */
export const googlePlacesProvider: PlacesProvider = {
  nearby: ({ lat, lng }: Coords) => call({ lat, lng }),
  search: (query, near) => call({ query, ...(near ?? {}) }),
}

export const placesProvider: PlacesProvider = googlePlacesProvider
