export function RatingPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div role="group" aria-label="Rating" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-label={`Rate ${n}`} aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={`h-11 rounded-xl border text-base font-semibold ${
            value === n ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
          }`}>
          {n}
        </button>
      ))}
    </div>
  )
}
