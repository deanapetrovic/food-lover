import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { escapeHtml, fetchPublicList, isValidSlug, renderListHtml, renderNotFoundHtml, type OgList } from '../../api/_og.js'
import handler from '../../api/og-list.js'

const list: OgList = {
  title: 'Best ćevapi in Belgrade',
  description: null,
  owner: { display_name: 'Maja' },
  items: [{ name: 'Ćevapi', rating: 10 }, { name: 'Pljeskavica', rating: 8 }, { name: 'Kajmak', rating: 7 }, { name: 'Sarma', rating: 6 }],
}

describe('isValidSlug / escapeHtml', () => {
  it('accepts generated slugs only', () => {
    expect(isValidSlug('AbC123xyz_-9')).toBe(true)
    expect(isValidSlug('short')).toBe(false)
    expect(isValidSlug('has spaces in it')).toBe(false)
    expect(isValidSlug('../../etc/passwd')).toBe(false)
    expect(isValidSlug('a'.repeat(65))).toBe(false)
  })
  it('escapes HTML', () => {
    expect(escapeHtml(`<b onclick="x">'&'</b>`)).not.toMatch(/[<>"']/)
  })
})

describe('renderListHtml', () => {
  const html = renderListHtml(list, 'https://dish.example/l/AbC123xyz_-9')

  it('has the Open Graph and Twitter tags a link preview needs', () => {
    expect(html).toContain('<meta property="og:title" content="Best ćevapi in Belgrade · Dish Memory">')
    expect(html).toContain('<meta property="og:url" content="https://dish.example/l/AbC123xyz_-9">')
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(html).toContain('<meta name="twitter:card" content="summary">')
    expect(html).toContain('<link rel="canonical" href="https://dish.example/l/AbC123xyz_-9">')
  })
  it('summarises the list: count, owner and the first three dishes', () => {
    expect(html).toContain('4 dishes by Maja: Ćevapi, Pljeskavica, Kajmak and more')
  })
  it('keeps the page out of search engines', () => {
    expect(html).toContain('<meta name="robots" content="noindex">')
  })
  it('uses the owner’s description when there is one', () => {
    expect(renderListHtml({ ...list, description: 'My honest ranking' }, 'https://x.test/l/abcdefgh')).toContain(
      'content="My honest ranking"',
    )
  })
  it('escapes a hostile title so it cannot break out of the markup', () => {
    const evil = renderListHtml({ ...list, title: '"><script>alert(1)</script>' }, 'https://x.test/l/abcdefgh')
    expect(evil).not.toContain('<script>')
    expect(evil).toContain('&#60;script&#62;')
  })
  it('handles one dish and no owner', () => {
    const one = renderListHtml({ title: 'T', description: null, owner: { display_name: null }, items: [{ name: 'Burek', rating: 9 }] }, 'https://x.test/l/abcdefgh')
    expect(one).toContain('1 dish: Burek')
    expect(one).not.toContain(' by ')
  })
})

describe('renderNotFoundHtml', () => {
  it('says nothing about the list', () => {
    const html = renderNotFoundHtml()
    expect(html).toContain('This list isn’t available')
    expect(html).toContain('noindex')
    expect(html).not.toContain('og:title')
  })
})

describe('fetchPublicList', () => {
  it('calls the public database function with the anon key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => list }) as unknown as typeof fetch
    expect(await fetchPublicList('https://proj.supabase.co/', 'anon-key', 'AbC123xyz_-9', fetchImpl)).toEqual(list)
    expect(fetchImpl).toHaveBeenCalledWith('https://proj.supabase.co/rest/v1/rpc/get_public_list', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ p_slug: 'AbC123xyz_-9' }),
      headers: expect.objectContaining({ apikey: 'anon-key', Authorization: 'Bearer anon-key' }),
    }))
  })
  it('returns null when the list is private or unknown', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => null }) as unknown as typeof fetch
    expect(await fetchPublicList('https://p.co', 'k', 'AbC123xyz_-9', fetchImpl)).toBeNull()
  })
  it('throws when the database errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch
    await expect(fetchPublicList('https://p.co', 'k', 'AbC123xyz_-9', fetchImpl)).rejects.toThrow('500')
  })
})

describe('og-list function', () => {
  const request = (slug: string) => new Request(`https://dish.example/api/og-list?slug=${slug}`)
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://proj.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('returns preview HTML for a shared list', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => list })
    const res = await handler.fetch(request('AbC123xyz_-9'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex')
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=60')
    const body = await res.text()
    expect(body).toContain('og:title')
    expect(body).toContain('https://dish.example/l/AbC123xyz_-9')
  })

  it('returns 404 for a private or unknown list, without any list details', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => null })
    const res = await handler.fetch(request('AbC123xyz_-9'))
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain('og:title')
  })

  it('rejects a malformed slug without calling the database', async () => {
    const res = await handler.fetch(request('x'))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 404 when the environment is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    const res = await handler.fetch(request('AbC123xyz_-9'))
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 502 and does not cache when the database is down', async () => {
    fetchMock.mockRejectedValue(new Error('network'))
    const res = await handler.fetch(request('AbC123xyz_-9'))
    expect(res.status).toBe(502)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
