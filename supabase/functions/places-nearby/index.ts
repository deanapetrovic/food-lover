// Edge Function: nearby / text place lookup via Google Places API (New).
// The API key lives only here (Supabase secret GOOGLE_PLACES_API_KEY), never in the app.
// Requires a signed-in user (verify_jwt = true).
//
// POST { lat?: number, lng?: number, query?: string }
//   - query empty  -> places within ~250 m of (lat, lng), nearest first
//   - query set    -> text search, biased to (lat, lng) when given
// -> { places: PlaceCandidate[] }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.addressComponents',
  'places.primaryTypeDisplayName',
].join(',')

const EATING_TYPES = ['restaurant', 'cafe', 'bakery', 'bar', 'meal_takeaway', 'fast_food_restaurant']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

interface GoogleComponent { longText?: string; shortText?: string; types?: string[] }
interface GooglePlace {
  id: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: GoogleComponent[]
  primaryTypeDisplayName?: { text?: string }
}

function normalize(p: GooglePlace) {
  const comps = p.addressComponents ?? []
  const pick = (type: string) => comps.find((c) => c.types?.includes(type))
  const city = pick('locality')?.longText ?? pick('postal_town')?.longText ?? pick('administrative_area_level_2')?.longText ?? null
  return {
    provider: 'google',
    externalPlaceId: p.id,
    name: p.displayName?.text ?? 'Unnamed place',
    address: p.formattedAddress ?? null,
    city,
    country: pick('country')?.shortText ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    cuisine: p.primaryTypeDisplayName?.text ?? null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const key = Deno.env.get('GOOGLE_PLACES_API_KEY')
  if (!key) return json({ error: 'places_not_configured' }, 503)

  let body: { lat?: unknown; lng?: unknown; query?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const hasLocation = body.lat != null && body.lng != null &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : ''

  if (!query && !hasLocation) return json({ error: 'need_location_or_query' }, 400)

  const center = { latitude: lat, longitude: lng }
  const url = query
    ? 'https://places.googleapis.com/v1/places:searchText'
    : 'https://places.googleapis.com/v1/places:searchNearby'
  const payload = query
    ? {
        textQuery: query,
        maxResultCount: 8,
        ...(hasLocation && { locationBias: { circle: { center, radius: 5000 } } }),
      }
    : {
        includedTypes: EATING_TYPES,
        maxResultCount: 8,
        rankPreference: 'DISTANCE',
        locationRestriction: { circle: { center, radius: 250 } },
      }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    console.error('places api error', res.status, await res.text())
    return json({ error: 'places_upstream_error' }, 502)
  }

  const data = (await res.json()) as { places?: GooglePlace[] }
  return json({ places: (data.places ?? []).map(normalize) })
})
