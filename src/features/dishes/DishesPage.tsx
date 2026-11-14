import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useDishes } from './useDishes'
import { usePhotoUrl } from './usePhotoUrl'
import type { DishWithPlace } from '@/lib/repositories/dishes'

function DishRow({ dish }: { dish: DishWithPlace }) {
  const url = usePhotoUrl(dish.photo_path)
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : (
          <div className="grid h-full w-full place-items-center text-2xl" aria-hidden>🍽️</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h2 className="truncate font-semibold">{dish.name}</h2>
          {dish.rating != null && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-on-accent"
              aria-label={`Rated ${dish.rating} out of 10`}>{dish.rating}</span>
          )}
        </div>
        <p className="truncate text-sm text-muted">
          {dish.place?.name}{dish.place?.city ? ` · ${dish.place.city}` : ''}
        </p>
        {dish.tags.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted">{dish.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        <p className="mt-1 text-xs text-muted">{new Date(dish.eaten_at).toLocaleDateString()}</p>
      </div>
    </li>
  )
}

export function DishesPage() {
  const { data, isLoading, error } = useDishes()

  return (
    <section className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dishes</h1>
        <button className="text-sm text-muted underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p role="alert" className="text-red-600">Couldn’t load your dishes. {(error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="mt-10 text-center">
          <p className="text-4xl" aria-hidden>🍜</p>
          <p className="mt-2 font-semibold">Nothing logged yet</p>
          <p className="text-sm text-muted">Snap your first dish. It takes about ten seconds.</p>
          <Link to="/log" className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent">
            Log a dish
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3">{data.map((d) => <DishRow key={d.id} dish={d} />)}</ul>
      )}
    </section>
  )
}
