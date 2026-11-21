import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calls, result, from } = vi.hoisted(() => {
  const calls: Array<[string, unknown[]]> = []
  const result: { data: unknown; error: unknown } = { data: null, error: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = new Proxy({}, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => unknown) => resolve(result)
      return (...args: unknown[]) => { calls.push([String(prop), args]); return chain }
    },
  })
  return { calls, result, from: vi.fn(() => chain) }
})
vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import {
  addToList, createList, deleteList, getList, listLists, removeFromList, reorderItems, setListPublic, shareUrl, updateList,
} from './lists'

const call = (name: string) => calls.filter(([n]) => n === name).map(([, a]) => a)

beforeEach(() => {
  calls.length = 0
  result.data = null
  result.error = null
  from.mockClear()
})

describe('listLists', () => {
  it('returns lists with their dish counts', async () => {
    result.data = [
      { id: 'l1', title: 'Best grill', description: null, is_public: true, share_slug: 'abc', updated_at: 't', list_items: [{ count: 3 }] },
      { id: 'l2', title: 'Empty', description: null, is_public: false, share_slug: null, updated_at: 't', list_items: [] },
    ]
    const lists = await listLists()
    expect(from).toHaveBeenCalledWith('lists')
    expect(call('order')).toEqual([['updated_at', { ascending: false }]])
    expect(lists.map((l) => [l.title, l.count])).toEqual([['Best grill', 3], ['Empty', 0]])
    expect(lists[0]).not.toHaveProperty('list_items')
  })
})

describe('getList', () => {
  it('asks for one list with its items in position order', async () => {
    result.data = { id: 'l1', items: [] }
    await getList('l1')
    expect(call('eq')).toEqual([['id', 'l1']])
    expect(call('order')).toEqual([['position', { referencedTable: 'list_items', ascending: true }]])
    expect(call('maybeSingle')).toHaveLength(1)
  })
  it('returns null when it is missing or not yours', async () => {
    expect(await getList('nope')).toBeNull()
  })
})

describe('createList / updateList', () => {
  it('creates a list with a trimmed title', async () => {
    result.data = { id: 'new' }
    expect(await createList('  Best ćevapi ')).toEqual({ id: 'new' })
    expect(call('insert')).toEqual([[{ title: 'Best ćevapi' }]])
  })
  it('refuses an empty name before touching the database', async () => {
    await expect(createList('   ')).rejects.toThrow(/name/)
    expect(from).not.toHaveBeenCalled()
  })
  it('renames, trimming and refusing blanks', async () => {
    await updateList('l1', { title: ' New name ' })
    expect(call('update')).toEqual([[{ title: 'New name' }]])
    expect(call('eq')).toEqual([['id', 'l1']])
    await expect(updateList('l1', { title: ' ' })).rejects.toThrow(/name/)
  })
  it('clears an empty description to null', async () => {
    await updateList('l1', { description: '   ' })
    expect(call('update')).toEqual([[{ description: null }]])
  })
  it('throws database errors', async () => {
    result.error = new Error('rls')
    await expect(createList('x')).rejects.toThrow('rls')
  })
})

describe('sharing', () => {
  it('turns sharing on and returns the generated slug', async () => {
    result.data = { is_public: true, share_slug: 'AbC123xyz_-9' }
    expect(await setListPublic('l1', true)).toEqual({ is_public: true, share_slug: 'AbC123xyz_-9' })
    expect(call('update')).toEqual([[{ is_public: true }]])
  })
  it('turns sharing off', async () => {
    result.data = { is_public: false, share_slug: null }
    expect((await setListPublic('l1', false)).share_slug).toBeNull()
    expect(call('update')).toEqual([[{ is_public: false }]])
  })
  it('builds the link from the origin', () => {
    expect(shareUrl('abc', 'https://dish.example')).toBe('https://dish.example/l/abc')
    expect(shareUrl('abc')).toBe(`${window.location.origin}/l/abc`)
  })
})

describe('items', () => {
  it('adds a dish at the given position', async () => {
    await addToList('l1', 'd1', 4)
    expect(from).toHaveBeenCalledWith('list_items')
    expect(call('insert')).toEqual([[{ list_id: 'l1', dish_id: 'd1', position: 4 }]])
  })
  it('removes an item by id', async () => {
    await removeFromList('i1')
    expect(call('delete')).toEqual([[]])
    expect(call('eq')).toEqual([['id', 'i1']])
  })
  it('rewrites positions to match the new order', async () => {
    await reorderItems('l1', [{ id: 'i2', dishId: 'd2' }, { id: 'i1', dishId: 'd1' }])
    expect(call('upsert')).toEqual([[
      [
        { id: 'i2', list_id: 'l1', dish_id: 'd2', position: 0 },
        { id: 'i1', list_id: 'l1', dish_id: 'd1', position: 1 },
      ],
      { onConflict: 'id' },
    ]])
  })
  it('deletes a list', async () => {
    await deleteList('l1')
    expect(from).toHaveBeenCalledWith('lists')
    expect(call('delete')).toHaveLength(1)
  })
})
