import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

// Placeholder values keep the app bootable (and tests importable) without env;
// the UI shows a setup notice when isSupabaseConfigured is false.
export const supabase = createClient<Database>(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)
