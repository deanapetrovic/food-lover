import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('./AuthProvider', () => ({ useAuth: () => ({ session: null, loading: false }) }))

import { LoginPage } from './LoginPage'

function renderPage() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>)
}

describe('LoginPage', () => {
  it('opens on "Sign up", with a way to sign in instead', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Have an account? Sign in' })).toBeInTheDocument()
  })

  it('switches to "Sign in" for returning users, and back', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Have an account? Sign in' }))
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'New here? Create an account' }))
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument()
  })

  it('uses a new-password hint when signing up and a current-password hint when signing in', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('autocomplete', 'new-password')
    await user.click(screen.getByRole('button', { name: 'Have an account? Sign in' }))
    expect(screen.getByPlaceholderText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('offers Google and Apple', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeInTheDocument()
  })
})
