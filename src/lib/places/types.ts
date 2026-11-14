export interface Coords {
  lat: number
  lng: number
}

/** A place suggestion, not yet saved to our database. */
export interface PlaceCandidate {
  provider: string // 'google' | 'manual'
  externalPlaceId: string | null
  name: string
  address: string | null
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  cuisine: string | null
  /** Set when this place already exists in our database, so it needn't be saved again. */
  savedId?: string
}

/** Swappable place lookup (Google today; Foursquare/OSM later). */
export interface PlacesProvider {
  nearby(coords: Coords): Promise<PlaceCandidate[]>
  search(query: string, near?: Coords | null): Promise<PlaceCandidate[]>
}

/** Thrown when the lookup service is missing, not configured, or down. */
export class PlacesUnavailableError extends Error {
  constructor(message = 'Place lookup is unavailable') {
    super(message)
    this.name = 'PlacesUnavailableError'
  }
}

export function manualPlace(name: string, city?: string | null): PlaceCandidate {
  return {
    provider: 'manual',
    externalPlaceId: null,
    name: name.trim(),
    address: null,
    city: city?.trim() || null,
    country: null,
    lat: null,
    lng: null,
    cuisine: null,
  }
}
