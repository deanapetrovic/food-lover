/** Largest size that fits in a max x max box, never upscaling. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

const PASS_THROUGH = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

/**
 * Resize + re-encode as JPEG in the browser (typically 3-8 MB -> ~300 KB), honouring EXIF
 * orientation. If the browser can't decode it, fall back to the original when it's a
 * supported type under the bucket's size limit.
 */
export async function compressImage(
  file: Blob,
  { maxSize = 1600, quality = 0.8 }: { maxSize?: number; quality?: number } = {},
): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSize)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) throw new Error('encode failed')
    return blob
  } catch (err) {
    if (PASS_THROUGH.includes(file.type) && file.size <= MAX_BYTES) return file
    throw new Error('This photo format is not supported. Try a JPEG or PNG.', { cause: err })
  }
}
