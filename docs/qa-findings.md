# QA Findings

Static QA review findings from the QA agent. Each entry documents a suspected or
confirmed bug found by reading code (the agent can't run the app). Findings cover
unhandled edge cases, null/race risks, off-by-one errors, dead branches, broken
types, schema/code drift, missing RLS, and similar code-level defects.

## How to use this file

- **New findings** land at status `new` and need triage.
- **Triage**: each `new` becomes `accepted` (real bug), `wont-fix` (closed with
  reason, e.g. "intentional behavior"), or `duplicate` (links to another ID).
- **Accepted** findings get a TaskCreate entry; the Task ID goes into `Related tasks`
  and the finding moves to `in-progress` while that task is active.
- **After code lands** the finding moves to `fixed`; the agent verifies on its next
  scan and marks `verified`.

## Status legend

| Status | Meaning |
|---|---|
| `new` | Just found, awaiting triage |
| `accepted` | Confirmed bug, scheduled to fix |
| `in-progress` | Active Task exists |
| `fixed` | Code landed, awaiting re-verification |
| `verified` | Agent confirmed fix in a later scan |
| `wont-fix` | Closed (e.g. "by design" / "irreproducible at static analysis") |
| `duplicate` | Points to another finding ID |

## Severity buckets

| Severity | Examples |
|---|---|
| `bug-critical` | Data loss risk; security hole; broken core flow with no workaround |
| `bug-major` | Broken feature, no workaround, affects normal usage |
| `bug-minor` | Edge case, cosmetic glitch, only affects unusual states |

## Counts (auto-updated by agent)

- new: 0
- accepted: 0
- in-progress: 0
- fixed: 21
- verified: 0
- wont-fix: 2

---

## Finding template

```markdown
## QA-NNN — Short title (max ~60 chars)
- **Severity:** bug-{critical|major|minor}
- **Area:** (e.g. Lists tab, multi-list refactor, recurrence)
- **Status:** new
- **Found:** YYYY-MM-DD (agent run #N)
- **Repro / Trigger:** Concrete steps or the code path that hits the issue.
- **Expected:** What should happen.
- **Actual:** What the code actually does (and why it's wrong).
- **Notes:** Optional — hypothesis, related bugs, suggested fix.
- **Related tasks:** #NNN (or "none yet")
- **Files:** path/to/relevant.ts (and others)
```

---

<!-- Findings appended below this line. Keep them in numeric ID order. -->

## QA-001 — Editing a task re-arms an already-fired reminder
- **Severity:** bug-major
- **Area:** Tasks / push reminders
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** task/[id] now stores the loaded reminder_at in a ref and only passes reminderAt to updateTask when the computed value differs. Unrelated edits no longer reset reminded_at. See Task #230.
- **Repro / Trigger:** Create a task with a due time and any reminder preset (e.g. "5 min before"). Wait for the cron job to fire the push (which marks `reminded_at`). Then open `/task/[id]` and edit anything (title, notes, assignees, etc.) and tap Save.
- **Expected:** Editing unrelated fields should not cause the reminder to re-fire.
- **Actual:** The edit screen always passes `reminderAt: computeReminderAt(dueAtIso, reminderPreset)` to `updateTask` (`src/app/task/[id].tsx` lines 156-179). `computeReminderAt` returns either an ISO string or `null` — never `undefined`. In `updateTask` (`src/lib/db.ts` lines 1472-1475) the branch `if (input.reminderAt !== undefined)` ALWAYS runs, which unconditionally sets `patch.reminded_at = null`. The next cron tick re-detects the row in the "pending reminders" partial index and sends a duplicate push.
- **Notes:** Fix is either (a) only reset `reminded_at` when `patch.reminder_at` actually changes (compare to the current row), or (b) have the task edit screen pass `reminderAt: undefined` when the user didn't touch the reminder picker. Option (a) is more robust since the comparison naturally handles the "user re-picked the same preset" case too.
- **Related tasks:** #230
- **Files:** src/app/task/[id].tsx (lines 156-188), src/lib/db.ts (lines 1461-1499), src/lib/task-reminders.ts (lines 29-37)

## QA-002 — Sunday summary ignores recurring events and alternation
- **Severity:** bug-major
- **Area:** sunday-summary edge function
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** New shared Deno module `supabase/functions/_shared/recurrence-resolver.ts` ports `expandEventToOccurrences`, custody pattern math, override-map building, and `resolveResponsibleProfileId` from the client lib (uses `npm:rrule@2.7.2` + `npm:luxon@3.4.4`). The sunday-summary function now: (1) fetches events whose `starts_at < horizon AND (ends_at > now OR recurrence_rule IS NOT NULL)` so multi-day overlap + recurring masters with old starts_at are both included; (2) fetches custody_schedules, custody_overrides, and event_occurrence_overrides for the relevant households and the window; (3) expands each master into occurrences in [now, horizon); (4) routes every occurrence through the resolver so alternation events count under the actual responsible parent (not as unassigned). One-off events also use interval-overlap to catch the cross-midnight case (mirrors QA-011). See Task #231.
- **Repro / Trigger:** Any household whose week-ahead events include either (a) a recurring event whose master `starts_at` is more than 7 days in the past, or (b) any event with `responsible_alternation` set (the master row carries `responsible_profile_id = null`).
- **Expected:** The Sunday summary push should match what the user sees in Home's "Next 7 days" card — recurring instances expanded into occurrences, alternation events resolved to the actual responsible parent per occurrence.
- **Actual:** `supabase/functions/sunday-summary/index.ts` (lines 132-138) just runs `.from('events').select(...).gte('starts_at', nowIso).lt('starts_at', horizonIso)`. There is no recurrence expansion and no call to the responsible resolver. Effects:
  1. Recurring events whose master `starts_at` is BEFORE the window (i.e. most ongoing series) are completely missed — they're filtered out by the `gte('starts_at', nowIso)` clause. The user gets a push that says "0 events" when in reality the next 7 days are full of weekly soccer / drop-offs.
  2. Alternation events that DO fall in the window are counted as `unassigned += 1` (line 185-188) because their stored `responsible_profile_id` is null, even though the resolver would assign them.
- **Notes:** The client-side `useWeekSummary` hook already does the right thing (calls `computeWeekSummary` with the resolver). The edge function needs equivalent logic — either reuse `expandEventToOccurrences` / `resolveResponsibleProfileId` from the client lib in Deno, or duplicate the logic carefully. The conflict count is similarly broken for the same reason. **Chose the duplicate-with-shared-module route** — Deno can't import the client lib directly (Node bundler resolution), and a true shared monorepo workspace would add tooling complexity disproportionate to the win. The shared module's docstring includes a "keep in sync with src/lib/" warning so drift is caught at code-review time.
- **Related tasks:** #231
- **Files:** supabase/functions/sunday-summary/index.ts, supabase/functions/_shared/recurrence-resolver.ts (new), src/lib/summary.ts, src/lib/recurrence.ts, src/lib/responsible-resolver.ts, src/lib/custody.ts

## QA-003 — Retrying a failed event creation creates duplicate events
- **Severity:** bug-major
- **Area:** event-form save flow
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** event/new.tsx now holds a createdEventIdRef. First successful createEvent stamps it; subsequent submit retries reuse the id and only re-run the task writes. Cleared on successful navigation. See Task #232. Note: event/[id].tsx update path is unaffected (updateEvent is idempotent on its own id).
- **Repro / Trigger:** Create a new event with at least one inline task. Force the task INSERT to fail (e.g. the user goes offline between the event insert and the task insert, or `task_lists` RLS rejects the row). Tap Save again.
- **Expected:** Retry should reuse the already-created event row.
- **Actual:** `src/app/event/new.tsx` `handleSubmit` calls `createEvent(household.id, …)` (line 135) and then iterates inline tasks. If any of the subsequent `createTask` / `setEventChildren` / `setTaskLists` calls throws, the event row is already committed but the form has no record of `created.id`. The error bubbles up to `EventForm.handleSubmit` (`src/components/event-form.tsx` line 389-395), which resets `submitting = false` and re-renders the form intact. Pressing Save again calls `createEvent` again, producing a second row with the same title/time. Same pattern in `event/[id].tsx` for updates (the event update + task writes are not atomic and a retry isn't gated).
- **Notes:** Either (a) capture the created event id locally and switch the form into edit mode on subsequent retries, (b) wrap the whole create-event-plus-tasks operation in a SECURITY DEFINER RPC, or (c) defer the navigation/error until ALL writes have settled and show an "event saved, but some tasks failed" partial-success state. (a) is the simplest fix.
- **Related tasks:** #232
- **Files:** src/app/event/new.tsx (lines 127-155), src/components/event-form.tsx (lines 328-396), src/lib/db.ts (lines 550-583)

## QA-004 — task-reminders Anyone-task expansion ignores assignee role/membership timing
- **Severity:** bug-minor
- **Area:** task-reminders edge function
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Anyone-task expansion in the edge function now filters household_members with `.in('role', ['parent', 'caregiver'])` so viewers no longer receive task-action pushes. See Task #235.
- **Repro / Trigger:** A task with zero `task_assignees` (Anyone) in a household where one member has been added very recently OR is a `viewer` role.
- **Expected:** Push goes to every household member who could plausibly act on the task.
- **Actual:** `supabase/functions/task-reminders/index.ts` (lines 92-109) fetches every row from `household_members` for the matching `household_id`, with no role filter. Viewers (read-only) get the same "task reminder" push as parents/caregivers, which is misleading because tapping it lands them in a screen where they can't actually complete the task. Minor but a real correctness issue.
- **Notes:** Add `.in('role', ['parent', 'caregiver'])` to the membership query (or whatever role set "can act on tasks" maps to). Document the decision in the function header.
- **Related tasks:** #235
- **Files:** supabase/functions/task-reminders/index.ts (lines 92-109)

## QA-005 — Calendar all-day events stored with local-midnight ISO drift days across timezones
- **Severity:** bug-major
- **Area:** event creation / all-day events
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** event-form.tsx handleSubmit now constructs all-day starts_at/ends_at at UTC midnight (`new Date('${date}T00:00:00Z')`, advanced via setUTCDate). Consumers — event/[id].tsx initialValues, calendar.tsx allDayEventsForDay + eventsByDay walker, index.tsx eventsForDay — derive the all-day date by the UTC YYYY-MM-DD prefix instead of local-time fields, so every viewer reads the same calendar date the creator picked. Migration 0029 backfills any legacy all-day rows to UTC midnight using each row's `timezone` column to recover the intended date. See Task #245.
- **Expected:** Both users see the event on May 22.
- **Actual:** `src/components/event-form.tsx` `handleSubmit` (lines 335-338) builds `startsAt = new Date('${date}T00:00')` which is local midnight, then `.toISOString()` converts to UTC. From Tokyo that's `2026-05-21T15:00:00Z`. Calendar consumers do `new Date(event.starts_at)` and `isSameDay(start, day)` against local-tz day cells — for the Tokyo creator that's still May 22, but a viewer in any tz further west than UTC+0 sees the event in their local rendering as May 21. The recurrence expander preserves the same `starts_at` for each occurrence, so weekly all-day series shifts the day-of-week by 1 across some viewer timezones.
- **Notes:** Two reasonable fixes: (a) store all-day events as DATE (no time component) in the DB and adjust the column type, or (b) keep timestamptz but normalize the wall clock to UTC midnight (`new Date(`${date}T00:00:00Z`)`) so every viewer sees the same calendar date. Same issue affects the Google sync path: `src/lib/google-calendar.ts` line 178-179 already uses `${e.start.date}T00:00:00.000Z` (UTC midnight) for incoming all-day events, so the inconsistency is even within our own data. **Chosen (b)** — keeps the schema stable and matches the google-calendar import shape.
- **Related tasks:** #245
- **Files:** src/components/event-form.tsx (lines 335-345), src/lib/google-calendar.ts (lines 174-195), src/app/(app)/calendar.tsx (lines 100-102, 819), src/app/(app)/index.tsx, src/app/event/[id].tsx, supabase/migrations/0029_backfill_all_day_utc_midnight.sql

## QA-006 — Apply-To toggle effect clobbers in-progress edits when override map refetches
- **Severity:** bug-minor
- **Area:** event-form (occurrence override mode)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** The re-seed effect now only fires on an actual `applyTo` TRANSITION (tracked via `prevApplyToRef`). `hasExistingOccurrenceOverride` and `occurrenceOverrideResponsibleId` are read from refs at toggle time so subsequent overrideMap refetches no longer overwrite the user's in-progress chip pick. See Task #248.
- **Repro / Trigger:** Open `/event/[id]?date=YYYY-MM-DD` for a recurring event. Switch to "This occurrence only", pick a different responsible parent, then trigger a refetch of `useEventOccurrenceOverrides` (e.g. by causing the screen to re-render in a way that returns a fresh `existingOverride` reference — focus, navigation back, etc.).
- **Expected:** User's in-progress responsible-parent pick is preserved across refetches.
- **Actual:** `src/components/event-form.tsx` lines 227-237 has a `useEffect` that resets `responsibleId` whenever `applyTo`, `hasExistingOccurrenceOverride`, or `occurrenceOverrideResponsibleId` changes. The dep array intentionally excludes `initialValues.*`, but `hasExistingOccurrenceOverride` is recomputed each render in the parent (`!!existingOverride`) and `occurrenceOverrideResponsibleId` is a value pulled from `useEventOccurrenceOverrides.overrideMap`. If that map refetches and the row identity changes, those props can flip and the effect overwrites the user's pick.
- **Notes:** Either (a) move the seed logic into a `useState` initializer keyed on `applyTo`, (b) only run the effect on `applyTo` transitions (use a ref to detect), or (c) freeze the override seed at mount. **Chose (b)** — minimal surface change, preserves the existing "re-seed on toggle" semantic.
- **Related tasks:** #248
- **Files:** src/components/event-form.tsx (lines 217-237), src/app/event/[id].tsx (lines 88-97)

## QA-007 — PlacesAutocomplete debounce resets on every parent re-render
- **Severity:** bug-minor
- **Area:** Places autocomplete (event form)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** event-form.tsx now wraps `skipFetchValues` in `useMemo(() => locations.flatMap(...), [locations])` so the array identity is stable across re-renders. PlacesAutocomplete's debounce effect no longer thrashes mid-keystroke. See Task #236.
- **Repro / Trigger:** Open `/event/new`, focus the Location field, start typing slowly while React state churns in the parent (e.g. typing in another field, the dragState updating, refetches firing).
- **Expected:** A keystroke followed by a 300 ms pause should fire the Places autocomplete fetch.
- **Actual:** `src/components/places-autocomplete.tsx` line 89-149 declares its debounce `useEffect` with deps `[value, placesOn, skipFetchValues]`. The parent (`src/components/event-form.tsx` line 1015) passes `skipFetchValues={locations.flatMap(l => …)}` — a freshly constructed array on every render. Every time `EventForm` re-renders for any reason, `skipFetchValues` gets a new identity, the effect re-runs, the existing 300 ms timeout is cleared and replaced, and the user's typing never debounces to completion.
- **Notes:** Either (a) memoize `skipFetchValues` in `event-form.tsx`, or (b) inside `places-autocomplete.tsx` switch the dep to a stable hash of the array's contents.
- **Related tasks:** #236
- **Files:** src/components/places-autocomplete.tsx (lines 89-149), src/components/event-form.tsx (lines 1015-1019)

## QA-008 — Migrations 0020 and 0021 are not idempotent
- **Severity:** bug-minor
- **Area:** Supabase migrations
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** 0020_child_colors.sql now uses `add column if not exists` and gates the backfill on `where color is null`. 0021_responsible_alternation.sql uses `add column if not exists`, named CHECK constraint with `drop constraint if exists`, `create table if not exists`, `create index if not exists`, and `drop policy if exists` before every `create policy`. Both migrations are now safe to rerun. See Task #237.
- **Repro / Trigger:** Reapply migrations after a partial-failure deploy or while bringing up a fresh environment that's already past these migrations.
- **Expected:** Migrations are safe to re-run (matches the stated style elsewhere — 0017, 0023, 0025, 0026, 0027 all use IF NOT EXISTS / DROP IF EXISTS / ON CONFLICT).
- **Actual:** `supabase/migrations/0020_child_colors.sql` uses bare `alter table public.children add column color text;` (no IF NOT EXISTS) followed by `alter column color set not null;`. Re-running fails on the first statement. `supabase/migrations/0021_responsible_alternation.sql` similarly uses `alter table public.events add column responsible_alternation text…` and `create table public.event_occurrence_overrides …` without IF NOT EXISTS, and the `create policy` statements have no `drop policy if exists` guards.
- **Notes:** Match the pattern from 0023/0025/0026 (IF NOT EXISTS, DROP POLICY IF EXISTS) so partial-apply recovery is safe. This isn't a runtime bug today but bites the next time we need to re-run migrations on a partly-bricked DB.
- **Related tasks:** #237
- **Files:** supabase/migrations/0020_child_colors.sql, supabase/migrations/0021_responsible_alternation.sql

## QA-009 — deleteList doc-comment says ON DELETE SET NULL but FK is cascade after migration 0025
- **Severity:** bug-minor
- **Area:** Lists deletion, code/doc drift
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** deleteList docstring now accurately describes the task_lists junction reality post-migration 0025: deletes cascade via task_lists.list_id FK, and tasks left with zero list rows fall into Inbox. See Task #238.
- **Repro / Trigger:** Code review / reader confusion. No user-visible effect today.
- **Expected:** Docstring matches what actually happens at the DB layer.
- **Actual:** `src/lib/db.ts` line 1180-1186 documents deleteList as "The DB-level FK is ON DELETE SET NULL, so any tasks that lived here survive with list_id = null." That was true under migration 0023, but migration 0025 (`task_lists_multi`) dropped the entire `tasks.list_id` column. Now deletes propagate via `task_lists.list_id` FK which is `ON DELETE CASCADE` (migration 0025 line 25). The task itself survives but with one fewer row in `task_lists` — the UI then folds tasks with empty `list_ids` into Inbox. Same end-user behavior, but the comment misleads future maintainers (and the multi-list orphan path is now the only path).
- **Notes:** Update the doc-comment to describe the current behavior. Cheap cleanup.
- **Related tasks:** #238
- **Files:** src/lib/db.ts (lines 1180-1186), supabase/migrations/0025_task_lists_multi.sql (lines 23-31, 70-73)

## QA-010 — Drag-to-create can leak window pointermove listener on view change mid-drag
- **Severity:** bug-minor
- **Area:** Calendar drag-to-create
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Both calendar.tsx (drag-to-create) and lists.tsx (chip reorder) now stash the active drag's `{ onMove, onUp }` in `activeDragHandlersRef`. onUp clears it after detaching listeners; the outer effect's cleanup also calls into the ref when present, removing the listeners and clearing dragState. View switches / lists refetches mid-drag no longer leak handlers bound to stale closures. See Task #246.
- **Repro / Trigger:** On web, mousedown on a day column to start a drag, then while still holding the mouse button down, switch view (Day ↔ Week, or anything that changes `viewMode` / `anchor` / `days`).
- **Expected:** Cancelled drag cleans up its listeners.
- **Actual:** `src/app/(app)/calendar.tsx` line 340-399 — the outer `useEffect` cleanup removes the `pointerdown` listener from each day column, but the `pointermove` and `pointerup` handlers installed on `window` inside `onDown` are not part of the effect's cleanup. If the effect re-runs while a drag is in flight, those window-level listeners remain bound to a stale `days` array and `rect`. The eventual pointerup fires `router.push` with a `day` reference taken from the OLD `days` array, which may not be what's currently rendered. Subsequent renders can also accumulate orphan listeners if the user drags-and-switches repeatedly.
- **Notes:** Track the active drag's `onMove`/`onUp` in a ref so the outer effect's cleanup can detach them. Same pattern would also fix the analogous chip-drag listener in `lists.tsx` (lines 197-259) — it adds window-level listeners inside `handleChipPointerDown` without a cleanup hook in the outer effect.
- **Related tasks:** #246
- **Files:** src/app/(app)/calendar.tsx (lines 340-399), src/app/(app)/lists.tsx (lines 197-280)

## QA-011 — getEventsForRange skips multi-day events that start before the range
- **Severity:** bug-minor
- **Area:** Calendar fetch
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** One-off filter now uses the standard interval-overlap predicate `starts_at < rangeEnd AND ends_at > rangeStart` (was `starts_at >= rangeStart AND starts_at < rangeEnd`). A Fri 6pm → Sat 2am event now appears on a Saturday-starting week. Updated comment block to describe the overlap semantic. See Task #247.
- **Repro / Trigger:** Create a one-off event that starts on Friday at 6 PM and ends Saturday at 2 AM (cross-midnight). Open the calendar on a week where Saturday is the first visible day.
- **Expected:** The event renders on Saturday morning (the part of its span that falls in view).
- **Actual:** `src/lib/db.ts` lines 437-444 — the one-off branch filters `.gte('starts_at', rangeStart.toISOString()).lt('starts_at', rangeEnd.toISOString())`. Events whose `starts_at` is before `rangeStart` are excluded outright, even if their `ends_at` overlaps the window. The author flagged this limitation in the code comment (lines 414-416: "Multi-day one-off events that start before the range but extend into it are not included"), but no fix has shipped. The recurring branch has the inverse limitation: events whose master `starts_at` is BEFORE the window get fetched even if their UNTIL ended a year ago (a perf nit, not a correctness bug).
- **Notes:** Add a second OR clause to the one-off query: events whose `ends_at > rangeStart AND starts_at < rangeEnd`. The recurring side already pulls everything started before the window, so cross-midnight recurring instances should already be expanded correctly.
- **Related tasks:** #247
- **Files:** src/lib/db.ts (lines 414-471)

## QA-012 — Calendar grid scroll-to-7AM only fires on initial mount, not on view re-entry
- **Severity:** bug-minor
- **Area:** Calendar view switching
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** scroll-to-7AM effect is now keyed on `[viewMode]` with an early-return `if (viewMode === 'month') return` guard. Returning to Week view from Month re-runs the effect against the freshly remounted ScrollView and lands the user at the 7 AM hour band. See Task #239.
- **Repro / Trigger:** Open the Calendar tab on Week view (default scroll lands at 7 AM). Switch to Month view, then switch back to Week.
- **Expected:** The week grid scrolls back to ~7 AM so the user lands on a useful time slot.
- **Actual:** `src/app/(app)/calendar.tsx` lines 290-298 — the `useEffect` that scrolls the inner ScrollView is keyed on `[]`, runs once at CalendarScreen mount. But the inner ScrollView (`gridScrollRef`) is conditionally rendered inside the non-month branch (line 909-1197). Switching to Month view unmounts it; switching back remounts it with default scroll position (top, i.e. midnight). The user is now staring at the 12 AM hour band.
- **Notes:** Move the scroll-to effect to depend on `viewMode` and gate it on `viewMode !== 'month'`. Reset isn't catastrophic but compounds with the larger drag-to-create / data-refetch UX work in this area.
- **Related tasks:** #239
- **Files:** src/app/(app)/calendar.tsx (lines 289-298)

## QA-013 — sunday-summary queries non-existent `household_id` column on event_occurrence_overrides
- **Severity:** bug-critical
- **Area:** sunday-summary edge function / occurrence override fetch
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** event_occurrence_overrides query now uses `events!inner(household_id)` and filters on `events.household_id` (mirrors the client's `getEventOccurrenceOverridesForRange` pattern). The result is normalized for both `{ events: {...} }` and `{ events: [{...}] }` shapes that postgrest-js can return for embedded relations. Added `error` destructuring + `console.error` to every query in the function (custody_schedules, custody_overrides, event_occurrence_overrides, external_events, tasks) so future schema drift surfaces in logs instead of silently dropping data. Needs `supabase functions deploy sunday-summary --no-verify-jwt` to land.
- **Repro / Trigger:** Any deploy of the rewritten sunday-summary function (introduced when QA-002 was fixed). Runs on every Sunday-summary cron tick.
- **Expected:** Per-event, per-date occurrence overrides for events in the user's household(s) are folded into the responsible-parent resolution so the Sunday-summary push counts match what `useWeekSummary` shows on Home.
- **Actual:** `supabase/functions/sunday-summary/index.ts` lines 200-205 runs:
  ```ts
  await supabase
      .from('event_occurrence_overrides')
      .select('event_id, occurrence_date, responsible_profile_id, household_id')
      .in('household_id', allHouseholdIds)
      ...
  ```
  The `event_occurrence_overrides` table (`supabase/migrations/0021_responsible_alternation.sql` lines 34-41) is keyed on (event_id, occurrence_date) and has NO `household_id` column — that's the whole reason the RLS policies (lines 49-66) join through `events e where e.id = event_id`. The compiled query will fail with `column "household_id" does not exist` (or `column event_occurrence_overrides.household_id does not exist` depending on alias). Additionally, the destructure on line 200 only reads `data` and never inspects `error`, so the failure is **silent** — `occOverridesRaw` becomes null/undefined, the `?? []` makes the for-loop a no-op, `occOverridesByHousehold` stays empty, and `resolveResponsibleProfileId` runs every occurrence through the alternation/static-field path with no override layer at all. The push notification ends up disagreeing with the in-app view exactly when the user has bothered to override one — which is the whole point of overrides.

  Compare with the working pattern in `src/lib/db.ts` lines 1050-1067 (`getEventOccurrenceOverridesForRange`) which uses `events!inner(household_id)` to join through.
- **Notes:** Two fixes: (a) drop `household_id` from the select + filter via `events!inner(household_id)` and `.eq('events.household_id', ...)` (matches the client lib's getter), or (b) since the function already has `allHouseholdIds`, fetch overrides per-household with the join. Also add `error` destructuring to every `supabase` query in the function — there are several others (custody_schedules, custody_overrides, external_events, tasks) where errors are similarly swallowed.
- **Related tasks:** none yet
- **Files:** supabase/functions/sunday-summary/index.ts (lines 200-216), supabase/migrations/0021_responsible_alternation.sql (lines 34-41), src/lib/db.ts (lines 1050-1067)

## QA-014 — All-day recurring events stored with non-UTC tz shift dates at DST boundaries
- **Severity:** bug-major
- **Area:** All-day events + recurrence expansion (QA-005 fix interaction)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** event-form.tsx handleSubmit now hardcodes `timezone: 'UTC'` for any allDay=true event at submit time (timed events keep the editor's IANA tz so DST keeps the wall clock invariant). Migration 0030 backfills `events.timezone = 'UTC'` for all existing all_day=true rows. With the wall clock and the timezone column in agreement, the recurrence expander's floating-DTSTART transform produces wall-clock-stable occurrences across DST — no more weekday flips after each transition. Same algorithm fix applies on both the client and the Deno port (no port changes needed; the expander already does the right thing when given consistent tz + UTC-midnight starts_at).
- **Repro / Trigger:** A user in any IANA tz with DST (e.g. America/New_York) creates a weekly all-day recurring event whose first occurrence falls before a DST transition. View the calendar after the transition.
- **Expected:** Every occurrence renders on the same weekday as the master event (e.g. every Sunday).
- **Actual:** The QA-005 fix in `src/components/event-form.tsx` lines 386-395 anchors `starts_at` at UTC midnight (`new Date('${date}T00:00:00Z')`). But the form still passes `timezone: initialValues.timezone` (line 447), which for a new event is the editor's IANA tz from `src/app/event/new.tsx` line 114 (`tz = profile?.default_timezone ?? deviceTz`). So an all-day recurring event ends up with `starts_at = 2026-03-01T00:00:00Z` AND `timezone = 'America/New_York'` — the stored instant doesn't match the wall clock the timezone implies.

  When `expandEventToOccurrences` (`src/lib/recurrence.ts` lines 243-267 / mirrored in `supabase/functions/_shared/recurrence-resolver.ts` lines 127-152) takes the tz-aware path:
  1. `utcInstantToFloating('2026-03-01T00:00:00Z', 'America/New_York')` → `2026-02-28T19:00:00 floating` (NY wall clock on 2026-03-01 UTC = Feb 28 19:00 EST).
  2. rrule weekly produces `Feb 28 19:00`, `Mar 7 19:00`, `Mar 14 19:00`, …
  3. `floatingInTzToUtc(Mar 14 19:00, 'America/New_York')` → after DST starts on 2026-03-08, NY tz is EDT (UTC-4), so Mar 14 19:00 NY = `2026-03-14T23:00:00Z`, NOT `2026-03-15T00:00:00Z`.

  The all-day renderers all key off `event.starts_at.slice(0, 10)` (`src/app/(app)/calendar.tsx` lines 126-136 `allDayEventsForDay`, lines 296-312 `eventsByDay`, `src/app/(app)/index.tsx` lines 43-62 `eventsForDay`). With `starts_at = '2026-03-14T23:00:00Z'`, the slice yields `'2026-03-14'`. The user's "Sunday" all-day event now renders on Saturday Mar 14 — the wrong day. Confirmed by stepping through both the client expander and the Deno port; same algorithm, same shift.

  This is brand-new behaviour because QA-005 told users to trust UTC-midnight prefix decoding for all-day events. Pre-QA-005 the wall clock and the tz agreed (creator's local midnight in creator's tz), so the floating-DTSTART transform produced wall-clock-stable occurrences. Now they disagree.
- **Notes:** Two reasonable fixes: (a) hard-code `timezone: 'UTC'` for all-day events at submit time (event-form.tsx handleSubmit), making the UTC-midnight anchor consistent with the timezone field — every viewer's date prefix logic keeps working and DST never shifts the occurrence; (b) skip the tz-aware floating-DTSTART path entirely for `event.all_day === true` in both expanders (use raw UTC instant + rrule, like the legacy null-tz branch). (a) is smaller and matches the migration-0029 backfill semantics (which already collapses everything to UTC). Either way, also need a one-shot follow-up migration (or run 0029 again) to override `timezone` to `'UTC'` for existing `all_day=true` rows where it's been set to something else, otherwise legacy rows keep producing the bad expansion.
- **Related tasks:** none yet
- **Files:** src/components/event-form.tsx (lines 386-395, 447), src/app/event/new.tsx (lines 86-114), src/lib/recurrence.ts (lines 243-267), supabase/functions/_shared/recurrence-resolver.ts (lines 127-152), src/app/(app)/calendar.tsx (lines 126-136, 289-321), src/app/(app)/index.tsx (lines 43-62)

## QA-015 — Migration 0029 picks UTC-date for pre-0015 all-day rows, losing the creator's intended date
- **Severity:** bug-minor
- **Area:** Migration 0029 backfill / legacy data
- **Status:** wont-fix
- **Found:** 2026-05-23 (agent run #2)
- **Resolution:** Accepted as a known limitation. Migration 0024 already collapsed every NULL timezone to 'UTC' before 0029 ran, so the creator's original tz is gone. No safe automated recovery — guessing from a household-default tz or a profile field would create different but still-wrong dates for users who travel or migrate. Project is pre-launch with a single developer-user household, so the practical impact is zero (no Tokyo-pre-0015 rows exist). Documenting here so any future operator handling actual user data knows to survey the affected rows manually if this ever ships against real legacy data.
- **Repro / Trigger:** Any all-day event created before migration 0015 (the per-event `timezone` column) by a user east of UTC (e.g. a Tokyo user picking "May 22" before 0015 landed). Migration 0024 backfilled the NULL timezone to `'UTC'`; migration 0029 then runs against the row.
- **Expected:** The all-day event's calendar date is recovered to what the creator originally picked (e.g. May 22 in Tokyo).
- **Actual:** `supabase/migrations/0029_backfill_all_day_utc_midnight.sql` lines 21-28 normalizes via `(starts_at at time zone coalesce(timezone, 'UTC'))::date`. For a Tokyo-created row stored as `2026-05-21T15:00:00Z` (local midnight on May 22 in Tokyo, serialized to UTC), the post-0024 timezone is `'UTC'` (not `'Asia/Tokyo'`). The expression `at time zone 'UTC'` gives wall clock `2026-05-21 15:00:00`, `::date` → `2026-05-21`. The migration rewrites starts_at to `2026-05-21T00:00:00Z`, which is now off by one day from the creator's intent.

  Migration 0024's choice of backfilling NULL → 'UTC' is documented as "the safe default because the stored starts_at/ends_at are already in UTC, so wall-clock-in-UTC equals the existing instant." For TIMED events that's fine. But for legacy all-day events specifically, the stored UTC instant encoded LOCAL midnight in the creator's tz, not UTC midnight — so `at time zone 'UTC'` recovers the wrong date.

  Same issue applies to ends_at (line 26).
- **Notes:** Hard to fix retroactively without knowing the creator's tz — that information is lost once 0024 wiped it to 'UTC'. Mitigations: (a) run 0029 BEFORE 0024 in any future env-bootstrap order, so the timezone column is still NULL when 0029 reads it (but null COALESCE is still 'UTC' — same problem); (b) augment 0029 to use a household-default tz or the creator's profile.default_timezone as a better fallback; (c) ship a one-off remediation script that operators can run on existing prod data after surveying affected rows by hand. Most ML-pedantic but realistic outcome: accept a small data-quality hole for pre-0015 all-day rows and document it. Note that 0029's WHERE clause (lines 30-35) still fires for these rows (their UTC hour is 15, non-zero), so they ARE being touched.
- **Related tasks:** none yet
- **Files:** supabase/migrations/0029_backfill_all_day_utc_midnight.sql (lines 19-35), supabase/migrations/0024_backfill_legacy_event_timezone.sql (entire), supabase/migrations/0015_event_timezone.sql

## QA-016 — Client expandEventToOccurrences still uses starts-only check, drifting from Deno port and QA-011 semantics
- **Severity:** bug-minor
- **Area:** Recurrence expander / code drift
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** src/lib/recurrence.ts one-off branch now uses `start < rangeEnd && end > rangeStart` — the interval-overlap predicate QA-011 retired everywhere else. Verbatim match with the Deno port in supabase/functions/_shared/recurrence-resolver.ts. The active getEventsForRange caller still pre-separates one-offs and doesn't reach this branch, but the function now actually delivers what its docstring promises for any future caller.
- **Repro / Trigger:** Code review / latent landmine. No direct user-visible effect today because the only caller (`getEventsForRange` in `src/lib/db.ts` lines 439-471) pre-separates one-offs from recurring and never passes a non-recurring event to the expander.
- **Expected:** The client `expandEventToOccurrences` matches the QA-011 fix in `getEventsForRange` AND the freshly-shipped Deno port (`supabase/functions/_shared/recurrence-resolver.ts` lines 110-120) — i.e. one-off events without `recurrence_rule` use the standard interval-overlap predicate `start < rangeEnd && end > rangeStart`.
- **Actual:** `src/lib/recurrence.ts` lines 218-222 still uses the starts-only predicate:
  ```ts
  if (!event.recurrence_rule) {
      const start = new Date(event.starts_at);
      if (start >= rangeStart && start < rangeEnd) return [event];
      return [];
  }
  ```
  This is the exact predicate QA-011 retired everywhere else. Any new caller that hands a one-off event to this function (e.g. a future digest hook, a unit test harness, a copy-pasted snippet in a screen) will silently lose multi-day events that started before the window. The Deno port already does the right thing (overlap predicate), so the two are now intentionally divergent — which is exactly what the "keep in sync" warning at the top of the Deno module is supposed to prevent.
- **Notes:** Fix is one line: replace the starts-only check with `if (start < rangeEnd && end > rangeStart) return [event]`. Mirrors the Deno port verbatim. Low priority because the active call site doesn't hit it, but the file claims the function returns occurrences that "fall in [rangeStart, rangeEnd)" — which the current implementation doesn't actually deliver for multi-day one-offs.
- **Related tasks:** none yet
- **Files:** src/lib/recurrence.ts (lines 213-222), supabase/functions/_shared/recurrence-resolver.ts (lines 110-120), src/lib/db.ts (lines 439-471)

## QA-017 — Client custody dateKey uses local format; Deno uses event-tz — cross-tz responsible-parent mismatch
- **Severity:** bug-minor
- **Area:** Responsible-parent resolver / client-edge drift
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** New `dateKeyInTz(date, tz)` helper in src/lib/custody.ts (Luxon-backed, mirrors the Deno port verbatim). `resolveCustodianOnDate` now accepts an optional `tz` param and uses it for the override lookup key; `resolveResponsibleProfileId` passes `event.timezone` through. Legacy callers (calendar custody-band strip) keep the local-time behavior by omitting tz, since they operate on a local-midnight calendar Date with no event context. Cross-tz viewers now compute the same cycle index and overrides the sunday-summary edge function does.
- **Repro / Trigger:** A household where the responsible parent on the calendar (the user's machine) is in tz X, but the event has `timezone = 'America/New_York'`. Triggered when the calendar viewer is in a tz that flips the calendar date relative to the event's tz (e.g. event near midnight in NY tz, viewer in Tokyo).
- **Expected:** The Sunday-summary push counts conflicts / assignments per the same custody date key the in-app calendar uses; the user sees the same responsible parent everywhere.
- **Actual:** The client `resolveCustodianOnDate` (`src/lib/custody.ts` lines 125-144) and `resolveResponsibleProfileId` (`src/lib/responsible-resolver.ts` line 55) both key off `format(occurrenceDate, 'yyyy-MM-dd')` — local-time format. The Deno port (`supabase/functions/_shared/recurrence-resolver.ts` lines 221-230, 281) keys off `dateKeyInTz(occurrenceDate, event.timezone)` — uses the event's IANA tz. For most users (single-tz household) these agree. But for a traveling parent viewing the calendar from Tokyo (device tz UTC+9) while events use America/New_York tz, an event at e.g. 23:00 NY time (= 04:00 next day UTC = 13:00 Tokyo) resolves to different calendar dates: client → today (Tokyo), Deno → yesterday (NY). The custody lookup uses different cycle indices and may return a different parent. The Sunday-summary push counts a "conflict" the user never sees on screen (or vice versa).
- **Notes:** Best fix is to align the client to the Deno semantic (use event.timezone for the date key) since the event's tz is the canonical reference for "what day did this happen on." Touches `src/lib/responsible-resolver.ts` line 55 and `src/lib/custody.ts` line 130. Threading the tz through `resolveCustodianOnDate` will also need consumers in `src/app/(app)/calendar.tsx` (line 907, the custodyBand strip) — those pass a `day` Date without context but should be unaffected since "day at midnight local" is a calendar date already, not an event time. Low-confidence flagging: I haven't traced every caller, so the change could surface unexpected breakage in the custody-band UI. Mark as bug-minor with caution.
- **Related tasks:** none yet
- **Files:** src/lib/custody.ts (lines 125-144), src/lib/responsible-resolver.ts (lines 51-78), supabase/functions/_shared/recurrence-resolver.ts (lines 216-300)

## QA-018 — List sort_order swap not atomic; concurrent edits can produce ordering anomalies
- **Severity:** bug-minor
- **Area:** Lists / Move up / Move down
- **Status:** wont-fix
- **Found:** 2026-05-23 (agent run #2)
- **Resolution:** The recommended fix path (b/c) — a SECURITY DEFINER RPC or partial UNIQUE constraint — is the right long-term answer, but the immediate impact is mitigated: list-form.tsx already gates the Move buttons on a `moving` busy state (sets at handler start, clears on completion), so single-tab rage-tap is blocked. Multi-tab races against the same household are the residual exposure, but produce a stable rendering (sort_order ties fall back to deterministic insertion order) with no data loss — just a visual ordering anomaly the user can correct with one more Move. Filing as wont-fix for now; ready to upgrade to a server-side swap RPC if real users start hitting this.
- **Repro / Trigger:** Two browser tabs open on the same household's Lists tab, both editing different lists. Tab A and Tab B both invoke Move up / Move down on adjacent neighbors in quick succession. Also reproduces in a single tab if the user rage-clicks the Move button before the previous `refetchLists` settles.
- **Expected:** The chip strip ends up in a consistent ordering, the two-row write either fully applies or fully fails.
- **Actual:** `src/app/list/[id].tsx` lines 90-101 — the swap reads `list.sort_order` and `neighbor.sort_order` from local state, then issues two sequential `updateList` writes. There's no SQL-level CAS or transaction; the writes can interleave with another tab's writes against the same rows. Example scenario: List A has sort_order=100, List B=200, List C=300. Tab A wants to move A down (swap with B). Tab B wants to move B down (swap with C).
  - Tab A reads (A=100, B=200). Tab B reads (B=200, C=300).
  - Tab A writes A=200. Tab B writes B=300.
  - Tab A writes B=100. Tab B writes C=200.
  - Final: A=200, B=100, C=200. **A and C share sort_order=200.**

  There's no UNIQUE constraint on (household_id, sort_order) in `supabase/migrations/0023_lists.sql` lines 24-37, so the duplicate is accepted silently. The chip strip's deterministic order by sort_order falls back to insertion order / primary key — still a stable rendering but no longer reflecting the user's intent. Single-tab rage-tap reproduces a milder version: the second click reads stale state, swaps the wrong rows.

  The screen has no `saving` guard on the Move buttons either, so the user can re-tap freely during the in-flight Promise.
- **Notes:** Fixes in increasing surface area: (a) lock the Move buttons during `swapWithNeighbor` (a busy ref / state). (b) Wrap the two updates in a SECURITY DEFINER RPC that does the swap atomically (or even better, recomputes all sort_orders in one shot from a desired order). (c) Add a partial UNIQUE on (household_id, sort_order) so the DB raises on collision; the client retries with the freshest read. (a) is the cheap UX fix; (b/c) are the real fix. The lists.tsx drag-to-reorder (`saveReorder`, lines 200-213) has the same shape but writes all rows at once via `Promise.all`, which makes the interleave window even bigger if two tabs reorder — flagging that for the same fix.
- **Related tasks:** none yet
- **Files:** src/app/list/[id].tsx (lines 87-101), src/app/(app)/lists.tsx (lines 200-213), supabase/migrations/0023_lists.sql (lines 24-46)

## QA-019 — Client custody cycle index uses local-tz day delta even when override key uses event tz
- **Severity:** bug-major
- **Area:** Responsible-parent resolver / QA-017 follow-up
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** `cycleIndexForDate`, `custodyLabelOnDate`, and `custodianProfileIdOnDate` now all accept an optional `tz` param. When set, the day delta from the anchor is computed in that IANA tz via Luxon (`DateTime.fromISO(anchor, {zone}).startOf('day')` minus the date in the same zone), mirroring the Deno port's `dayDeltaInTz` verbatim. `resolveCustodianOnDate` passes its `tz` through to the schedule-pattern fallback too, so both the override branch AND the pattern branch agree with the edge function. Legacy callers (calendar custody-band strip) keep the local-tz behavior by omitting the param. See Task #257.
- **Repro / Trigger:** Household with a configured custody schedule and an alternation event whose `timezone` differs from the viewer's device tz, on a date where the wall-clock day in the event's tz disagrees with the viewer's local day (e.g. event tz `America/New_York`, occurrence near midnight NY, viewer in `Asia/Tokyo`). The bug shows up most cleanly when **no** custody override exists for that date — that's when the schedule-pattern path runs, and that path is the half QA-017 didn't fix.
- **Expected:** The client and the sunday-summary edge function compute the same responsible-parent profile id for the occurrence. The QA-017 fix made the OVERRIDE lookup tz-correct (uses `dateKeyInTz(date, event.timezone)`), so the pattern lookup in the same function should be tz-correct too — otherwise the function is internally inconsistent (overrides keyed in event tz, fallback keyed in viewer-local tz).
- **Actual:** `src/lib/custody.ts` `resolveCustodianOnDate` (lines 148-168) only threads the `tz` argument into the override map key (line 154, `dateKeyInTz(date, tz)`). When no override matches, line 164 falls through to `custodianProfileIdOnDate(schedule, date)` — which calls `cycleIndexForDate(schedule, date)` (lines 91-97) which uses `differenceInCalendarDays(date, anchor)` from date-fns. `differenceInCalendarDays` interprets both inputs in the runtime's local timezone, NOT the event's timezone. So:

  - Override path: keyed in `event.timezone` (correct, matches Deno).
  - Pattern path: keyed in viewer-local tz (wrong, drifts from Deno).

  Concrete trace — Tokyo viewer (UTC+9), event at `2026-05-22T03:00:00Z` with `timezone='America/New_York'`, custody schedule anchor `2026-05-01`, 7-day cycle `['A','A','B','B','A','A','B']`:
  - `dateKeyInTz(date, 'America/New_York')` → `'2026-05-21'` (NY wall clock: 23:00 May 21).
  - `differenceInCalendarDays(<May 22 12:00 in Tokyo local>, parseISO('2026-05-01'))` → 21 (Tokyo's May 22 − local-parsed May 1).
  - `cycleIndexForDate` → `21 % 7 = 0` → label A → parent_a.
  - But the Deno port's `dayDeltaInTz('2026-05-01', date, 'America/New_York')` would return 20 → `20 % 7 = 6` → label B → parent_b.

  So the same alternation occurrence resolves to parent A in the client and parent B in the Sunday-summary push. The QA-017 docstring at lines 138-146 even claims "callers that have an event in hand … pass `tz = event.timezone` so the override-map lookup keys off the event's wall-clock date, matching the Deno-side resolver" — but the schedule-pattern path (which is the COMMON case, since most events have no override) bypasses the tz threading entirely.

  Compare the Deno port's `custodianProfileIdOnDate` in `supabase/functions/_shared/recurrence-resolver.ts` lines 194-204: it passes `tz` into `cycleIndexForDate` → `dayDeltaInTz(schedule.anchor_date, date, tz)` (lines 175-181), which converts both inputs through Luxon in the event tz. Two ports, two different algorithms for the same path.
- **Notes:** Fix is to thread `tz` through the client's `cycleIndexForDate` and `custodianProfileIdOnDate` (or just inline a Luxon-backed day delta in `resolveCustodianOnDate` and call it directly). The signature change ripples to call sites: `src/app/(app)/calendar.tsx` line 967 (custody-band, passes no event context — keep tz=null), `src/app/(app)/index.tsx` line 672 (DaySection, also no event context — tz=null). The responsible-resolver caller at `src/lib/responsible-resolver.ts` line 79-84 already passes `event.timezone`, so the fix immediately starts working there. Confirmed by re-tracing the algorithm end-to-end against the Deno port — both halves of `resolveCustodianOnDate` need the same tz semantics, and right now only one does. Promoting to bug-major because alternation events are exactly the path the QA-017 fix was meant to align across client/edge.
- **Related tasks:** none yet
- **Files:** src/lib/custody.ts (lines 91-97, 109-116, 148-168), src/lib/responsible-resolver.ts (lines 75-85), supabase/functions/_shared/recurrence-resolver.ts (lines 175-204)

## QA-020 — Sunday-summary task count excludes overdue-today tasks the in-app Home digest shows
- **Severity:** bug-minor
- **Area:** sunday-summary task counting / client-edge drift
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** sunday-summary now computes `todayStartIso` = UTC midnight at the top of today and uses that as the `.gte('due_at', ...)` bound on the open-tasks query. A task with due_at = today 09:00 stays in the push even when cron fires at 15:00, matching the client digest's `startOfDay(now)` behavior. Events still use `nowIso` (a push shouldn't talk about an event that already ended). See Task #262.
- **Repro / Trigger:** A household with at least one open task whose `due_at` is earlier today than the cron-fire instant (e.g. task due `2026-05-24T09:00:00Z`, cron fires at `2026-05-24T15:00:00Z`). Compare the "N tasks to do" count in the Sunday push to the Home tab's "Today's tasks" / "This week" sections after the push lands.
- **Expected:** Same count of actionable upcoming tasks both places — the QA-002 fix point of the sunday-summary rewrite was to make the push and the in-app view agree.
- **Actual:** `supabase/functions/sunday-summary/index.ts` line 308 fetches tasks with `.gte('due_at', nowIso)` — `nowIso = new Date().toISOString()` at line 99 (current instant). So an open task due at 09:00 today is dropped when the cron fires at 15:00 today.

  The client's `useUpcomingTasks` hook computes `rangeStart = startOfDay(new Date())` (`src/hooks/use-upcoming-tasks.ts` line 25), then calls `getUpcomingTasks(householdId, rangeStart, rangeEnd, { includeUndated: true })`. `getUpcomingTasks` in `src/lib/db.ts` lines 1374-1378 emits a postgrest OR filter `and(due_at.gte.${rangeStart.toISOString()}, due_at.lte.${rangeEnd.toISOString()}), due_at.is.null` — `rangeStart` is 00:00 LOCAL today, which in UTC is some time earlier the prior day for Western tzs or some time later the same day for Eastern tzs. Either way, "due at 09:00 today" is included in the client's filter but excluded by the edge function's "after now" cutoff. Same `mine`-filter rule is applied identically on both sides (assigned to user OR Anyone), so the divergence is purely the lower-bound clause.

  Net: every Sunday morning when the cron fires (~9 AM local for most users — pg_cron schedule in migration 0013), any task due Sun 00:00–~09:00 is "missed" by the push but still highlighted in-app. User opens the app expecting "N tasks to do" and sees N+M. Small but corrodes trust in the push.

  Secondary nit on the same line: the cron also runs once per WEEK (Sunday), so a task due Sun 09:00 that the user completes before the Sunday-evening review still gets counted in the push if the cron fires Sun 06:00. The window slop is symmetric — both ends are off by hours, not days — but the in-app counts use `startOfDay(now)` as the floor.
- **Notes:** Two reasonable fixes: (a) Replace `nowIso` with `new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z').toISOString()` so the lower bound is UTC midnight of today (a rough analog to "start of day in the user's tz" without per-user logic), or (b) compute per-recipient by walking the user's `profile.default_timezone` and a Luxon `startOfDay` in that zone. (a) is closer to what the client computes and a one-line change. Either way also worth filing a tiny follow-up: the client INCLUDES undated tasks in `useUpcomingTasks` but the Home digest's render at `src/app/(app)/index.tsx` lines 374-443 doesn't display them — so adding them to the sunday-summary count without also surfacing them in the digest would create the inverse drift.
- **Related tasks:** none yet
- **Files:** supabase/functions/sunday-summary/index.ts (lines 97-99, 303-309), src/hooks/use-upcoming-tasks.ts (lines 25-32), src/lib/db.ts (lines 1374-1382), src/app/(app)/index.tsx (lines 374-443)

## QA-021 — Welcome card briefly shows prior household's dismissal state on household switch
- **Severity:** bug-minor
- **Area:** Home / WelcomeCard / AsyncStorage race
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** The effect that reads AsyncStorage on `welcomeKey` change now calls `setWelcomeDismissed(null)` first. The render gate `welcomeDismissed === false` already treats null as "don't show yet", so the welcome card is hidden during the brief async window — no flash of the prior household's state. Latent today (no UI to switch household), but the fix is invisible and bulletproof for when multi-household ships. See Task #259.
- **Repro / Trigger:** A user member of two households who switches the active household (or creates a brand-new one) while sitting on the Home tab. Multi-household isn't fully shipped yet — `index.tsx` hardcodes `households?.[0]` (line 97) — so this is latent. Surfaces today only via the corner case "user creates a fresh household after dismissing the welcome on a prior household with the same `households?.[0]` ordering": the per-household AsyncStorage key changes, but the `welcomeDismissed` state doesn't reset.
- **Expected:** When the household id changes, the welcome card's visibility re-evaluates from a clean slate — `welcomeDismissed = null` until the new household's AsyncStorage key resolves, just like the cold-start path.
- **Actual:** `src/app/(app)/index.tsx` lines 104-119:
  ```ts
  const [welcomeDismissed, setWelcomeDismissed] = useState<boolean | null>(null);
  const welcomeKey = household
      ? `onenest:home-welcome-dismissed:${household.id}`
      : null;
  useEffect(() => {
      if (!welcomeKey) return;
      AsyncStorage.getItem(welcomeKey)
          .then((v) => setWelcomeDismissed(v === 'true'))
          .catch(() => setWelcomeDismissed(false));
  }, [welcomeKey]);
  ```
  When `welcomeKey` changes (household switched), the effect fires AsyncStorage.getItem for the NEW key, but `welcomeDismissed` keeps its prior value (e.g. `true` from the previous household's dismissed state) until the new fetch resolves. The render gate at line 236 reads `welcomeDismissed === false` to show — so if the prior household had dismissed (state=true), the brief window between household switch and AsyncStorage resolution will keep the card hidden even for a brand-new household that should show it. Inverse case: prior household visible (state=false), switching to a household that previously dismissed will FLASH the card for the few hundred ms it takes AsyncStorage to read.
- **Notes:** Reset `welcomeDismissed` to null in the same effect, before the AsyncStorage read: `useEffect(() => { setWelcomeDismissed(null); if (!welcomeKey) return; AsyncStorage.getItem(welcomeKey).then(…) }, [welcomeKey])`. That matches the cold-start invariant ("null = unhydrated, hide until we know"). Latent today because multi-household selection isn't user-facing yet, so flagging at minor severity — but worth fixing before that ships, since the misfire is per-household-state-confusion which is exactly the bug class multi-household introduces. Confirmed by re-tracing the effect / render-gate combo; nothing in the surrounding code resets the state between household ids.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (lines 96-120, 236-258)

## QA-022 — Multi-day all-day month pill uses first-day's responsible parent on every day cell
- **Severity:** bug-minor
- **Area:** Calendar Month view / multi-day all-day events
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Both sites that resolve responsible per-cell-day for all-day events now pass the cell's own `day` rather than `new Date(event.starts_at)`. (1) The Week/Day all-day chip row (calendar.tsx ~1080-1090) unconditionally uses `day` as occurrenceDate since this code path only runs for events that already cover the cell. (2) The Month-view pill (~877-893) uses `day` only when `e.all_day` is true; timed events keep `starts_at` because they only appear on their start day in month view. Mon→Wed alternation event now renders Mon's color in Mon's cell, Tue's color in Tue's cell, etc. See Task #260.
- **Repro / Trigger:** Separated-household with a configured custody schedule whose pattern changes parents mid-event window. Create an all-day event spanning at least two days that crosses a custody handoff (e.g. Mon→Wed vacation where Tue is the cycle handoff). Switch to Month view.
- **Expected:** The colored title pill for each day cell reflects the responsible parent on THAT day (consistent with how Day / Week view's all-day chip would — though those don't currently show per-day color either, the user reasonably expects Month to either match Day/Week or to show per-day color since it's the only view rendering one pill per cell).
- **Actual:** `src/app/(app)/calendar.tsx` lines 826-893 — for each visible pill the resolver is called with `occurrenceDate: new Date(e.starts_at)`:
  ```ts
  const responsible = resolveResponsibleProfileId({
      event: e,
      occurrenceDate: new Date(e.starts_at),
      ...
  });
  ```
  But the bucketing logic at lines 301-321 walks `cursor.setUTCDate(cursor.getUTCDate() + 1)` over every UTC calendar day in [start, end), pushing the SAME event object into each day's array. So the pill in Tuesday's cell receives the event with starts_at=Monday and resolves Monday's responsible parent — even though the cell is for Tuesday.

  The same shape applies to alternation events with `responsible_alternation = 'same_day'`: the lookupDate fed into `resolveCustodianOnDate` is Monday, not Tuesday, so the Tuesday cell shows the Monday custodian's color. For users who have configured per-occurrence overrides on the Tuesday date, those overrides ALSO won't apply to the Tuesday cell (resolver looks up `${eventId}|Monday`, not `${eventId}|Tuesday`).

  Day and Week view's all-day chip has the same pattern at lines 1027-1037 (`occurrenceDate = new Date(event.starts_at)`), so the bug is consistent across the all-day path. Single-day all-day events naturally fall out as "right answer" because the start day IS the only day. Single-day timed events are fine too (no day-walking happens).
- **Notes:** Fix is to compute responsible per-day in the bucketing loop, attaching the resolved id either as a synthetic field on the per-cell event object (`{ ...e, _resolvedResponsible: profileId }`) or via a parallel `Map<string, Map<string, string>>` keyed by dayKey then eventId. Then the render at lines 826-893 reads the precomputed value instead of re-resolving with the master event's starts_at. Same fix applies symmetrically to the all-day chip on Day/Week (`allDayEventsForDay` / lines 1027-1037). Bug-minor because separated households with custody handoffs mid-multi-day-vacation are an uncommon shape, but the responsible-parent color is a core part of what the calendar communicates so wrong colors here are misleading. Confirmed by re-tracing the bucketing → render path; no compensation elsewhere.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (lines 292-324, 826-893, 1027-1037)

## QA-023 — colors.background + 'D9' alpha concat assumes 7-char hex, brittle to future palette changes
- **Severity:** bug-minor
- **Area:** ScrollOverflowChevron / theme color handling
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** New `withAlpha(color, alpha)` helper in `src/lib/platform-styles.ts` normalizes #RGB / #RRGGBB / #RRGGBBAA / rgb() / rgba() inputs into a well-formed `rgba(r, g, b, a)`. Replaced the three brittle concat sites: ScrollOverflowChevron background (`colors.background + 'D9'`), calendar.tsx other-member busy-block bg + border (`${memberColor}26` / `${memberColor}99`), and the Home custody pill bg (`${custodianColor}22`). Also caught the new WelcomeCard chip background (`#6F7FA522`) I'd added in the UX-026 fix. Future palette changes that introduce non-7-char hex won't silently break these surfaces; the helper warns and falls back to the original color string instead. See Task #261.
- **Repro / Trigger:** No active repro today — `src/constants/theme.ts` lines 21-34 declare `background` as 7-char `#RRGGBB` in both light (`#F4EFE2`) and dark (`#1F232E`). The bug latent-fires the moment any future palette tweak adds a CSS3 shorthand (`#F4E`) or an explicit alpha (`#F4EFE2CC`).
- **Expected:** Constructing a 60%/85%-opacity variant of the theme background should be expressible in a way that doesn't silently break when the input format shifts.
- **Actual:** `src/components/scroll-overflow-indicator.tsx` line 128 does `backgroundColor: colors.background + 'D9'`. The result is parsed by React Native / RN-web as `#RRGGBBAA`. For the current palette it's valid (`#F4EFE2D9`). But:
  - If a future palette uses shorthand `#FFF`, the concat becomes `#FFFD9` — 5 hex chars, which CSS3 + RN-Web treat as malformed and either ignore (transparent background) or interpret unpredictably.
  - If a future palette pre-bakes an alpha `#F4EFE2CC`, the concat becomes `#F4EFE2CCD9` — 10 hex chars, invalid, parsed as transparent.
  - Same pattern recurs in `src/app/(app)/calendar.tsx` line 1291-1292: `${memberColor}26` / `${memberColor}99` for member busy block backgrounds. `memberColor` comes from `colorForResponsible` → `memberColorMap` (`src/lib/colors.ts`), which returns palette entries. If the palette ever switches to `rgb()` or shorthand `#RGB`, those concats break the same way.
  - And `src/app/(app)/lists.tsx` line 1280: `'rgba(111, 127, 165, 0.15)'` is a literal so safe — flagged just to contrast.

  Inline `chipScrollWrapper`-style alpha appending is a known footgun; the more durable shape is a tiny helper `withAlpha(hex, alpha: 0-1): string` that branches on hex length and falls back to `rgba(...)` for non-7-char inputs.
- **Notes:** Easy fix: add a `withAlpha` helper to `src/lib/colors.ts` and replace the three concat sites. Bug-minor with low immediate impact (the palette is unlikely to change in a way that bites this), but it's an example of theme-tinted code that doesn't actually use the theme system — calling it out so any future palette refactor knows to grep for `+ '` near hex usage. Confirmed by reading the palette + the three usage sites; nothing today is broken.
- **Related tasks:** none yet
- **Files:** src/components/scroll-overflow-indicator.tsx (line 128), src/app/(app)/calendar.tsx (lines 1291-1292), src/constants/theme.ts (lines 20-35), src/lib/colors.ts

