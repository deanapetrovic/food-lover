import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const searchDishes = vi.fn()
const listMyCities = vi.fn()

vi.mock('@/lib/repositories/search', () => ({
  searchDishes: (...a: unknown[]) => searchDishes(...a),
  listMyCities: (...a: unknown[]) => listMyCities(...a),
}))
vi.mock('@/lib/photos', () => ({ getSignedPhotoUrl: vi.fn().mockResolvedValue('blob:x') }))

import { DishesPage } from './DishesPage'

const place = { id: 'p1', name: 'Zlatni', city: 'Belgrade', cuisine: 'balkan', lat: null, lng: null }
const tried = {
  id: 'd1', name: 'Ćevapi', rating: 9, note: null, tags: ['grill'], photo_path: null,
  eaten_at: '2026-11-07T12:00:00Z', status: 'tried', source_url: null, place_id: 'p1', place,
}
const want = { ...tried, id: 'w1', name: 'Pljeskavica', rating: null, status: 'want_to_try', tags: [] }

const last = () => searchDishes.mock.lastCall?.[0]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><DishesPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  searchDishes.mockResolvedValue([tried])
  listMyCities.mockResolvedValue(['Belgrade', 'Novi Sad'])
})

describe('Dishes: browse, search and filters', () => {
  it('starts with your tried dishes, newest first', async () => {
    renderPage()
    expect(await screen.findByText('Ćevapi')).toBeInTheDocument()
    expect(last()).toEqual({ q: '', minRating: null, city: null, status: 'tried', sort: 'recent' })
    expect(screen.getByText('1 dish')).toBeInTheDocument()
    expect(screen.getByLabelText('Rated 9 out of 10')).toBeInTheDocument()
  })

  it('searches as you type and ranks by rating once there is a query', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    await user.type(screen.getByLabelText('Search dishes'), 'cevapi')
    await waitFor(() => expect(last()).toMatchObject({ q: 'cevapi', sort: 'best' }))
  })

  it('answers "best ćevapi in Belgrade" in three taps: query + 8+ + city', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    await user.type(screen.getByLabelText('Search dishes'), 'cevapi')
    await user.click(screen.getByRole('button', { name: '8+' }))
    await user.click(await screen.findByRole('button', { name: 'Belgrade' }))
    await waitFor(() =>
      expect(last()).toEqual({ q: 'cevapi', minRating: 8, city: 'Belgrade', status: 'tried', sort: 'best' }),
    )
  })

  it('toggles the rating filter off when tapped again', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    await user.click(screen.getByRole('button', { name: '9+' }))
    await waitFor(() => expect(last().minRating).toBe(9))
    await user.click(screen.getByRole('button', { name: '9+' }))
    await waitFor(() => expect(last().minRating).toBeNull())
  })

  it('filters by tried / want to try / all', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    await user.click(screen.getByRole('button', { name: 'Want to try' }))
    await waitFor(() => expect(last().status).toBe('want_to_try'))
    await user.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(last().status).toBeNull())
  })

  it('lets you switch the sort', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    await user.click(screen.getByRole('button', { name: 'Top rated' }))
    await waitFor(() => expect(last().sort).toBe('best'))
    await user.click(screen.getByRole('button', { name: 'Newest' }))
    await waitFor(() => expect(last().sort).toBe('recent'))
  })

  it('marks want-to-try dishes instead of showing a rating', async () => {
    searchDishes.mockResolvedValue([want])
    renderPage()
    expect(await screen.findByText('Pljeskavica')).toBeInTheDocument()
    expect(screen.getByText('Want to try', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Rated/)).not.toBeInTheDocument()
  })

  it('shows "No matches" with a way back, instead of the first-run screen', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Ćevapi')
    searchDishes.mockResolvedValue([])
    await user.click(screen.getByRole('button', { name: '9+' }))
    expect(await screen.findByText('No matches')).toBeInTheDocument()
    expect(screen.queryByText('Nothing logged yet')).not.toBeInTheDocument()

    searchDishes.mockResolvedValue([tried])
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(last()).toEqual({ q: '', minRating: null, city: null, status: 'tried', sort: 'recent' }))
    expect(await screen.findByText('Ćevapi')).toBeInTheDocument()
  })

  it('shows the first-run screen when nothing is logged and nothing is filtered', async () => {
    searchDishes.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nothing logged yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log a dish' })).toHaveAttribute('href', '/log')
  })

  it('hides the city row when there are no cities yet', async () => {
    listMyCities.mockResolvedValue([])
    renderPage()
    await screen.findByText('Ćevapi')
    expect(screen.queryByRole('group', { name: 'City' })).not.toBeInTheDocument()
  })
})
