import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from './AuthProvider'

type Provider = 'google' | 'apple'

export function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signup') // opens on "Sign up"; "Have an account? Sign in" switches
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setMessage(null)
    const { error, data } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (mode === 'signup' && !data.session) setMessage('Check your email to confirm your account.')
  }

  async function oauth(provider: Provider) {
    setMessage(null)
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })
    if (error) setMessage(error.message)
  }

  const field = 'w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent'
  const primary = 'w-full rounded-xl bg-accent px-4 py-3 font-semibold text-on-accent disabled:opacity-50'
  const secondary = 'w-full rounded-xl border border-line bg-surface px-4 py-3 font-medium'

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <header>
        <h1 className="text-3xl font-bold">Dish Memory</h1>
        <p className="mt-1 text-muted">Every dish you loved, one tap away.</p>
      </header>

      {!isSupabaseConfigured && (
        <p role="alert" className="rounded-xl border border-line bg-surface p-3 text-sm">
          Supabase isn’t configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill it in (see README).
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className={field} type="email" autoComplete="email" placeholder="Email" required
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={field} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className={primary} disabled={busy}>{mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="text-sm text-muted underline"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted"><hr className="flex-1 border-line" />or<hr className="flex-1 border-line" /></div>

      <div className="flex flex-col gap-3">
        <button className={secondary} onClick={() => oauth('google')}>Continue with Google</button>
        <button className={secondary} onClick={() => oauth('apple')}>Continue with Apple</button>
      </div>

      {message && <p role="status" className="text-sm text-accent">{message}</p>}
    </main>
  )
}
