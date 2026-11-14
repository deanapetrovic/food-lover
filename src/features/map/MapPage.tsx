import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSearchDishes } from '@/features/dishes/useSearch'
import type { DishStatus } from '@/lib/database.types'
import { groupByPlace } from './groupByPlace'
import { MapView, type MapMarker } from './MapView'

type StatusFilter = DishStatus | 'all'
const OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tried', label: 'Tried' },
  { value: 'want_to_try', label: 'Want to try' },
]

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function MapPage() {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [user, setUser] = useState<{ lat: number; lng: number } | null>(null)
  const [locateError, setLocateError] = useState<string | null>(null)

  const { data, isLoading, error } = useSearchDishes({ status: status === 'all' ? null : status })
  const { groups, unlocatedPlaces } = useMemo(() => groupByPlace(data ?? []), [data])

  const markers: MapMarker[] = useMemo(
    () => groups.map((g) => ({
      id: g.placeId, lat: g.lat, lng: g.lng, label: g.name,
      kind: g.tried > 0 ? 'tried' : 'want',
      badge: g.bestRating != null ? String(g.bestRating) : null,
    })),
    [groups],
  )
  const selected = groups.find((g) => g.placeId === selectedId) ?? null

  const locate = () => {
    setLocateError(null)
    if (!('geolocation' in navigator)) { setLocateError('This device can’t share its location.'); return }
    navigator.geolocation.getCurrentPosition(
      (p) => setUser({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setLocateError('Couldn’t get your location. Check that location is allowed for this site.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  return (
    <section className="flex h-full flex-col p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Map</h1>
        <button type="button" onClick={locate}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium">Near me</button>
      </header>

      <div role="group" aria-label="Show" className="mb-3 flex gap-2 overflow-x-auto">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" aria-pressed={status === o.value}
            onClick={() => { setStatus(o.value); setSelectedId(null) }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              status === o.value ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface'
            }`}>
            {o.label}
          </button>
        ))}
      </div>

      {locateError && <p role="alert" className="mb-2 text-sm text-danger">{locateError}</p>}
      {error && <p role="alert" className="mb-2 text-sm text-danger">Couldn’t load your places. {(error as Error).message}</p>}

      <div className="relative min-h-80 flex-1 overflow-hidden rounded-2xl border border-line">
        <MapView markers={markers} selectedId={selectedId} onSelect={setSelectedId} userLocation={user}
          className="absolute inset-0" />

        {!isLoading && !error && markers.length === 0 && (
          <p className="pointer-events-none absolute inset-x-4 top-4 z-[500] rounded-xl bg-surface/95 p-3 text-center text-sm shadow"
            data-testid="map-empty">
            {data && data.length > 0
              ? 'None of these places have a location yet, so there’s nothing to pin.'
              : 'Nothing to show yet. Log a dish at a place and it will appear here.'}
          </p>
        )}

        {selected && (
          <div className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-line bg-surface p-3 shadow-lg"
            data-testid="place-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate font-semibold">{selected.name}</h2>
                {selected.city && <p className="text-sm text-muted">{selected.city}</p>}
              </div>
              <button type="button" aria-label="Close" onClick={() => setSelectedId(null)}
                className="px-2 text-xl leading-none text-muted">×</button>
            </div>
            <p className="mt-1 text-sm">
              {[
                selected.tried > 0 && plural(selected.tried, 'dish tried', 'dishes tried'),
                selected.want > 0 && `${selected.want} to try`,
              ].filter(Boolean).join(' · ')}
              {selected.bestDish && selected.bestRating != null && (
                <span className="text-muted"> · best: {selected.bestDish} ({selected.bestRating})</span>
              )}
            </p>
            <Link to={`/place/${selected.placeId}`}
              className="mt-2 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
              Open place
            </Link>
          </div>
        )}
      </div>

      {unlocatedPlaces > 0 && markers.length > 0 && (
        <p className="mt-2 text-xs text-muted" data-testid="unlocated-note">
          {plural(unlocatedPlaces, 'place has', 'places have')} no location (added by name), so
          {unlocatedPlaces === 1 ? ' it isn’t' : ' they aren’t'} on the map.
        </p>
      )}
    </section>
  )
}
