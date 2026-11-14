import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { DishStatus } from '@/lib/database.types'
import type { SortMode } from '@/lib/repositories/search'
import { useCities, useSearchDishes } from './useSearch'
import { DishRow } from './DishRow'

type StatusFilter = DishStatus | 'all'

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'tried', label: 'Tried' },
  { value: 'want_to_try', label: 'Want to try' },
  { value: 'all', label: 'All' },
]
const RATING_OPTIONS = [7, 8, 9]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
        active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
      }`}>
      {children}
    </button>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="w-14 shrink-0 text-xs text-muted">{label}</span>
      {children}
    </div>
  )
}

export function DishesPage() {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [minRating, setMinRating] = useState<number | null>(null)
  const [city, setCity] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusFilter>('tried')
  const [sort, setSort] = useState<SortMode | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(id)
  }, [text])

  // Searching is mostly "what's the best X?", so rank by rating once there's a query.
  const effectiveSort: SortMode = sort ?? (q ? 'best' : 'recent')

  const { data, isLoading, error } = useSearchDishes({
    q, minRating, city, status: status === 'all' ? null : status, sort: effectiveSort,
  })
  const { data: cities = [] } = useCities()

  const filtered = Boolean(q || minRating || city || sort || status !== 'tried')
  const clearAll = () => { setText(''); setQ(''); setMinRating(null); setCity(null); setStatus('tried'); setSort(null) }

  return (
    <section className="p-4">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dishes</h1>
        <button className="text-sm text-muted underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <input type="search" aria-label="Search dishes" value={text} placeholder="Search dish, place, city, tag…"
        onChange={(e) => setText(e.target.value)}
        className="mb-3 w-full rounded-xl border border-line bg-surface px-3 py-3" />

      <div className="mb-3 space-y-1">
        <FilterRow label="Show">
          {STATUS_OPTIONS.map((o) => (
            <Chip key={o.value} active={status === o.value} onClick={() => setStatus(o.value)}>{o.label}</Chip>
          ))}
        </FilterRow>
        <FilterRow label="Rating">
          {RATING_OPTIONS.map((n) => (
            <Chip key={n} active={minRating === n} onClick={() => setMinRating(minRating === n ? null : n)}>{n}+</Chip>
          ))}
        </FilterRow>
        {cities.length > 0 && (
          <FilterRow label="City">
            {cities.map((c) => (
              <Chip key={c} active={city === c} onClick={() => setCity(city === c ? null : c)}>{c}</Chip>
            ))}
          </FilterRow>
        )}
        <FilterRow label="Sort">
          <Chip active={effectiveSort === 'best'} onClick={() => setSort('best')}>Top rated</Chip>
          <Chip active={effectiveSort === 'recent'} onClick={() => setSort('recent')}>Newest</Chip>
        </FilterRow>
      </div>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p role="alert" className="text-danger">Couldn’t load your dishes. {(error as Error).message}</p>}

      {data && data.length > 0 && (
        <>
          <p className="mb-2 flex items-center justify-between text-sm text-muted" aria-live="polite">
            <span>{data.length} {data.length === 1 ? 'dish' : 'dishes'}</span>
            {filtered && <button type="button" onClick={clearAll} className="underline">Clear filters</button>}
          </p>
          <ul className="space-y-3">{data.map((d) => <DishRow key={d.id} dish={d} />)}</ul>
        </>
      )}

      {data && data.length === 0 && !filtered && (
        <div className="mt-10 text-center">
          <p className="text-4xl" aria-hidden>🍜</p>
          <p className="mt-2 font-semibold">Nothing logged yet</p>
          <p className="text-sm text-muted">Snap your first dish. It takes about ten seconds.</p>
          <Link to="/log" className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent">
            Log a dish
          </Link>
        </div>
      )}

      {data && data.length === 0 && filtered && (
        <div className="mt-10 text-center">
          <p className="font-semibold">No matches</p>
          <p className="text-sm text-muted">Try fewer filters, or a shorter search.</p>
          <button type="button" onClick={clearAll}
            className="mt-4 rounded-xl border border-line bg-surface px-5 py-3 font-medium">Clear filters</button>
        </div>
      )}
    </section>
  )
}
