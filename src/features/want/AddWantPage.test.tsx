import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PlaceCandidate } from '@/lib/places'

const kafana: PlaceCandidate = {
  provider: 'google', externalPlaceId: 'g-1', name: 'Ćevabdžinica Zlatni', address: 'Addr', city: 'Belgrade',
  country: 'RS', lat: 44.8, lng: 20.4, cuisine: 'Grill',
}
const resolveLink = vi.fn()
const search = vi.fn()
const addWantToTry = vi.fn()
const savePlace = vi.fn()

vi.mock('@/lib/linkPreview', async (orig) => ({
  ...(await orig<typeof import('@/lib/linkPreview')>()),
  resolveLink: (...a: unknown[]) => resolveLink(...a),
}))
vi.mock('@/lib/places', async (orig) => ({
  ...(await orig<typeof import('@/lib/places')>()),
  placesProvider: { nearby: vi.fn().mockResolvedValue([]), search: (...a: unknown[]) => search(...a) },
}))
vi.mock('@/lib/repositories/dishes', async (orig) => ({
  ...(await orig<typeof import('@/lib/repositories/dishes')>()),
  addWantToTry: (...a: unknown[]) => addWantToTry(...a),
}))
vi.mock('@/lib/repositories/places', () => ({ savePlace: (...a: unknown[]) => savePlace(...a) }))

import { AddWantPage, ShareRedirect } from './AddWantPage'

const IG = 'https://www.instagram.com/p/abc123/'

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/want/add" element={<AddWantPage />} />
          <Route path="/share" element={<ShareRedirect />} />
          <Route path="/want" element={<p>WANT LIST</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resolveLink.mockResolvedValue({
    url: IG, title: 'Ćevabdžinica Zlatni on Instagram: "so good"', description: 'Best ćevapi in town', siteName: 'Instagram',
  })
  search.mockResolvedValue([kafana])
  savePlace.mockResolvedValue('place-1')
  addWantToTry.mockResolvedValue({ id: 'w1' })
})

describe('adding to want-to-try', () => {
  it('reads a shared link, guesses the name and place, and saves what the user confirms', async () => {
    const user = userEvent.setup()
    renderAt(`/want/add?url=${encodeURIComponent(IG)}`)

    expect(await screen.findByTestId('link-preview')).toHaveTextContent('Best ćevapi in town')
    expect(resolveLink).toHaveBeenCalledWith(IG)
    expect(screen.getByLabelText('What do you want to try?')).toHaveValue('Ćevabdžinica Zlatni')

    // The guess pre-fills the place search; nothing is chosen until the user taps it.
    await waitFor(() => expect(search).toHaveBeenCalledWith('Ćevabdžinica Zlatni', null))
    expect(screen.queryByTestId('selected-place')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Ćevabdžinica Zlatni' }))
    expect(screen.getByTestId('selected-place')).toHaveTextContent('Ćevabdžinica Zlatni')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(addWantToTry).toHaveBeenCalledTimes(1))
    expect(savePlace).toHaveBeenCalledWith(kafana)
    expect(addWantToTry).toHaveBeenCalledWith({
      name: 'Ćevabdžinica Zlatni', placeId: 'place-1', sourceUrl: IG, note: '', tags: [],
    })
    expect(await screen.findByText('WANT LIST')).toBeInTheDocument()
  })

  it('accepts an Android share, where the link arrives inside the text', async () => {
    renderAt(`/share?title=${encodeURIComponent('Pekara Pistacchio')}&text=${encodeURIComponent('Try this ' + IG)}`)
    await waitFor(() => expect(resolveLink).toHaveBeenCalledWith(IG))
    expect(screen.getByLabelText('Link (optional)')).toHaveValue(IG)
  })

  it('still saves when the link cannot be read', async () => {
    resolveLink.mockRejectedValue(new Error('blocked'))
    search.mockResolvedValue([])
    const user = userEvent.setup()
    renderAt(`/want/add?url=${encodeURIComponent('https://example.com/x')}`)

    expect(await screen.findByText(/Couldn’t read that link/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('What do you want to try?'), 'Sarma')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(addWantToTry).toHaveBeenCalled())
    expect(savePlace).not.toHaveBeenCalled()
    expect(addWantToTry).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sarma', placeId: null, sourceUrl: 'https://example.com/x' }),
    )
  })

  it('works fully manually, with no link and no place', async () => {
    const user = userEvent.setup()
    renderAt('/want/add')
    expect(resolveLink).not.toHaveBeenCalled()

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    await user.type(screen.getByLabelText('What do you want to try?'), 'Burek')
    expect(save).toBeEnabled()
    await user.click(save)

    await waitFor(() => expect(addWantToTry).toHaveBeenCalled())
    expect(addWantToTry).toHaveBeenCalledWith({ name: 'Burek', placeId: null, sourceUrl: '', note: '', tags: [] })
  })

  it('blocks saving a link that is not http(s)', async () => {
    const user = userEvent.setup()
    renderAt('/want/add')
    await user.type(screen.getByLabelText('What do you want to try?'), 'Burek')
    await user.type(screen.getByLabelText('Link (optional)'), 'javascript:alert(1)')
    expect(screen.getByRole('alert')).toHaveTextContent('http')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})
