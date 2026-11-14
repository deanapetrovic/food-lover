import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { placesProvider, manualPlace, type Coords, type PlaceCandidate } from '@/lib/places'

interface Props {
  coords: Coords | null
  geoStatus: 'pending' | 'ready' | 'denied' | 'unavailable'
  selected: PlaceCandidate | null
  onSelect: (p: PlaceCandidate) => void
  /** Suggest (and pre-select) places near the user. Off for want-to-try, where you're not there yet. */
  nearby?: boolean
  label?: string
  /** Pre-fills the search box, e.g. a place name guessed from a shared link. */
  initialQuery?: string
}

const same = (a: PlaceCandidate | null, b: PlaceCandidate) =>
  a != null && a.provider === b.provider && a.externalPlaceId === b.externalPlaceId && a.name === b.name

export function PlacePicker({
  coords, geoStatus, selected, onSelect, nearby: nearbyMode = true, label = 'Where did you eat?', initialQuery,
}: Props) {
  const [search, setSearch] = useState(initialQuery ?? '')
  const [debounced, setDebounced] = useState((initialQuery ?? '').trim())
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualCity, setManualCity] = useState('')

  // A guess can arrive after the picker mounted (the link is still being read).
  useEffect(() => {
    if (initialQuery) setSearch((s) => s || initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(id)
  }, [search])

  const searching = debounced.length >= 2
  const nearbyQuery = useQuery({
    queryKey: ['places', 'nearby', coords?.lat, coords?.lng],
    queryFn: () => placesProvider.nearby(coords as Coords),
    enabled: nearbyMode && coords != null && !searching,
    staleTime: 60_000,
    retry: false,
  })
  const found = useQuery({
    queryKey: ['places', 'search', debounced, coords?.lat, coords?.lng],
    queryFn: () => placesProvider.search(debounced, coords),
    enabled: searching,
    staleTime: 60_000,
    retry: false,
  })

  const active = searching ? found : nearbyQuery
  const candidates = active.data ?? []

  // Pre-select the closest suggestion so the common case needs zero taps.
  const first = nearbyQuery.data?.[0]
  useEffect(() => {
    if (nearbyMode && !selected && first && !searching) onSelect(first)
  }, [nearbyMode, first, selected, searching, onSelect])

  const lookupFailed = active.isError
  const showManualByDefault = lookupFailed || (nearbyMode && (geoStatus === 'denied' || geoStatus === 'unavailable'))

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{label}</legend>

      {selected && (
        <p className="mb-2 rounded-xl border border-accent bg-surface p-3 text-sm" data-testid="selected-place">
          <span className="font-semibold">{selected.name}</span>
          {selected.city && <span className="text-muted"> · {selected.city}</span>}
        </p>
      )}

      {nearbyMode && geoStatus === 'pending' && !searching && (
        <p className="text-sm text-muted">Finding places near you…</p>
      )}
      {nearbyMode && geoStatus === 'denied' && (
        <p className="text-sm text-muted">Location is off, so search for the place instead.</p>
      )}
      {lookupFailed && (
        <p className="text-sm text-muted">Place lookup isn’t available right now. Add the place by name below.</p>
      )}
      {active.isFetching && <p className="text-sm text-muted">Looking…</p>}

      {candidates.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {candidates.map((c) => (
            <li key={`${c.provider}:${c.externalPlaceId ?? c.name}`}>
              <button type="button" onClick={() => onSelect(c)} aria-pressed={same(selected, c)}
                className={`rounded-full border px-3 py-2 text-left text-sm ${
                  same(selected, c) ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'
                }`}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {!lookupFailed && (
        <input aria-label="Search for a place" type="search" value={search} placeholder="Search for a place…"
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2" />
      )}

      {(manualOpen || showManualByDefault) ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input aria-label="Place name" value={manualName} placeholder="Place name"
            onChange={(e) => setManualName(e.target.value)}
            className="col-span-2 rounded-xl border border-line bg-surface px-3 py-2" />
          <input aria-label="City" value={manualCity} placeholder="City"
            onChange={(e) => setManualCity(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2" />
          <button type="button" disabled={!manualName.trim()}
            onClick={() => onSelect(manualPlace(manualName, manualCity))}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium disabled:opacity-50">
            Use this place
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setManualOpen(true)} className="mt-2 text-sm text-muted underline">
          Can’t find it? Add it by name
        </button>
      )}
    </fieldset>
  )
}
