import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'

const authState = { session: null as unknown, loading: false }
vi.mock('./AuthProvider', () => ({ useAuth: () => authState }))

import { RequireAuth } from './RequireAuth'

function setup() {
  return render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<RequireAuth />}><Route path="/secret" element={<div>secret</div>} /></Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('redirects signed-out users to /login', () => {
    authState.session = null
    setup()
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
  it('renders children when signed in', () => {
    authState.session = { user: { email: 'a@b.c' } }
    setup()
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
