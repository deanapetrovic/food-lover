import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthProvider'

export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  const { session } = useAuth()
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">Coming in {milestone}.</p>
      <p className="mt-6 text-xs text-muted">Signed in as {session?.user.email}</p>
      <button className="mt-2 text-sm underline" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </section>
  )
}
