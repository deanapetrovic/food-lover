import { supabase } from '@/lib/supabase'

export interface ListSummary {
  id: string
  title: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  updated_at: string
  count: number
}

export interface ListItemRow {
  id: string
  position: number
  dish: {
    id: string
    name: string
    rating: number | null
    photo_path: string | null
    status: 'tried' | 'want_to_try'
    place: { id: string; name: string; city: string | null } | null
  }
}

export interface ListDetail {
  id: string
  title: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  items: ListItemRow[]
}

const DETAIL_SELECT =
  'id, title, description, is_public, share_slug, items:list_items(id, position, dish:dishes(id, name, rating, photo_path, status, place:places(id, name, city)))'

/** The signed-in user's lists, most recently changed first, each with its dish count. */
export async function listLists(): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('id, title, description, is_public, share_slug, updated_at, list_items(count)')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data.map(({ list_items, ...rest }) => ({ ...rest, count: list_items?.[0]?.count ?? 0 }))
}

/** One list with its dishes in order, or null if it doesn't exist / isn't yours. */
export async function getList(id: string): Promise<ListDetail | null> {
  const { data, error } = await supabase
    .from('lists')
    .select(DETAIL_SELECT)
    .eq('id', id)
    .order('position', { referencedTable: 'list_items', ascending: true })
    .maybeSingle()
  if (error) throw error
  return data as unknown as ListDetail | null
}

export async function createList(title: string): Promise<{ id: string }> {
  const clean = title.trim()
  if (!clean) throw new Error('Give the list a name')
  const { data, error } = await supabase.from('lists').insert({ title: clean }).select('id').single()
  if (error) throw error
  return data
}

export async function updateList(id: string, patch: { title?: string; description?: string | null }): Promise<void> {
  const next: { title?: string; description?: string | null } = {}
  if (patch.title !== undefined) {
    const clean = patch.title.trim()
    if (!clean) throw new Error('A list needs a name')
    next.title = clean
  }
  if (patch.description !== undefined) next.description = patch.description?.trim() || null
  const { error } = await supabase.from('lists').update(next).eq('id', id)
  if (error) throw error
}

/** Turning sharing on makes the database generate the link's slug; turning it off clears it. */
export async function setListPublic(id: string, isPublic: boolean): Promise<{ is_public: boolean; share_slug: string | null }> {
  const { data, error } = await supabase
    .from('lists')
    .update({ is_public: isPublic })
    .eq('id', id)
    .select('is_public, share_slug')
    .single()
  if (error) throw error
  return data
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', id)
  if (error) throw error
}

export async function addToList(listId: string, dishId: string, position: number): Promise<void> {
  const { error } = await supabase.from('list_items').insert({ list_id: listId, dish_id: dishId, position })
  if (error) throw error
}

export async function removeFromList(itemId: string): Promise<void> {
  const { error } = await supabase.from('list_items').delete().eq('id', itemId)
  if (error) throw error
}

/** Rewrites positions 0..n-1 to match the given order. */
export async function reorderItems(listId: string, ordered: Array<{ id: string; dishId: string }>): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .upsert(ordered.map((o, position) => ({ id: o.id, list_id: listId, dish_id: o.dishId, position })), { onConflict: 'id' })
  if (error) throw error
}

/** The link people open. Built from the current origin, so it works on localhost, Vercel or a custom domain. */
export function shareUrl(slug: string, origin: string = window.location.origin): string {
  return `${origin}/l/${slug}`
}
