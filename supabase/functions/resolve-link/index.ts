// Edge Function: best-effort link preview for shared links (Instagram, TikTok, Google Maps, blogs...).
// POST { url } -> { url, title, description, siteName, author }
// Requires a signed-in user (verify_jwt = true).
//
// Because this fetches a user-supplied URL from our servers, it is hardened against SSRF:
// http(s) on ports 80/443 only, hostnames must resolve to public addresses (re-checked on every
// redirect), redirects are followed manually (max 4), 6 s timeout, 512 KB body cap, HTML only.
// Known limit: DNS can change between our check and the fetch (rebinding); the function holds no
// secrets and returns only parsed text, so the blast radius is small.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MAX_BYTES = 512 * 1024
const TIMEOUT_MS = 6000
const MAX_REDIRECTS = 4
const UA = 'Mozilla/5.0 (compatible; DishMemoryBot/1.0; link preview)'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const l = ip.toLowerCase()
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:')
  }
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true
  return (
    p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168)
  )
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad_scheme')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('bad_port')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('private_host')
  }
  const isIp = /^[\d.]+$/.test(host) || host.includes(':')
  const ips = isIp
    ? [host]
    : [
        ...(await Deno.resolveDns(host, 'A').catch(() => [] as string[])),
        ...(await Deno.resolveDns(host, 'AAAA').catch(() => [] as string[])),
      ]
  if (ips.length === 0) throw new Error('unresolvable')
  if (ips.some(isPrivateIp)) throw new Error('private_address')
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => {})
  const all = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { all.set(c, o); o += c.length }
  return new TextDecoder('utf-8', { fatal: false }).decode(all)
}

async function fetchHtml(start: URL): Promise<{ finalUrl: URL; html: string }> {
  let current = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current)
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'en' },
    })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return { finalUrl: current, html: '' }
      current = new URL(loc, current)
      continue
    }
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.includes('html')) { await res.body?.cancel().catch(() => {}); return { finalUrl: current, html: '' } }
    return { finalUrl: current, html: await readCapped(res) }
  }
  throw new Error('too_many_redirects')
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

function parseMeta(html: string) {
  const map = new Map<string, string>()
  for (const tag of html.slice(0, 200_000).match(/<meta\s+[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? ''
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase()
    if (key && attrs.content && !map.has(key)) map.set(key, decode(attrs.content))
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return {
    title: map.get('og:title') ?? map.get('twitter:title') ?? (titleTag ? decode(titleTag) : null),
    description: map.get('og:description') ?? map.get('twitter:description') ?? map.get('description') ?? null,
    siteName: map.get('og:site_name') ?? null,
  }
}

async function tiktokOembed(url: URL) {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': UA },
    })
    if (!res.ok) return null
    const j = (await res.json()) as { title?: string; author_name?: string }
    return { title: j.title ? decode(j.title) : null, author: j.author_name ?? null }
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let raw = ''
  try { raw = String((await req.json()).url ?? '') } catch { return json({ error: 'bad_json' }, 400) }
  if (!raw || raw.length > 2000) return json({ error: 'bad_url' }, 400)

  let target: URL
  try { target = new URL(raw) } catch { return json({ error: 'bad_url' }, 400) }

  try {
    const { finalUrl, html } = await fetchHtml(target)
    const meta = parseMeta(html)
    let { title } = meta
    let author: string | null = null
    if (!title && finalUrl.hostname.endsWith('tiktok.com')) {
      const o = await tiktokOembed(finalUrl)
      title = o?.title ?? null
      author = o?.author ?? null
    }
    return json({ url: finalUrl.toString(), title, description: meta.description, siteName: meta.siteName, author })
  } catch (e) {
    const code = (e as Error).message
    const blocked = ['bad_scheme', 'bad_port', 'private_host', 'private_address'].includes(code)
    return json({ error: blocked ? 'url_not_allowed' : 'fetch_failed' }, blocked ? 400 : 502)
  }
})
