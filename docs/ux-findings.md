# UX Findings

Static UX review findings from the UX agent. Each entry is a stable-ID record of a
potential improvement to usability, interaction consistency, or visual UX. The agent
reads code only — it can't click around, so findings are limited to what's
inspectable from components, styles, and screen layouts.

## How to use this file

- **New findings** land at status `new` and need triage.
- **Triage**: each `new` becomes `accepted` (worth fixing), `wont-fix` (closed with
  reason), or `duplicate` (links to another ID).
- **Accepted** findings get a TaskCreate entry; the Task ID goes into `Related tasks`
  and the finding moves to `in-progress` while that task is active.
- **After code lands** the finding moves to `fixed`; the agent verifies on its next
  scan and marks `verified`.

## Status legend

| Status | Meaning |
|---|---|
| `new` | Just found, awaiting triage |
| `accepted` | Agreed worth fixing; may not have a task yet |
| `in-progress` | Active Task exists |
| `fixed` | Code landed, awaiting re-verification |
| `verified` | Agent confirmed fix in a later scan |
| `wont-fix` | Closed without action (with reason) |
| `duplicate` | Points to another finding ID |

## Severity buckets

| Severity | Examples |
|---|---|
| `ux-high` | Confusing or inefficient core flow; user can't accomplish primary task |
| `ux-medium` | Inconsistent interaction paradigm across screens; missing affordance |
| `ux-low` | Polish, nit, copy improvement, micro-alignment |

## Counts (auto-updated by agent)

- new: 0
- accepted: 0
- in-progress: 0
- fixed: 32
- verified: 0
- wont-fix: 3

---

## Finding template

```markdown
## UX-NNN — Short title (max ~60 chars)
- **Severity:** ux-{high|medium|low}
- **Area:** (e.g. Lists tab, Calendar, Event form)
- **Status:** new
- **Found:** YYYY-MM-DD (agent run #N)
- **Description:** What's wrong / suboptimal.
- **Recommendation:** Concrete proposal.
- **Related tasks:** #NNN (or "none yet")
- **Files:** path/to/relevant.tsx (and others)
```

---

<!-- Findings appended below this line. Keep them in numeric ID order. -->

## UX-001 — Native bulk-delete skips confirmation
- **Severity:** ux-high
- **Area:** Lists tab (bulk-select mode)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** handleBulkDelete now uses a Promise-wrapped Alert.alert on native (with destructive button style) + window.confirm on web. Mirrors the pattern in list-form's delete confirmation. See Task #233.
- **Description:** On web, the bulk-delete handler shows `window.confirm("Delete N tasks? This can't be undone.")` before deleting. On native, the same handler hard-codes `confirmed = true` with the comment "Native confirm UX deferred — Alert wouldn't gracefully await here." That means a single tap on the bulk Delete button on iOS/Android wipes every selected task with zero confirmation and no undo. Bulk-deleting tasks one accidentally selected is a realistic flow (the select button is right next to the scope toggle), and the delete is irreversible.
- **Recommendation:** Use the same Promise-wrapped `Alert.alert` pattern that `task/[id].tsx`, `event-form.tsx`, and `child-form.tsx` already use to await a native confirmation. Or as an interim measure, surface an in-app inline confirm row inside the bulk bar (e.g. "Delete N tasks? [Cancel] [Delete]") so the parity is preserved without depending on platform dialogs.
- **Related tasks:** #233
- **Files:** src/app/(app)/lists.tsx (handleBulkDelete, ~lines 463-484)

## UX-002 — Accessibility labels missing app-wide
- **Severity:** ux-high
- **Area:** Cross-cutting (every screen)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Highest-impact icon-only Pressables now carry accessibilityLabel + role (and accessibilityState where they toggle). Coverage: Calendar prev/next arrows (interpolated with viewMode), month-grid day cells, native day-column wrappers, Calendar FAB. Home TaskRow checkbox toggle. Lists chip pencil-edit, TaskListRow bulk-select checkbox, complete-toggle checkbox, row delete. event-task-section inline task checkbox + remove. Pressables wrapping ThemedText with readable copy (chip labels, Cancel/Save, etc.) were intentionally skipped — RN screen readers announce child text automatically, so adding redundant labels would just duplicate the announcement. See Task #254.
- **Description:** A grep across `src/` for `accessibilityLabel|accessibilityRole|accessibilityHint` returns exactly one hit (`child-badge.tsx`). Every Pressable in the FABs, chip strips, scope toggles, view-mode toggles, custody pills, drag-handles, +/− buttons, "+ lists" toggles, ChevronRight rows, and bulk-bar buttons is unlabeled. The plus FABs in Home and Calendar are particularly bad — a screen reader announces "button" with no clue what they do. The note indicator (📝), conflict (⚠), unassigned (📌), recurrence (↻), and overflow ("+N") are all icon-only and unannounced.
- **Recommendation:** Add `accessibilityLabel` to every Pressable that renders icon-only or emoji-only content (FABs, ✕ delete buttons, ‹/› calendar arrows, the pencil edit chip, custody pills, note/conflict/unassigned indicators in Home summary, the "↻ Alternates" chips). Long term, run through every Pressable and add either a label or rely on its child text being announced.
- **Related tasks:** #254
- **Files:** src/app/(app)/index.tsx, src/app/(app)/calendar.tsx, src/app/(app)/lists.tsx, src/app/(app)/settings.tsx, src/components/event-form.tsx, src/components/event-task-section.tsx (and more)

## UX-003 — Cross-list meta pills delete on tap with no affordance
- **Severity:** ux-high
- **Area:** Lists tab (task rows)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Cross-list pills now show a trailing × glyph (slightly bolder, opacity-dimmed) and carry accessibilityLabel="Remove from {list}". The destructive intent is now signaled before the tap. See Task #234.
- **Description:** In `TaskListRow`, each task displays meta chips for the OTHER lists it belongs to (rendered identically to the active-list chip strip above — same shape, same color). A code comment notes "Tappable as a shortcut to remove the task from that list" — tapping the pill calls `handleToggleTaskList(t, listId)` which mutates the membership. The pill has no ✕, no different hover/press treatment, and no label change. Users will tap it expecting either nothing, navigation to that list, or a popover — not silent removal from a list. This is a destructive action with the same affordance as the read-only display chip ("Event", due-date, assignee dots) sitting next to it.
- **Recommendation:** Either (a) add a small ✕ to the cross-list pill so the destructive intent is visible, (b) make the tap open a small inline confirm ("Remove from Groceries?"), or (c) route the tap to navigate to that list (the read-as-link interpretation) and keep removal inside the explicit "+ lists" picker that already exists on the same row.
- **Related tasks:** #234
- **Files:** src/app/(app)/lists.tsx (TaskListRow meta-list pills, ~lines 1283-1316)

## UX-004 — Lists tab has no FAB, breaks "+ new" mental model
- **Severity:** ux-medium
- **Area:** Lists tab vs Home / Calendar
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Added a primary FAB (56×56, slate-blue, `+` glyph) at bottom-right of the Lists tab matching Home/Calendar. Routes to `/list/new`. Hidden while bulk-selection mode is active so it doesn't compete with the bulk-action bar for the bottom-right anchor. The dashed "+ New list" chip at the end of the strip remains as a secondary path. See Task #249.
- **Description:** Home and Calendar both render a floating + button (bottom-right, 56×56, slate-blue) that creates a new event. The Lists tab has no equivalent — task creation lives in an inline quick-add row near the top of the screen, and list creation is a "+ New list" chip at the end of the chip strip. The Lists tab is the only one of the four primary tabs without a FAB, breaking the visual paradigm. Users who learn the FAB on Home/Calendar will reach for it on Lists and find nothing.
- **Recommendation:** Either add a FAB to Lists that focuses the quick-add input (so the affordance is consistent), or remove the FAB from Home/Calendar in favor of the inline-add pattern. The former is lower-friction. Note the quick-add input scrolls out of view easily on small phones once a few tasks exist — a FAB-as-scroll-to-quick-add would also fix that.
- **Related tasks:** #249
- **Files:** src/app/(app)/index.tsx (~lines 390-394), src/app/(app)/calendar.tsx (~lines 1203-1207), src/app/(app)/lists.tsx

## UX-005 — Drag-to-create works only on web; native has degraded calendar entry
- **Severity:** ux-medium
- **Area:** Calendar (Day/Week views)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Each day column is now a Pressable on native (View on web, so the existing drag-to-create's pointerdown listener still owns the gesture). `handleDayColumnTapNative` snaps the touch's `locationY` to a 15-min boundary via the existing `snapMinutes`/`yToMinutes` helpers and routes to `/event/new` with `date`, `startTime`, and `endTime` (start + 15 min). Event blocks + busy blocks remain their own Pressables so they consume the tap before this fallback fires. Empty-state Day banner now reads "Tap a time slot to add an event, or tap [+ new event]" on native — honest about what the grid tap does. Long-press deferred (reserved for native drag-to-create when we move to EAS). See Task #251.
- **Description:** The Calendar's empty Day view banner reads `'Drag on the grid to add an event, or'` on web and `'Tap'` on native — but on native, tapping the grid doesn't actually do anything; the user has to find the FAB. So native users see a banner that effectively says "Tap [+ new event]" with no indication that the grid itself is inert. Worse, the comment in code says native click-and-drag was "deferred until we're on an EAS build" but no minimum native affordance was put in its place — e.g. tap-on-a-time-slot to start a 15-min event. The crosshair cursor + drag UX is the main "create an event at this time" gesture on web, and native users have no analog.
- **Recommendation:** At minimum, attach an onPress to each day column on native that pushes `/event/new` with the slot's date and a snapped startTime. Long-press could be reserved for the eventual native drag-to-create. Update the banner copy to remove the misleading "Tap" affordance hint until something actually responds to a grid tap.
- **Related tasks:** #251
- **Files:** src/app/(app)/calendar.tsx (~lines 885-904, drag-to-create effect ~340-399)

## UX-006 — Custody pill icon flips meaning between Home and Calendar
- **Severity:** ux-medium
- **Area:** Home vs Calendar (custody indicator)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Both surfaces now use Feather `user` for the default custody state and `↻` for overrides. Replaced Home's "with" text and Calendar's 👶 emoji. See Task #240.
- **Description:** Home's DaySection renders a custody pill with either the word "with" (default) or the symbol "↻" (override), followed by the custodian's name. Calendar's custody band cell shows the symbol "👶" (default) or "↻" (override) followed by the first name only. Same data, two different glyph systems — and neither uses an icon library; one is plain text ("with"), one is an emoji ("👶"). A user moving between Home and Calendar will see the same parent represented two different ways for the same day.
- **Recommendation:** Pick one glyph for "default custody" — preferably an icon from `@expo/vector-icons` (Feather already in use) like `user` or `users`, with `accessibilityLabel="with parent"`. Use the same "↻" override symbol on both surfaces (already consistent). Render the full display name on Calendar too if width permits, or the first name on Home if not — but keep label parity.
- **Related tasks:** #240
- **Files:** src/app/(app)/index.tsx (~lines 448-462), src/app/(app)/calendar.tsx (~lines 763-803)

## UX-007 — Inconsistent "Assigned to: Anyone" label vs "Unassigned" indicator
- **Severity:** ux-medium
- **Area:** Lists tab, Home, Event form, Sunday summary
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Home summary card now reads "N events for Anyone" (was "unassigned events"). Sunday-summary edge function still emits "unassigned" in the push body — out of scope for the copy pass; deferred until QA-002 reworks that function. See Task #241.
- **Description:** A task or event with no specific responsible parent is called four different things across surfaces:
  - Home day-list TaskRow: `assigneeLabel === 'Anyone'`
  - Lists tab cross-list pills: no special label (just the assignee dot omitted)
  - Home weekly-summary unassigned events: `'📌 N unassigned event(s)'` + "No one assigned yet — tap to claim it"
  - Event form / Task editor: chip labeled "Anyone" (with UNASSIGNED_COLOR)
  - Calendar all-day chips and time blocks: use UNASSIGNED_COLOR but no text label
  The summary card uses the word "unassigned" while the rest of the app uses "Anyone". The user has to mentally map "📌 unassigned" → "an Anyone task" — they don't read as the same concept at a glance.
- **Recommendation:** Normalize on a single term. "Anyone" reads as more inviting and matches the existing chip text; "Unassigned" reads as a negative state. Pick one and update the summary copy (`'📌 N events with no one assigned yet'` or similar) and the row helper text.
- **Related tasks:** #241
- **Files:** src/app/(app)/index.tsx (~lines 229-266, 576-582), src/components/event-form.tsx (~lines 573-599), src/app/task/[id].tsx (~lines 491-511)

## UX-008 — "Tap to claim it" copy implies an action that doesn't exist
- **Severity:** ux-medium
- **Area:** Home (Next-7-days summary card)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Copy changed from "No one assigned yet — tap to claim it" to "For Anyone — tap to open and assign". Honest about what happens (opens the form) and consistent with the broader "Anyone" terminology. The true one-tap claim button is still a worthwhile follow-up but stays as an unscoped backlog item. See Task #242.
- **Description:** Unassigned events in the weekly summary card show the helper text `'No one assigned yet — tap to claim it'`. Tapping the row routes to `/event/[id]` (the full event editor), not a one-tap "claim" action — the user lands inside the event form with the Anyone chip still selected and has to manually pick their own parent chip, then Save. The copy promises a fast claim flow that doesn't exist; the actual flow is "tap → form opens → pick chip → tap Save → wait for round-trip → bounce back to Home".
- **Recommendation:** Either implement a true claim shortcut (a small "Claim" button on each summary row that does an inline `updateEvent({ responsibleProfileId: user.id })` then refetches), or change the copy to something honest like "Tap to open" or "No one assigned yet — open to set one".
- **Related tasks:** #242
- **Files:** src/app/(app)/index.tsx (~lines 237-266)

## UX-009 — Empty/loading state inconsistency: Lists hides screen, Home shows day labels
- **Severity:** ux-medium
- **Area:** Cross-screen loading patterns
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Lists tab now only returns full-screen LoadingScreen while `listsLoading` (we can't draw the chip strip without lists). Once lists arrive, the header + view-mode toggle + chip strip + quick-add render normally; the task pane shows an inline ActivityIndicator inside its ScrollView while `tasksLoading`. Refetch-to-refresh no longer makes the entire screen vanish. Home and Calendar already followed this pattern, so the three primary tabs now have matching loading personalities. Modal edit screens keep their early-return LoadingScreen — they have no persistent chrome to preserve. See Task #250.
- **Description:** Three different "still loading" patterns ship today:
  - **Lists** returns `<LoadingScreen />` early (~line 519) — full-screen spinner, even the chip strip & quick-add disappear.
  - **Home** renders the entire layout and shows `<LoadingScreen />` *inside* the scroll area (line 164) when events are loading — but still shows the "Home" header.
  - **Calendar** shows the whole header, toggle, custody band, and day-header row, and only swaps in `<LoadingScreen />` inside the grid scroll (line 906).
  - Event/task/list edit screens all return `<LoadingScreen />` early, hiding the whole UI.
  Result: refresh-to-refetch on Lists feels jarring (UI vanishes); on Home it feels OK but the task sections silently appear once loaded; on Calendar the chrome stays but the grid is blank for a beat. A user moving between tabs sees three different loading personalities.
- **Recommendation:** Pick one rule per "context":
  - For tabs with a persistent header (Home, Calendar, Lists), keep chrome visible and only swap the content area for a skeleton or spinner.
  - For modal edit screens, full-screen LoadingScreen is fine.
  Lists in particular should keep its chip strip and quick-add visible while tasks are loading, since they're still usable.
- **Related tasks:** #250
- **Files:** src/app/(app)/lists.tsx (~line 519), src/app/(app)/index.tsx (~line 164), src/app/(app)/calendar.tsx (~line 906)

## UX-010 — Drag-to-reorder list chips invisible on native; chip-strip overflow has no hint
- **Severity:** ux-medium
- **Area:** Lists tab (chip strip)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Two parts. (1) Native chip reorder: list-form.tsx now renders Move up / Move down buttons (with a11y labels). list/[id] computes position + canMove flags from the lists array and exposes swap callbacks; each swap updates two rows' sort_order then refetches. Works on web too as a keyboard-accessible alternative to drag. (2) Overflow indicator: new `src/components/scroll-overflow-indicator.tsx` exports `useHorizontalOverflow()` + `<ScrollOverflowChevron />`. Wired into the Lists chip strip, Calendar child filter, and event-form locations strip — when content overflows the viewport, a small right-edge chevron appears; hidden once scrolled to the end. See Tasks #252, #253.
- **Description:** Two related affordance gaps in the Lists chip strip:
  1. The drag-to-reorder is implemented `Platform.OS === 'web'` only; the `cursor: 'grab'` hint only renders on web. Native users have no way to reorder their lists — and no UI clue that reordering is even possible.
  2. The chip strip is a horizontal ScrollView (`showsHorizontalScrollIndicator={false}`). With more than ~5 lists, later chips scroll offscreen with zero visual hint that more exist (no fade gradient, no arrow, no scrollbar). The same applies to the Calendar's child filter strip and the event form's location chip strip.
- **Recommendation:**
  1. Add a long-press alternative for native reorder (use `react-native-draggable-flatlist` or roll the same pointerdown logic via a PanResponder), OR move reorder to inside `/list/[id]` as a "Move up / Move down" affordance so native users have a path at all.
  2. Add a subtle right-edge fade gradient or a small chevron on horizontal scroll containers when content overflows, so users know to scroll.
- **Related tasks:** #252, #253
- **Files:** src/app/(app)/lists.tsx (~lines 197-280, 564-753), src/app/(app)/calendar.tsx (~lines 505-568), src/components/event-form.tsx (~lines 908-966), src/components/scroll-overflow-indicator.tsx (new), src/components/list-form.tsx, src/app/list/[id].tsx

## UX-011 — "Anyone" chip in event-task-section uses muted text styling, looks disabled
- **Severity:** ux-low
- **Area:** Event form > inline task rows; Standalone task editor
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** Anyone chip in event-task-section, task/[id], and task/new now uses colors.text in the unselected state (was textSecondary). Selection signal stays on the border + fill. See Task #243.
- **Description:** In `event-task-section.tsx` (assignee row) and `task/[id].tsx` (assigned-to row), the "Anyone" chip when NOT active renders text with `color: colors.textSecondary` while the parent chips next to it use `color: colors.text` (full contrast). The visual reading is "Anyone is the dimmed/unavailable option" — but functionally it's the select-all toggle and equally valid. The other Anyone chips in the event-form "Responsible parent" row and the lists.tsx "+ lists" picker DO use full-contrast text. Same chip role, different prominence across surfaces.
- **Recommendation:** Use `colors.text` for the Anyone chip text in the unselected state — let the chip border + dot communicate its identity, not a contrast difference. Reserve `textSecondary` for actually disabled controls.
- **Related tasks:** #243
- **Files:** src/components/event-task-section.tsx (~lines 343-355), src/app/task/[id].tsx (~lines 503-510), src/app/task/new.tsx

## UX-012 — "Ends on (optional)" date can be set before the event's start date, silently invalid
- **Severity:** ux-low
- **Area:** Event form (recurrence)
- **Status:** fixed
- **Found:** 2026-05-24 (agent run #1)
- **Fix:** event-form.tsx handleSubmit now validates `untilForRule >= date` and throws "Recurrence end date must be on or after the event's start date." via the existing error pattern (mirrors the "End time must be after the start time" guard). See Task #244.
- **Description:** The "Ends on (optional)" date field on a recurring event has no min/max validation. A user can pick an end date that's earlier than the event's own start date, which produces an RRULE with `UNTIL=<before DTSTART>` — the series will yield zero occurrences. The form happily saves it. There's also no inline preview ("Repeats X times" or "Last occurrence: …") to catch the mistake before save. Compared to the comparable "End time must be after the start time" guard inside `handleSubmit` for non-recurring events, this is an inconsistency in input-validation coverage.
- **Recommendation:** Either (a) constrain the Ends-on DateField's min to the event's own `date`, OR (b) re-use the form's existing throw-and-display pattern: validate in handleSubmit that `recurrenceEndDate >= date` and surface "End date must be on or after the event's start date." The latter is lower-friction and matches the existing "End time must be after the start time" precedent.
- **Related tasks:** #244
- **Files:** src/components/event-form.tsx (~lines 327-369, 863-901)

## UX-013 — Move up/down on /list/[id] flashes a full-screen LoadingScreen and wipes unsaved form state
- **Severity:** ux-high
- **Area:** Lists tab → /list/[id] (edit list)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** list/[id] now uses a `hasHydratedRef` flag set once the first lists/tasks load resolves with a found list. Subsequent refetches (triggered by Move up/down's `refetchLists()`) flip `listsLoading` back to true but the gate short-circuits because `hasHydratedRef.current` is already set — the ListForm stays mounted, preserves unsaved name/color edits, and the user just sees the buttons momentarily disabled via the existing `setMoving` state. Centered LoadingScreen now only shows on the true initial hydration.
- **Description:** The new Move up / Move down affordance calls `swapWithNeighbor`, which writes two rows then awaits `refetchLists()` (use-lists.ts sets `isLoading: true` for the duration). `/list/[id]` early-returns `<LoadingScreen />` while `listsLoading || tasksLoading` (lines 48-50), so the entire ListForm unmounts and remounts on every move. Three concrete problems for the user: (1) the screen visibly flashes to a centered spinner and back, far more dramatic than a quiet button-disabled state; (2) the ListForm's local `name` and `color` state is reset to `initialValues` on remount — any unsaved rename / palette pick the user made before reaching for Move up is silently lost; (3) the ScrollView scrolls to top on remount, so a user repeatedly pressing Move up to walk a list from the bottom to the top loses their place after each press. The task brief specifically flagged "the lists data refetches between presses, so does the form correctly re-disable Move up at the new top edge?" — re-disabling works fine on paper because `canMoveUp = !list.is_default && currentIdx > 1` is recomputed after the refetch, but the user never sees the recomputed buttons; they see a LoadingScreen flash and then the form re-renders from scratch.
- **Recommendation:** Don't gate the whole screen on `listsLoading` after the initial mount. Either (a) track a separate `initialLoad` flag and only short-circuit on first hydration, then keep the form mounted and let `swapWithNeighbor`'s busy state drive the in-form disabled treatment that's already wired through `setMoving`; or (b) optimistic-update the lists order in a parent ref so `swapWithNeighbor` doesn't need to await a refetch at all. Option (a) is the smaller change. Bonus: this same pattern fixes the unsaved-name-lost issue.
- **Related tasks:** none yet
- **Files:** src/app/list/[id].tsx (~lines 48-50, 88-101), src/components/list-form.tsx (~lines 104-121), src/hooks/use-lists.ts (~lines 18-35)

## UX-014 — Home FAB quick-create menu has hardcoded white background, broken in dark theme
- **Severity:** ux-medium
- **Area:** Home (FAB chooser)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Chooser pills now derive backgroundColor + text color from the active theme (`colors.backgroundElement` + `colors.text`). Static styles strip the hardcoded `#fff` / `#2A2E3A` literals. On dark theme the pills now look like the rest of the elevated UI surfaces instead of bright white intruders.
- **Description:** `fabMenuItem` in src/app/(app)/index.tsx is styled with `backgroundColor: '#fff'` and `fabMenuItemText` with `color: '#2A2E3A'` (deep slate). These are fixed regardless of `useAppColorScheme()`. On dark theme the rest of the app uses `#1F232E` page background and cream `#EBE5D5` text — when the user taps the FAB on dark theme, two bright-white pill buttons pop above it with dark text, looking like leftover light-mode UI and breaking the visual cohesion the rest of the app maintains. Compare to the bulk-action bar in Lists which explicitly reads `backgroundColor: colors.background` (lines 1063-1067).
- **Recommendation:** Use `colors.backgroundElement` (raised slate in dark, pale sage in light) for the pill background and `colors.text` for the label. Drop the hardcoded literals. Same fix pattern applies to the bg of the chooser items in `index.tsx:823-833`.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 422-456 markup, 813-833 styles)

## UX-015 — ScrollOverflowChevron's white overlay clashes on dark theme and dims rightmost chip on light
- **Severity:** ux-medium
- **Area:** Cross-cutting (Lists chip strip, Calendar child filter, event-form locations)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Chevron now reads the active theme via `useAppColorScheme()` and uses `colors.background + 'D9'` (~85% alpha) as its background. Cream surface on light, deep slate on dark — blends with the page rather than masking the chip beneath. Chevron icon color flipped to `colors.textSecondary` so it stays legible on both themes.
- **Description:** The new ScrollOverflowChevron renders with `backgroundColor: 'rgba(255, 255, 255, 0.7)'` (scroll-overflow-indicator.tsx ~line 129). Two issues: (1) on dark theme the page background is `#1F232E`, so a 70% white box pops as a milky-light square at the right edge of the chip strip — much louder than the subtle hint the component aims to be. (2) On light theme the chip strip already sits against `#F4EFE2` cream; the rightmost ~20px of the last visible chip is covered by the overlay, dimming a pastel-colored list / child chip to a desaturated wash. Combined with the fact that the indicator's container is 20px wide while the chevron icon is only 18px — the entire 20px column is fogged, not just the icon area. A user looking at a Groceries list chip at the screen edge would think the chip is half-disabled.
- **Recommendation:** Either (a) drop the solid background and rely on a soft fade gradient (e.g. `LinearGradient` from transparent to `colors.background`) so the indicator blends with the page rather than masking the chip; or (b) replace the fixed white with `colors.background` so the overlay matches the surface behind the strip (light cream in light mode, deep slate in dark) and the chevron itself flips color to remain legible (`colors.text`/`textSecondary`). Option (a) is the prettier fix; option (b) is a one-line swap that buys most of the win.
- **Related tasks:** none yet
- **Files:** src/components/scroll-overflow-indicator.tsx (~lines 93-117, 119-133)

## UX-016 — Recurrence end-date inline error lingers after the user fixes the field
- **Severity:** ux-medium
- **Area:** Event form (recurrence)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Added a `useEffect` that clears `error` whenever any of the validated inputs change (`date`, `endTime`, `recurrenceEndDate`). The validation re-fires on the next Save, so clearing optimistically is safe. Covers both the new UX-012 recurrence-end-date error and the older "End time must be after the start time" guard.
- **Description:** UX-012's fix correctly throws "Recurrence end date must be on or after the event's start date." on Save when the UNTIL is before the start. On web the error is set via `setError(msg)` and rendered inline near the bottom of the form (event-form.tsx ~lines 1205-1209). Problem: `setError(null)` only runs at the top of `handleSubmit` (line 375). If the user reads the error, edits the recurrence end date to a valid value, then either changes their mind ("OK never mind, I'll cancel") or scrolls to keep editing other fields, the red error message stays pinned in the form even though the underlying condition is resolved. There's no on-change reset for any field. The same issue applies to the older "End time must be after the start time" guard. Native users dodge this because the error path uses `Alert.alert` instead of `setError`.
- **Recommendation:** Clear the error whenever any of the validated inputs changes — at minimum, on `setDate`, `setEndTime`, and `setRecurrenceEndDate`. Simplest implementation: wrap each setter in a thin local wrapper that calls `setError(null)` first. Or attach a `useEffect` that clears `error` whenever `date / endTime / recurrenceEndDate` changes. The validation re-fires on the next Save, so clearing optimistically is safe.
- **Related tasks:** none yet
- **Files:** src/components/event-form.tsx (~lines 372-462 handleSubmit, 858-872 endDate field, 953-984 recurrenceEndDate field)

## UX-017 — Native tap-to-create has no guardrail; a stray tap on the day grid creates an event
- **Severity:** ux-medium
- **Area:** Calendar (Day / Week view, native only)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Swapped `onPress` for `onLongPress` (with `delayLongPress: 500`) on the native day-column Pressable. Stray finger touches while scrolling and brushes near event blocks now do nothing; the user has to intentionally press-and-hold the empty grid to create. Empty-state banner copy updated on native to "Press and hold a time slot to add an event, or tap + new event" so the gesture is discoverable. Accessibility label adjusted to "Press and hold to add an event on {date}".
- **Description:** UX-005's fix wraps each native day column in a `Pressable` whose `onPress` immediately routes to `/event/new` with a snapped 15-min slot (calendar.tsx ~lines 501-515, 1097-1117). No confirmation, no long-press requirement, no scroll-cancels-tap heuristic — a single tap anywhere on the empty grid pushes a new screen. Concrete failure modes: (1) scrolling the grid vertically with a finger that started its press on empty space → on release, the Pressable fires and the user lands in /event/new instead of just having scrolled; (2) tapping near (but not on) a 14-px-min-height busy block to "look at it" → tap lands in the column, not the block, and creates an event for "9:00 AM" the user never wanted; (3) the day column is the entire 24-hour height, so any tap on the screen below the all-day row is a create-tap. The web flow uses pointer drag with a synthesized 15-min single-click that the same handler debounces — but native gets the same nav with zero gesture qualifier. The task brief specifically asked "could the user mis-tap and accidentally create empty events frequently?" — yes, easily.
- **Recommendation:** Either (a) require long-press to fire `handleDayColumnTapNative` (matches the comment's intent to reserve long-press for native drag, but a quick long-press is still a confirmable affordance vs. a bare tap); (b) keep tap-to-create but add a small "Tap a time to add" pulsing hint in the empty Day view banner only — and skip the gesture entirely in Week view where columns are narrow and mis-taps are more likely; or (c) add a slight delay + visual "ghost" highlight on press, so the user sees what they're about to create and can lift their finger to cancel. Worth pairing with a "you accidentally created Event at 9:00 AM — undo" toast on the form's mount when the create-time is suspiciously round and the title is empty, but that's a stretch.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 501-515 handler, 1087-1133 Wrapper choice)

## UX-018 — FAB behavior diverges across tabs: Home toggles a menu, Calendar/Lists fire directly
- **Severity:** ux-medium
- **Area:** Cross-cutting (FAB pattern)
- **Status:** wont-fix
- **Found:** 2026-05-23 (agent run #2)
- **Resolution:** Closed without code change after weighing the recommended options. Home is the multi-context entry — it surfaces both events and tasks alongside a calendar summary, so a chooser between "+ New event" and "+ New task" reflects the screen's actual breadth. Calendar's primary noun is the event; Lists' primary noun is the list. Direct-fire on those tabs matches how a user describes the intent ("I want to add an event" → tap calendar FAB, not "pick what kind of thing"). Extending the chooser to every tab (option a) would require choices that don't exist in those contexts (Calendar's task-from-here? Lists' event-for-this-list?). Dropping Home's chooser (option b) removes the only path to make a task without first opening a list. The accessibility labels already differentiate ("Open quick-create menu" vs "New event" vs "Create new list"), so screen-reader users get distinct affordances. Filing as wont-fix; revisit if real users hit the dissonance.
- **Description:** All three primary tabs now render a visually identical 56×56 slate-blue FAB at bottom-right (UX-004's fix added the Lists one). But the press behavior differs:
  - Home: opens a quick-create chooser (toggle to ×, two pill buttons appear above) — accessibilityLabel "Open quick-create menu"
  - Calendar: navigates immediately to `/event/new` — label "New event"
  - Lists: navigates immediately to `/list/new` — label "Create new list"
  
  A user who learns "FAB on Home opens a menu" will tap the Calendar FAB expecting the same menu and instead jump into a full-screen form. Conversely, a user who learns "FAB jumps me into a form" will tap the Home FAB and be confused by the chooser. The Home FAB's `+` even toggles to `×` to signal openness, which neither other FAB does — so the visual signal that "the FAB has an open state" lives only on Home. Compounding factor: the +/× swap means the Home FAB doubles as a "close" button while open, which is a third distinct interaction the others don't have.
- **Recommendation:** Pick one model. Two reasonable paths: (a) extend the chooser to every tab — Calendar's FAB could surface "New event / New task / New custody override"; Lists' could surface "New list / New task". (b) Drop the Home chooser entirely and split it into a direct-fire `+ New event` FAB (matching Calendar/Lists), and surface task creation via the existing inline path (Lists' quick-add). Option (b) trims an interaction mode but breaks the "I can make a task from Home" hook. Option (a) is more work but pays off the consistency. Even an interim "Home FAB long-press → chooser, tap → New event" would match the Calendar/Lists mental model for tap.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 422-466 FAB + menu), src/app/(app)/calendar.tsx (~lines 1372-1378), src/app/(app)/lists.tsx (~lines 1180-1188)

## UX-019 — First-run experience for a brand-new household is silent and unwelcoming
- **Severity:** ux-medium
- **Area:** Onboarding (Home, Calendar, Lists after household creation)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Added a `WelcomeCard` component to Home that renders on first-run (events.length === 0 AND no tasks in any bucket) until dismissed. Headline reads "Welcome to {household name}" with up to four conditional action chips: "+ Invite partner" (when members.length <= 1, routes to Settings), "+ Add a child" (when no children, routes to /child/new), "+ Set up custody" (when household_type === 'separated' && no schedule, routes to Settings), and "+ New event" (always). Dismissal persists per-household via AsyncStorage under `onenest:home-welcome-dismissed:{id}`. Calendar empty banner was already extended to Week + Month in UX-022, so that side of the finding is covered too. Lists tab was already adequate per the finding.
- **Description:** After a user finishes `/create-household`, they land on Home with nothing yet — no events, no tasks, no custody schedule, no partner. What they see:
  - Home: the title "Home", the household name, then `✓ All clear for the next 7 days` (a *success* message even though the user hasn't actually done anything yet), and two `DaySection` cards each saying "Nothing scheduled." No call to action, no "Invite your partner" prompt, no "Add a child" prompt, no "Get started by adding your first event" pointer.
  - Calendar: Week view (default) with an empty grid and no banner. The day-view banner ("Nothing scheduled. Tap a time slot…") is gated to `viewMode === 'day' && visibleEvents.length === 0` (calendar.tsx ~lines 1035-1054), so a fresh user on the default Week view sees zero guidance.
  - Lists: chip strip with just "Inbox" + the dashed "+ New list" chip, scope toggle, and "No tasks yet. Type one above to get started." This one is OK.
  
  Compared with the polish elsewhere (welcoming `/create-household` headline, the day-view banner copy), the post-create surfaces feel like dead UI for first-run users. The most important missing prompts are "invite your partner" (Settings → Invite) and "set up custody schedule" for separated-household types — without these the rest of the app's color/responsibility metaphor is invisible.
- **Recommendation:** Add a first-run-detection helper (e.g. `events.length === 0 && tasks.length === 0 && !invitations.length`) and render a single welcome card on Home for the first session:
  - Headline: "Welcome to [household name]"
  - Up to 4 quick-action chips: Invite partner (if 1 member), Add a child (if 0 children), Set up custody (if type=separated && !custodySchedule), Add your first event
  - Dismissable; sticks via AsyncStorage so it doesn't return on every reload
  
  Also extend the Calendar empty banner to Week and Month views, gated by `visibleEvents.length === 0`, with the same Tap-grid / + new event copy.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 196-310 summary card area), src/app/(app)/calendar.tsx (~lines 1035-1054), src/app/(app)/lists.tsx (~lines 961-967)

## UX-020 — Native DateField is a plain TextInput requiring typed YYYY-MM-DD
- **Severity:** ux-low
- **Area:** Cross-cutting (any date field on native)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Installed `@react-native-community/datetimepicker` via `npx expo install`. Rewrote `src/components/datetime-fields.tsx` (native variant only — web's `.web.tsx` was already fine) so DateField / TimeField now render a Pressable showing the formatted current value (e.g. "Mon, May 23" or "9:30 AM") and open a real platform picker on tap. iOS uses an in-flow `DateTimePicker` mounted inside a custom Modal with Cancel/Done buttons. Android uses the imperative `DateTimePickerAndroid.open()` — the OS handles modal + commit/cancel. The `value` + `onChange` API (YYYY-MM-DD / HH:mm) stays identical to the web variant, so every existing caller (event form, task form, recurrence Ends-on, etc.) gets the upgrade for free.
- **Description:** `DateField` in src/components/datetime-fields.tsx is implemented as a bare TextInput with `placeholder="YYYY-MM-DD"`. The file comments even acknowledge it: "Native fallback: plain TextInput with a format hint. Swap in a proper datetime picker […] before shipping on iOS / Android." On native this means the user must manually type `2026-05-23` to enter a date, including the hyphens, with the system soft keyboard (no special date picker UI). This affects the Event form (start date, end date, recurrence Ends-on), Task form (due date), and any other DateField use. Even though it's a known TODO, several recent UX fixes (UX-012 recurrence validation, UX-013 Move up/down on /list/[id]) ship into a flow where typed YYYY-MM-DD entry is the only path — and a typo silently produces "Invalid Date" or a date a year off. Web uses `<input type="date">` via the same TextInput so it picks up native browser date pickers; native users get nothing.
- **Recommendation:** Wire `@react-native-community/datetimepicker` for native. On press, show a modal picker; the form's `value: string` and `onChange(YYYY-MM-DD)` API stays untouched. Same for `TimeField`. Out of scope for the current sweep but worth filing as the bottleneck for several touched fields.
- **Related tasks:** none yet
- **Files:** src/components/datetime-fields.tsx (~lines 1-66)

## UX-021 — Horizontal overflow indicator is right-only; no hint when content exists to the left
- **Severity:** ux-low
- **Area:** Cross-cutting (chip strips with overflow)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** `useHorizontalOverflow` now also exposes `showLeftIndicator` (true when `scrollX > OVERFLOW_TOLERANCE`). Every existing call site — Lists chip strip, Calendar child filter, event-form locations — now renders both `<ScrollOverflowChevron side="left" />` and `<ScrollOverflowChevron side="right" />` so the user gets symmetric hints. Both use the same theme-aware background from UX-015.
- **Description:** `useHorizontalOverflow` tracks containerWidth + contentWidth + scrollX and exposes a single `showRightIndicator`. The `ScrollOverflowChevron` component accepts `side: 'left' | 'right'` (so the styling is half-done), but every consumer wires only the right chevron (lists.tsx line 813, calendar.tsx line 693, event-form.tsx line 1063). Once the user scrolls past the start of the chip strip, the leftmost chips disappear with no indicator, exactly the problem UX-010 was meant to fix on the other side. With many lists / children / locations, a user can scroll right, hit the end (right chevron hides), then have no signal that scrolling left is even a thing — the strip looks like all there is. The task brief specifically asked "Is there a left-edge chevron when scrolled past start (asymmetric)?" — no.
- **Recommendation:** Extend `useHorizontalOverflow` to also expose `showLeftIndicator = scrollX > OVERFLOW_TOLERANCE`. Wire a second `<ScrollOverflowChevron side="left" />` next to each existing right one. Cheap addition since the component already accepts the prop.
- **Related tasks:** none yet
- **Files:** src/components/scroll-overflow-indicator.tsx (~lines 54-83), src/app/(app)/lists.tsx (~line 813), src/app/(app)/calendar.tsx (~line 693), src/components/event-form.tsx (~line 1063)

## UX-022 — Calendar empty banner only appears in Day view; Week/Month with zero events stay silent
- **Severity:** ux-low
- **Area:** Calendar (Week, Month views)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Banner gate now only requires `visibleEvents.length === 0` (was AND viewMode === 'day'). Copy adapts per view: "Nothing scheduled." for Day, "Nothing scheduled this week." for Week, "Nothing scheduled this month." for Month. The "+ new event" link copy remains identical so the create affordance reads the same across views.
- **Description:** The empty-state banner that reads "Nothing scheduled. Tap a time slot to add an event, or tap + new event" is gated to `viewMode === 'day' && visibleEvents.length === 0` (calendar.tsx ~lines 1035-1054). A new user whose default is Week, or who has switched to Month, with zero events in range sees a bare grid (7 columns of empty hour lines, or 42 dot-less day cells) with no copy at all. Discoverability of "+ new event" via the FAB is OK on its own, but the contextual hint adds reassurance — "I'm in the right place, there's just nothing here yet". For households with a non-empty calendar this banner is irrelevant; for first-run / first-week users it's the only voice on the screen.
- **Recommendation:** Extend the banner condition to `visibleEvents.length === 0` regardless of `viewMode`. Adjust the copy slightly per view if needed: "Nothing scheduled this week" / "Nothing scheduled this month" reads less awkwardly than "Nothing scheduled" alone. Keep the same `+ new event` link in the copy.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 1035-1054)

## UX-023 — Bulk-bar "Add to list…" picker doesn't show which lists the selected tasks already belong to
- **Severity:** ux-low
- **Area:** Lists tab (bulk-select mode)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #2)
- **Fix:** Bulk picker chips now compute `allHaveIt` per-list (every selected task already includes that list). Filled chip = no-op tap, outlined chip = tap will add the membership. Matches the per-row "+ lists" picker convention so a user who learned "filled = already attached" reads both consistently.
- **Description:** In bulk-select mode, tapping "+ Add to list…" expands an inline picker that renders every list as a filled chip in its own color (lists.tsx ~lines 1147-1172). Tapping a chip calls `handleBulkAddToList(listId)` which iterates the selected tasks, skipping any task that already has that list — silently no-op for those tasks. From the user's standpoint, every chip in the picker looks identically actionable; there's no visual hint that picking "Groceries" might do nothing if the selected tasks are already in Groceries. Compare the per-row `+ lists` picker (TaskListRow `listPickerPanel`, lines 1453-1490) which DOES distinguish selected vs unselected lists via background fill (`backgroundColor: selected ? l.color : 'transparent'`). The bulk-bar picker should follow the same convention.
- **Recommendation:** Compute the union of `list_ids` across the selected tasks. Render chips for lists in that union with the "selected" treatment (filled background) and lists outside the union as outlined. Optional: disable / dim chips for lists every selected task is already in, since tapping them is a no-op. Even just rendering all chips outlined (matching the per-row picker's unselected state) would be more honest than the current always-filled rendering.
- **Related tasks:** none yet
- **Files:** src/app/(app)/lists.tsx (~lines 533-550 handleBulkAddToList, 1147-1172 picker chips, 1453-1490 per-row picker for comparison)

## UX-024 — UX-022 "Nothing scheduled this month" copy ships but the banner never renders in Month view
- **Severity:** ux-high
- **Area:** Calendar (Month view, empty state)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Hoisted the `{visibleEvents.length === 0 ? <banner /> : null}` block above the `viewMode === 'month' ? … : …` ternary so it renders in all three views (sits alongside the chip strip / custody band). The per-view copy ("Nothing scheduled this month") now actually appears in Month view on a quiet month. See Task #255.
- **Description:** UX-022's fix added the `viewMode === 'month' ? 'Nothing scheduled this month.'` copy to the empty-state banner. But the banner JSX (calendar.tsx lines 1098-1121) lives **inside** the non-month branch of the ternary `viewMode === 'month' ? <MonthGrid /> : (<>…banner + grid…</>)` that begins at line 715/918. Whenever the user is in Month view, the entire `<>` else-branch is unmounted — banner included. So a user who lands on Month view with zero events sees a bare 42-cell grid; the "Nothing scheduled this month" branch is dead code that can never execute. The same fix needs to render the banner **above** the ternary (so it sits with the chip strip / custody band and is visible in all three views), or duplicate the banner into the month branch.
- **Recommendation:** Move the `{visibleEvents.length === 0 ? <banner /> : null}` block above the `viewMode === 'month' ? … : …` ternary so it renders for all three views. The custody band + all-day row are already gated by their own conditions and sit fine in the shared area. Bonus: the `viewMode === 'month'` branch of the banner copy then becomes reachable for the first time, and Month-view first-run users finally see "+ new event" guidance.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 715-918 outer Month-vs-else ternary, 1098-1121 banner JSX that lives in the else branch only)

## UX-025 — Past-day dim cascades through the day column and washes out past event blocks
- **Severity:** ux-medium
- **Area:** Calendar (Week / Day view, past days)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Both halves of the agent's recommendation. (a) The day column no longer applies `opacity` to itself; instead a sibling `pastDayOverlay` View (absolute-positioned, `colors.background` background at 45% alpha, `pointerEvents: 'none'`) sits on top of the column children, dimming the visual without cascading into events. Touches still reach the column for press-and-hold-to-create. (b) New `rangeAnchorsPresentOrFuture` memo gates all three dim sites (day header, day column, month cell) — when the user has navigated entirely into the past, nothing dims because the today-anchored interpretation no longer applies. See Task #256.
- **Description:** The past-day dim is applied on the day column Wrapper itself: `isPast && !dayIsToday && { opacity: 0.55 }` (calendar.tsx ~lines 1205-1206). Because RN `opacity` cascades to children, every event block, busy block, and other-member busy block rendered inside that column is also rendered at 0.55 opacity. The event block's text (already white on a pastel-tinted bg) becomes faint white on a faded pastel — and event blocks anchored to a past day in the same Week view as today's column look "deprioritized" in a way the user can't reverse. Two concrete problems: (1) a user reviewing Monday's pickup time on a Wednesday afternoon has the worst-readable copy on the screen for the most info-dense block; (2) the same opacity cascade applies when the user navigates BACK to a past week — they explicitly asked to see those events, but the entire grid + every event is washed out. The week / day grid effectively says "you're not allowed to look at the past" even when the user is actively looking at the past.
- **Recommendation:** Either (a) move the opacity off the column and onto the column's hour-line + background-tint layers only (leave events at full opacity — they're the content the user actually wants to read); or (b) gate the dim by anchor: only dim past days when the user is on a CURRENT (today-containing) week / day view. Past weeks already represent "I am intentionally looking at the past" and shouldn't be self-dimming. Option (b) is the smaller change and arguably the more correct mental model — the dim's purpose is "your attention should be on today + future" within a today-anchored view.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 928-952 day-header dim, 1155-1206 day-column dim, 768-803 month-cell dim)

## UX-026 — WelcomeCard action-chip text uses brand slate-blue, fails WCAG AA on dark theme
- **Severity:** ux-medium
- **Area:** Home (first-run welcome card, dark theme)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Action-chip text now uses `colors.text` (~7:1 contrast on both themes). Chip identity is carried by the slate-blue border + ~13% slate-blue fill (`#6F7FA522`), which sits behind both light and dark surfaces without contrast issues. The chip reads as a slate-blue tinted action regardless of theme without sacrificing legibility. See Task #258.
- **Description:** The four action chips inside the WelcomeCard render their label with `color: '#6F7FA5'` (the OneNest brand slate-blue) inside a transparent-background chip with a `colors.backgroundSelected` border, sitting on a `colors.backgroundElement` card (index.tsx ~lines 644-648, styles 1015-1020). On light theme that puts slate-blue text on a pale-sage card — readable at ~5:1. On dark theme it puts slate-blue text (rgb 111,127,165, relative luminance ~0.21) on `#2A2F3D` raised slate (relative luminance ~0.035), which is ~3.06:1 contrast — below WCAG AA's 4.5:1 minimum for normal-size text. The chips are also the only call-to-action affordance on the first thing a brand-new dark-theme user sees, so the legibility hit lands directly on the onboarding moment. Same `#6F7FA5` color is used elsewhere on dark theme (recurrence chip "Done" text, etc.) but those sit beside selected-state chips with white text that carry the contrast — here it's the only colored element and fails on its own.
- **Recommendation:** Either (a) switch the action-chip text to `colors.text` on dark theme (a small `scheme === 'dark' ? colors.text : '#6F7FA5'` ternary), or (b) brighten the brand accent for dark theme — define a `colors.accent` palette token that's `#6F7FA5` in light and a higher-luminance equivalent (e.g. `#8FA0CC`) in dark. Option (b) is more work but pays off everywhere the brand slate-blue is used.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 644-648 WelcomeCard chip text)

## UX-027 — WelcomeCard dismiss × has a ~28pt tap target, well below the 44pt mobile minimum
- **Severity:** ux-medium
- **Area:** Home (WelcomeCard dismiss button)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Added `hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}` to the dismiss Pressable. Visual × stays compact (preserving the card's clean header) but the touch target extends to ~52×52pt, well above the HIG 44pt minimum. The other small × buttons in the app (event-task-section removeBtn, cross-list pill ×) are flagged for a separate cross-cutting tap-target audit. See Task #258.
- **Description:** The dismiss × is a ThemedText with `fontSize: 20` inside a Pressable with `padding: Spacing.one` (= 4) on all sides (index.tsx ~lines 616-629, styles 1008-1009). Total tappable area is ~28×28pt. Apple HIG mandates 44×44pt, Material Design recommends 48×48pt; both standards exist because finger-sized targets miss small UI consistently. A user trying to dismiss the welcome card has to tap precisely on a small × in the corner of the card — easy to miss and tap one of the action chips below instead, which then routes them away from Home. Combined with UX-028 (no way to bring the card back), a stray miss can be a surprisingly destructive accident.
- **Recommendation:** Bump the dismiss button to ≥44×44 tap area. Cheapest fix: `padding: Spacing.three` (16, giving 20+32=52pt) or `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` to enlarge the hit zone without enlarging the visual element. Apply the same review to the other small × buttons in the app (event-task-section removeBtn is 28×28 also, lists.tsx chip ✕ glyphs after UX-003, etc.) — this is a cross-cutting pattern worth a sweep.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 616-629 dismiss Pressable, 1008-1009 welcomeDismiss style)

## UX-028 — Once dismissed, WelcomeCard cannot be brought back without clearing AsyncStorage
- **Severity:** ux-medium
- **Area:** Home (first-run welcome card recovery)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Added a "Show welcome card on Home again" link at the bottom of Settings (just above Sign out). On tap it clears the `onenest:home-welcome-dismissed:{householdId}` AsyncStorage key and shows an Alert confirming the restore. Visual weight is intentionally low (textSecondary, no fill) — recovery is a secondary action that shouldn't compete with Sign out or the primary household management rows. See Task #258.
- **Description:** The welcome card writes `onenest:home-welcome-dismissed:{householdId}` = `'true'` to AsyncStorage on dismiss (index.tsx ~lines 99-119), and the render gate `welcomeDismissed === false` permanently hides it once that key is set. Settings has no "Show the welcome tips again" affordance. The card's four chips (Invite partner, Add a child, Set up custody, New event) are the only first-run navigation hints — once the user dismisses (intentionally or by misclick — see UX-027), they have no path to surface them again short of going through Settings to find the same actions one at a time. A user who dismisses on day one then later wants the "Invite partner" prompt back has no recovery. Reinstall / cache-clear is the only escape hatch.
- **Recommendation:** Add a "Show getting-started tips" row in Settings that clears the `onenest:home-welcome-dismissed:{id}` key for the active household and bounces back to Home. Could also surface it under a Help menu later. Even just labeling the row "Restart onboarding tips" would let users self-recover. Cheap fix, and it eliminates the "dismissed by accident, lost the tips forever" failure mode that UX-027 makes more likely.
- **Related tasks:** none yet
- **Files:** src/app/(app)/index.tsx (~lines 99-119 dismissed state + AsyncStorage write), src/app/(app)/settings.tsx (no current affordance)

## UX-029 — Native press-and-hold to create has no discoverability for users who already have events
- **Severity:** ux-medium
- **Area:** Calendar (native, Day / Week view)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Recommendation (a) shipped. New AsyncStorage counter `onenest:calendar-longpress-hint` increments on every Calendar mount (native only). For the first 3 sessions, a "Tip: press and hold any time slot to add an event there." bar renders above the grid even when the user has events. Self-dismisses on (i) manual × tap, (ii) a successful long-press fire (gesture discovered), or (iii) hitting the show-count limit. Initial state is `null` until AsyncStorage resolves, so returning users never flash the tip on cold start. See Task #263.
- **Description:** UX-017's fix added 500ms long-press to the native day column with a banner hint: "Press and hold a time slot to add an event, or tap + new event" (calendar.tsx ~lines 1110-1112). The banner is gated by `visibleEvents.length === 0` (line 1098) — meaning the press-and-hold hint is only ever shown when the user has NO events in the visible range. The moment a user has even one event, the banner disappears and the long-press gesture becomes completely undiscoverable: no visual affordance on the column, no onboarding hint, no tip in Settings. A user who learned the FAB on day one will never discover that "I can also press a time slot to pre-fill the start time" — they'll keep using the FAB and manually typing 9:30. The web flow has a `cursor: 'crosshair'` hint (line 1210) that signals "drag here", but native has no equivalent.
- **Recommendation:** Either (a) keep the banner showing a discoverability hint for the first N sessions even when events exist (track a `onenest:longpress-hint-seen` counter in AsyncStorage; show "Tip: Press and hold any time slot to add an event" on the first 3 Calendar visits, then dismiss); or (b) add a subtle pulsing hint on the column on first focus (a one-time animated cue); or (c) when the user taps a time slot (currently does nothing on native), show an inline tooltip "Press and hold to add an event here". Option (a) is the smallest change and matches the bottom-bar "tap to dismiss" iOS pattern. Without something, the gesture is effectively invisible past first run.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 1098-1121 banner gate, 1178-1194 long-press wiring on native day column)

## UX-030 — Month-view event pills truncate so aggressively on narrow phones that they convey almost no information
- **Severity:** ux-medium
- **Area:** Calendar (Month view, portrait-phone widths)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Recommendation (b) shipped — dropped the event-type icon from Month-view pills entirely. The title is the content that disambiguates; the icon was decorative and stole 1-2 chars before truncation. Time prefix stays. On a 45pt-wide cell, "9am Soccer" now fits where "9am ⚽ S…" used to truncate.
- **Description:** Month cells split the screen width across 7 columns. On a 375pt-wide iPhone SE-class display that's ~53pt per cell, minus 4pt padding leaves ~45pt of usable text width. Event pills render `{startTime} {iconForType} {title}` with `numberOfLines={1}` (calendar.tsx ~lines 861-893). Concrete cases at 45pt: "9:30am ⚽ Soccer practice" truncates around `9:30am ⚽…` — the title that disambiguates the event is the first thing cut. With three pills stacked + the day number + "+N more", a busy day cell renders three nearly-information-free truncated pills. Compared to the prior "colored dot" representation which was honest about being non-informative, the new pills LOOK like they're telling you something but mostly don't. The mixed time format adds noise: "9am ⚽ S…" vs "9:13am ⚽ S…" produce different truncation points within the same cell, so a column of pills has ragged-left edges that read as misalignment. The :00-stripping helps on "9am" but breaks down on the more common cases of :30 / :15 starts.
- **Recommendation:** Either (a) drop the time prefix on Month view at narrow widths and show just `{icon} {title}`, letting the title get more space — the cell's row position within the day already implies "early/late" coarsely; or (b) drop the event-type icon (it's redundant when the title is meaningful and steals 1-2 chars otherwise); or (c) use a measured `useWindowDimensions` to switch to a denser format under ~400pt total width. Option (b) is the least invasive — icons are decorative, titles are content. Bonus polish: replace `.replace(':00', '')` with a per-minute format so "9:30am Soccer" reads consistently — the current logic only special-cases on-the-hour times.
- **Related tasks:** none yet
- **Files:** src/app/(app)/calendar.tsx (~lines 853-895 month event pill render, 1541-1551 monthEventPill styles)

## UX-031 — Native DateField/TimeField display formats diverge from the web variant — cross-platform spec drift
- **Severity:** ux-low
- **Area:** Cross-cutting (any DateField / TimeField, web vs native)
- **Status:** wont-fix
- **Found:** 2026-05-23 (agent run #3)
- **Resolution:** Accepted the trade-off the finding itself flagged as low-severity. Wrapping web's `<input type="date">` in a Pressable + read-only overlay to fake "Mon, May 23" formatting would: (1) require maintaining a hidden-input-with-fake-label pattern brittle to browser version changes; (2) lose the native browser date picker affordance (chevron, calendar icon, keyboard-accessible spinner) that's the whole reason we use the HTML input on web; (3) introduce locale handling that the OS already does for free on each platform. Each platform's native rendering is well-understood by its users. Drift between platforms is real but minor — a user on web sees ISO/24h, on iPhone sees friendly format, both readable. Documenting and leaving as a future polish if real users complain.
- **Description:** The UX-020 fix gave native users a proper picker, and along the way changed the display format to "Mon, May 23" (no year unless different) for dates and "9:30 AM" for times (datetime-fields.tsx ~lines 50-85). The web variant (datetime-fields.web.tsx) renders the raw HTML `<input type="date">` / `<input type="time">`, which shows `YYYY-MM-DD` and `HH:mm` (24h) in most browsers' default rendering. So the same event form, viewed on iPhone Safari vs Chrome on desktop, displays the same event's start as "Mon, May 23 · 9:30 AM" (iOS) vs "2026-05-23 · 09:30" (web). A household member on web reviewing an event their partner created on phone sees raw ISO and 24-hour, even though the partner picked the date via a friendly UI. The picker UX is a wash (both are platform-native), but the **displayed value** drifts. Same concern on the task editor, child birthday, recurrence Ends-on, etc.
- **Recommendation:** Wrap the web `<input>` in a Pressable + read-only text label that displays `formatDisplayDate`/`formatDisplayTime` over the native control, hiding the underlying input visually (opacity 0, position absolute, but keeping it interactive for click → native picker). That gives web a friendly display while keeping the OS picker. Alternatively, accept the platform-native ISO format as the web style and trust browsers to render dates in the user's locale — but cross-platform drift is the worse outcome since the same household members compare notes across surfaces. Trade-off noted as low because both formats are technically readable; the drift is a polish issue, not a blocker.
- **Related tasks:** none yet
- **Files:** src/components/datetime-fields.tsx (~lines 50-85 native display formatters), src/components/datetime-fields.web.tsx (~lines 1-63 web variant uses raw HTML input)

## UX-032 — Native DateField/TimeField "tap to open" has no signaling beyond a bordered field
- **Severity:** ux-low
- **Area:** Cross-cutting (every DateField / TimeField on native)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Added a trailing `<Feather name="calendar" />` to DateField and `<Feather name="clock" />` to TimeField, mirroring the calendar/clock indicators browsers paint inside HTML `<input type="date">` / `type="time">`. Field becomes a flex row with text on the left and icon flush-right. Icon color uses `colors.textSecondary` to read as a hint rather than a primary affordance.
- **Description:** The native DateField/TimeField renders as a bordered, 44-tall Pressable with formatted text inside (datetime-fields.tsx ~lines 96-105, 146-167). There's no chevron, no calendar icon, no underline-as-link styling — just text in a box that looks identical to a non-interactive read-only label. Compare the web variant which uses a real `<input type="date">` — browsers paint a calendar dropdown icon at the right edge, telling the user "this opens a picker". A native user looking at the event form sees the date as a static-looking value beside a label, with no visible cue that tapping does anything. The only way to discover the interaction is by trial tap. Compound concern: an accidental tap on a date field while scrolling the form opens an iOS modal that animates in — that surprise modal is the user's first signal that the field is interactive. Worth a trailing chevron-down icon at minimum.
- **Recommendation:** Add a small `<Feather name="calendar" />` (date) or `<Feather name="clock" />` (time) icon on the right side of the field's contents, mirroring browser default. Cheaper alternative: a `▾` chevron suffix. Either gives the user an instant "this is interactive and opens a picker" cue without changing the layout meaningfully.
- **Related tasks:** none yet
- **Files:** src/components/datetime-fields.tsx (~lines 96-105 useFieldStyles, 146-167 DateField render, 260-281 TimeField render)

## UX-033 — Recurrence error auto-clear is silent — no positive feedback that the user's fix was accepted
- **Severity:** ux-low
- **Area:** Event form (recurrence end-date error)
- **Status:** wont-fix
- **Found:** 2026-05-23 (agent run #3)
- **Resolution:** The silent clear is consistent with how form validation works across most apps users encounter (Gmail / Slack / Linear / Notion — type a valid email, the red border just disappears). Adding a transient success cue per-field would set a precedent we'd need to extend to every other validation (end-time-after-start, required title, recurrence-day-picked), which becomes noisy. The disappearance of the error IS the positive signal in standard form UX vocabulary. Closing as wont-fix; the validation re-runs on Save and surfaces fresh errors there if needed.
- **Description:** UX-016's fix attaches a `useEffect` that resets `error` to null whenever `date`, `endTime`, or `recurrenceEndDate` change (event-form.tsx ~lines 320-333). Functionally this clears the lingering red-line stale error. UX-wise it does so **silently**: the user fixes the recurrence end date from May 20 → June 20, the red error message simply vanishes the moment they pick the new date. There's no transition, no checkmark, no "Looks good" cue — just an abrupt disappearance. A cautious user might assume the form is hiding something (some validation is still failing but inline-only?), or might miss the disappearance entirely and re-tap Save anyway to "really fix" it. The opposite extreme would be over-engineered (toasts for every field change), but the current zero-feedback path leaves the user uncertain whether their change "took".
- **Recommendation:** Either (a) keep the silent clear but add a subtle fade-out animation on the error text (250ms opacity → 0) so the user sees the message physically resolving rather than vanishing; or (b) keep the error in place but visually crossed-out / dimmed once the underlying validation passes, then re-validate on Save. Option (a) is the cheapest. Either way, a 2-line behavioral note in the inline error component would help.
- **Related tasks:** none yet
- **Files:** src/components/event-form.tsx (~lines 320-333 useEffect that clears, ~1205-1209 inline error render)

## UX-034 — Children chip selected-state hardcodes `#2A2E3A` text, ignores dark theme
- **Severity:** ux-low
- **Area:** Event-task-section (Children chips on each inline task)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Promoted `Colors.textOnPastel` (`#2A2E3A` in both themes, with an inline comment explaining the intentional theme-agnostic choice). Swapped all five call sites: event-task-section children chip, lists.tsx active-chip (×3), task/new.tsx list chip, task/[id].tsx list chip. Future palette changes that introduce a darker pastel won't silently break contrast since the token is one edit away.
- **Description:** The Children chip in `event-task-section.tsx` uses `color: selected ? '#2A2E3A' : colors.text` on `backgroundColor: c.color` (event-task-section.tsx ~lines 476-485). The selected text color is hardcoded to dark slate (`#2A2E3A`) rather than driven from the theme. On both themes the chip background is a child's pastel (`#F4A6C0`, `#A8DEC5`, etc. from CHILDREN_PALETTE in colors.ts), so dark slate text on a pastel bg renders fine in both themes — there's no immediate broken-contrast bug. But the choice is conceptually wrong: a selected chip text-color should follow the theme's "foreground on light surface" convention (i.e. it should be the same dark slate regardless of theme because the pastel bg is the same), but it should be expressed as `colors.textOnPastel` or at least `Colors.light.text` to signal the intent. The same hardcoded `#2A2E3A` shows up in 3 other places in event-task-section.tsx (list chip selected, children chip selected) and lists.tsx bulk picker — each is a "selected chip on pastel" case. If the design ever introduces a darker child palette color, the hardcoded slate becomes a real contrast bug.
- **Recommendation:** Promote a `Colors.textOnPastel` (or `colorOnLightSurface`) token to the theme — same `#2A2E3A` value in both themes — and reference it everywhere a chip puts text on a known-pastel background. Cosmetic/refactor-level change, but it makes the intent explicit and inoculates against future palette changes. Until then, a comment at each call site noting "intentional: pastel bg is theme-agnostic" would prevent a well-meaning future PR from "fixing" it to `colors.text`.
- **Related tasks:** none yet
- **Files:** src/components/event-task-section.tsx (~lines 432-435 list chip, 479-482 child chip), src/app/(app)/lists.tsx (~lines 1190-1192 bulk picker)

## UX-035 — Children chip text-only render loses the child-identity signal in unselected state
- **Severity:** ux-low
- **Area:** Event-task-section (Children chip row, unselected state)
- **Status:** fixed
- **Found:** 2026-05-23 (agent run #3)
- **Fix:** Added an 8pt color dot before the name in the unselected state (the selected state already paints the chip the child's color, so the dot would be redundant there). Chip becomes a flex row with the dot + name. Preserves the "no avatar redundancy" goal of the earlier ChildBadge removal while restoring at-a-glance color → identity for the unselected state.
- **Description:** Per task-brief note, the inline-task children chip was simplified to drop the duplicated ChildBadge avatar (event-task-section.tsx ~lines 469-485). The chip is now just `{c.display_name}` inside a Pressable with `borderColor: c.color` and a transparent bg when unselected. Two children in the household — say "Anna" (pink) and "Ben" (mint) — render as two pill-shaped buttons whose only color cue is a thin 1-pt border. On a busy form with parent assignee chips, list chips, AND children chips in sequence (~3 chip rows per task), the user has to read the border color carefully to identify which chip corresponds to which child. Compare the same-row Lists chips above (line 408-443) which also use just a border in the unselected state — but lists rarely have palette collisions with people, while children + parents on the same screen share visual real estate. The selected state IS distinctive (filled with the child's color + child-named text), but the unselected state under-signals.
- **Recommendation:** Add a small color swatch (e.g. an 8pt color dot, NOT a full ChildBadge with initial) inside the chip before the name. That preserves the "no avatar redundancy" goal the task fix targeted, but restores the at-a-glance color → identity mapping for the unselected state. Alternatively: keep the border but make it 2pt thick on the children row only (vs 1pt on lists / parents) so the child color reads more clearly.
- **Related tasks:** none yet
- **Files:** src/components/event-task-section.tsx (~lines 469-485 children chip render)

