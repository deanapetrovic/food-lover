import { Link } from 'react-router-dom'
import type { DishListItem } from '@/lib/repositories/dishes'
import { reorderLabel } from './reorder'
import { usePhotoUrl } from './usePhotoUrl'

interface Props {
  dish: DishListItem
  /** Show the place line (off on the place page, where every dish is at the same place). */
  showPlace?: boolean
  /** Show the "Must reorder" / "Skip" verdict. */
  verdict?: boolean
}

export function DishRow({ dish, showPlace = true, verdict = false }: Props) {
  const url = usePhotoUrl(dish.photo_path)
  const label = verdict ? reorderLabel(dish.rating) : null
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
          {dish.rating != null ? (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-on-accent"
              aria-label={`Rated ${dish.rating} out of 10`}>{dish.rating}</span>
          ) : (
            <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-xs text-muted">Want to try</span>
          )}
        </div>
        {showPlace && dish.place && (
          <p className="truncate text-sm text-muted">
            <Link to={`/place/${dish.place.id}`} className="underline-offset-2 hover:underline">{dish.place.name}</Link>
            {dish.place.city ? ` · ${dish.place.city}` : ''}
          </p>
        )}
        {label && (
          <p className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
            label === 'Skip' ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'
          }`}>{label}</p>
        )}
        {dish.tags.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted">{dish.tags.map((t) => `#${t}`).join(' ')}</p>
        )}
        <p className="mt-1 text-xs text-muted">{new Date(dish.eaten_at).toLocaleDateString()}</p>
      </div>
    </li>
  )
}
