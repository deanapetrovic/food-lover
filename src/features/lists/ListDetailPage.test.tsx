import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getList = vi.fn()
const addToList = vi.fn()
const removeFromList = vi.fn()
const reorderItems = vi.fn()
const setListPublic = vi.fn()
const updateList = vi.fn()
const deleteList = vi.fn()
const searchDishes = vi.fn()

vi.mock('@/lib/repositories/lists', async (orig) => ({
  ...(await orig<typeof import('@/lib/repositories/lists')>()),
  getList: (...a: unknown[]) => getList(...a),
  addToList: (...a: unknown[]) => addToList(...a),
  removeFromList: (...a: unknown[]) => removeFromList(...a),
  reorderItems: (...a: unknown[]) => reorderItems(...a),
  setListPublic: (...a: unknown[]) => setListPublic(...a),
  updateList: (...a: unknown[]) => updateList(...a),
  deleteList: (...a: unknown[]) => deleteList(...a),
}))
vi.mock('@/lib/repositories/search', () => ({
  searchDishes: (...a: unknown[]) => searchDishes(...a),
  listMyCities: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/photos', () => ({ getSignedPhotoUrl: vi.fn().mockResolvedValue('blob:x') }))

import { ListDetailPage } from './ListDetailPage'

const dish = (id: string, name: string, rating: number | null) => ({
  id, name, rating, photo_path: null, status: rating == null ? 'want_to_try' : 'tried',
  place: { id: 'p1', name: 'Zlatni', city: 'Belgrade' },
})
const privateList = {
  id: 'l1', title: 'Best grill', description: null, is_public: false, share_slug: null,
  items: [
    { id: 'i1', position: 0, dish: dish('d1', 'Ćevapi', 10) },
    { id: 'i2', position: 1, dish: dish('d2', 'Pljeskavica', 8) },
  ],
}
const publicList = { ...privateList, is_public: true, share_slug: 'AbC123xyz_-9' }
// What search returns: the two already in the list, plus one that isn't.
const searchResults = [
  { id: 'd1', name: 'Ćevapi', rating: 10, place: { name: 'Zlatni' } },
  { id: 'd2', name: 'Pljeskavica', rating: 8, place: { name: 'Zlatni' } },
  { id: 'd3', name: 'Kajmak', rating: 7, place: { name: 'Zlatni' } },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/lists/l1']}>
        <Routes>
          <Route path="/lists/:id" element={<ListDetailPage />} />
          <Route path="/lists" element={<p>LISTS TAB</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getList.mockResolvedValue(privateList)
  searchDishes.mockResolvedValue(searchResults)
  for (const fn of [addToList, removeFromList, reorderItems, updateList, deleteList]) fn.mockResolvedValue(undefined)
  setListPublic.mockResolvedValue({ is_public: true, share_slug: 'AbC123xyz_-9' })
})

describe('ListDetailPage: the dishes', () => {
  it('shows the dishes in order', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Best grill' })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('Zlatni') && li.querySelector('button[aria-label^="Move"]'))
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual(['Ćevapi', 'Pljeskavica'])
    expect(screen.getByText('2 dishes')).toBeInTheDocument()
  })

  it('disables moving the first item up and the last item down', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Best grill' })
    expect(screen.getByRole('button', { name: 'Move Ćevapi up' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move Pljeskavica down' })).toBeDisabled()
  })

  it('reorders by moving a dish down', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Move Ćevapi down' }))
    await waitFor(() => expect(reorderItems).toHaveBeenCalledWith('l1', [
      { id: 'i2', dishId: 'd2' },
      { id: 'i1', dishId: 'd1' },
    ]))
  })

  it('removes a dish', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Remove Pljeskavica' }))
    await waitFor(() => expect(removeFromList).toHaveBeenCalledWith('i2'))
  })

  it('offers only dishes that are not in the list yet, and adds one at the end', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('heading', { name: 'Best grill' })
    await user.click(screen.getByText('Add dishes'))

    expect(await screen.findByRole('button', { name: 'Add Kajmak' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Ćevapi' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add Kajmak' }))
    await waitFor(() => expect(addToList).toHaveBeenCalledWith('l1', 'd3', 2))
  })

  it('invites you to add dishes to an empty list', async () => {
    getList.mockResolvedValue({ ...privateList, items: [] })
    renderPage()
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument()
  })
})

describe('ListDetailPage: sharing', () => {
  it('starts private, with no link', async () => {
    renderPage()
    const toggle = await screen.findByRole('switch', { name: 'Share with a link' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument()
  })

  it('turning sharing on shows the public link and what visitors will see', async () => {
    getList.mockResolvedValueOnce(privateList).mockResolvedValue(publicList)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Share with a link' }))

    await waitFor(() => expect(setListPublic).toHaveBeenCalledWith('l1', true))
    const link = await screen.findByLabelText('Share link')
    expect(link).toHaveValue(`${window.location.origin}/l/AbC123xyz_-9`)
    expect(screen.getByText(/never see your email/)).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Share with a link' })).toHaveAttribute('aria-checked', 'true')
  })

  it('copies the link', async () => {
    getList.mockResolvedValue(publicList)
    const user = userEvent.setup()
    renderPage()
    await screen.findByLabelText('Share link')
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/l/AbC123xyz_-9`)
    expect(await screen.findByRole('button', { name: 'Copied ✓' })).toBeInTheDocument()
  })

  it('opens a preview of the public page in a new tab', async () => {
    getList.mockResolvedValue(publicList)
    renderPage()
    const preview = await screen.findByRole('link', { name: 'Preview' })
    expect(preview).toHaveAttribute('href', `${window.location.origin}/l/AbC123xyz_-9`)
    expect(preview).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('turning sharing off asks the database to stop sharing', async () => {
    getList.mockResolvedValue(publicList)
    setListPublic.mockResolvedValue({ is_public: false, share_slug: null })
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('switch', { name: 'Share with a link' }))
    await waitFor(() => expect(setListPublic).toHaveBeenCalledWith('l1', false))
  })
})

describe('ListDetailPage: manage', () => {
  it('renames the list', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('List name')
    await user.clear(input)
    await user.type(input, 'Top grill')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { title: 'Top grill' }))
  })

  it('deletes the list after confirming, then returns to the Lists tab', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete list' }))
    await waitFor(() => expect(deleteList).toHaveBeenCalledWith('l1'))
    expect(await screen.findByText('LISTS TAB')).toBeInTheDocument()
  })

  it('does not delete when you cancel', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Delete list' }))
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('says so when the list does not exist', async () => {
    getList.mockResolvedValue(null)
    renderPage()
    expect(await screen.findByRole('heading', { name: 'List not found' })).toBeInTheDocument()
  })

  it('shows an error when an action fails', async () => {
    removeFromList.mockRejectedValue(new Error('rls says no'))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Remove Ćevapi' }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('rls says no')).toBeInTheDocument()
  })
})
