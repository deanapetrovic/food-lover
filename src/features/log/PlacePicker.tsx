import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { placesProvider, manualPlace, type Coords, type PlaceCandidate } from '@/lib/places'

interface Props {
  coords: Coords | null
  geoStatus: 'pending' | 'ready' | 'denied' | 'unavailable'
  selected: PlaceCandidate | null
  onSelect: (p: PlaceCandidate) => void
}

const same = (a: PlaceCandidate | null, b: PlaceCandidate) =>
  a != null && a.provider === b.provider && a.externalPlaceId === b.externalPlaceId && a.name === b.name

export function PlacePicker({ coords, geoStatus, selected, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualCity, setManualCity] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 350)
    return () => clearTimeout(id)
  }, [search])

  const searching = debounced.length >= 2
  const nearby = useQuery({
    queryKey: ['places', 'nearby', coords?.lat, coords?.lng],
    queryFn: () => placesProvider.nearby(coords as Coords),
    enabled: coords != null && !searching,
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

  const active = searching ? found : nearby
  const candidates = active.data ?? []

  // Pre-select the closest suggestion so the common case needs zero taps.
  const first = nearby.data?.[0]
  useEffect(() => {
    if (!selected && first && !searching) onSelect(first)
  }, [first, selected, searching, onSelect])

  const lookupFailed = active.isError
  const showManualByDefault = lookupFailed || geoStatus === 'denied' || geoStatus === 'unavailable'

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Where did you eat?</legend>

      {selected && (
        <p className="mb-2 rounded-xl border border-accent bg-surface p-3 text-sm" data-testid="selected-place">
          <span className="font-semibold">{selected.name}</span>
          {selected.city && <span className="text-muted"> · {selected.city}</span>}
        </p>
      )}

      {geoStatus === 'pending' && !searching && <p className="text-sm text-muted">Finding places near you…</p>}
      {geoStatus === 'denied' && (
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
