import { Link, useNavigate, useParams } from 'react-router-dom'
import { DishRow } from '@/features/dishes/DishRow'
import { usePlace, useDishesAtPlace } from './usePlace'
import type { Place } from '@/lib/database.types'

function mapsUrl(place: Place) {
  const query = [place.name, place.address ?? place.city].filter(Boolean).join(', ')
  const params = new URLSearchParams({ api: '1', query })
  if (place.provider === 'google' && place.external_place_id) params.set('query_place_id', place.external_place_id)
  return `https://www.google.com/maps/search/?${params.toString()}`
}

export function PlacePage() {
  const { id = null } = useParams()
  const navigate = useNavigate()
  const place = usePlace(id)
  const dishes = useDishesAtPlace(id)

  const back = (
    <button type="button" onClick={() => navigate(-1)} className="mb-3 text-sm text-accent">‹ Back</button>
  )

  if (place.isLoading || dishes.isLoading) return <section className="p-4">{back}<p className="text-muted">Loading…</p></section>

  if (place.error || dishes.error) {
    return (
      <section className="p-4">{back}
        <p role="alert" className="text-danger">Couldn’t load this place. {((place.error ?? dishes.error) as Error).message}</p>
      </section>
    )
  }

  if (!place.data) {
    return (
      <section className="p-4">{back}
        <h1 className="text-2xl font-bold">Place not found</h1>
        <p className="mt-1 text-sm text-muted">It may have been removed, or it isn’t one of yours.</p>
      </section>
    )
  }

  const p = place.data
  const all = dishes.data ?? []
  const tried = all.filter((d) => d.status === 'tried')
  const want = all.filter((d) => d.status === 'want_to_try')
  const rated = tried.filter((d) => d.rating != null)
  const average = rated.length ? (rated.reduce((sum, d) => sum + (d.rating ?? 0), 0) / rated.length).toFixed(1) : null
  const subtitle = [p.address ?? p.city, p.cuisine].filter(Boolean).join(' · ')

  return (
    <section className="p-4">
      {back}
      <header className="mb-4">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        <p className="mt-2 text-sm" data-testid="place-summary">
          {tried.length === 0
            ? 'Nothing tried here yet'
            : `${tried.length} ${tried.length === 1 ? 'dish' : 'dishes'} tried${average ? ` · average ${average}` : ''}`}
        </p>
        <div className="mt-3 flex gap-2">
          <Link to={`/log?place=${p.id}`}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent">Log a dish here</Link>
          <a href={mapsUrl(p)} target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium">Open in Maps</a>
        </div>
      </header>

      {tried.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-muted">Tried here · best first</h2>
          <ul className="mb-5 space-y-3">
            {tried.map((d) => <DishRow key={d.id} dish={d} showPlace={false} verdict />)}
          </ul>
        </>
      )}

      {want.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-muted">Want to try here</h2>
          <ul className="space-y-3">
            {want.map((d) => <DishRow key={d.id} dish={d} showPlace={false} />)}
          </ul>
        </>
      )}

      {all.length === 0 && (
        <p className="text-sm text-muted">You haven’t logged anything here yet. Tap “Log a dish here” to add your first.</p>
      )}
    </section>
  )
}
