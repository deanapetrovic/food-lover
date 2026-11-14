import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { useDish, useDishes, dishesKey } from '@/features/dishes/useDishes'
import { compressImage } from '@/lib/image'
import { uploadDishPhoto } from '@/lib/photos'
import { createDish, markTried } from '@/lib/repositories/dishes'
import { savePlace } from '@/lib/repositories/places'
import { useGeolocation } from '@/lib/useGeolocation'
import type { PlaceCandidate } from '@/lib/places'
import { PlacePicker } from './PlacePicker'
import { RatingPicker } from './RatingPicker'
import { TagInput } from './TagInput'

interface PickedPhoto {
  previewUrl: string
  task: Promise<string> // resolves to the storage path once uploaded
}

function topBy(values: string[], limit: number) {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([v]) => v)
}

export function LogDishPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const geo = useGeolocation()
  const { data: existing } = useDishes('tried')

  // /log?from=<id> converts a want-to-try item into a logged dish (same row, prefilled).
  const [params] = useSearchParams()
  const fromId = params.get('from')
  const { data: source } = useDish(fromId)
  const prefilled = useRef(false)

  const [photo, setPhoto] = useState<PickedPhoto | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [place, setPlace] = useState<PlaceCandidate | null>(null)
  const [name, setName] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const previewRef = useRef<string | null>(null)

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  useEffect(() => {
    if (!source || prefilled.current) return
    prefilled.current = true
    setName(source.name)
    setNote(source.note ?? '')
    setTags(source.tags)
    if (source.place) {
      setPlace({
        provider: 'saved', externalPlaceId: null, name: source.place.name, address: null,
        city: source.place.city, country: null, lat: source.place.lat, lng: source.place.lng,
        cuisine: source.place.cuisine, savedId: source.place.id,
      })
    }
  }, [source])

  const nameSuggestions = useMemo(() => topBy((existing ?? []).map((d) => d.name), 20), [existing])
  const tagSuggestions = useMemo(() => topBy((existing ?? []).flatMap((d) => d.tags), 6), [existing])

  // Start compressing + uploading the moment a photo is picked, while the user keeps typing.
  const onPickPhoto = (file: File | undefined) => {
    if (!file || !userId) return
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const previewUrl = URL.createObjectURL(file)
    previewRef.current = previewUrl
    setPhotoError(null)
    const task = compressImage(file).then((blob) => uploadDishPhoto(userId, blob))
    task.catch((e: Error) => setPhotoError(e.message || 'Photo upload failed'))
    setPhoto({ previewUrl, task })
  }

  const removePhoto = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPhoto(null)
    setPhotoError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!place || rating == null) throw new Error('Pick a place and a rating first')
      let photoPath: string | null = null
      if (photo) {
        try {
          photoPath = await photo.task
        } catch {
          throw new Error('The photo didn’t upload. Remove it or pick it again, then save.')
        }
      }
      const placeId = place.savedId ?? (await savePlace(place))
      const dish = { name, placeId, rating, note, tags, photoPath }
      return fromId ? markTried(fromId, dish) : createDish(dish)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dishesKey })
      navigate('/')
    },
  })

  const canSave = Boolean(name.trim() && place && rating != null) && !save.isPending

  return (
    <form className="space-y-5 p-4" onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate() }}>
      <h1 className="text-2xl font-bold">{fromId ? 'Mark as tried' : 'Log a dish'}</h1>

      {/* Photo first: one tap opens the camera on phones, the file picker on desktop. */}
      {photo ? (
        <div className="relative overflow-hidden rounded-2xl">
          <img src={photo.previewUrl} alt="Your dish" className="aspect-[4/3] w-full object-cover" />
          <button type="button" onClick={removePhoto}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            Remove
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 grid h-28 cursor-pointer place-items-center rounded-2xl bg-accent text-lg font-semibold text-on-accent">
            📷 Take photo
            <input aria-label="Take photo" type="file" accept="image/*" capture="environment" className="sr-only"
              onChange={(e) => { onPickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <label className="grid h-28 cursor-pointer place-items-center rounded-2xl border border-line bg-surface text-sm font-medium">
            🖼️ Library
            <input aria-label="Choose from library" type="file" accept="image/*" className="sr-only"
              onChange={(e) => { onPickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>
      )}
      {photoError && <p role="alert" className="text-sm text-red-600">{photoError}</p>}

      <PlacePicker coords={geo.coords} geoStatus={geo.status} selected={place} onSelect={setPlace} />

      <div>
        <label htmlFor="dish-name" className="mb-1 block text-sm font-medium">Dish</label>
        <input id="dish-name" list="dish-name-suggestions" value={name} autoComplete="off"
          placeholder="e.g. Ćevapi, large"
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-lg" />
        <datalist id="dish-name-suggestions">
          {nameSuggestions.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Rating</p>
        <RatingPicker value={rating} onChange={setRating} />
      </div>

      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-medium">Note and tags (optional)</summary>
        <div className="mt-3 space-y-3">
          <textarea aria-label="Note" value={note} rows={3} placeholder="What made it good (or not)?"
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3 py-2" />
          <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} />
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
