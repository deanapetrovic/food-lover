# Dish Memory

A private, dish-level food memory: every entry is a DISH linked to a PLACE.
React + Vite + TypeScript PWA, backed by Supabase (Postgres, Auth, Storage, RLS).

## Setup

Requires Node 20+.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev
```

### Environment variables

| Variable | Where to get it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Same page → `anon` `public` key |

Later milestones add server-side keys (Google Places, Supabase service role). Those
never go in `.env.local`; they live in Supabase Edge Function secrets and Vercel env.

### Supabase auth setup (Milestone 0)

1. Create a project at supabase.com.
2. Authentication → Providers: Email is on by default. For quick testing you can turn off
   "Confirm email".
3. Authentication → URL Configuration: add `http://localhost:5173` to Site URL / Redirect URLs.
4. Optional: enable Google (Google Cloud OAuth web client) and Apple (Services ID + verified
   domain) using the redirect URL Supabase shows. Email sign-in works without them.

## Database (Milestone 1)

Schema lives in `supabase/migrations/`. Tables: `profiles`, `places`, `dishes`, `lists`,
`list_items`, plus the private `dish-photos` storage bucket. Row Level Security is on
everywhere; `anon` has no table access. Public lists are readable only through the
`get_public_list(slug)` function, and places are written only through `upsert_place(...)`.

**Run it locally** (needs Docker Desktop):

```bash
supabase start        # starts local Postgres/Auth/Storage, prints the local URL + anon key
supabase db reset     # applies migrations + seed.sql
supabase test db      # runs the pgTAP RLS tests in supabase/tests/
```

Put the local URL and anon key from `supabase start` into `.env.local` to develop against it.

**Run it on a hosted project:** `supabase link --project-ref <ref>` then `supabase db push`
(or paste the three files in `supabase/migrations/` into the SQL editor, in order).
`src/lib/database.types.ts` is generated from the schema; regenerate it after any migration with
`supabase gen types typescript --project-id <ref> > src/lib/database.types.ts`
(keep the hand-written helper types at the bottom of the file).

**Tests:** `supabase/tests/database/rls.test.sql` (pgTAP, 43 assertions) covers profile
creation, tried/want-to-try constraints, cross-user isolation on dishes/lists/list items/places/photos,
anonymous lockout, and the public list RPC. It has been run against the hosted dev project inside a
rolled-back transaction.

## Dish logging and nearby places (Milestone 2)

Photos are resized in the browser (long side 1600 px, JPEG ~0.8) and uploaded to the private
`dish-photos` bucket as soon as they are picked. Nearby places come from the `places-nearby`
Edge Function (`supabase/functions/places-nearby`), which calls Google Places (New) so the key
never reaches the browser. Without the key the app still works: you add the place by name.

**Create the Google key**
1. Google Cloud Console → create/select a project, and turn on billing (Places has a free monthly allowance).
2. APIs & Services → Library → enable **Places API (New)**.
3. APIs & Services → Credentials → Create credentials → API key. Restrict it to **Places API (New)**.
   (Don't add an HTTP-referrer restriction: the call comes from Supabase's servers, not a browser.)
4. Store it as a Supabase secret (never in `.env.local`):

```bash
supabase secrets set GOOGLE_PLACES_API_KEY=your-key --project-ref <ref>
```

or in the dashboard: Edge Functions → Secrets → add `GOOGLE_PLACES_API_KEY`.

**Deploy the function:** `supabase functions deploy places-nearby --project-ref <ref>`
(JWT verification stays on, so only signed-in users can call it).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm run build` | Typecheck + production build (also generates the service worker) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |

## Testing on a phone

Camera, geolocation and PWA install need HTTPS. Use a Vercel preview URL, or a tunnel to the
dev server. Plain `http://<lan-ip>:5173` will not work for those features.

## Milestones

0. Setup and auth ✅
1. Data model and RLS ✅ (applied to the hosted dev project; RLS tests pass)
2. Dish logging ✅ (place lookup needs the Google key above; manual entry works without it)
3. Want-to-try and sharing in
4. Search and filters
5. Place page
6. Map view
7. Shareable lists and public page
8. Polish
