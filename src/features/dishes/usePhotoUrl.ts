import { useQuery } from '@tanstack/react-query'
import { getSignedPhotoUrl } from '@/lib/photos'

/** Signed URL for a private dish photo (cached ~50 min of its 60 min lifetime). */
export function usePhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['photo-url', path],
    queryFn: () => getSignedPhotoUrl(path as string),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
  }).data
}
