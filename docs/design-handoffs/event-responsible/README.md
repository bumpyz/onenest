# Handoff — Event detail, kebab spec + multi-responsible model

## Overview

This handoff covers two related design moves on the **Event detail** surface:

1. **`EventOverflowSheet`** — the destination for the `•••` kebab in the
   Event detail top bar. Three or four grouped action cards depending on
   whether the event recurs. A separate one-off variant is included.

2. **Multi-responsible events** — the central modeling shift: an event can
   have multiple responsible adults, and **tagging IS the sharing
   primitive**. Anyone tagged on an event sees it across both their
   homes; anyone untagged sees only "Busy" in that time slot. This
   replaces the older single-`responsible_profile_id` model.

The bundle includes a **single-file standalone HTML** (`OneNest - UI
Explorations (standalone).html`) so engineering / product can review the
full canvas offline without setting up local hosting. Open it in any
browser by double-clicking.

## About the design files

These are **design references created in HTML/React** — prototypes showing
intended look and behavior, not production code to copy directly. The
OneNest app is React Native (Expo Router). The task is to recreate these
surfaces in the existing RN codebase using its established patterns
(`ThemedView`, `ThemedText`, `Pressable`, the `SGroup`/`SRow` helpers, etc.).

Open `OneNest - UI Explorations (standalone).html` or
`OneNest - UI Explorations.html` (the multi-file version, identical
content). The sections that matter for this handoff:

- `04.3 · Event — multi-responsible (birthday)`
- `04.4 · Event — Responsible picker (multi-select)`
- `04.5 · Event — ••• overflow sheet`

The original single-responsible Event detail is at `04.1 · Event detail`
and remains the spec for events with one responsible adult.

## Fidelity

**High-fidelity.** Colors, type, spacing, copy, mono labels — all final.
Identity colors map to `cMembers.alex.color`, `…riley.color`, etc.

---

## File map

| File | What's in it |
|---|---|
| `screens-event-edit.jsx` | **The new work.** `EventOverflowSheet` (recurring variant), `EventOverflowSheetOneOff` (non-recurring variant), `EventDetailMulti` (multi-responsible detail), `EventResponsibleSheet` (multi-select picker), plus `EOSRow`, `ResponsibleChip`, `AddPersonChip` helpers. |
| `screens-extra.jsx` | The original `EventDetail` (single-responsible) — kept as the spec for one-responsible events. Helpers `EDSectionLabel`, `EDRow`, `EDActivity`, `ChildChip`, `PillBtn`. |
| `screens-task-edit.jsx` | `SheetShell` + `SheetBackdrop` — reused by every sheet in this bundle. |
| `direction-c-pro.jsx` | Palettes, `cMembers`, `CAvatar`. |
| Other files | Supporting so the preview renders. |

---

## Part 1 · The kebab — `EventOverflowSheet`

### Why a kebab and not a Share pill

Earlier exploration considered a separate Share affordance in the top bar.
We landed on **kebab only** because sharing inside the household is
implicit — see Part 2. Sharing OUTSIDE the household (export `.ics`, copy
link) is available inside the overflow sheet under Actions.

### Top bar layout

```
[ ← back ]    EVENT (centered mono caps)    [ ••• ]
```

Both pills are 32×32, `C.card`, `0.5px solid C.hair`, radius 8. The kebab
is three horizontal dots in `C.ink`.

### Recurring variant — 4 grouped cards, height 620

Used when `event.recurrence_rule` is non-null. Has the recurrence group
at top.

**Group 1 · `THIS EVENT REPEATS`** *(only for recurring events)*
- **Edit only this occurrence** — "May 27 · won't affect future Wednesdays"
- **Edit all future occurrences** — "From May 27 onwards"
- **Skip this occurrence** — "Hide May 27 · series continues"

This is the question every user asks when editing a repeating event.
Surfacing it as an explicit branching choice — *before* the action — is
much clearer than burying it in a confirmation dialog after they tap
Edit. Cron-style ambiguity removed.

**Group 2 · `ACTIONS`**
- **Duplicate** — same time, who, lists
- **Copy to another day** — same time on a different date *("do this
  again next Tuesday" is a very common pattern)*
- **Convert to task** — drop the time block, keep details *(inverse of
  the task→event action in TaskOverflowSheet)*
- **Reassign across custody** — accent-tinted CTA, **only when there's a
  conflict**. Pre-computed suggestion: "Try moving to Riley to clear the
  conflict"
- **Export as `.ics`** — for sharing outside OneNest

**Group 3 · `VISIBILITY`**
- **Who can see this** — `Currently · Alex, Riley, Casey (busy time only)`
- **Mark as private** — `External co-parents see 'Busy', not the title`

> ⚠️ With the multi-responsible model in Part 2, "Mark as private" now
> means: invisible to *anyone not in the responsible list*. Update the
> sub-copy accordingly when implementing.

**Group 4 · destructive** *(alert-tinted card, `0.5px solid C.alert + '33'`)*
- **Delete this occurrence** — `May 27 only · series continues`
- **Delete entire series** — `All future Wednesdays · cannot be undone`

Two separate destructive options because conflating them is dangerous.
Each gets a confirmation dialog on tap.

### One-off variant — 3 grouped cards, height 500

`EventOverflowSheetOneOff`. Same shape minus the recurrence group;
destructive group has a single row `Delete event · Cannot be undone`.

### Row anatomy (`EOSRow`)

- 32×32 left tile, radius 8, `0.5px hair` border. Background:
  - `C.card` for neutral rows
  - `C.accent + '18'` for the accent action (Reassign)
  - `C.alert + '14'` for destructive rows
- Label 14 / 600 / -0.2 in `C.ink`, danger=alert, accent=accent
- Sub 11.5 / inkMuted / lineHeight 1.4
- Trailing chevron in `C.inkFaint`, **omitted on destructive rows**

### RN porting notes

- `react-native-bottom-sheet` or a presented modal stack with snap points
  (460 / 500 / 540 / 620).
- The accent-tinted "Reassign across custody" row is **conditionally
  rendered** — only when the calendar resolver returns a conflict for the
  responsible parent. Otherwise hide that row entirely.
- Confirmation dialogs on the two destructive rows. Use the existing
  destructive-confirmation pattern from `RemoveCaregiverSheet`.

---

## Part 2 · Multi-responsible model

### The central rule

> **Tagging = visibility.** Anyone tagged on an event as Responsible
> sees the full event across both their homes. Anyone NOT tagged sees
> only "Busy" in that time slot.

This rule **replaces** any separate "share with X" or "make visible to
Y" affordance. There is no such affordance because there doesn't need to
be one — adding/removing someone from the Responsible list IS the
sharing action.

### Why this matters

Old single-responsible model couldn't represent obvious cases:
- A child's birthday with both parents AND a co-parent all hosting
- A school event both parents attend
- A medical appointment where a caregiver brings the kid AND a parent
  joins remotely

Trying to express "share this event with these three people" via a
separate share dialog created ambiguity: was the responsible parent the
*owner*? Was the share read-only? What did "share" mean when both
parents are co-equal?

The fix: collapse Responsible + Visibility into one list. Three people
tagged = three people see the event = three people can edit. One "lead"
gets the primary push (chosen explicitly, default = first added).

### What this changes in the data model

Old:
```
events
  └─ responsible_profile_id   (single fk → profiles.id)
```

New (suggested schema, your call on column shape):
```
events
  └─ (no inline responsible)
events_responsible
  ├─ event_id
  ├─ profile_id
  ├─ is_lead         BOOL  (exactly one TRUE per event)
  └─ created_at
```

External co-parents and caregivers are valid `profile_id` values in
this table — same row shape, same semantics.

> ⚠️ **Migration**: existing rows with `responsible_profile_id` need to
> become a single-row `events_responsible` entry with `is_lead=true`.
> Behavior should be identical for those events.

### `EventDetailMulti` — the multi-responsible detail screen

Same skeleton as `EventDetail` but two changes:

1. **`SHARED · 3 HOMES` chip** in the header next to the time.
   - Background `C.accent + '18'`, text `C.accent`, mono 10 / 600,
     radius 999, padding `3px 9px`
   - Small "linked circles" SVG icon on the left
   - Only renders when `responsible_profiles.length > 1`. Always counts
     distinct **households**, not people — three people in two homes
     reads as `SHARED · 2 HOMES`.

2. **Responsible row becomes a chip rack.**
   - Mono label `Responsible` on the left, mono count `3 PEOPLE` on
     the right
   - Below: `ResponsibleChip` per person + an `AddPersonChip` (dashed
     `+ Add`)
   - Below that: an inline accent-tinted explanation card describing
     visibility in plain language. **Only render this card when
     `responsible_profiles.length > 1`** — single-responsible events
     don't need the disclaimer.

### `ResponsibleChip` anatomy

- Padding `4px 9px 4px 4px`, radius 999
- Background `member.color + '22'`, border `0.5px solid member.color + '55'`
- Left: 20px CAvatar
- Middle: name in 12.5 / 600 / -0.1 / `C.ink`
- Right (optional, mono 9 / 700 / uppercase / 0.3 letter-spacing, `C.card + 'AA'` background):
  - `LEAD` tag for the lead person
  - `EXT` tag for external co-parents
  - `CARE` tag for caregivers — recommend using `C.warn` color for this
    to match the existing caregiver visual language

### `EventResponsibleSheet` — the picker

Opens when the user taps the Responsible row or any chip in it.
`SheetShell` with title `Responsible`, subtitle "Anyone tagged here sees
the full event — title, location, notes, attached tasks." Height 620.

**Body, top to bottom:**

1. **Multi-select list** (square checkboxes, NOT radios). All household
   profiles + active external co-parents + active caregivers. Order:
   - Selected first
   - Then unselected co-parents
   - Then unselected externals
   - Then unselected caregivers
   - Within each band, alphabetical

   Each row shows:
   - 32px avatar (or initial bubble for caregivers without an avatar)
   - Name in 14 / 600
   - Role chips inline: `LEAD` / `EXT` / `CARE`
   - Mono 10.5 sub with context: "You · with the kids this week",
     "Co-parent · active 3h ago", "External · Soph's other parent",
     "Caregiver · weekdays · sees what's assigned"
   - Square checkbox on the right (radius 6, accent fill + white check when selected)
   - Selected rows tinted `C.accent + '0e'`

2. **Footer card — the rule, stated directly.**
   Dashed `0.5px C.hair` border, radius 10, padding `10px 12px`. Eye
   icon in `C.accent`. Bold lead-in `Tagging = visibility.` followed by
   plain-language explanation.

3. **Lead picker row.**
   Mono caps label `LEAD`. A `C.inset` card showing the current lead's
   avatar + name + sub "Gets the LEAD chip · receives the primary push
   when reminders fire". Trailing chevron opens a single-select picker
   scoped to currently-selected responsible profiles only.

**Footer:**
- Primary: `Save · N selected` (dynamic)
- Secondary: `Clear` (deselects everyone — confirm-on-tap because an
  event with no responsible adult is an edge case)

### Edge cases worth designing for

- **Selecting an external co-parent who doesn't share the child** —
  e.g. Devon (Soph's other parent) is tagged on a Mei event. Should be
  allowed (Devon might be picking everyone up) but **show a small
  warning chip on the row in the sheet** explaining that Devon will
  see this Mei event despite normally not being able to. Not designed
  in this pass.

- **Removing the last responsible person** — disallow at save time.
  The Clear button needs a confirmation dialog and replaces clear-all
  with "Hand off to…" picker.

- **Removing yourself when you're the only one** — also disallowed.

- **Reassigning lead** — straightforward. Pushing the LEAD chip to a
  person not currently selected should auto-select them.

### Knock-on changes (NOT in this handoff)

These are implications of the multi-responsible model that need their
own design pass:

1. **`EventCreate` form** — the Responsible picker there is currently
   single-select. Needs to become multi-select with the same lead
   semantics.
2. **Event list row rendering** — should show 1-3 stacked avatars
   (`CStack`) for multi-responsible events instead of a single avatar.
3. **Push notification copy** — only LEAD gets the primary push; other
   responsible parents get a secondary "FYI Alex is doing X" push. UX
   copy for this push category needs review.
4. **Calendar conflict resolver** — must treat multi-responsible events
   as conflicting for EACH responsible parent independently. A birthday
   tagged on Alex + Riley conflicts with Alex's other Wednesday events
   AND Riley's other Wednesday events.
5. **The Backup field** (currently `EDRow` on the single-responsible
   detail) — does it still make sense when there are 3 responsible
   adults? Probably becomes a per-event "if no one shows up, fall back
   to…" or is dropped entirely. Punt on this — needs product input.

---

## Cross-cutting design tokens

Same palette as the previous handoffs. New uses in this bundle:

- `C.accent + '18'` — SHARED chip background; explanation banner background
- `C.accent + '10'` — softer accent banner (responsible explanation card)
- `C.warn + '18'` — CARE tag background
- `C.alert + '14'` — destructive icon tile background
- `C.alert + '33'` — destructive group card border

---

## Open product questions

1. **Schema migration plan for `responsible_profile_id` → `events_responsible`.**
   Backfill strategy + rollback path. Has implications for any analytics
   queries currently joining on `responsible_profile_id`.
2. **Caregiver role in Responsible list.** Confirm caregivers ARE allowed
   to be tagged responsible (the mock shows this is allowed). If yes,
   does their visibility scope change while they're responsible — full
   event details or just the time block?
3. **Notification preferences interaction.** Today notifications are
   filtered by household visibility. With multi-responsible events
   crossing households, the resolution rule for *which* parent's
   notification preferences apply needs to be specified.
4. **Audit trail.** The History section already shows who-did-what,
   but should we also log who *was* and *is no longer* responsible? The
   delta is high-value for separated families.

---

## Files in this bundle

- `OneNest - UI Explorations (standalone).html` — **single self-contained
  HTML, open in any browser.** 2.3 MB. No network access needed once
  loaded.
- `OneNest - UI Explorations.html` — multi-file version (loads the JSX
  files alongside it).
- `screens-event-edit.jsx` — **the new work**
- `screens-extra.jsx` — original `EventDetail`, helpers
- `screens-task-edit.jsx` — `SheetShell` + `SheetBackdrop` primitives
- `direction-c-pro.jsx` — palettes, `cMembers`, `CAvatar`, `CStack`
- All other files — supporting so the preview renders

See sibling folders for the previous handoffs in this work stream:
- `design_handoff_settings_subroutes/` — Settings sub-routes + 5-tab nav + Contacts
- `design_handoff_task_detail_v2/` — Task detail v2 + bottom-sheet edits
- `design_handoff_custody_surfaces/` — Today/Family Hub/CustodySchedule/Pattern editor
