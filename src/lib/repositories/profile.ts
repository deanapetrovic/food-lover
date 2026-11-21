import { supabase } from '@/lib/supabase'

/** The name shown as "by …" on lists you share. Empty until you choose one. */
export async function getMyDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  if (error) throw error
  return data?.display_name ?? null
}

/** Blank clears it, so shared pages show no name. */
export async function setMyDisplayName(userId: string, name: string): Promise<string | null> {
  const clean = name.trim().slice(0, 80) || null
  const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', userId)
  if (error) throw error
  return clean
}
