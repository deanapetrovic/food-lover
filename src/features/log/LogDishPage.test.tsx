import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlacesUnavailableError, type PlaceCandidate } from '@/lib/places'

const candidate: PlaceCandidate = {
  provider: 'google', externalPlaceId: 'g-1', name: 'Ćevabdžinica Zlatni', address: 'Addr 1',
  city: 'Belgrade', country: 'RS', lat: 44.8, lng: 20.4, cuisine: 'Grill',
}
const other: PlaceCandidate = { ...candidate, externalPlaceId: 'g-2', name: 'Burger Joint' }

const nearby = vi.fn()
const createDish = vi.fn()
const savePlace = vi.fn()
const uploadDishPhoto = vi.fn()

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { user: { id: 'user-1', email: 'm@example.com' } }, loading: false }),
}))
vi.mock('@/lib/places', async (orig) => ({
  ...(await orig<typeof import('@/lib/places')>()),
  placesProvider: { nearby: (...a: unknown[]) => nearby(...a), search: vi.fn().mockResolvedValue([]) },
}))
vi.mock('@/lib/repositories/dishes', async (orig) => ({
  ...(await orig<typeof import('@/lib/repositories/dishes')>()),
  createDish: (...a: unknown[]) => createDish(...a),
  listDishes: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/repositories/places', () => ({ savePlace: (...a: unknown[]) => savePlace(...a) }))
vi.mock('@/lib/image', () => ({ compressImage: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' })) }))
vi.mock('@/lib/photos', () => ({
  uploadDishPhoto: (...a: unknown[]) => uploadDishPhoto(...a),
  getSignedPhotoUrl: vi.fn(),
}))

import { LogDishPage } from './LogDishPage'

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/log']}>
        <Routes>
          <Route path="/log" element={<LogDishPage />} />
          <Route path="/" element={<p>HOME</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  nearby.mockResolvedValue([candidate, other])
  savePlace.mockResolvedValue('place-1')
  createDish.mockResolvedValue({ id: 'dish-1' })
  uploadDishPhoto.mockResolvedValue('user-1/photo.jpg')
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback) =>
        ok({ coords: { latitude: 44.8, longitude: 20.4 } } as GeolocationPosition),
    },
  })
})

describe('logging a dish', () => {
  it('logs photo + nearest place + name + rating in one pass', async () => {
    const user = userEvent.setup()
    renderPage()

    // The nearest place is pre-selected without any tap.
    expect(await screen.findByTestId('selected-place')).toHaveTextContent('Ćevabdžinica Zlatni')

    await user.upload(
      screen.getByLabelText('Take photo'),
      new File(['img'], 'dish.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByAltText('Your dish')).toBeInTheDocument()
    await waitFor(() => expect(uploadDishPhoto).toHaveBeenCalledWith('user-1', expect.any(Blob)))

    await user.type(screen.getByLabelText('Dish'), 'Ćevapi');
    await user.click(screen.getByRole('button', { name: 'Rate 9' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createDish).toHaveBeenCalledTimes(1))
    expect(savePlace).toHaveBeenCalledWith(candidate)
    expect(createDish).toHaveBeenCalledWith({
      name: 'Ćevapi', placeId: 'place-1', rating: 9, note: '', tags: [], photoPath: 'user-1/photo.jpg',
    })
    expect(await screen.findByText('HOME')).toBeInTheDocument()
  })

  it('keeps Save disabled until there is a name and a rating', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('selected-place')

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('Dish'), 'Burek')
    expect(save).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Rate 7' }))
    expect(save).toBeEnabled()
  })

  it('lets the user switch to another suggested place', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('selected-place')

    await user.click(screen.getByRole('button', { name: 'Burger Joint' }))
    expect(screen.getByTestId('selected-place')).toHaveTextContent('Burger Joint')
  })

  it('collects tags and note, normalising the tags', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('selected-place')

    await user.type(screen.getByLabelText('Dish'), 'Pljeskavica')
    await user.click(screen.getByRole('button', { name: 'Rate 8' }))
    await user.click(screen.getByText('Note and tags (optional)'))
    await user.type(screen.getByLabelText('Note'), 'Juicy')
    await user.type(screen.getByLabelText('Add tag'), '#Grill,')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createDish).toHaveBeenCalled())
    expect(createDish).toHaveBeenCalledWith(
      expect.objectContaining({ note: 'Juicy', tags: ['grill'], photoPath: null }),
    )
  })

  it('falls back to adding the place by name when lookup is unavailable', async () => {
    nearby.mockRejectedValue(new PlacesUnavailableError())
    const user = userEvent.setup()
    renderPage()

    await user.type(await screen.findByLabelText('Place name'), 'Kafana Test')
    await user.type(screen.getByLabelText('City'), 'Belgrade')
    await user.click(screen.getByRole('button', { name: 'Use this place' }))
    await user.type(screen.getByLabelText('Dish'), 'Sarma')
    await user.click(screen.getByRole('button', { name: 'Rate 8' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(savePlace).toHaveBeenCalled())
    expect(savePlace).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'manual', name: 'Kafana Test', city: 'Belgrade' }),
    )
  })

  it('does not save the dish if the photo failed to upload', async () => {
    uploadDishPhoto.mockRejectedValue(new Error('storage down'))
    const user = userEvent.setup()
    renderPage()
    await screen.findByTestId('selected-place')

    await user.upload(screen.getByLabelText('Take photo'), new File(['img'], 'd.jpg', { type: 'image/jpeg' }))
    await user.type(screen.getByLabelText('Dish'), 'Ćevapi')
    await user.click(screen.getByRole('button', { name: 'Rate 9' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(createDish).not.toHaveBeenCalled()
  })
})
