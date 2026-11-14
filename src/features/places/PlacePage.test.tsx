import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getPlace = vi.fn()
const listDishesAtPlace = vi.fn()

vi.mock('@/lib/repositories/places', () => ({
  getPlace: (...a: unknown[]) => getPlace(...a),
  listDishesAtPlace: (...a: unknown[]) => listDishesAtPlace(...a),
}))
vi.mock('@/lib/photos', () => ({ getSignedPhotoUrl: vi.fn().mockResolvedValue('blob:x') }))

import { PlacePage } from './PlacePage'

const place = {
  id: 'p1', provider: 'google', external_place_id: 'g-1', name: 'Ćevabdžinica Zlatni', address: 'Knez Mihailova 10',
  city: 'Belgrade', country: 'RS', lat: 44.8, lng: 20.4, cuisine: 'Grill',
}
const miniPlace = { id: 'p1', name: 'Ćevabdžinica Zlatni', city: 'Belgrade', cuisine: 'Grill', lat: 44.8, lng: 20.4 }
const dish = (over: object) => ({
  id: 'x', name: 'Dish', rating: 7, note: null, tags: [], photo_path: null, eaten_at: '2026-11-07T12:00:00Z',
  status: 'tried', source_url: null, place_id: 'p1', place: miniPlace, ...over,
})
const dishes = [
  dish({ id: 'd1', name: 'Ćevapi', rating: 9 }),
  dish({ id: 'd2', name: 'Kajmak', rating: 7 }),
  dish({ id: 'd3', name: 'Soggy fries', rating: 3 }),
  dish({ id: 'd4', name: 'Pljeskavica', rating: null, status: 'want_to_try' }),
]

function renderAt(path = '/place/p1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/place/:id" element={<PlacePage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getPlace.mockResolvedValue(place)
  listDishesAtPlace.mockResolvedValue(dishes)
})

describe('PlacePage', () => {
  it('shows the place, a summary, and your dishes there in the order returned (best first)', async () => {
    renderAt()
    expect(await screen.findByRole('heading', { name: 'Ćevabdžinica Zlatni' })).toBeInTheDocument()
    expect(getPlace).toHaveBeenCalledWith('p1')
    expect(listDishesAtPlace).toHaveBeenCalledWith('p1')
    expect(screen.getByText('Knez Mihailova 10 · Grill')).toBeInTheDocument()
    // (9 + 7 + 3) / 3 = 6.3; the want-to-try item has no rating and isn't counted
    expect(screen.getByTestId('place-summary')).toHaveTextContent('3 dishes tried · average 6.3')

    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['Tried here · best first', 'Ćevapi', 'Kajmak', 'Soggy fries', 'Want to try here', 'Pljeskavica'])
  })

  it('flags must-reorder and skip dishes, and leaves the middle alone', async () => {
    renderAt()
    await screen.findByText('Ćevapi')
    const row = (name: string) => screen.getByText(name).closest('li') as HTMLElement
    expect(within(row('Ćevapi')).getByText('Must reorder')).toBeInTheDocument()
    expect(within(row('Soggy fries')).getByText('Skip')).toBeInTheDocument()
    expect(within(row('Kajmak')).queryByText(/Must reorder|Skip/)).not.toBeInTheDocument()
    expect(within(row('Pljeskavica')).queryByText(/Must reorder|Skip/)).not.toBeInTheDocument()
  })

  it('does not repeat the place name on every dish', async () => {
    renderAt()
    await screen.findByText('Ćevapi')
    expect(screen.queryByRole('link', { name: 'Ćevabdžinica Zlatni' })).not.toBeInTheDocument()
  })

  it('offers to log a dish here and to open the place in Maps', async () => {
    renderAt()
    expect(await screen.findByRole('link', { name: 'Log a dish here' })).toHaveAttribute('href', '/log?place=p1')
    const maps = screen.getByRole('link', { name: 'Open in Maps' })
    const href = maps.getAttribute('href') as string
    expect(href).toContain('https://www.google.com/maps/search/?')
    expect(href).toContain('query_place_id=g-1')
    expect(decodeURIComponent(href.replace(/\+/g, ' '))).toContain('Ćevabdžinica Zlatni, Knez Mihailova 10')
    expect(maps).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('says so when nothing is tried here yet', async () => {
    listDishesAtPlace.mockResolvedValue([dish({ id: 'w', name: 'Idea', rating: null, status: 'want_to_try' })])
    renderAt()
    expect(await screen.findByTestId('place-summary')).toHaveTextContent('Nothing tried here yet')
    expect(screen.queryByText('Tried here · best first')).not.toBeInTheDocument()
  })

  it('invites you to log the first dish at an empty place', async () => {
    listDishesAtPlace.mockResolvedValue([])
    renderAt()
    expect(await screen.findByText(/You haven’t logged anything here yet/)).toBeInTheDocument()
  })

  it('shows "Place not found" for a missing or hidden place', async () => {
    getPlace.mockResolvedValue(null)
    renderAt('/place/other')
    expect(await screen.findByRole('heading', { name: 'Place not found' })).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    getPlace.mockRejectedValue(new Error('boom'))
    renderAt()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
