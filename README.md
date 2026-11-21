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

## Want-to-try and sharing in (Milestone 3)

The **Want** tab holds things you haven't tried yet. Each one is a dish row with `status = want_to_try`
(no rating needed; place and link optional). Ways to add:

- **Add manually**: name, optional link, optional place, note and tags.
- **Paste a link** (works everywhere, including iOS): copy a link in Instagram/TikTok/Maps, open the
  Want tab, tap *Paste a link*. The app reads the clipboard only when you tap.
- **Share sheet (Android Chrome, installed PWA only)**: the web manifest registers a Web Share Target
  (`/share`), so *Share → Dish Memory* opens the add screen. **iOS Safari does not support share targets
  for web apps**; use *Paste a link*. (An iOS Shortcut that opens `https://<your-app>/want/add?url=…`
  also works.) Reinstall the PWA after updating so Android picks up the manifest change.

The `resolve-link` Edge Function (`supabase/functions/resolve-link`) fetches the page and returns its
title/description. It is best-effort: Instagram and TikTok often block previews, in which case you just type
the name. From the link we guess a place (Google Maps links carry the name; otherwise the page title) and
pre-fill the place search, but **nothing is chosen until you tap it**. Because the function fetches
user-supplied URLs it blocks private/internal addresses (SSRF), follows at most 4 redirects, and caps
time and size. Deploy it with `supabase functions deploy resolve-link --project-ref <ref>`; it needs no secrets.

**Mark as tried** opens the log form prefilled from the saved item (`/log?from=<id>`); saving converts the
same row to `tried`, keeping its link and place. Saved links must be `http(s)` (also enforced by a database
constraint).

## Search and filters (Milestone 4)

The **Dishes** tab is also the search screen: one box that looks across dish name, note, tags, place name,
city and cuisine, plus chips for *Tried / Want to try / All*, rating (7+ / 8+ / 9+), your cities, and sort
(*Top rated* / *Newest*; it ranks by rating automatically once you type). "Best ćevapi in Belgrade" is:
type `cevapi`, tap `8+`, tap `Belgrade`.

It runs in Postgres (`search_dishes` and `list_my_cities`, migration `…000005_search.sql`):
- Accent- and case-insensitive: `cevapi` finds `Ćevapi`, `BELGRADE` finds `Belgrade`.
- Every word must match somewhere (`cevapi grill` needs both); `#grill` and `grill` are the same word.
- `%` and `_` are matched literally. The functions are `SECURITY INVOKER`, so row-level security still
  limits results to the signed-in user's own dishes; signed-out visitors can't call them.
- It scans one user's dishes, which is fine for thousands of dishes. If it ever feels slow, add a
  generated search column with a trigram/GIN index (the M1 trigram indexes are a start).

## Place page (Milestone 5)

Tap a place name anywhere (Dishes or Want lists) to open `/place/<id>`: its address and cuisine, how many
dishes you've tried there and your average rating, then your dishes there **best first**. Dishes rated 9–10
are flagged **Must reorder** and 1–4 are flagged **Skip** (derived from the rating, so there is nothing extra to
maintain). Things you want to try there are listed separately. **Log a dish here** opens the log form with this
place already chosen (`/log?place=<id>`), and **Open in Maps** opens Google Maps for it. A place you can't see
(someone else's manual place) shows "Place not found"; row-level security does that, not the app.

## Map (Milestone 6)

The **Map** tab pins your places on an OpenStreetMap map (Leaflet, no API key). One pin per place:
a **filled blue circle with your best rating** for places you've tried, an **outlined circle** for want-to-try
only. Nearby pins merge into a **white square with a count**; tap it to zoom in. Tap a pin for a card (dishes
tried, best dish, link to the place page). Chips filter *All / Tried / Want to try*, and **Near me** centres the
map on you (the browser asks for permission; needs HTTPS or localhost).

- Only places with coordinates can be pinned. Places found through Google have them; places added **by name**
  don't, and the page tells you how many are missing. (A later improvement could geocode those.)
- `MapView` (`src/features/map/MapView.tsx`) is the only file that knows about Leaflet. To use Google Maps or
  MapLibre instead, replace that one component; the page just passes it markers.
- OSM's free tile server is meant for light use (see its tile usage policy). For heavy traffic, change
  `TILE_URL` in `MapView.tsx` to a hosted provider (MapTiler, Stadia, etc.).
- The map code loads only when you open the tab, so it doesn't slow down the rest of the app.

## Shareable lists (Milestone 7)

**Lists tab:** create a list (for example “Best ćevapi in Belgrade”), add dishes from your log with the search
box, reorder with ↑/↓, rename or delete. Turn on **Share with a link** to get `https://<your-site>/l/<slug>`.
Anyone can open it signed out, with nothing to install; they get a read-only page with each dish's photo,
rating, note, tags and a link to its place on a map. Turn sharing off and the link stops working immediately.
Turning it on again creates a **new** link, so an old one never comes back to life.

**What a visitor can see:** dish names, ratings, notes, tags, place names/addresses, photos, and the list's
title and description, plus an optional name you choose in the share panel (“Your name on shared lists”).
It is blank until you set it and is **never taken from your email**. They never see your email, user id,
or any dish that isn't on the list. Shared pages are marked `noindex` so search engines skip them.
Check your notes before sharing: they are public on the page.

**How it works**
- The page reads through the database function `get_public_list(slug)` (runs for signed-out visitors, only
  ever returns a list that is currently public; there is no other anonymous access to your tables).
- Photos are private, so the page asks the **`public-list-photos`** Edge Function for 1-hour signed links.
  It only signs photos of dishes in a list that is public right now, and answers the same empty reply for
  unknown, private and malformed links. It uses the service role that Supabase gives every Edge Function, so
  there is nothing to configure and no secret in Vercel. Deploy:
  `supabase functions deploy public-list-photos --project-ref <ref> --no-verify-jwt`
- **Link previews** (WhatsApp, iMessage, Slack, Telegram, X...): those apps fetch the link without running
  JavaScript, so `vercel.json` sends `/l/<slug>` to a Vercel Function (`api/og-list.ts`) **only for known
  preview bots**; people get the normal app. It returns the title and a one-line summary as Open Graph tags,
  reads the same public database function with the public anon key, and returns a bare 404 for anything private
  or unknown. It uses the two env vars the app already needs (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  **It only goes live after you redeploy to Vercel.** There is no preview image yet (photos are private).
- If your Vercel project has **Deployment Protection** on, signed-out visitors and preview bots hit a Vercel
  login instead of your page. Turn it off for production (Project → Settings → Deployment Protection) so
  shared links work for everyone.

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
3. Want-to-try and sharing in ✅
4. Search and filters ✅
5. Place page ✅
6. Map view ✅
7. Shareable lists and public page ✅ (link previews need a Vercel redeploy)
8. Polish
