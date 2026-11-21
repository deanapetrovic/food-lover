// Vercel Function: link-preview HTML for shared lists.
// vercel.json sends /l/<slug> here only when the visitor is a known link-preview crawler (Slack, WhatsApp,
// iMessage, Facebook, X, Telegram, ...). People get the normal app. Needs the same two env vars the app
// already uses; no secrets.

import { fetchPublicList, isValidSlug, renderListHtml, renderNotFoundHtml } from './_og.js'

const html = (body: string, status: number, cache: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache, 'X-Robots-Tag': 'noindex' },
  })

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const slug = url.searchParams.get('slug') ?? ''
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY

    if (!isValidSlug(slug) || !supabaseUrl || !anonKey) return html(renderNotFoundHtml(), 404, 'public, s-maxage=60')

    try {
      const list = await fetchPublicList(supabaseUrl, anonKey, slug)
      if (!list) return html(renderNotFoundHtml(), 404, 'public, s-maxage=60')
      // Short cache: if the owner stops sharing, the preview disappears within a minute.
      return html(renderListHtml(list, `${url.origin}/l/${slug}`), 200, 'public, s-maxage=60, stale-while-revalidate=300')
    } catch {
      return html(renderNotFoundHtml(), 502, 'no-store')
    }
  },
}
