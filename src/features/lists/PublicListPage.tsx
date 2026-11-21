import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPublicList, getPublicListPhotos, mapsLink, type PublicListItem } from '@/lib/repositories/publicList'

function Item({ item, rank, photo }: { item: PublicListItem; rank: number; photo?: string }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface">
      {photo && <img src={photo} alt={item.name} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">
            <span className="mr-2 text-muted">{rank}.</span>{item.name}
          </h2>
          {item.rating != null && (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-on-accent"
              aria-label={`Rated ${item.rating} out of 10`}>{item.rating}</span>
          )}
        </div>
        {item.place && (
          <p className="mt-1 text-sm">
            <a href={mapsLink(item.place)} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              {item.place.name}
            </a>
            <span className="text-muted">{item.place.city ? ` · ${item.place.city}` : ''}</span>
          </p>
        )}
        {item.note && <p className="mt-2 text-sm">{item.note}</p>}
        {item.tags.length > 0 && <p className="mt-2 text-xs text-muted">{item.tags.map((t) => `#${t}`).join(' ')}</p>}
      </div>
    </li>
  )
}

/** Read-only page for a shared list. Reachable signed out, with no install. */
export function PublicListPage() {
  const { slug = '' } = useParams()

  const list = useQuery({
    queryKey: ['public-list', slug],
    queryFn: () => getPublicList(slug),
    retry: false,
  })
  const hasPhotos = Boolean(list.data?.items.some((i) => i.photo_path))
  const photos = useQuery({
    queryKey: ['public-list-photos', slug],
    queryFn: () => getPublicListPhotos(slug),
    enabled: hasPhotos,
    staleTime: 50 * 60 * 1000,
  })

  // Shared lists are unlisted: keep search engines away, and give the tab a useful title.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => { meta.remove() }
  }, [])
  useEffect(() => {
    if (!list.data) return
    const previous = document.title
    document.title = `${list.data.title} · Dish Memory`
    return () => { document.title = previous }
  }, [list.data])

  return (
    <main className="mx-auto min-h-full max-w-md px-4 py-8">
      {list.isLoading && <p className="text-muted">Loading…</p>}

      {list.error && (
        <div className="mt-16 text-center" role="alert">
          <h1 className="text-xl font-bold">Couldn’t load this list</h1>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
        </div>
      )}

      {!list.isLoading && !list.error && !list.data && (
        <div className="mt-16 text-center">
          <h1 className="text-xl font-bold">This list isn’t available</h1>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            The link may be wrong, or the owner stopped sharing it.
          </p>
        </div>
      )}

      {list.data && (
        <>
          <header className="mb-5">
            <h1 className="text-3xl font-bold">{list.data.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {list.data.owner.display_name ? `by ${list.data.owner.display_name} · ` : ''}
              {list.data.items.length} {list.data.items.length === 1 ? 'dish' : 'dishes'}
            </p>
            {list.data.description && <p className="mt-3">{list.data.description}</p>}
          </header>

          {list.data.items.length === 0 ? (
            <p className="text-sm text-muted">This list is empty for now.</p>
          ) : (
            <ol className="space-y-4">
              {list.data.items.map((item, i) => (
                <Item key={item.dish_id} item={item} rank={i + 1}
                  photo={item.photo_path ? photos.data?.[item.photo_path] : undefined} />
              ))}
            </ol>
          )}
        </>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        Made with <span className="font-medium">Dish Memory</span>, a private food diary
      </footer>
    </main>
  )
}
