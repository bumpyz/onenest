# Handoff — Calendar FAB rules + List detail inline-row + conflict-resolver access

## Overview

Four related fixes, unified by one principle — **respect the rule, except where a permanent UI surface makes the rule worse**:

1. **Calendar week FAB returns to canonical position.** The persistent
   drag-hint banner that pushed the FAB up by 56px is removed from the
   default render. Drag-hint stays as a *transient* state (only visible
   during an active drag) and gets the bottom slot at that time — the
   FAB fades out, because the user's intent is to *move*, not create.

2. **Calendar week grid extends to the tab bar.** The card was rendering
   only 11 hours of content (440px) inside a 574px container, leaving
   a visible ~130px gap above the tab bar. Hour range extended to
   6am–10pm (17 hours, fills + scrolls past the container) and the
   inner card got `minHeight: 100%` so it visually fills regardless of
   hour count. Side benefit: realistic family day from school dropoff
   through bedtime.

3. **Calendar month drops the FAB entirely.** Month view has a
   permanent selected-day preview card pinned to the bottom. Rather
   than elevating the FAB to sit above it (the prior compromise), the
   "+ New event" action is now embedded *inside* the preview card,
   side-by-side with "Open day view →". Two affordances, one
   contextual surface, scoped to the selected day. Month is formally
   outside the FAB rule by design.

4. **List detail FAB labels itself + focuses inline row.** Previously
   labeled `Add` and ambiguous; now `New task`. The FAB tap focuses
   the existing inline quick-add row at the top of the list — same
   affordance, bigger tap target. A focused-state artboard is added
   showing the row with checkbox + caret + accent escalation link to
   the full CreateTask form.

5. **`ConflictResolution` is now reachable from every surface that
   shows a conflict.** Previously only Today's inline card and the
   Notifications inbox led there. Calendar blocks and Event detail
   exposed the conflict visually but had no tap-target. Now they do.

## The FAB rule, restated

After these fixes the FAB rule has three states, in priority order:

1. **No FAB.** When a view has a permanent contextual UI surface (Month
   view's selected-day preview card), the create action lives inside
   that surface, scoped to its context. No FAB.
2. **Kind-committed FAB at `bottom: 96`.** When a tab's primary content
   is one kind (Calendar = events, Lists = tasks, Contacts = contacts,
   Custody = overrides), the FAB short-circuits to that kind. Label is
   `New <kind>`.
3. **Chooser FAB at `bottom: 96`.** When a tab is multi-kind (Today,
   Family), the FAB opens `QuickCreateSheet`. Label is `New`.

Transient overlays (drag-hint, sheets) fade the FAB out — they don't
displace it.

## The List detail FAB → inline row pattern

`ListDetail`'s FAB is the **only** kind-committed FAB that doesn't open
a full create form. Instead it focuses the existing inline quick-add
row at the top of the list — empty checkbox + caret-blinking input.
Type, hit ↵ to commit, row clears and stays focused for rapid entry.

This matches iOS Reminders. Faster for grocery-style multi-item entry.
For tasks that need more fields (assignee, due, lists), a
`MORE FIELDS →` accent link on the right of the row escalates to the
full `CreateTask` form with the list pre-filled.

The Quick add row's default-vs-focused state is shown as two artboards
in section 05.2 of the canvas.

## The conflict-resolver access rule

> **Anywhere a conflict is visible, the visible signal IS the tap-target.**
> Block borders, chips, badges — make them tappable, route them to
> `ConflictResolution` scoped to that conflict.

| Surface | Conflict signal | Tap-target → `ConflictResolution` |
|---|---|---|
| Today | Inline conflict card | Card body (and inline buttons for shortcuts) |
| Calendar — week | Red border on block + **NEW** warn-tinted bug in corner | The bug |
| Calendar — day | Red border on block + **NEW** warn-tinted bug in corner | The bug |
| Calendar — month | Conflict cells get a small warn dot | The dot |
| Event detail | **NEW** chip + chevron (was decorative) | The chip |
| Event overflow sheet | "Reassign across custody" action | The action row |
| Notifications inbox | Conflict notification | The row |

The block itself remains tappable → opens Event detail (unchanged).
The new conflict bug is a *secondary* tap-target on the same block —
it's small and unmistakable enough that it doesn't fight the primary
gesture.

### What the bug looks like

- 14×14 round badge, `C.warn` fill, `1.5px solid C.card` outline
- White `!` glyph centered, 7×7 viewBox
- Soft shadow `0 1px 2px rgba(0,0,0,0.15)`
- Position: `absolute; right: 2px; bottom: 2px` on the event block
- Only rendered when `conflict && !ghost`

Bottom-right placement keeps it away from the existing `handoff` swap
icon in the top-right; both can coexist on a block.

### What the `CONFLICT` chip looks like now (Event detail)

Same pill (warn-tinted background, warn icon, "CONFLICT" mono caps)
but adds:
- `0.5px solid C.warn + '55'` border (was none)
- Trailing chevron in `C.warn`, 5×8

Both changes signal interactivity. The chip is now a `Pressable` that
opens `ConflictResolution`.

## FAB position rule (recap from the FAB-rule handoff)

This handoff confirms the rule by removing the one tab that broke it:

- All FABs sit at `bottom: 96` (above the bottom nav)
- Transient overlays don't permanently change the FAB position
- When a transient overlay needs the bottom slot, the FAB fades out
  rather than displacing upward

## The drag-hint state — design notes

Drag-hint is a great feature but was being mis-rendered as a permanent
overlay in the static mock. The correct behavior on RN:

1. **Default state.** FAB visible at `bottom: 96`. No drag-hint.
2. **During an active drag** (long-press + drag on an event block):
   - FAB fades out (200ms)
   - Drag-hint sheet fades in at the same position (`bottom: 96`)
   - Hint shows: `Drag <event title> to <target slot> — resolves conflict`
   - Sticky `Apply` accent chip on the right of the hint commits the move
3. **On drop or cancel.** Hint fades out, FAB fades back in.

The hint should also update in real-time as the drag target changes —
showing the resolution outcome for the current drop target. Out of
scope for this static handoff but important for the RN implementation.

## What this handoff does NOT include

- A redesigned `ConflictResolution` screen — the existing one (section
  04.6 in the canvas) stays as-is. This handoff is purely about
  making it reachable.
- A persistent "X conflicts this week" banner. We deliberately did not
  add one — episodic problems shouldn't take permanent real estate.
  The Notifications tab count badge + the in-context tap-targets is
  enough.
- Long-press contextual menu on event blocks. Suggested in chat but
  not designed in this pass; would surface `Resolve conflict →` at the
  top of the menu when the block is in conflict.

## Files changed in this bundle

| File | Change |
|---|---|
| `direction-c-pro.jsx` | `ProCalendar` (Week) — drag-hint banner removed from default render; FAB moved to `bottom: 96`; hours extended from `[8..18]` to `[6..22]`; inner grid card got `minHeight: 100%` so it visually fills the container. `CCalBlock` — added conflict bug (14×14 warn badge in bottom-right corner). |
| `screens-extra-5.jsx` | `CalendarMonth` — FAB removed; "+ New event" embedded into selected-day preview card footer alongside "Open day view →" (2-up split with hairline divider, both mono caps 11/600 — accent for primary, inkSec for secondary). `CalendarDay` FAB label `New` → `New event`. |
| `screens-extra-3.jsx` | `ListDetail` — FAB label `Add` → `New task`. Added `focused` prop that renders the quick-add row in active state: empty checkbox + typed text + blinking accent caret + `MORE FIELDS →` accent escalation link + accent-filled `↵` chip. |
| `screens-extra.jsx` | `EventDetail` — `CONFLICT` chip gets a warn-tinted border + trailing chevron to signal it's tappable. |
| `app.jsx` | `05.2 · List detail` section adds a third artboard `P3 · adding item` showing the focused inline-row state. |

No other files were modified. They're carried over so the standalone
HTML renders the full canvas.

## RN porting notes

- **Hour range.** Default 6am–10pm. Households with early-rising kids or
  late-night activities may want this configurable in Settings →
  Appearance — out of scope here, but worth noting.
- **Scroll-to-now on initial render.** With the extended hour range, the
  card is taller than the viewport. RN implementation should scroll the
  grid to center the "now" line on initial mount (not at the top of
  6am). Use `scrollTo({y: nowLineOffset - viewportHeight/2})` on layout.
- **CCalBlock conflict bug.** Should accept an `onConflictPress`
  callback alongside `onPress`. Hit-target should be at least 24×24
  even though the visual is 14×14 — pad with transparent margin.
- **EventDetail CONFLICT chip.** Make the existing chip a `Pressable`.
  The inline conflict-resolver ribbon below remains; chip is the
  shortcut, ribbon is the in-context detail. Don't remove the ribbon.
- **FAB hide-during-drag.** Use the existing animated-opacity pattern
  for the FAB. Drag state lives on the calendar view's local state.
- **Drag-hint banner.** Render via `react-native-reanimated`'s
  `LayoutAnimation` for the fade-in/fade-out. Pinned to the same
  `bottom: 96` position the FAB just vacated.

## Open product questions

1. **Default tap behavior on a conflict block.** Currently the block
   tap opens Event detail. Should a conflict block default to opening
   `ConflictResolution` instead (since the conflict is the more
   pressing concern)? Recommendation: no, keep block-tap on Event
   detail. The bug is an explicit conflict-only affordance and that's
   the right separation. Users who want to see the conflict will look
   for the warn-tinted bug.

2. **Conflict bug placement on conflicting side-by-side blocks.** When
   two blocks render side-by-side (the existing `conflict + right`
   case), they share a conflict. Should both blocks show the bug, or
   only one? Recommendation: only the **non-`right`** block (the left
   one) — it's the canonical "owner" of the conflict pair. Both
   showing creates visual noise.

3. **Conflict dot on month-view cells.** Not designed in this pass.
   Recommendation: small 5×5 warn-tinted dot in the bottom-right of
   the cell, separate from the event-count dots. Tap the day → opens
   Day view scrolled to the conflict.

## Files in this bundle

- `OneNest - UI Explorations (standalone).html` — single self-contained HTML, ~2.4 MB. Open offline.
- `OneNest - UI Explorations.html` — multi-file version
- `direction-c-pro.jsx`, `screens-extra.jsx` — the two files with changes
- All other files — supporting, unchanged

See sibling folders for the related handoffs:
- `design_handoff_fab_rule/` — the formal FAB consistency rule
- `design_handoff_lists_v2/` — Lists tab with FAB + tappable list cards
- `design_handoff_creation_flows/` — Create task/list/contact/child/override
- `design_handoff_event_responsible/` — Event kebab + multi-responsible model
- `design_handoff_custody_surfaces/` — Today/Family Hub/Schedule/Pattern editor
- `design_handoff_task_detail_v2/` — Task detail v2 + bottom-sheet edits
- `design_handoff_settings_subroutes/` — Settings sub-routes + 5-tab nav + Contacts
