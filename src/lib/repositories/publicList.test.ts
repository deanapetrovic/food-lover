import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, invoke } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { rpc, functions: { invoke } } }))

import { getPublicList, getPublicListPhotos, mapsLink } from './publicList'

beforeEach(() => { rpc.mockReset(); invoke.mockReset() })

describe('getPublicList', () => {
  it('reads a list through the public database function', async () => {
    rpc.mockResolvedValue({ data: { id: 'l1', title: 'Best grill', items: [] }, error: null })
    expect(await getPublicList('abc')).toMatchObject({ title: 'Best grill' })
    expect(rpc).toHaveBeenCalledWith('get_public_list', { p_slug: 'abc' })
  })
  it('returns null for an unknown or private list', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    expect(await getPublicList('nope')).toBeNull()
  })
  it('throws database errors', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') })
    await expect(getPublicList('x')).rejects.toThrow('boom')
  })
})

describe('getPublicListPhotos', () => {
  it('returns the signed links by path', async () => {
    invoke.mockResolvedValue({ data: { urls: { 'u/a.jpg': 'https://signed/a' } }, error: null })
    expect(await getPublicListPhotos('abc')).toEqual({ 'u/a.jpg': 'https://signed/a' })
    expect(invoke).toHaveBeenCalledWith('public-list-photos', { body: { slug: 'abc' } })
  })
  it('falls back to no photos if the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('down') })
    expect(await getPublicListPhotos('abc')).toEqual({})
  })
  it('falls back to no photos if the call throws', async () => {
    invoke.mockRejectedValue(new Error('network'))
    expect(await getPublicListPhotos('abc')).toEqual({})
  })
})

describe('mapsLink', () => {
  const base = { id: 'p', name: 'Zlatni', address: 'Skadarska 14', city: 'Belgrade', cuisine: null }
  it('uses coordinates when it has them', () => {
    const href = mapsLink({ ...base, lat: 44.8, lng: 20.4 })
    expect(new URL(href).searchParams.get('query')).toBe('44.8,20.4')
  })
  it('searches by name and address otherwise', () => {
    const href = mapsLink({ ...base, lat: null, lng: null })
    expect(new URL(href).searchParams.get('query')).toBe('Zlatni, Skadarska 14')
  })
})
