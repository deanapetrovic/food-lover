import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dishesKey } from '@/features/dishes/useDishes'
import { PlacePicker } from '@/features/log/PlacePicker'
import { TagInput } from '@/features/log/TagInput'
import { cleanTitle, extractUrl, guessPlaceQuery, isHttpUrl, resolveLink, type LinkPreview } from '@/lib/linkPreview'
import type { PlaceCandidate } from '@/lib/places'
import { addWantToTry } from '@/lib/repositories/dishes'
import { savePlace } from '@/lib/repositories/places'

/** Android's share sheet opens /share?title=&text=&url= (PWA share target); same screen. */
export function ShareRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/want/add${search}`} replace />
}

type ReadState = 'idle' | 'loading' | 'ready' | 'failed'

export function AddWantPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const sharedUrl = extractUrl(params.get('url') ?? '') ?? extractUrl(params.get('text') ?? '') ?? ''
  const sharedTitle = cleanTitle(params.get('title') ?? '')

  const [url, setUrl] = useState(sharedUrl)
  const [name, setName] = useState(sharedTitle)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [place, setPlace] = useState<PlaceCandidate | null>(null)
  const [placeQuery, setPlaceQuery] = useState<string | undefined>()
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [readState, setReadState] = useState<ReadState>('idle')
  const lastRead = useRef('')

  // Best-effort: read the link, guess the place, and let the user confirm both.
  const readLink = async (target: string) => {
    if (!isHttpUrl(target) || lastRead.current === target) return
    lastRead.current = target
    setReadState('loading')
    let p: LinkPreview | null = null
    try {
      p = await resolveLink(target)
      setPreview(p)
      setReadState('ready')
    } catch {
      setReadState('failed')
    }
    const guess = guessPlaceQuery(target, p)
    if (guess) {
      setPlaceQuery(guess)
      setName((n) => n || guess)
    }
  }

  useEffect(() => {
    if (sharedUrl) void readLink(sharedUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const paste = async () => {
    try {
      const found = extractUrl(await navigator.clipboard.readText())
      if (found) { setUrl(found); void readLink(found) }
    } catch { /* clipboard blocked: the user can type the link */ }
  }

  const save = useMutation({
    mutationFn: async () => {
      const placeId = place ? (place.savedId ?? (await savePlace(place))) : null
      return addWantToTry({ name, placeId, sourceUrl: url, note, tags })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dishesKey })
      navigate('/want')
    },
  })

  const urlInvalid = url.trim() !== '' && !isHttpUrl(url.trim())
  const canSave = Boolean(name.trim()) && !urlInvalid && !save.isPending

  return (
    <form className="space-y-5 p-4" onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate() }}>
      <h1 className="text-2xl font-bold">Add to want-to-try</h1>

      <div>
        <label htmlFor="want-url" className="mb-1 block text-sm font-medium">Link (optional)</label>
        <div className="flex gap-2">
          <input id="want-url" type="url" inputMode="url" value={url} placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)} onBlur={() => void readLink(url.trim())}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-3" />
          <button type="button" onClick={paste}
            className="rounded-xl border border-line bg-surface px-3 text-sm font-medium">Paste</button>
        </div>
        {urlInvalid && <p role="alert" className="mt-1 text-sm text-red-600">Links must start with http:// or https://</p>}
        {readState === 'loading' && <p className="mt-1 text-sm text-muted">Reading the link…</p>}
        {readState === 'failed' && (
          <p className="mt-1 text-sm text-muted">Couldn’t read that link (some apps block previews). You can still save it.</p>
        )}
        {readState === 'ready' && preview && (preview.title || preview.description) && (
          <div className="mt-2 rounded-xl border border-line bg-surface p-3 text-sm" data-testid="link-preview">
            {preview.title && <p className="font-medium">{preview.title}</p>}
            {preview.description && <p className="mt-1 line-clamp-3 text-muted">{preview.description}</p>}
            {preview.siteName && <p className="mt-1 text-xs text-muted">{preview.siteName}</p>}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="want-name" className="mb-1 block text-sm font-medium">What do you want to try?</label>
        <input id="want-name" value={name} autoComplete="off" placeholder="Dish or place, e.g. Pljeskavica"
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-lg" />
      </div>

      <PlacePicker coords={null} geoStatus="unavailable" selected={place} onSelect={setPlace}
        nearby={false} label="Where is it? (optional)" initialQuery={placeQuery} />
      {placeQuery && !place && (
        <p className="-mt-3 text-sm text-muted">We guessed a place from the link. Tap the right one to confirm, or skip it.</p>
      )}

      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">Note and tags (optional)</summary>
        <div className="mt-3 space-y-3">
          <textarea aria-label="Note" value={note} rows={3} placeholder="Why do you want to try it?"
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </details>

      {save.error && <p role="alert" className="text-sm text-red-600">{(save.error as Error).message}</p>}

      <button type="submit" disabled={!canSave}
        className="w-full rounded-2xl bg-accent py-4 text-lg font-bold text-on-accent disabled:opacity-40">
        {save.isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
