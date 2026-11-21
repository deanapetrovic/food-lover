import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createList } from '@/lib/repositories/lists'
import { listsKey, useLists } from './useLists'

export function ListsPage() {
  const { data, isLoading, error } = useLists()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')

  const create = useMutation({
    mutationFn: () => createList(title),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: listsKey })
      navigate(`/lists/${id}`)
    },
  })

  return (
    <section className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lists</h1>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent">New list</button>
        )}
      </header>

      {creating && (
        <form className="mb-4 rounded-2xl border border-line bg-surface p-3"
          onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate() }}>
          <label htmlFor="new-list-title" className="mb-1 block text-sm font-medium">List name</label>
          <input id="new-list-title" autoFocus value={title} placeholder="e.g. Best ćevapi in Belgrade"
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-3" />
          {create.error && <p role="alert" className="mt-2 text-sm text-danger">{(create.error as Error).message}</p>}
          <div className="mt-3 flex gap-2">
            <button type="submit" disabled={!title.trim() || create.isPending}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-40">
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setTitle('') }}
              className="rounded-xl border border-line px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-muted">Loading…</p>}
      {error && <p role="alert" className="text-danger">Couldn’t load your lists. {(error as Error).message}</p>}

      {data && data.length === 0 && !creating && (
        <div className="mt-10 text-center">
          <p className="font-semibold">No lists yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            Make a list of your favourites, like “Best ćevapi in Belgrade”, and share it with a link anyone can open.
          </p>
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3">
          {data.map((l) => (
            <li key={l.id}>
              <Link to={`/lists/${l.id}`} className="block rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{l.title}</h2>
                  {l.is_public && (
                    <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">Shared</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">{l.count} {l.count === 1 ? 'dish' : 'dishes'}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
