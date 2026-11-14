export type ReorderLabel = 'Must reorder' | 'Skip'

/** Your own verdict at a glance: 9–10 is "must reorder", 1–4 is "skip", the middle gets no label. */
export function reorderLabel(rating: number | null | undefined): ReorderLabel | null {
  if (rating == null) return null
  if (rating >= 9) return 'Must reorder'
  if (rating <= 4) return 'Skip'
  return null
}
