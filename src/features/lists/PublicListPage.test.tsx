import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getPublicList = vi.fn()
const getPublicListPhotos = vi.fn()

vi.mock('@/lib/repositories/publicList', async (orig) => ({
  ...(await orig<typeof import('@/lib/repositories/publicList')>()),
  getPublicList: (...a: unknown[]) => getPublicList(...a),
  getPublicListPhotos: (...a: unknown[]) => getPublicListPhotos(...a),
}))

import { PublicListPage } from './PublicListPage'

const place = { id: 'p1', name: 'Zlatni', address: 'Skadarska 14', city: 'Belgrade', lat: 44.8, lng: 20.4, cuisine: 'grill' }
const list = {
  id: 'l1', title: 'Best ćevapi in Belgrade', description: 'My honest ranking', updated_at: 't',
  owner: { display_name: 'Maja' },
  items: [
    { dish_id: 'd1', position: 0, name: 'Ćevapi, 10 pcs', rating: 10, note: 'Smoky', tags: ['grill', 'lunch'], photo_path: 'u/d1.jpg', eaten_at: 't', place },
    { dish_id: 'd2', position: 1, name: 'Pljeskavica', rating: 8, note: null, tags: [], photo_path: null, eaten_at: 't', place },
  ],
}

function renderAt(slug = 'AbC123xyz_-9') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/l/${slug}`]}>
        <Routes><Route path="/l/:slug" element={<PublicListPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  document.title = 'Dish Memory'
  document.head.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove())
  getPublicList.mockResolvedValue(list)
  getPublicListPhotos.mockResolvedValue({ 'u/d1.jpg': 'https://signed.example/d1' })
})

describe('PublicListPage', () => {
  it('shows the list, its owner and the dishes in order, with ratings', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { level: 1, name: 'Best ćevapi in Belgrade' })).toBeInTheDocument()
    expect(getPublicList).toHaveBeenCalledWith('AbC123xyz_-9')
    expect(screen.getByText(/by Maja · 2 dishes/)).toBeInTheDocument()
    expect(screen.getByText('My honest ranking')).toBeInTheDocument()

    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['1.Ćevapi, 10 pcs', '2.Pljeskavica'])
    expect(screen.getByLabelText('Rated 10 out of 10')).toBeInTheDocument()
    expect(screen.getByText('Smoky')).toBeInTheDocument()
    expect(screen.getByText('#grill #lunch')).toBeInTheDocument()
  })

  it('links each place to a map, opening in a new tab', async () => {
    renderAt()
    const links = await screen.findAllByRole('link', { name: 'Zlatni' })
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('google.com/maps/search'))
    expect(links[0]).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows photos when the photo function returns links, and only for dishes that have one', async () => {
    renderAt()
    const img = await screen.findByRole('img', { name: 'Ćevapi, 10 pcs' })
    expect(img).toHaveAttribute('src', 'https://signed.example/d1')
    expect(screen.queryByRole('img', { name: 'Pljeskavica' })).not.toBeInTheDocument()
    expect(getPublicListPhotos).toHaveBeenCalledWith('AbC123xyz_-9')
  })

  it('does not ask for photos when no dish has one', async () => {
    getPublicList.mockResolvedValue({ ...list, items: list.items.map((i) => ({ ...i, photo_path: null })) })
    renderAt()
    await screen.findByText('Pljeskavica')
    expect(getPublicListPhotos).not.toHaveBeenCalled()
  })

  it('still shows the list if photos fail to load', async () => {
    getPublicListPhotos.mockResolvedValue({})
    renderAt()
    expect(await screen.findByText('Ćevapi, 10 pcs')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not reveal why a list is unavailable (unknown, private and unshared look the same)', async () => {
    getPublicList.mockResolvedValue(null)
    renderAt('bogus-slug-1')
    expect(await screen.findByRole('heading', { name: 'This list isn’t available' })).toBeInTheDocument()
    expect(screen.queryByText('Best ćevapi in Belgrade')).not.toBeInTheDocument()
  })

  it('shows a retry hint when it cannot load', async () => {
    getPublicList.mockRejectedValue(new Error('offline'))
    renderAt()
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load this list')
  })

  it('handles an empty list', async () => {
    getPublicList.mockResolvedValue({ ...list, items: [] })
    renderAt()
    expect(await screen.findByText('This list is empty for now.')).toBeInTheDocument()
  })

  it('keeps shared lists out of search engines and titles the tab', async () => {
    renderAt()
    await screen.findByText('Ćevapi, 10 pcs')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.title).toBe('Best ćevapi in Belgrade · Dish Memory')
  })

  it('never shows an email or user id', async () => {
    renderAt()
    await screen.findByText('Ćevapi, 10 pcs')
    expect(document.body.textContent).not.toMatch(/@|user_id/)
  })
})
