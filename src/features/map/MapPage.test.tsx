import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { MapViewProps } from './MapView'

const searchDishes = vi.fn()
vi.mock('@/lib/repositories/search', () => ({
  searchDishes: (...a: unknown[]) => searchDishes(...a),
  listMyCities: vi.fn().mockResolvedValue([]),
}))

// Leaflet needs a real layout engine; the page's job is what it hands to the map, so stand in for it.
vi.mock('./MapView', () => ({
  MapView: (p: MapViewProps) => (
    <div data-testid="map">
      {p.markers.map((m) => (
        <button key={m.id} type="button" onClick={() => p.onSelect(m.id)}>
          {`pin ${m.label} ${m.kind} ${m.badge ?? '-'}`}
        </button>
      ))}
      <span data-testid="selected">{p.selectedId ?? 'none'}</span>
      <span data-testid="user">{p.userLocation ? `${p.userLocation.lat},${p.userLocation.lng}` : 'none'}</span>
    </div>
  ),
}))

import { MapPage } from './MapPage'

const zlatni = { id: 'p1', name: 'Zlatni', city: 'Belgrade', cuisine: null, lat: 44.8, lng: 20.4 }
const pistacchio = { id: 'p2', name: 'Pistacchio', city: 'Belgrade', cuisine: null, lat: 44.81, lng: 20.46 }
const byName = { id: 'p3', name: 'By name', city: null, cuisine: null, lat: null, lng: null }
const dish = (over: object) => ({
  id: Math.random().toString(36).slice(2), name: 'Dish', rating: 7, note: null, tags: [], photo_path: null,
  eaten_at: '2026-11-07T12:00:00Z', status: 'tried', source_url: null, place_id: null, place: null, ...over,
})

const last = () => searchDishes.mock.lastCall?.[0]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><MapPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  searchDishes.mockResolvedValue([
    dish({ name: 'Ćevapi', rating: 9, place: zlatni }),
    dish({ name: 'Kajmak', rating: 7, place: zlatni }),
    dish({ name: 'Burek idea', rating: null, status: 'want_to_try', place: pistacchio }),
    dish({ name: 'Sarma', rating: 8, place: byName }),
  ])
})

describe('MapPage', () => {
  it('shows tried and want-to-try places together by default, one pin per place', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: 'pin Zlatni tried 9' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pin Pistacchio want -' })).toBeInTheDocument()
    expect(last()).toEqual({ status: null })
    expect(screen.queryByRole('button', { name: /By name/ })).not.toBeInTheDocument()
  })

  it('explains places that have no location', async () => {
    renderPage()
    expect(await screen.findByTestId('unlocated-note')).toHaveTextContent('1 place has no location')
  })

  it('opens a card for the tapped pin, with a link to the place page', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'pin Zlatni tried 9' }))

    const card = await screen.findByTestId('place-card')
    expect(within(card).getByRole('heading', { name: 'Zlatni' })).toBeInTheDocument()
    expect(card).toHaveTextContent('2 dishes tried')
    expect(card).toHaveTextContent('best: Ćevapi (9)')
    expect(within(card).getByRole('link', { name: 'Open place' })).toHaveAttribute('href', '/place/p1')
    expect(screen.getByTestId('selected')).toHaveTextContent('p1')

    await user.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('place-card')).not.toBeInTheDocument()
  })

  it('describes a want-to-try-only place', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'pin Pistacchio want -' }))
    expect(await screen.findByTestId('place-card')).toHaveTextContent('1 to try')
  })

  it('filters the pins by tried / want to try and clears the selection', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'pin Zlatni tried 9' }))
    expect(await screen.findByTestId('place-card')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Want to try' }))
    await waitFor(() => expect(last()).toEqual({ status: 'want_to_try' }))
    expect(screen.queryByTestId('place-card')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tried' }))
    await waitFor(() => expect(last()).toEqual({ status: 'tried' }))
  })

  it('"Near me" centres the map on your position', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 44.8, longitude: 20.45 } } as GeolocationPosition) },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('map')
    await user.click(screen.getByRole('button', { name: 'Near me' }))
    expect(screen.getByTestId('user')).toHaveTextContent('44.8,20.45')
  })

  it('says so when location is blocked', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) => err({ code: 1 } as GeolocationPositionError) },
    })
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('map')
    await user.click(screen.getByRole('button', { name: 'Near me' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t get your location')
  })

  it('explains an empty map', async () => {
    searchDishes.mockResolvedValue([])
    renderPage()
    expect(await screen.findByTestId('map-empty')).toHaveTextContent('Nothing to show yet')
  })

  it('explains when places exist but none have a location', async () => {
    searchDishes.mockResolvedValue([dish({ place: byName })])
    renderPage()
    expect(await screen.findByTestId('map-empty')).toHaveTextContent('None of these places have a location')
  })
})
