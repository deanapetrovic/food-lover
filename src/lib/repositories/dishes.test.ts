import { beforeEach, describe, expect, it, vi } from 'vitest'

const { single, insert, order, selectList, from } = vi.hoisted(() => {
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))
  const order = vi.fn()
  const selectList = vi.fn(() => ({ order }))
  const from = vi.fn(() => ({ insert, select: selectList }))
  return { single, insert, order, selectList, from }
})

vi.mock('@/lib/supabase', () => ({ supabase: { from } }))

import { createDish, listDishes, normalizeTags } from './dishes'

beforeEach(() => vi.clearAllMocks())

describe('normalizeTags', () => {
  it('lower-cases, strips #, trims and de-duplicates', () => {
    expect(normalizeTags([' #Grill ', 'grill', 'SPICY', '', '  '])).toEqual(['grill', 'spicy'])
  })
  it('keeps at most 10 tags', () => {
    const many = Array.from({ length: 15 }, (_, i) => `t${i}`)
    expect(normalizeTags(many)).toHaveLength(10)
  })
})

describe('createDish', () => {
  it('inserts a tried dish with cleaned fields and returns the row', async () => {
    single.mockResolvedValue({ data: { id: 'd1' }, error: null })

    const row = await createDish({
      name: '  Ćevapi ',
      placeId: 'p1',
      rating: 9,
      note: '   ',
      tags: ['#Grill', 'grill'],
      photoPath: 'u1/a.jpg',
    })

    expect(from).toHaveBeenCalledWith('dishes')
    expect(insert).toHaveBeenCalledWith({
      name: 'Ćevapi',
      place_id: 'p1',
      rating: 9,
      note: null,
      tags: ['grill'],
      photo_path: 'u1/a.jpg',
      status: 'tried',
    })
    expect(row).toEqual({ id: 'd1' })
  })

  it('passes eaten_at only when given', async () => {
    single.mockResolvedValue({ data: { id: 'd2' }, error: null })
    await createDish({ name: 'x', placeId: 'p', rating: 5, eatenAt: '2026-01-02T10:00:00Z' })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ eaten_at: '2026-01-02T10:00:00Z' }))
  })

  it('throws the database error', async () => {
    single.mockResolvedValue({ data: null, error: new Error('rls') })
    await expect(createDish({ name: 'x', placeId: 'p', rating: 5 })).rejects.toThrow('rls')
  })
})

describe('listDishes', () => {
  it('asks for newest first with the place joined', async () => {
    order.mockResolvedValue({ data: [{ id: 'd1' }], error: null })
    const rows = await listDishes()
    expect(selectList).toHaveBeenCalledWith(expect.stringContaining('place:places('))
    expect(order).toHaveBeenCalledWith('eaten_at', { ascending: false })
    expect(rows).toEqual([{ id: 'd1' }])
  })
})
