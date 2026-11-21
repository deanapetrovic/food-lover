// Helpers for the link-preview function (api/og-list.ts). The leading underscore keeps Vercel from
// treating this file as a route.

export interface OgList {
  title: string
  description: string | null
  owner: { display_name: string | null }
  items: Array<{ name: string; rating: number | null }>
}

export const isValidSlug = (slug: string) => /^[A-Za-z0-9_-]{8,64}$/.test(slug)

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

function page(head: string, body: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
${head}
</head>
<body>
${body}
</body>
</html>`
}

/** Minimal HTML with Open Graph / Twitter tags, served to link-preview crawlers (they don't run JavaScript). */
export function renderListHtml(list: OgList, pageUrl: string): string {
  const count = list.items.length
  const top = list.items.slice(0, 3).map((i) => i.name).join(', ')
  const by = list.owner.display_name ? ` by ${list.owner.display_name}` : ''
  const description = clip(
    list.description?.trim() ||
      `${count} ${count === 1 ? 'dish' : 'dishes'}${by}${top ? `: ${top}${count > 3 ? ' and more' : ''}` : ''}`,
    200,
  )
  const title = clip(`${list.title} · Dish Memory`, 90)
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const u = escapeHtml(pageUrl)
  return page(
    `<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${u}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Dish Memory">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">`,
    `<h1>${escapeHtml(list.title)}</h1>\n<p>${d}</p>\n<p><a href="${u}">Open the list</a></p>`,
  )
}

/** Same page for an unknown link and a list that is no longer shared, so neither is revealed. */
export function renderNotFoundHtml(): string {
  return page(
    `<title>List not available · Dish Memory</title>
<meta name="description" content="This list isn’t available.">`,
    `<h1>This list isn’t available</h1>`,
  )
}

/** Reads a public list through the same database function the app uses (works with the public anon key). */
export async function fetchPublicList(
  supabaseUrl: string,
  anonKey: string,
  slug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OgList | null> {
  const res = await fetchImpl(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_public_list`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug }),
  })
  if (!res.ok) throw new Error(`database responded ${res.status}`)
  return ((await res.json()) as OgList | null) ?? null
}
