import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getMyDisplayName = vi.fn()
const setMyDisplayName = vi.fn()
const auth: { session: { user: { id: string } } | null } = { session: { user: { id: 'user-1' } } }

vi.mock('@/features/auth/AuthProvider', () => ({ useAuth: () => ({ session: auth.session, loading: false }) }))
vi.mock('@/lib/repositories/profile', () => ({
  getMyDisplayName: (...a: unknown[]) => getMyDisplayName(...a),
  setMyDisplayName: (...a: unknown[]) => setMyDisplayName(...a),
}))

import { DisplayNameField } from './DisplayNameField'

function renderField() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><DisplayNameField /></QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.session = { user: { id: 'user-1' } }
  getMyDisplayName.mockResolvedValue(null)
  setMyDisplayName.mockImplementation(async (_id: string, name: string) => name.trim() || null)
})

describe('DisplayNameField', () => {
  it('starts empty (never filled from the email) and explains it is optional', async () => {
    renderField()
    const input = await screen.findByLabelText('Your name on shared lists')
    expect(input).toHaveValue('')
    expect(getMyDisplayName).toHaveBeenCalledWith('user-1')
    expect(screen.getByText(/leave it blank to show no name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows the saved name', async () => {
    getMyDisplayName.mockResolvedValue('Maja')
    renderField()
    await waitFor(() => expect(screen.getByLabelText('Your name on shared lists')).toHaveValue('Maja'))
  })

  it('saves a new name for your own user', async () => {
    const user = userEvent.setup()
    renderField()
    await user.type(await screen.findByLabelText('Your name on shared lists'), 'Maja')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(setMyDisplayName).toHaveBeenCalledWith('user-1', 'Maja'))
    expect(await screen.findByRole('button', { name: 'Saved ✓' })).toBeInTheDocument()
  })

  it('lets you clear the name', async () => {
    getMyDisplayName.mockResolvedValue('Maja')
    const user = userEvent.setup()
    renderField()
    const input = await screen.findByLabelText('Your name on shared lists')
    await waitFor(() => expect(input).toHaveValue('Maja'))
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(setMyDisplayName).toHaveBeenCalledWith('user-1', ''))
  })

  it('shows an error if saving fails', async () => {
    setMyDisplayName.mockRejectedValue(new Error('rls says no'))
    const user = userEvent.setup()
    renderField()
    await user.type(await screen.findByLabelText('Your name on shared lists'), 'M')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('rls says no')
  })

  it('renders nothing when signed out', async () => {
    auth.session = null
    const { container } = renderField()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(getMyDisplayName).not.toHaveBeenCalled()
  })
})
