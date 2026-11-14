import { supabase } from '@/lib/supabase'

export interface LinkPreview {
  url: string
  title: string | null
  description: string | null
  siteName: string | null
  author?: string | null
}

/** First http(s) URL inside shared text ("Check this out https://… 🔥"). */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i)
  return m ? m[0].replace(/[).,;!?]+$/, '') : null
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

const SITE_SUFFIX = /\s*[|\-–•·]\s*(instagram|tiktok|facebook|youtube|google maps|tripadvisor|foursquare|yelp|wolt|glovo)\b.*$/i
// Titles that name the site, not a place (login walls, bot checks, bare map pages).
const GENERIC_TITLE = /^(google maps|instagram|tiktok|facebook|youtube|log ?in|sign ?in|just a moment\.{0,3}|access denied)$/i
const ON_SITE =/\s+on\s+(instagram|tiktok|facebook|youtube)\b.*$/i

/** Strips "… | Instagram" style suffixes and caps the length. */
export function cleanTitle(title: string): string {
  return title
    .replace(ON_SITE, '')
    .replace(SITE_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/**
 * Best-effort guess of the place a link is about, used to pre-fill the place search.
 * Google Maps links carry the name in the path; for other sites we fall back to the page title.
 * Always a suggestion: the user confirms the place.
 */
export function guessPlaceQuery(url: string, preview?: LinkPreview | null): string | null {
  for (const candidate of [url, preview?.url]) {
    if (!candidate) continue
    try {
      const u = new URL(candidate)
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.startsWith('/maps/place/')) {
        const name = u.pathname.split('/')[3]
        if (name) return decodeURIComponent(name.replace(/\+/g, ' ')).trim() || null
      }
    } catch {
      /* not a URL */
    }
  }
  const title = preview?.title ? cleanTitle(preview.title) : ''
  return title.length >= 2 && !GENERIC_TITLE.test(title) ? title : null
}

export async function resolveLink(url: string): Promise<LinkPreview> {
  const { data, error } = await supabase.functions.invoke<LinkPreview>('resolve-link', { body: { url } })
  if (error || !data) throw new Error(error?.message ?? 'Could not read this link')
  return data
}
