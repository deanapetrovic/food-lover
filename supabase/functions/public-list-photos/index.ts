// Edge Function: short-lived signed links for the photos of ONE public list.
// POST { slug } -> { urls: { "<storage path>": "<signed url>" } }
//
// Photos live in a private bucket, so a signed-out visitor to /l/<slug> can't read them directly. This
// function uses the service role (provided to every Edge Function by Supabase, never shipped to the
// browser) but only ever signs paths that belong to dishes in a list that is currently public.
// Unknown, private and malformed slugs all get the same empty answer, so it can't be used to probe
// which links exist. No sign-in is required (verify_jwt = false): the unguessable slug is the capability.

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SIGNED_FOR_SECONDS = 60 * 60
const MAX_PHOTOS = 100

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let slug = ''
  try { slug = String((await req.json()).slug ?? '') } catch { return json({ error: 'bad_json' }, 400) }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(slug)) return json({ urls: {} })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: list } = await admin.from('lists').select('id').eq('share_slug', slug).eq('is_public', true).maybeSingle()
  if (!list) return json({ urls: {} })

  const { data: items } = await admin
    .from('list_items')
    .select('dish:dishes(photo_path)')
    .eq('list_id', list.id)
    .limit(MAX_PHOTOS)

  const paths = [
    ...new Set(
      (items ?? [])
        .map((i: { dish: { photo_path: string | null } | { photo_path: string | null }[] | null }) =>
          Array.isArray(i.dish) ? i.dish[0]?.photo_path : i.dish?.photo_path)
        .filter((p): p is string => Boolean(p)),
    ),
  ]
  if (paths.length === 0) return json({ urls: {} })

  const { data: signed } = await admin.storage.from('dish-photos').createSignedUrls(paths, SIGNED_FOR_SECONDS)
  const urls: Record<string, string> = {}
  for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
  return json({ urls })
})
