import { supabase } from '@/lib/supabase'

export interface PublicListItem {
  dish_id: string
  position: number
  name: string
  rating: number | null
  note: string | null
  tags: string[]
  photo_path: string | null
  eaten_at: string
  place: {
    id: string
    name: string
    address: string | null
    city: string | null
    lat: number | null
    lng: number | null
    cuisine: string | null
  } | null
}

export interface PublicList {
  id: string
  title: string
  description: string | null
  updated_at: string
  owner: { display_name: string | null }
  items: PublicListItem[]
}

/** Reads a public list by its link slug. Works signed out; returns null for unknown or private lists. */
export async function getPublicList(slug: string): Promise<PublicList | null> {
  const { data, error } = await supabase.rpc('get_public_list', { p_slug: slug })
  if (error) throw error
  return (data as unknown as PublicList | null) ?? null
}

/**
 * Photos are private, so the public page asks a small Edge Function for short-lived signed links.
 * Best-effort: if it fails the list still shows, just without pictures.
 */
export async function getPublicListPhotos(slug: string): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase.functions.invoke<{ urls: Record<string, string> }>('public-list-photos', {
      body: { slug },
    })
    if (error) return {}
    return data?.urls ?? {}
  } catch {
    return {}
  }
}

/** A map link for a place: exact when we have coordinates, otherwise a name search. */
export function mapsLink(place: NonNullable<PublicListItem['place']>): string {
  const query = place.lat != null && place.lng != null
    ? `${place.lat},${place.lng}`
    : [place.name, place.address ?? place.city].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query }).toString()}`
}
