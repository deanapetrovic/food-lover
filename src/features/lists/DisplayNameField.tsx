import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { getMyDisplayName, setMyDisplayName } from '@/lib/repositories/profile'

/** "Your name on the shared page": optional, never filled in from the email. */
export function DisplayNameField() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['profile', 'display-name', userId], queryFn: () => getMyDisplayName(userId as string), enabled: Boolean(userId) })
  const [value, setValue] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => { if (saved.data !== undefined) setValue(saved.data ?? '') }, [saved.data])

  const save = useMutation({
    mutationFn: () => setMyDisplayName(userId as string, value),
    onSuccess: async (name) => {
      setValue(name ?? '')
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })

  if (!userId || saved.isLoading) return null
  const dirty = value.trim() !== (saved.data ?? '')

  return (
    <form className="mt-3 border-t border-line pt-3"
      onSubmit={(e) => { e.preventDefault(); if (dirty) save.mutate() }}>
      <label htmlFor="display-name" className="block text-sm font-medium">Your name on shared lists</label>
      <p className="mb-2 text-xs text-muted">Shown as “by …” on the public page. Optional; leave it blank to show no name.</p>
      <div className="flex gap-2">
        <input id="display-name" value={value} maxLength={80} placeholder="No name shown"
          onChange={(e) => setValue(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-sm" />
        <button type="submit" disabled={!dirty || save.isPending}
          className="rounded-xl border border-line px-3 text-sm font-medium disabled:opacity-40">
          {justSaved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
      {save.error && <p role="alert" className="mt-1 text-xs text-danger">{(save.error as Error).message}</p>}
    </form>
  )
}
