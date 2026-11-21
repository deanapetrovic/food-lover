import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listLists = vi.fn()
const createList = vi.fn()

vi.mock('@/lib/repositories/lists', () => ({
  listLists: (...a: unknown[]) => listLists(...a),
  createList: (...a: unknown[]) => createList(...a),
}))

import { ListsPage } from './ListsPage'

const lists = [
  { id: 'l1', title: 'Best ćevapi', description: null, is_public: true, share_slug: 'abc', updated_at: 't', count: 3 },
  { id: 'l2', title: 'Brunch ideas', description: null, is_public: false, share_slug: null, updated_at: 't', count: 1 },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/lists']}>
        <Routes>
          <Route path="/lists" element={<ListsPage />} />
          <Route path="/lists/:id" element={<p>OPENED LIST</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listLists.mockResolvedValue(lists)
  createList.mockResolvedValue({ id: 'new-1' })
})

describe('ListsPage', () => {
  it('shows your lists with counts, and marks the shared one', async () => {
    renderPage()
    expect(await screen.findByText('Best ćevapi')).toBeInTheDocument()
    expect(screen.getByText('3 dishes')).toBeInTheDocument()
    expect(screen.getByText('1 dish')).toBeInTheDocument()
    expect(screen.getAllByText('Shared')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /Best ćevapi/ })).toHaveAttribute('href', '/lists/l1')
  })

  it('creates a list and opens it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Best ćevapi')
    await user.click(screen.getByRole('button', { name: 'New list' }))

    const create = screen.getByRole('button', { name: 'Create' })
    expect(create).toBeDisabled()
    await user.type(screen.getByLabelText('List name'), 'Pizza night')
    await user.click(create)

    await waitFor(() => expect(createList).toHaveBeenCalledWith('Pizza night'))
    expect(await screen.findByText('OPENED LIST')).toBeInTheDocument()
  })

  it('can cancel creating', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'New list' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('List name')).not.toBeInTheDocument()
    expect(createList).not.toHaveBeenCalled()
  })

  it('explains an empty state', async () => {
    listLists.mockResolvedValue([])
    renderPage()
    expect(await screen.findByText('No lists yet')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    listLists.mockRejectedValue(new Error('boom'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })
})
