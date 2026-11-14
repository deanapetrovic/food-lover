import { supabase } from '@/lib/supabase'

const BUCKET = 'dish-photos'
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Uploads to `{userId}/{uuid}.jpg` in the private bucket and returns the storage path. */
export async function uploadDishPhoto(userId: string, blob: Blob): Promise<string> {
  const type = blob.type || 'image/jpeg'
  const path = `${userId}/${crypto.randomUUID()}.${EXT[type] ?? 'jpg'}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: type, cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function getSignedPhotoUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}
