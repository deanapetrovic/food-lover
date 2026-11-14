import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listDishes = vi.fn()
const deleteDish = vi.fn()

vi.mock('@/lib/repositories/dishes', async (orig) => ({
  ...(await orig<typeof import('@/lib/repositories/dishes')>()),
  listDishes: (...a: unknown[]) => listDishes(...a),
  deleteDish: (...a: unknown[]) => deleteDish(...a),
}))

import { WantPage } from './WantPage'

const items = [
  {
    id: 'w1', name: 'Pljeskavica', note: 'from a reel', tags: [], rating: null, status: 'want_to_try',
    source_url: 'https://www.instagram.com/p/abc', place: { id: 'p1', name: 'Kafana Test', city: 'Belgrade' },
  },
  {
    id: 'w2', name: 'Sketchy link', note: null, tags: [], rating: null, status: 'want_to_try',
    source_url: 'javascript:alert(1)', place: null,
  },
]

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname}{l.search}</p>
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/want']}>
        <Routes>
          <Route path="/want" element={<WantPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listDishes.mockResolvedValue(items)
  deleteDish.mockResolvedValue(undefined)
})

describe('WantPage', () => {
  it('asks only for want-to-try dishes and lists them', async () => {
    renderPage()
    expect(await screen.findByText('Pljeskavica')).toBeInTheDocument()
    expect(listDishes).toHaveBeenCalledWith({ status: 'want_to_try' })
    expect(screen.getByText('Kafana Test · Belgrade')).toBeInTheDocument()
  })

  it('links "Mark as tried" to the log form for that item', async () => {
    renderPage()
    await screen.findByText('Pljeskavica')
    const links = screen.getAllByRole('link', { name: 'Mark as tried' })
    expect(links[0]).toHaveAttribute('href', '/log?from=w1')
  })

  it('shows safe source links only, opening in a new tab', async () => {
    renderPage()
    const link = await screen.findByRole('link', { name: 'instagram.com' })
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/p/abc')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
  })

  it('removes an item after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pljeskavica')
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await waitFor(() => expect(deleteDish).toHaveBeenCalledWith('w1'))
  })

  it('does not remove when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Pljeskavica')
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(deleteDish).not.toHaveBeenCalled()
  })

  it('shows an empty state with the paste-a-link hint', async () => {
    listDishes.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('Nothing saved yet')).toBeInTheDocument()
  })

  it('"Paste a link" opens the add screen with the clipboard link (iOS share-in path)', async () => {
    const user = userEvent.setup() // user-event installs its own clipboard stub, so override after it
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('check https://maps.app.goo.gl/xyz now') },
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Paste a link' }))
    expect(await screen.findByTestId('where')).toHaveTextContent(
      '/want/add?url=' + encodeURIComponent('https://maps.app.goo.gl/xyz'),
    )
  })

  it('explains when the clipboard has no link', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('just words') },
    })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Paste a link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('No link on your clipboard')
  })
})
