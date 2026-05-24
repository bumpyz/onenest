# OneNest

A co-parenting / family calendar app. Shared events, custody schedules, task
lists, and weekly push digests across separated parents, blended households,
and traditional families.

Built with **Expo (SDK 56) + Expo Router** so the same codebase ships to iOS,
Android, and the web. Data lives in **Supabase** — Postgres with RLS,
Edge Functions (Deno), and the Vault for OAuth secret storage.

## What's in it

- **Shared calendar** with day / week / month views. Drag-to-create on web,
  long-press-to-create on native. Recurring events use rrule + luxon for
  DST-correct expansion.
- **Custody schedule** — six built-in patterns (2-2-3, 2-2-5-5, 3-4-4-3, 7-7,
  5-2, alternating weekends) plus per-date overrides. Each parent gets a
  consistent color; events optionally alternate by the custody schedule.
- **Tasks + Lists** — multi-list per task, per-child tagging, bulk operations,
  inline quick-add, push reminders via Expo Push + pg_cron.
- **External calendar pairing** — Google + Microsoft. Stored tokens are vault-
  encrypted; only "busy" status crosses the per-parent privacy boundary.
- **Push notifications** — Sunday weekly digest (conflicts, unassigned events,
  task counts) and per-task reminders, both scheduled via pg_cron.
- **Locations** — Google Places autocomplete, saved locations, embedded map
  preview.

## Privacy model

Paired external calendars (Google / Microsoft) are **private per parent**.
Only the time range of busy blocks is shared with co-parents — never titles,
descriptions, attendees, or locations. The household members see "Alice is
busy 2-4pm" without learning that it's a dentist appointment.

## Stack

- **Frontend:** Expo 56, Expo Router (file-based routes), React Native Web for
  the browser target. State lives in custom hooks; no global store.
- **Backend:** Supabase (Postgres + RLS + Vault), three Edge Functions
  (sunday-summary, task-reminders, google-oauth-proxy), pg_cron for scheduling.
- **Recurrence:** rrule.js + luxon, with a shared Deno port in
  `supabase/functions/_shared/recurrence-resolver.ts` so the sunday-summary
  push and the in-app view agree on what falls in the coming week.
- **Auth:** Google OAuth (web + native). Apple Sign In wired but deferred.

## Getting started

Prereqs: Node 20+, the Supabase CLI, an [Expo](https://expo.dev) account if you
plan to test on a device.

```bash
# Install
npm install

# Copy the env template and fill in your Supabase project's URL + anon key,
# Google OAuth client IDs, and (optionally) Google Places API key.
cp .env.example .env.local

# Run the dev server (web + Expo Go QR)
npx expo start
```

For the database, run migrations from `supabase/migrations/` (numbered
0001…0030 as of writing). Each migration is idempotent — re-applying is a
no-op.

Edge functions deploy individually:

```bash
supabase functions deploy sunday-summary  --no-verify-jwt
supabase functions deploy task-reminders  --no-verify-jwt
supabase functions deploy google-oauth-proxy
```

## Repo layout

```
src/
├── app/                      # Expo Router file-based routes
│   ├── (app)/                # Authenticated tabs: Home, Calendar, Lists, Settings
│   ├── (auth)/               # Sign-in
│   ├── (onboarding)/         # Create household
│   ├── event/, task/, list/, child/, location/, custody/
│   └── oauth/                # OAuth callback routes
├── components/               # Reusable UI (forms, pickers, chips, badges)
├── hooks/                    # use-events, use-week-summary, use-lists, etc.
├── lib/                      # db.ts, recurrence.ts, custody.ts, summary.ts, …
└── providers/                # auth-provider, theme-provider

supabase/
├── migrations/               # 0001…0030 SQL migrations
└── functions/
    ├── _shared/              # Deno modules shared across functions
    ├── sunday-summary/       # Weekly digest push
    ├── task-reminders/       # Per-task push reminders
    └── google-oauth-proxy/   # PKCE token exchange + refresh

docs/
├── qa-findings.md            # Static QA review findings (lifecycle + history)
└── ux-findings.md            # Static UX review findings
```

## Findings docs

Two markdown ledgers track every QA bug and UX issue surfaced by static review
agents (or anyone reading the code). Each entry has a stable ID (`QA-NNN` /
`UX-NNN`), a severity bucket, and a status lifecycle (new → accepted →
in-progress → fixed → verified, with `wont-fix` and `duplicate` for closed
items). When code lands for an accepted item, the fix gets a short note in
the same entry so the lineage is one-click obvious. See `docs/qa-findings.md`
and `docs/ux-findings.md`.

## Conventions

- **Migrations are idempotent.** `if not exists`, `drop policy if exists`,
  `on conflict do nothing`. New migrations should follow suit.
- **Type-checked everywhere.** `npx tsc --noEmit` runs clean on every commit.
- **No emojis in code or files unless explicitly requested.** A few inline
  emojis in copy (📅 ✓ ↻) are part of the UI vocabulary; otherwise keep it
  clean.
- **Comments earn their keep.** Anything non-obvious — a workaround for an RN
  Web quirk, a privacy-model trade-off, a fix tied to a QA/UX finding ID —
  gets a short comment explaining the why, not the what.
- **The Deno port mirrors the client.** `supabase/functions/_shared/` exists
  so the edge functions don't drift from the client lib. Changes to one
  should mirror the other; the module's header comment says so.
