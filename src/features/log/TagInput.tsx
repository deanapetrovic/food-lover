import { useState } from 'react'
import { normalizeTags } from '@/lib/repositories/dishes'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
}

export function TagInput({ tags, onChange, suggestions = [] }: Props) {
  const [draft, setDraft] = useState('')

  const add = (raw: string) => {
    const next = normalizeTags([...tags, ...raw.split(',')])
    if (next.length !== tags.length) onChange(next)
    setDraft('')
  }

  const unused = suggestions.filter((s) => !tags.includes(s)).slice(0, 6)

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <button key={t} type="button" aria-label={`Remove tag ${t}`}
            onClick={() => onChange(tags.filter((x) => x !== t))}
            className="rounded-full bg-accent px-3 py-1 text-sm text-on-accent">
            #{t} ×
          </button>
        ))}
        <input aria-label="Add tag" value={draft} placeholder="Add tag…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) }
          }}
          onBlur={() => draft.trim() && add(draft)}
          className="min-w-24 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm" />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)}
              className="rounded-full border border-line px-3 py-1 text-sm text-muted">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  )
}
