# Handoff — Creation flows (Task · List · Contact · Add child · Custody override)

## Overview

This handoff defines the **shared scaffold** for all creation flows in
OneNest and ships **four new screens** that follow it:

| Route | Screen | Mock id |
|---|---|---|
| `/task/new`     | `CreateTask`           | 05.7 in the canvas |
| `/list/new`     | `CreateList`           | 05.8 |
| `/contact/new`  | `CreateContact`        | 08.3 |
| `/child/new`    | `AddChild`             | 07.2 |
| `/custody/new`  | `NewOverride` (existing) | 06.3 |
| `/event/new`    | `EventCreate` (existing — the canonical reference) | 04.2 |

All six follow one scaffold. Engineers should think of this as **one
component pattern with six instances**, not six separate one-offs. The
common helpers (`FormSectionLabel`, `FormGroup`, `FormRow`, `FormSwitch`,
`ParentChip`, `AnyoneChip`) already live in `screens-extra-2.jsx`
alongside `EventCreate`; the new flows reuse them verbatim plus a few
small primitives in `screens-creation.jsx`:

- `CreateTopBar` — Cancel / centered title / Save pill with disabled state
- `TitleInput` — accent-underlined input with blinking caret
- `AIHelper` — soft accent banner with sparkle + example string
- `ColorSwatch` — 36×36 rounded swatch with white-check selected state
- `SegRow` — iOS-style segmented control inside a `C.inset` shell
- `DashedAddChip` — the `+ Pick lists` / `+ Add allergy` affordance
- `ListTagChip`, `HealthChip`, `TmplRow`, `CIRow` — flow-specific helpers

## About the design files

These are **design references created in HTML/React** — prototypes showing
intended look and behavior, not production code to copy directly. The
OneNest app is React Native (Expo Router). The task is to recreate these
surfaces in the existing RN codebase using its established patterns
(`ThemedView`, `ThemedText`, `Pressable`, `react-native-svg`, etc.).

Open `OneNest - UI Explorations (standalone).html` (single self-contained
file, ~2.3 MB, works offline) in any browser. The canvas sections you
want are 04.2, 05.7, 05.8, 06.3, 07.2, 08.3 — each with both light
(P3 Mist Forest) and dark (P4-F Charcoal Forest) artboards.

## Fidelity

**High-fidelity.** Colors, type, spacing, copy, mono labels — all final.

---

## The shared scaffold

Every create flow obeys nine rules. Implementing the scaffold as a
shared component (`<CreateFlowScreen title saveLabel onSave>`) is
strongly recommended over copy-paste.

### 1 · Sticky top bar

Position: `top: 54px` (below status bar), full-width, height ~40.

Three zones:

```
[ Cancel ]            New <kind>            [ Save ]
   14/500/inkSec    14/600/ink/-0.2    12.5/600 pill
```

- Pill background: `C.accent` when valid, `C.inset` + `0.5px C.hair` border
  when disabled
- Pill text color: `C.onAccent` when active, `C.inkMuted` when disabled
- 0.5px hairline bottom; 12px backdrop-blur over `C.bg + 'F0'`

**No bottom save bar** for creates. The only exception is `NewOverride`,
which adds a sticky bottom summary because the action has cross-household
side-effects worth surfacing at the moment of commit.

### 2 · Title input — first field, always

- Mono caps label (`TITLE`, `NAME`, `LIST NAME`) at 10 / 0.4 letter-spacing
- Value at 22 / 600 / -0.7
- 1.5px solid `C.accent` underline (NOT a full-box input)
- 1.5×22 blinking caret immediately after the text
  (`@keyframes blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }`)
- `padding: 14px 20px 6px`

This pattern signals "you can just type" without form-box clutter, and
makes the title visually dominant — the most important thing in any
create flow is naming the thing.

### 3 · AI parse helper — below the title where it applies

Soft `C.accent + '12'` background, `C.accent + '33'` border, padding
`10px 12px`, radius 10. Sparkle glyph + bold-ish line + mono example.

Shipped on **Task**, **Event**, **Contact**. **Skipped** on List and
Add child because there's nothing meaningful to parse from a phrase.

Example strings (from the mocks):
- Task: `"pack soph friday 6pm doctor" → due, kid, list pre-filled`
- Event: `"soccer mei wed 4pm lincoln park" → all fields filled`
- Contact: `paste a vCard / contact card → phone + email pre-filled`

### 4 · Section labels — outside the cards

Mono caps 11 / 600 / 0.4 letter-spacing in `C.inkSec`, padded
`6px 24px`. They sit **outside** the form group cards (iOS Settings
idiom), not inside them. Examples: `When`, `Who`, `In lists`, `Color`,
`Health`, `Notes`.

### 5 · Form group cards

- `C.card` background, `borderRadius: 12`, `0.5px solid C.hair`
- Hairline-separated rows (`0.5px solid C.hair`)
- Field values are mono and right-aligned
- Trailing chevron means "opens a picker"
- `FormSwitch` for booleans

### 6 · Selection chips

Inside cards, in a `padding: 12px 14px` block with a mono caps mini-label
above (e.g. `KIDS · PICK AT LEAST ONE`). Wrap with `gap: 6`.

| Chip | Use |
|---|---|
| `ParentChip` | Members & kids — tinted with `member.color`, white-check when selected |
| `ListTagChip` | List membership — colored dot + label |
| `HealthChip` | Allergies/medical — adds optional `SEVERE` severity badge in the same color |
| `DashedAddChip` | The catch-all "+ Add" affordance |
| `AnyoneChip` | The catch-all "Anyone" assignment chip |

### 7 · Visibility = belongs-to

The core privacy rule, applied uniformly:

> **Tagging a kid drives who sees the thing.** Anyone who can see the
> tagged kid can see the contact / list / task / event. External
> co-parents only see entities tagged for kids they share.

Every create flow that touches kids surfaces an inline
`C.accent + '10'` explanation card stating the rule in plain language.

Already locked in for Events (multi-responsible) — same model extends
here. Don't duplicate this as a separate "share with…" picker
anywhere in the app.

### 8 · Smart-suggestion card — at the bottom where useful

Pattern: dashed `C.accent + '66'` border, radius 12, padding `12px 14px`,
sparkle glyph on the left, copy + two CButtons on the right
(`Yes, automate` primary + `Not now` neutral).

Shipped on:
- **Create task** → "Attach to Wed's hand-off?"
- **Create list** → "Auto-attach to Soccer Practice each week?"
- **Create event** → "We noticed soccer happens every Tuesday"

Not shipped on Contact, AddChild, NewOverride — these don't have an
obvious automation worth proposing inline.

### 9 · Validation gate

Save is disabled (pill greys out) when required fields are empty. Each
screen's required set:

| Screen | Required fields |
|---|---|
| Create task | Title |
| Create event | Title · Starts · Ends |
| Create list | Title |
| Create contact | Name · Belongs to (≥1 kid) |
| Add child | Name · Lives with (≥1 adult) |
| New override | Affects (≥1 kid) · With whom · Date range |

When disabled, the pill renders `C.inset` background with `0.5px C.hair`
border and inkMuted text. When valid, full `C.accent` + `C.onAccent`.

---

## Per-screen specs

### CreateTask · 05.7

**Sections, top to bottom:**

1. **Title** — `"Pack Theo's overnight bag"`
2. **AI helper** — `"pack soph friday 6pm doctor" → due, kid, list pre-filled`
3. **When** — Due (alert color if today), Reminder, Repeats (each chevron)
4. **Who** — Assigned to (single-select chip row + Anyone) + For (multi-select kid chips, inside the same card with a hairline separator)
5. **In lists** — `ListTagChip` row, multi-select, `+ Pick lists` dashed chip → opens `ListsSheet`
6. **Priority** — 5-level `SegRow` (None · Low · Normal · High · Urgent), NOT a chevron picker — priority is atomic and frequent enough to deserve inline
7. **Notes** — multiline `C.card` textarea, min-height 80px
8. **Smart suggestion** — "Attach to Wed's hand-off?" with Attach / Not now

**Sticky bar:** no.

**Defaults:**
- Assigned to = current user
- For = currently-selected kid context (if there is one — e.g., user came from a kid's detail screen)
- Due = no default (must be set manually); reminder defaults to None
- Lists = inherits from the "create from" context if any

### CreateList · 05.8

**Sections, top to bottom:**

1. **Title** — `"Soccer prep"`
2. *No AI helper* — nothing meaningful to parse
3. **Kind** — 4-segment `SegRow`: Tasks · Grocery · Shopping · Packing.
   This is the most consequential field; it determines whether list
   items have qty + store (Grocery), where-it's-going (Packing), or
   neither (Tasks). Below the segmented: 11/inkMuted explainer.
4. **Color** — 8 swatches mapped to the identity palette, plus an Icon
   row below with a chevron
5. **For** — Multi-select kid chips with explainer:
   `"New tasks added to this list will default to 'For Mei'."` Important
   — choosing kids here sets a downstream default, doesn't restrict
   what can be added
6. **Shared with** — Multi-select member chips + `+ Caregiver` dashed
   chip. Inline `C.accent + '10'` banner explains the visibility rule
7. **Start from** — Template radio rows:
   - **Blank list** (selected by default)
   - **Soccer prep** — 6 typical items · `POPULAR` badge
   - **School morning** — 9 typical items
   - **Custom paste** — paste a list, we'll split it into items
8. **Smart suggestion** — "Auto-attach to Soccer Practice each week?"
   with Yes, automate / Not now

**Sticky bar:** no.

**Defaults:**
- Kind = Tasks
- Color = randomized from the identity palette, biased toward unused colors
- For = empty (list isn't tied to a kid by default)
- Shared with = current user + co-parent

### CreateContact · 08.3

**Sections, top to bottom:**

1. **Name** — `"Mrs. Anderson"`
2. **AI helper** — vCard paste hint
3. **Type** — 5-segment `SegRow`: Medical · School · Activity · Family · Other.
   Selected: Activity. Below: chevron row for Sub-type (`Piano teacher`).
   The Sub-type pre-populates downstream fields (Medical types prompt
   for insurance, School types prompt for grade-level)
4. **Belongs to** — `KIDS · PICK AT LEAST ONE` mini-label, multi-select
   kid chips. Inline explainer:
   `"Only people who can see Soph will see this contact."` This is THE
   visibility rule — required field
5. **Contact info** — `CIRow` rows with left glyph (phone/mail/map), mono
   right-aligned value, mono caps right-aligned label. Three rows:
   Phone, Email, Address
6. **Linked event** — Optional. Shows a colored-bar preview of the
   recurring event the contact relates to (e.g., Soph's piano lesson).
   Carries a mono `LINKED` chip. Tap chevron row below to pick/unpick
7. **Quick flags** — `FormSwitch` rows: `Pin to top`, `Emergency contact`
8. **Notes** — textarea

**Sticky bar:** no.

**Defaults:**
- Type = Activity (most common new-contact type per existing usage data)
- Belongs to = empty (must pick) — Save disabled until set
- Linked event = empty

### AddChild · 07.2

The most consequential creation flow in the app. Adding a child
materially changes how the household is structured (custody, visibility,
allergies that propagate to caregivers, etc).

**Sections, top to bottom:**

1. **Avatar preview hero** — 80×80 round avatar in the selected color
   with a single initial centered. Halo ring shadow:
   `0 0 0 4px C.bg, 0 0 0 5px <color>·44, 0 6px 24px <color>·33`
   (light mode; dark drops the outer shadow). Pencil bug in the
   bottom-right corner. Caption below: `"Tap to upload photo"` in mono
   inkMuted
2. **Name** — `"Theo"`
3. **Basics** — Birthday (with computed `· 8 yrs` mono suffix), Pronouns,
   Nickname — each chevron rows
4. **Color** — 8 swatches. The selected color is what appears on Theo's
   events, tasks, and chips everywhere. Inline footer explains this
5. **Who Theo lives with** — Multi-select adult chips. This is the
   single most important field on the screen.
   - Selecting Alex + Riley alone → child is single-household
   - Selecting an external co-parent → **shared custody is enabled**
     for this child
   - Inline explainer with `Learn more →` link
   - Below: `Follows main pattern` toggle — when on, Theo inherits the
     household's custody pattern. When off, the field opens a per-child
     pattern picker (separate flow, see "Per-child override depth" in
     the custody handoff)
6. **School** — School name, Grade, Teacher — chevron rows. Each opens
   a picker / typeahead
7. **Health** — Inline allergy chips with `SEVERE` badge for Anaphylactic
   risks (red `HealthChip`); medications row (chevron); Pediatrician
   row that explicitly says `+ Pick from contacts` in accent — links to
   the Contacts surface so the data lives in one place
8. **Visibility** — Caregivers see (`Assigned only` / `Everything` /
   `Custom`); External co-parents see (auto-determined from custody, shown
   as `Not applicable` when no external co-parent)

**Sticky bar:** no.

**Defaults:**
- Color = randomized from unused identity colors
- Pronouns = empty (no default — never assume)
- Lives with = the current user only; co-parent must be tapped on
- Follows main pattern = on
- Caregivers see = `Assigned only`

### NewOverride (Custody override dialog) · 06.3

Specified in detail in the prior handoff (`design_handoff_custody_surfaces`).
Two notes specific to this spec:

- It's the **only** creation flow with a sticky bottom save bar. The
  bar shows a one-line summary ("Alex takes all 4 kids · Jun 7–8") and
  flips its CTA between `Save override` (no external co-parents
  involved) and `Send for approval` (external co-parent affected). The
  bottom bar is justified here because:
  1. Events get reassigned at save time (side-effect on the
     calendar that the user should see-and-confirm)
  2. The summary line is the only place the full intent is stated in
     plain English
- It's the **only** creation flow that auto-renders an external-
  approval warning card. None of the other creates touch co-parent
  approval surfaces.

---

## Cross-cutting consistency rules

These shouldn't drift between flows. If you find yourself adding
something new, please add it to ALL relevant flows:

| Rule | Where it applies |
|---|---|
| Title field is always first, accent-underlined, with caret | All 6 |
| Mono caps labels for sections, outside cards | All 6 |
| Member-tinted `ParentChip` for any person-pick | All 6 |
| `+ Add`/`+ Pick…` chips are dashed, mono, inkMuted | Task · Contact · List · AddChild |
| Visibility explainer card uses `C.accent + '10'` background | Contact · List · AddChild (anywhere tagging-as-visibility applies) |
| Smart-suggestion card uses dashed `C.accent + '66'` border | Task · List · Event |
| Save disabled = inset pill + inkMuted text | All 6 |
| Field separator inside cards = `0.5px solid C.hair` | All 6 |
| All sticky top bars use `C.bg + 'F0'` + 12px backdrop-blur | All 6 |

---

## RN porting notes

- **Top bar.** Build as a shared `<CreateFlowHeader title saveDisabled
  onSave onCancel>` component. Use Expo Router's modal presentation
  (`presentation: 'modal'`) so the back gesture matches iOS expectation.
- **Title input.** `TextInput` with a single bottom border styled to
  the accent color. Use `selectionColor` to make the native iOS cursor
  match `C.accent`. No need to recreate the blinking-caret animation —
  iOS does it natively.
- **Form group cards + FormRow.** These already exist in
  `src/app/settings/household.tsx` as `SGroup`/`SRow` — reuse those.
- **SegRow.** `react-native-segmented-control` ships an iOS-flavored
  component that matches the visual; or build inline with `Pressable`
  + the `boxShadow` lift on selected.
- **ParentChip / ListTagChip.** Already in use elsewhere in the app —
  ensure these are factored into shared components.
- **Avatar preview hero (AddChild).** The halo shadow is a single
  `box-shadow` in CSS; in RN use `react-native-shadow-2` or layer two
  views (one for the inner halo, one for the outer drop).
- **AI parse helper.** The "parse a phrase" action wires to the existing
  AI parse endpoint used by the Today screen's command bar. Pre-fill
  result should populate ALL relevant fields, with mono `auto` chips
  next to each populated field for ~3s so the user knows what came
  from the parse (suggested polish — not in the static mocks).

---

## Open product questions

1. **Persisting in-progress drafts.** Should a partially-filled create
   flow persist if the user dismisses? Recommendation: yes for
   Task/List/Event (drafts saved silently, restored on next open); no
   for AddChild/CreateContact (too high-stakes — confirm discard).
2. **AddChild · Pediatrician picker.** Linking to Contacts is the right
   move, but what happens at Add-child time when the household has no
   contacts yet? Suggest: `+ Create one` accent chip in-line that opens
   a stripped `CreateContact` modal on top.
3. **NewOverride · `Just swapping` kind.** Confirm copy. We deliberately
   added this neutral category so parents don't feel forced to justify
   routine swaps.
4. **CreateContact · Linked event.** Today the link is one-direction
   (contact → event). Should the event also display the contact in its
   own detail screen? Recommendation: yes — add a Linked contact section
   to EventDetail, scoped to non-personal events.
5. **AddChild · "Lives with" multi-select.** If both biological
   parents are in the household (no separation), the field still
   technically requires selecting both. Should we infer this from
   household membership? Recommendation: pre-check all household
   adults by default; user can deselect to override.

---

## Files in this bundle

- `OneNest - UI Explorations (standalone).html` — **single self-contained
  HTML, ~2.3 MB.** Open in any browser. Works offline.
- `OneNest - UI Explorations.html` — multi-file version
- `screens-creation.jsx` — **the new work** (CreateTask, CreateList,
  CreateContact, AddChild + helpers)
- `screens-extra-2.jsx` — `EventCreate` (the canonical reference) and
  the shared `FormSectionLabel`, `FormGroup`, `FormRow`, `FormSwitch`,
  `ParentChip`, `AnyoneChip`
- `screens-custody.jsx` — `NewOverride` (the existing custody-override
  dialog)
- `direction-c-pro.jsx` — palettes, `cMembers`, `CAvatar`
- All other files — supporting so the preview renders

See sibling folders for the other handoffs in this work stream:
- `design_handoff_settings_subroutes/` — Settings sub-routes + 5-tab nav + Contacts tab
- `design_handoff_task_detail_v2/` — Task detail v2 + bottom-sheet edits
- `design_handoff_custody_surfaces/` — Today/Family Hub/Schedule/Pattern editor
- `design_handoff_event_responsible/` — Event kebab + multi-responsible model
