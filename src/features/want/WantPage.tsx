import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDishes, dishesKey } from '@/features/dishes/useDishes'
import { deleteDish, type DishWithPlace } from '@/lib/repositories/dishes'
import { extractUrl, isHttpUrl } from '@/lib/linkPreview'

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function WantRow({ dish, onRemove, removing }: { dish: DishWithPlace; onRemove: () => void; removing: boolean }) {
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold">{dish.name}</h2>
      {dish.place && (
        <p className="text-sm text-muted">{dish.place.name}{dish.place.city ? ` · ${dish.place.city}` : ''}</p>
      )}
      {dish.source_url && isHttpUrl(dish.source_url) && (
        <a href={dish.source_url} target="_blank" rel="noopener noreferrer"
          className="mt-1 block truncate text-sm text-accent underline">{hostOf(dish.source_url)}</a>
      )}
      {dish.note && <p className="mt-1 text-sm">{dish.note}</p>}
      <div className="mt-3 flex items-center gap-4">
        <Link to={`/log?from=${dish.id}`}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent">Mark as tried</Link>
        <button type="button" disabled={removing} onClick={onRemove}
          className="text-sm text-muted underline disabled:opacity-50">Remove</button>
      </div>
    </li>
  )
}

export function WantPage() {
  const { data, isLoading, error } = useDishes('want_to_try')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pasteHint, setPasteHint] = useState<string | null>(null)

  const remove = useMutation({
    mutationFn: (id: string) => deleteDish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dishesKey }),
  })

  // iOS can't receive shares into a PWA, so "paste a link" is the share-in path there.
  const pasteLink = async () => {
    setPasteHint(null)
    try {
      const url = extractUrl(await navigator.clipboard.readText())
      if (url) navigate(`/want/add?url=${encodeURIComponent(url)}`)
      else setPasteHint('No link on your clipboard. Copy one first, or add it manually.')
    } catch {
      setPasteHint('Couldn’t read the clipboard. Allow paste, or use “Add manually”.')
    }
  }

  return (
    <section className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Want to try</h1>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={pasteLink}
          className="rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent">Paste a link</button>
        <Link to="/want/add"
          className="rounded-xl border border-line bg-surface px-4 py-3 text-center font-medium">Add manually</Link>
      </div>
      {pasteHint && <p role="status" className="mb-3 text-sm text-muted">{pasteHint}</p>}

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p role="alert" className="text-red-600">Couldn’t load your list. {(error as Error).message}</p>}
      {remove.error && <p role="alert" className="text-red-600">{(remove.error as Error).message}</p>}

      {data && data.length === 0 && (
        <div className="mt-8 text-center">
          <p className="font-semibold">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted">
            Found a place on Instagram or TikTok? Copy the link, tap “Paste a link”, and it lands here.
            On Android you can also share straight to this app.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((d) => (
            <WantRow key={d.id} dish={d} removing={remove.isPending && remove.variables === d.id}
              onRemove={() => { if (window.confirm(`Remove “${d.name}” from your list?`)) remove.mutate(d.id) }} />
          ))}
        </ul>
      )}
    </section>
  )
}
