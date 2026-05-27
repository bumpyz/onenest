# Handoff — Task detail v2 + bottom-sheet edit pattern

## Overview

This handoff covers a redesign of the **Task detail** screen and introduces
a **bottom-sheet edit pattern** that replaces the previous `/edit` route.

The core idea: every editable field on the task gets a focused bottom sheet
instead of pushing to a separate full-page edit form. The `/edit` catch-all
goes away. Inline editing handles the title and notes; sheets handle every
other field.

Six changes are in scope:

1. **Field carets open bottom sheets** — `Assigned to`, `Due`, `Reminder`,
   `Recurring`, and the new `Priority` row each open a focused sheet on tap.
2. **Title becomes inline-editable** — tap the title, it becomes an input.
   No pencil icon in the hero.
3. **Notes stays as its own SGroup**, tap-to-edit inline (becomes textarea).
4. **Lists / For (children) become multi-select sheets** — chips are
   display-only; tap any chip *or* the `+ Edit` affordance to open the
   multi-select sheet. No per-chip remove × .
5. **`Priority` joins the Details rows** — own bottom sheet picker
   (None / Low / Normal / High / Urgent). The `HIGH PRIORITY` hero pill is
   read-only status display.
6. **Top-bar kebab (•••)** opens **`TaskOverflowSheet`** — task-level
   actions that don't fit on the sticky bar (Share, Duplicate, Convert
   to event, Move, Pin, Archive, Export, Delete).
7. **`/edit` route is removed entirely.**

## About the design files

The files in this bundle are **design references created in HTML/React**.
The OneNest app is React Native (Expo Router). The task is to **recreate
these screens in the existing RN codebase** using its established patterns
(`ThemedView`, `ThemedText`, `Pressable`, `react-native-svg`, the
expo-router stack for navigation, etc.).

Open `OneNest - UI Explorations.html` in a browser to see the live mocks.
The relevant sections are:

- `Task detail · v2` (3 artboards — read state, editing-title state, dark)
- `Task overflow · ••• kebab`
- `Task field-edit sheets` (7 artboards: Due, Reminder, Assigned to,
  Priority, Recurring, In lists, For whom)

The original `Task detail` section is also kept for diff reference.

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy, and interaction
patterns are final. Mono labels (`DUE TONIGHT · 21:00`, `HIGH PRIORITY`,
`Tap title to rename · ••• for more`) are intentional.

---

## File map

| File | What |
|---|---|
| `screens-task-edit.jsx` | **The new work.** `TaskDetailV2`, `TaskOverflowSheet`, `DueDateSheet`, `ReminderSheet`, `AssignSheet`, `PrioritySheet`, `RecurringSheet`, `ListsSheet`, `ChildrenSheet`, plus shared `SheetShell`, `SheetBackdrop`, `OverflowRow`, `ForChip`, `ListChip`, `AddChip` primitives. |
| `screens-extra-3.jsx` | Contains the old `TaskDetail` for diff reference. **Not modified.** |
| `direction-c-pro.jsx` | Palettes + `cMembers` + helpers. Not modified. |
| `app.jsx` | Design canvas wiring. |
| `screens-extra*.jsx`, `screens-settings.jsx`, `ios-frame.jsx`, `design-canvas.jsx` | Supporting files so the preview renders. |

---

## Section A · Task detail v2 (`TaskDetailV2`)

**Component**: `TaskDetailV2` in `screens-task-edit.jsx`.
**Artboard**: 402 × 874.
**Diff from existing `TaskDetail`** (in `screens-extra-3.jsx`):

| Region | Was | Now |
|---|---|---|
| Title | Read-only display | **Inline-editable on tap** — `inset` background, 1.2px accent border, blinking caret. No pencil icon. |
| Hint below title pills | Absent | New mono 10/inkMuted line: `Tap title to rename · ••• for more`. Only shown in read state. |
| Details rows | Assigned · Due · Reminder · Recurring | **Adds Priority row** (5th row, mono accent value `High`). |
| Status pills (DUE TONIGHT, HIGH PRIORITY) | Same | **Read-only status** — no longer affordances. Priority is changed via the Priority row. |
| For whom (children) | Absent (or implicit via linked event) | **New `For · N` SGroup** with kid chips + `+ Edit` chip. |
| Lists | Chips with **per-chip remove implied**, `+ Add` chip | Chips display-only, `+ Edit` chip (was `+ Add`). Tap any chip or `+ Edit` → multi-select sheet. |
| Notes | Plain text | Plain text with a mono `TAP TO EDIT` hint in the top-right. Tapping opens inline textarea (not a separate sheet). |
| Sticky bar | Snooze + Mark done | Unchanged. |
| Top-bar kebab | Existed but unspecified | **Opens `TaskOverflowSheet`.** |

### Editing-title state

When the title is tapped:

- Container becomes `padding: 6px 10px`, `marginLeft: -10` (so the input
  edge aligns with the original title's edge), radius 8.
- Background: `C.inset`. Border: 1.2px `C.accent`.
- Title text remains at its original 22 / 600 / -0.7 / lineHeight 1.25 —
  it's now the value of a text input.
- Blinking 2 × 24 accent caret immediately after the text.
  Animation: `@keyframes blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }`
  (declared in the HTML head).
- The `Tap title to rename · ••• for more` hint is hidden during edit.
- iOS keyboard slides up. On blur (tap outside) or Done on the keyboard,
  save and return to read state.

### Priority row behavior

- Row label: `Priority`.
- Right value: mono 12 / 600 / -0.2 in the color matching the priority
  level. For "High" use `C.accent`. For Urgent use `C.alert`. For Normal
  use `C.alex`. For Low use `C.devon`. For None use `C.inkMuted`.
- Tapping opens `PrioritySheet`.

### For (children) SGroup

- Sits between Details and Linked event.
- Label `For · N` where N = selected kid count.
- Card with horizontal flex of `ForChip`s and a trailing `AddChip`
  (`+ Edit`).
- Each `ForChip` is a pill: `4px 10px 4px 4px`, radius 999,
  `member.color + '22'` bg, `0.5px solid member.color + '55'` border,
  18px avatar + "For {name}" label.

---

## Section B · Sheet shell (`SheetShell` + `SheetBackdrop`)

Every field-edit sheet and the overflow sheet uses this shell.

### Backdrop

`position: absolute; inset: 0; z-index: 10;`
`background: rgba(0,0,0,0.42); backdropFilter: blur(2px)`.

The underlying screen renders at 40% opacity behind the backdrop so the
sheet reads as modal but the user can see they're still in context.

### Sheet container

- Bottom-anchored, `borderTopLeftRadius: 20; borderTopRightRadius: 20`.
- `background: C.card`. `borderTop: 0.5px solid C.hair`.
- Shadow: `0 -8px 32px rgba(0,0,0,0.18)`.
- Height varies per sheet (460–580px range).
- Vertical flex: drag handle → title row → scrollable content → optional
  footer.

### Drag handle

36 × 4 px, `borderRadius: 2`, `background: C.inkFaint`. Centered at the
top with `paddingTop: 8`. Standard iOS sheet handle.

### Title row

`padding: 10px 16px 8px`; bottom border `0.5px solid C.hair`.

- Left: `title` (16 / 600 / -0.3) + optional `sub` (11.5 / inkMuted /
  lineHeight 1.4).
- Right: 28×28 round `C.inset` close button with an `X` icon (path
  `M1 1l8 8M9 1l-8 8`, strokeWidth 1.6, inkSec). Closes the sheet.

### Content

`flex: 1; overflowY: auto; padding: 12px 16px`. Anything in here scrolls
if it exceeds the sheet height.

### Footer

Optional. `padding: 10px 16px 28px` (extra bottom padding for home-bar
safe area). `borderTop: 0.5px solid C.hair`.

- Optional secondary chip on the left: `flex: 0 0 auto`, `inset`
  background, hair border, padding `11px 14px`, radius 10, 13/600 ink.
  Used for "Cancel", "Clear", "Unassign", etc.
- Primary chip on the right: `flex: 1`, accent bg, onAccent text, radius
  10, padding `12px 14px`, 14/600 centered. Text is dynamic — shows what
  will be saved (`Save · Tonight 21:00`, `Save · 2 selected`, etc.).

---

## Section C · Task overflow sheet (`TaskOverflowSheet`)

Triggered by the `•••` (more) PillBtn in the top bar of `TaskDetailV2`.

Height **540 px**. Title: task title (truncated). Subtitle: `Task actions`.
Footer: `Cancel` chip only (no primary action — the rows themselves are
the actions).

Content is **three grouped cards**, each an `inset` rounded-12 container
with hairline-separated rows. Each row uses `OverflowRow`:
32×32 left icon tile (`C.card` background, hair border, radius 8) + label
(14 / 600) + optional sub (11.5 / inkMuted) + trailing chevron (omitted
for destructive rows).

### Group 1 · Primary
| Row | Sub | Notes |
|---|---|---|
| Share task | Copy link · message · email | Opens iOS share sheet |
| Duplicate | Make a copy with all fields | New task with same notes/lists/priority/recurring rule reset to one-time |
| Convert to event | Promote to calendar with a time block | Removes task; creates event; preserves links to lists/children |
| Move to another list | Reassigns lists in one step | Quick wrapper around the `ListsSheet` for the common "wrong list" case |
| Pin to top of list | — | Sticky at the top of the parent list view |

### Group 2 · Secondary
| Row | Sub | Notes |
|---|---|---|
| Archive without completing | Hide from active views; keep in history | Not the same as Delete — useful for "we decided not to do this" |
| Export as PDF | — | For school/medical task lists people screenshot today |

### Group 3 · Destructive
Card has `border: 0.5px solid C.alert + '33'` (faint alert tint) to set it
apart visually.
| Row | Sub |
|---|---|
| Delete task | Removes for everyone · cannot be undone |

The destructive row's icon tile uses `C.alert + '14'` background. Label
and icon are in `C.alert`. No trailing chevron (tap = confirm-prompt).

---

## Section D · Field-edit sheets

All sheets follow the `SheetShell` pattern. Per-sheet details below.

### D.1 — `DueDateSheet`  (height 580)

**Trigger**: tapping the Details `Due` row.
**Primary**: `Save · Tonight 21:00`. **Secondary**: `Clear`.

Content sections (top to bottom):

1. **Quick presets** (mono caps label).
   2-column grid of 6 `DueChip`s:
   - `Today · 21:00` / sub `In 4 hours` — selected
   - `Tomorrow · 09:00`
   - `This weekend` / sub `Sat 10:00`
   - `Next week` / sub `Mon 09:00`
   - `No due date` (muted)
   - `Custom…` (muted) — opens a wheel picker (out of scope; system control)

   `DueChip`: `padding 10px 11px`, radius 10. Unselected = `inset` bg,
   hair border. Selected = `accent + '14'` bg, 1.2px accent border.

2. **Date · May 2026** (mono caps label).
   `MiniCalendar` — 7-col grid (`S M T W T F S`), 31 cells.
   Selected day (27): accent bg, onAccent text. Today (25): 1px accent
   border, accent text. Default: ink text. Mono 11, font-weight 500/600,
   padding `6px 0`, radius 6.

3. **Time** (mono caps label).
   Card with current time `21:00` in Geist Mono 28 / 600 / -1 on the left
   and 4 quick-pick chips on the right (`18:00 19:00 20:00 21:00`).
   Selected chip = accent bg + onAccent text. Tapping a chip updates the
   big readout instantly. Long-press opens a wheel picker.

### D.2 — `ReminderSheet`  (height 560)

**Trigger**: tapping the Details `Reminder` row.
**Primary**: `Save · 30 min before`. No secondary.

Content: single `inset` rounded-12 card with hairline-separated radio
rows. 8 options:

```
Off               No reminder
At due time       21:00
5 min before      20:55
15 min before     20:45
30 min before     20:30          ← selected
1 hour before     20:00
2 hours before    19:00
Custom…           Pick exact time
```

Each row: label (13.5 / 500) + sub (mono 11 / inkMuted). Trailing 20×20
radio bubble; selected = filled accent + white check; selected row also
has `accent + '0e'` row background.

### D.3 — `AssignSheet`  (height 500)

**Trigger**: tapping the Details `Assigned to` row.
**Primary**: `Save · Alex`. **Secondary**: `Unassign`.

Content sections:

1. **Person list** in a single card. Each row:
   - 32px CAvatar
   - Name (14 / 600) — append `(you)` for the current user
   - Mono 10.5 inkMuted sub showing `N active tasks · last active T`
     (or `External · K shared tasks` for external co-parents)
   - Trailing 22px round radio. Selected = accent fill + white check.

   Members in order: alex (you, selected) → riley → casey (external) →
   devon (external).

2. **Auto-assign hint card** — dashed hair border, `padding 10px 12px`.
   Left: 24×24 inset `?` bubble. Middle: 11.5 / inkSec body with bold
   "Auto-assign" lead-in: "based on who's with the kid at the due time".
   Right: a 36×22 toggle (off in the mock).

   When Auto-assign is on, the radio rows above grey out and the system
   picks the assignee at the due time based on custody state.

### D.4 — `PrioritySheet`  (height 460)

**Trigger**: tapping the Details `Priority` row.
**Primary**: `Save · High`. No secondary.

Content: single `inset` rounded-12 card. Each row has:
- 28×28 left tile with the priority's color (`color + '22'` bg,
  `0.5px solid color + '55'` border). Filled chevron flag icon for
  Low/Normal/High/Urgent; dashed circle for None.
- Label (13.5 / 600).
- Sub (11 / inkMuted) explaining what the level does.
- Trailing 20px radio.

Options:

| Label | Sub | Color |
|---|---|---|
| None   | No priority indicator   | `C.inkFaint` |
| Low    | Nice to have            | `C.devon` |
| Normal | Default                 | `C.alex` |
| High   | Surfaces above Normal   | `C.accent` ← selected |
| Urgent | Surfaces above everything | `C.alert` |

### D.5 — `RecurringSheet`  (height 560)

**Trigger**: tapping the Details `Recurring` row.
**Primary**: `Save · One-time`. No secondary.

Content: radio list, 7 options:

| Label | Sub |
|---|---|
| One-time | No repeat | ← selected |
| Daily | Every day |
| Weekdays | Mon–Fri |
| Weekly | Every Wed |
| **Bi-weekly** | **Every other Wed · matches custody** |
| Monthly | On the 27th |
| Custom… | Pick days, interval, end |

> The **Bi-weekly** preset surfaces a custody-aware default for separated
> households — pickup-day chores commonly follow custody cadence. Optional;
> drop the "matches custody" sub-label if scope is tight.

Sheet sub-text: "The new instance inherits notes, lists, and priority."

### D.6 — `ListsSheet`  (height 580)

**Trigger**: tapping any list chip OR the `+ Edit` chip in the `In lists`
SGroup.
**Primary**: `Save · 2 selected`. No secondary.

Content sections:

1. **Search field** — `inset` rounded-10, hair border, padding `9px 12px`.
   Left magnifying-glass SVG, mono 12 inkFaint placeholder
   `Search lists…`, trailing `+ NEW` chip (mono caps accent, `accent + '14'`
   background, radius 4) that opens a create-list inline form.

2. **Lists list** — `inset` rounded-12 card with hairline-separated rows.
   Each row: 22×22 left swatch tile (`color + '33'` bg, hair border, inner
   8px dot in `color`) + name (13.5 / 500) + mono `N tasks` sub + trailing
   20×20 **square** checkbox (radius 5). Selected = accent fill + white
   check; selected row has `accent + '0e'` row background.

   Sheet sub-text: "Tasks can live in multiple lists. Uncheck to remove."

### D.7 — `ChildrenSheet`  (height 500)

**Trigger**: tapping any kid chip OR the `+ Edit` chip in the `For · N`
SGroup.
**Primary**: `Save · Oliver`. No secondary.

Content: single `inset` rounded-12 card with hairline-separated rows.
Each row: 32px CAvatar + name (14 / 600) + mono 10.5 inkMuted meta showing
age, grade, and current custody week (`with Casey this week`).
Trailing 20×20 **square** checkbox (same shape as ListsSheet — multi-select).

Sheet sub-text: "External co-parents see the task only for kids they
share." This is an important access-control reminder for separated
families.

---

## Cross-cutting interaction rules

- **Sheet dismiss**: tap backdrop, swipe down on handle, or tap close X
  in title row.
- **Sheet save**: tap primary footer chip.
- **Sheet cancel**: equivalent to dismiss with no save — restores
  pre-edit value.
- **Sheet stack**: sheets are presented one at a time. Tapping a row in
  one sheet that needs another (e.g., `Custom…` in `DueDateSheet`)
  dismisses the parent first, then presents the child.
- **Save labels**: always reflect the pending value so users know what
  they're committing to (`Save · 2 selected`, `Save · Tonight 21:00`,
  `Save · High`). Defaults to plain `Save` if nothing is selectable.
- **No optimistic UI** for destructive actions — Delete from the overflow
  sheet shows a confirmation dialog.

---

## RN porting notes

- **Bottom sheets**: use `@gorhom/bottom-sheet` if not already a dep, or
  Expo Router's native modal stack (`presentation: 'formSheet'`). Snap
  points roughly match the heights listed above (460/500/540/560/580).
- **Backdrop**: `react-native-reanimated` opacity interpolation, or the
  built-in backdrop from `@gorhom/bottom-sheet`. The dimmed underlying
  task-detail screen is automatic with native modal presentation.
- **Inline title edit**: `TextInput` with `autoFocus={editing}`, blur on
  Done, save on submit. The blinking caret is just `TextInput`'s native
  cursor — don't recreate it.
- **MiniCalendar**: probably the same component as the existing
  date-picker on Custody screen. Don't reinvent.
- **Lists / Children multi-select**: state lives in the sheet; commit on
  Save. Optimistically update the chips in the parent screen so the user
  sees their changes immediately.
- **OverflowSheet**: an iOS `ActionSheet` is *almost* right but doesn't
  support sub-labels and grouped cards. Use the same `BottomSheet`
  primitive as the field sheets; just hide the footer and render
  three grouped action cards instead of a content area.
- **Convert to event**: this is a non-trivial server operation (create
  event, delete task, transfer associations). Build the endpoint first.
- **Removal of `/edit` route**: search for `router.push('/task/.../edit')`
  call sites and replace each with the appropriate sheet open. The
  `/edit` route file itself can be deleted.

---

## Design tokens

All tokens are from the active palette (`paletteMistForest` /
`paletteCharcoalForest`). Use the theme provider; do not hardcode hex
values except for the per-list chip colors (which come from the list
record itself, not the palette).

Identity colors used in sheets:
- Auto-assign hint: neutral inkSec
- Priority levels: see Section D.4 table
- ForChip background: derived from `member.color + '22'` (light) /
  `'33'` would be too strong on dark — keep `'22'`
- Lists swatch: each list has its own `color` field already in the
  database

Animation:
- Sheet enter: 280ms cubic-bezier(0.2, 0.9, 0.3, 1) translateY from 100%
- Sheet exit: 240ms cubic-bezier(0.4, 0, 0.6, 1) translateY to 100%
- Backdrop: opacity 0 → 0.42 in 280ms, reverse 240ms
- Blink (title caret): existing `@keyframes blink` — 1s steps(2) infinite

---

## Open questions for product

1. **`Auto-assign` toggle on AssignSheet** — needs a backend rule
   ("who's with the kid at the due time"). Confirm semantics for tasks
   without a `for` child set.
2. **`Convert to event`** — what happens to the existing task's history?
   Suggested: keep an `audit_log` entry on the new event pointing at the
   old task ID, and a tombstone in the task list rather than a hard
   delete.
3. **Custody-aware bi-weekly preset** — confirm copy: "matches custody"
   vs "matches your handoff days" vs "every other handoff".
4. **Per-chip remove on Lists / Children** — current spec is "tap chip
   to open multi-select sheet". A small × on each chip is also
   technically possible (you can see it in the mock's status pills) but
   we recommend against — the unchecking-in-sheet pattern is more
   consistent and avoids ambiguity.

---

## Files in this bundle

- `screens-task-edit.jsx` — **the new work**
- `screens-extra-3.jsx` — contains the old `TaskDetail` for diff reference
- `app.jsx` — design canvas wiring
- `OneNest - UI Explorations.html` — preview entry point
- All other `.jsx` files — supporting so the preview renders
