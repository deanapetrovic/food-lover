import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchDishes } from '@/features/dishes/useSearch'
import { usePhotoUrl } from '@/features/dishes/usePhotoUrl'
import {
  addToList, deleteList, removeFromList, reorderItems, setListPublic, shareUrl, updateList,
  type ListDetail, type ListItemRow,
} from '@/lib/repositories/lists'
import { DisplayNameField } from './DisplayNameField'
import { listsKey, useList } from './useLists'

function ItemRow({
  item, index, total, onMove, onRemove, busy,
}: { item: ListItemRow; index: number; total: number; onMove: (from: number, to: number) => void; onRemove: () => void; busy: boolean }) {
  const photo = usePhotoUrl(item.dish.photo_path)
  const { dish } = item
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
      <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted">{index + 1}</span>
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-bg">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{dish.name}</p>
        <p className="truncate text-sm text-muted">
          {dish.place?.name}{dish.place?.city ? ` · ${dish.place.city}` : ''}
          {dish.rating != null ? ` · ${dish.rating}/10` : ' · want to try'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label={`Move ${dish.name} up`} disabled={busy || index === 0}
          onClick={() => onMove(index, index - 1)} className="rounded-lg border border-line px-2 py-1 disabled:opacity-30">↑</button>
        <button type="button" aria-label={`Move ${dish.name} down`} disabled={busy || index === total - 1}
          onClick={() => onMove(index, index + 1)} className="rounded-lg border border-line px-2 py-1 disabled:opacity-30">↓</button>
        <button type="button" aria-label={`Remove ${dish.name}`} disabled={busy}
          onClick={onRemove} className="rounded-lg px-2 py-1 text-danger disabled:opacity-30">✕</button>
      </div>
    </li>
  )
}

function AddDishes({ list, onAdd, busy }: { list: ListDetail; onAdd: (dishId: string) => void; busy: boolean }) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250)
    return () => clearTimeout(id)
  }, [text])

  const { data, isLoading } = useSearchDishes({ q, status: null, sort: 'best' })
  const inList = useMemo(() => new Set(list.items.map((i) => i.dish.id)), [list.items])
  const candidates = (data ?? []).filter((d) => !inList.has(d.id)).slice(0, 12)

  return (
    <details className="rounded-2xl border border-line bg-surface p-3">
      <summary className="cursor-pointer text-sm font-semibold">Add dishes</summary>
      <div className="mt-3">
        <input type="search" aria-label="Search your dishes" value={text} placeholder="Search your dishes…"
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
        {isLoading && <p className="mt-2 text-sm text-muted">Loading…</p>}
        {data && candidates.length === 0 && (
          <p className="mt-2 text-sm text-muted">{q ? 'No matching dishes left to add.' : 'Every dish is already in this list.'}</p>
        )}
        <ul className="mt-2 space-y-2">
          {candidates.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="truncate text-xs text-muted">
                  {d.place?.name}{d.rating != null ? ` · ${d.rating}/10` : ' · want to try'}
                </p>
              </div>
              <button type="button" aria-label={`Add ${d.name}`} disabled={busy} onClick={() => onAdd(d.id)}
                className="shrink-0 rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-on-accent disabled:opacity-40">Add</button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

export function ListDetailPage() {
  const { id = null } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: list, isLoading, error } = useList(id)

  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState('')
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: listsKey })
  const onError = (e: unknown) => setActionError((e as Error).message)
  const options = { onSuccess: () => { setActionError(null); return refresh() }, onError }

  const rename = useMutation({ mutationFn: (t: string) => updateList(list!.id, { title: t }), ...options, onSuccess: async () => { setEditingTitle(false); setActionError(null); await refresh() } })
  const add = useMutation({ mutationFn: (dishId: string) => addToList(list!.id, dishId, list!.items.length), ...options })
  const remove = useMutation({ mutationFn: (itemId: string) => removeFromList(itemId), ...options })
  const move = useMutation({
    mutationFn: ({ from, to }: { from: number; to: number }) => {
      const next = list!.items.map((i) => ({ id: i.id, dishId: i.dish.id }))
      next.splice(to, 0, next.splice(from, 1)[0])
      return reorderItems(list!.id, next)
    },
    ...options,
  })
  const share = useMutation({ mutationFn: (isPublic: boolean) => setListPublic(list!.id, isPublic), ...options })
  const destroy = useMutation({
    mutationFn: () => deleteList(list!.id),
    onSuccess: async () => { await refresh(); navigate('/lists', { replace: true }) },
    onError,
  })

  const busy = add.isPending || remove.isPending || move.isPending

  if (isLoading) return <section className="p-4"><p className="text-muted">Loading…</p></section>
  if (error) return <section className="p-4"><p role="alert" className="text-danger">Couldn’t load this list. {(error as Error).message}</p></section>
  if (!list) {
    return (
      <section className="p-4">
        <button type="button" onClick={() => navigate('/lists')} className="mb-3 text-sm text-accent">‹ Lists</button>
        <h1 className="text-2xl font-bold">List not found</h1>
      </section>
    )
  }

  const link = list.is_public && list.share_slug ? shareUrl(list.share_slug) : null
  const copy = async () => {
    if (!link) return
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { setActionError('Couldn’t copy. Select the link and copy it by hand.') }
  }
  const nativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <section className="space-y-4 p-4">
      <button type="button" onClick={() => navigate('/lists')} className="text-sm text-accent">‹ Lists</button>

      <header>
        {editingTitle ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (title.trim()) rename.mutate(title) }}>
            <input aria-label="List name" value={title} autoFocus onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-lg font-semibold" />
            <button type="submit" disabled={!title.trim() || rename.isPending}
              className="rounded-xl bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-40">Save</button>
            <button type="button" onClick={() => setEditingTitle(false)} className="rounded-xl border border-line px-3 text-sm">Cancel</button>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-2xl font-bold">{list.title}</h1>
            <button type="button" onClick={() => { setTitle(list.title); setEditingTitle(true) }}
              className="shrink-0 text-sm text-muted underline">Rename</button>
          </div>
        )}
        <p className="text-sm text-muted">{list.items.length} {list.items.length === 1 ? 'dish' : 'dishes'}</p>
      </header>

      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}

      {list.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-center text-sm text-muted">
          Nothing here yet. Open “Add dishes” below to pick some from your log.
        </p>
      ) : (
        <ol className="space-y-2">
          {list.items.map((item, index) => (
            <ItemRow key={item.id} item={item} index={index} total={list.items.length} busy={busy}
              onMove={(from, to) => move.mutate({ from, to })} onRemove={() => remove.mutate(item.id)} />
          ))}
        </ol>
      )}

      <AddDishes list={list} onAdd={(dishId) => add.mutate(dishId)} busy={busy} />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Share with a link</p>
            <p className="text-sm text-muted">Anyone with the link can view this list. No account or app needed.</p>
          </div>
          <button type="button" role="switch" aria-checked={list.is_public} aria-label="Share with a link"
            disabled={share.isPending} onClick={() => share.mutate(!list.is_public)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${list.is_public ? 'bg-accent' : 'bg-line'}`}>
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${list.is_public ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>

        {link && (
          <div className="mt-3 space-y-2">
            <input readOnly aria-label="Share link" value={link} onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent">
                {copied ? 'Copied ✓' : 'Copy link'}
              </button>
              {nativeShare && (
                <button type="button" onClick={() => navigator.share({ title: list.title, url: link }).catch(() => {})}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-medium">Share…</button>
              )}
              <a href={link} target="_blank" rel="noopener noreferrer"
                className="rounded-xl border border-line px-4 py-2 text-sm font-medium">Preview</a>
            </div>
            <p className="text-xs text-muted">
              Visitors see each dish’s name, rating, note, tags, place and photo, plus the name below if you set one.
              They never see your email. Turn sharing off any time and the link stops working.
            </p>
            <DisplayNameField />
          </div>
        )}
      </div>

      <button type="button" disabled={destroy.isPending}
        onClick={() => { if (window.confirm(`Delete “${list.title}”? Your dishes stay; only the list is removed.`)) destroy.mutate() }}
        className="text-sm text-danger underline disabled:opacity-50">Delete list</button>
    </section>
  )
}
