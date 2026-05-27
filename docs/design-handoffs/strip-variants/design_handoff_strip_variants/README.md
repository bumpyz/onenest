# Handoff — Custody strip variants (Caregiver + External co-parent)

## Overview

Two viewer-perspective variants of `CustodyStripToday` (the small daily
"who has the kids" strip on the Today screen):

- **Variant A · Caregiver viewer** (#397) — nannies, grandparents, etc.
  Observer framing. Read-only.
- **Variant B · External co-parent viewer** (#398) — parents outside the
  household who share custody of one or more kids in it. Per-kid POV.

Both reuse the visual vocabulary of the base strip — same card shell,
same 7-day bar, same color treatment, same countdown chip — but reshape
the labels, role badges, and (for B) the header anchor to fit the
viewer.

## About the design files

Design references in HTML/React, not production code. RN port to the
existing Expo Router codebase. Open
`OneNest - UI Explorations (standalone).html` to see the live mocks.

Sections in the canvas:
- `02.1 · Today — current design (with custody strip)` — base for diff
- `02.1.A · Custody strip — caregiver viewer (#397)` — 3 artboards
- `02.1.B · Custody strip — external co-parent (#398)` — 3 artboards

## Fidelity

**High-fidelity.** All copy, colors, spacing, role badges are final.

## File map

| File | What |
|---|---|
| `screens-custody-variants.jsx` | **The new work.** `CaregiverShowcase`, `CaregiverInContext`, `ExternalShowcase`, `ExternalInContext` plus the per-state mock components (`CaregiverStripA1Default…A5LongNames`, `ExternalStripB1Default…B5LongNames`) and shared primitives (`StripCard`, `StripTopRow`, `StripBottomRow`, `SevenDayBar`, `ViewingBadge`, `PatternChip`, `Countdown`, `KidStripDefault`, `ShowcaseLabel`). |
| `screens-custody.jsx` | Base `CustodyStripToday` (unchanged, ~line 589). |
| `direction-c-pro.jsx` | Palettes, `cMembers`, `CAvatar`, `CBottomNav`. |

---

## Variant A — Caregiver viewer (#397)

### Top label

Observer-stance verb. Kids stay out of the subject. Defaults to:

> **`Alex is on duty this week`**

Context-aware variants:
- Hand-off day: `Hand-off today`
- Countdown active + caregiver has prep tasks: `Brief Casey at pickup`
- Both parents present (overlap day): `Alex & Riley both on duty`

### Avatar treatment

Single parent avatar (the on-duty parent), unchanged from the base strip.
**No extra POV bug on the avatar** — adding a glyph would muddy the cMembers
visual vocabulary across the app. The POV signal lives in the `VIEWING`
badge instead.

When both parents are on duty (overlap day, ④ in the showcase), the
avatar becomes a 22px stack of both parents (8px overlap), same pattern
as `CStack`.

### Next-handoff line — passive framing

> **`Casey takes Oliver`** (not `Oliver → Casey`)

The caregiver isn't on either side of the arrow. Passive framing keeps
them out of it. Time formatting unchanged from the base strip
(`Wed 17:00` in mono ink-500).

### Read-only signaling — three things at once

1. **No chevron** on the right of the card.
2. **`VIEWING` mono caps badge** with eye glyph in the top-right of the
   top row, anchored to the right after the pattern chip. Visual is
   `C.inset` background, `0.5px C.hair` border, mono 9.5/700/0.4
   letter-spacing.
3. **Tap-to-detail opens a read-only sheet**, not the editor. Same
   information as the schedule viewer but no Pattern button, no
   "+ New override" FAB.

### Countdown chip — soft by default, alert when prep needed

| Caregiver state | Color |
|---|---|
| Default (`IN 1D`, `IN 3D`) | `C.inkSec` — soft, observer |
| Pickup imminent + open prep tasks | `C.alert` — they need to act |

Caregivers' urgency is about *prep tasks they own*, not the schedule.
The countdown number color follows that intent.

### Pattern chip

Same `ALT · WK 22` chip as the base strip. Pattern info is non-privileged
(caregivers should know which week it is); only editing is gated.

### Five states (in the showcase artboards)

| # | State | Note |
|---|---|---|
| ① | Default — Tue, Alex's week | Casey takes Oliver next on Wed |
| ② | Hand-off day — 5h out | Today bar shows AB split, warn marker |
| ③ | Countdown active — 25 min out | Top label flips to "Brief Casey at pickup", countdown turns alert |
| ④ | Both parents on duty — Friday overlap | Avatar stacks; AB split bar with accent marker |
| ⑤ | Overflow — long names | Single-line ellipsis; pattern chip + VIEWING badge stay |

---

## Variant B — External co-parent viewer (#398)

### Per-kid POV framing

The strip anchors to the **kid**, not the household's week. Top of the
card carries a mono caps line above the headline:

```
SOPH'S WEEK              ← mono caps 9.5/700/0.4 inkMuted
With Alex · comes to you Fri    ← 13/600/-0.2 ink
```

The kid avatar (22px) anchors the row on the left. No household identity
appears in the strip itself.

The headline copy reflects the kid's state:
- Currently with the in-household parent: `With Alex · comes to you Fri`
- Currently with the viewer: `With you · returns to Alex Wed`
- Today is hand-off: `Soph comes to you today`
- Countdown active: `Pickup at Lincoln Elementary`

### 7-day bar — yes, the existing shape works scoped to one kid

Same 7-day bar, same color treatment. The in-household parent's color
goes on the household side; the external co-parent's identity color
(`C.devon`) goes on the viewer side. The hand-off day shows the AB
split and a warn-tinted marker (matches base strip's marker treatment).

### Multi-kid handling — stacked strips

When the external co-parent shares 2+ kids with the household:
**two stacked strips**, one per kid, with `gap: 8px` between them.

Considered alternatives and rejected:
- **Per-kid tabs** at the top — hides information; user has to tap to discover
- **Single strip with per-kid sub-bars** — visually too dense, scale-fails
- **Toggle button** — same problem as tabs, plus extra interaction cost

Stacked is honest: each kid is its own custody question. Tested with 2 kids;
visually OK in a 402px viewport. 3+ shared kids would need an entry collapse
("View 1 more kid →") — flagged as a follow-up, not implemented in this pass.

### Identity in the next-handoff line

The in-household parent appears with their avatar. The viewer appears as a
**2nd-person actor**, not by avatar:

> **`You take Soph Fri 17:00`**

No `Alex → Devon` arrow. That arrow would falsely frame Devon as inside
the household's hand-off system. Devon is *not* on the household's
`parent_a / parent_b` axis — they're an external link via the child.

### Read-only + privacy

Same `VIEWING` badge as the caregiver variant. Plus three deliberate
absences:

- **No pattern chip** — the household's pattern config isn't theirs to see
- **No swap-request banner** — household-internal
- **No override path** — they can't create overrides on the household's schedule

When tapped, opens a read-only sheet scoped to just the kid's custody
state. No household weekly view, no other kids visible.

### Pairing-calendar overlap (orthogonal but visible)

OneNest supports paired external calendars (Google / Microsoft) for
busy-block visibility. The external co-parent variant intersects this
deliberately — when the external parent has a paired calendar, the
strip gets a small dashed-border row directly below the 7-day bar:

```
┌─────────────────────────────────────────────────┐
│ ▢▢ 2 busy blocks on your paired calendar this week │
└─────────────────────────────────────────────────┘
```

- `0.5px dashed C.inkFaint` border, transparent background
- Mono 9.5/inkMuted text
- Tiny dashed-square glyph on the left

Dashed signals "this is your data, not the household's." Visually
distinct so it doesn't conflate with the custody bars. Tap → opens the
paired calendar's busy-block list (existing surface).

### Five states (in the showcase artboards)

| # | State | Note |
|---|---|---|
| ① | Default — Soph is with Alex, comes Fri | `IN 3D`, soft |
| ② | Hand-off day — Soph comes today | Top label "Soph comes to you today"; AB split bar |
| ③ | Countdown active — pickup in 20 min | Top label "Pickup at Lincoln Elementary"; countdown alert |
| ④ | Multi-kid — Devon shares Soph + Mei | Two stacked strips, each with its own headline + bar |
| ⑤ | Overflow — long names + paired calendar | Single-line ellipsis; busy-block row shown |

---

## Top-bar context

Each in-context artboard shows the strip embedded in a Today-like page
to confirm it sits naturally in the surrounding layout:

- **Caregiver in-context** — top bar shows Nina with a `CARE` badge.
  Greeting: `Good morning, Nina.` Below the strip: a 3-row "Today ·
  assigned to you" card (the only kind of items a caregiver has on Today).
- **External in-context** — top bar shows Devon with an `EXT` badge.
  No household identity in the header — title reads `Your kids · LINKED`.
  Greeting: `Good morning, Devon.` Below the strip: an "Soph · upcoming"
  card with a privacy footer: `"You only see what's tagged for Soph.
  The household's other plans aren't shown."`

---

## RN porting notes

- **One component, three modes.** Suggested API:
  `<CustodyStripToday viewer="coparent" | "caregiver" | "external" childId?={id}>`.
  `childId` is required only for external mode.
- **Multi-kid external.** When the external co-parent has multiple
  shared kids, the parent component should render one strip per kid in
  a vertical stack with `gap: 8`.
- **VIEWING badge.** Suggest factoring out as `<RoleBadge kind="viewing"
  >` since the same chip pattern is reused elsewhere (Members screen,
  Family hub people row).
- **Color resolution.** External parent's identity color comes from the
  external-co-parent profile record on the household relationship —
  same color used in the existing `cMembers.devon` etc.
- **Tap targets.** Both variants are tappable like the base strip. They
  open a **role-scoped read-only schedule view**, not the editor. Suggest
  a new route `/custody/view` that branches by viewer role from a
  single resolver.
- **Hand-off day AB split.** The 7-day bar's split-color treatment is
  done with two absolutely-positioned half-rects + a 0.5px `C.bg`
  hairline divider down the middle. Reproducible in RN with
  `react-native-svg`'s `Rect` x-offsetting, or with two stacked Views.

---

## Open product questions

1. **Caregiver-on-handoff-day "Brief next parent" tasks.** The
   countdown turning alert when caregiver prep is pending assumes
   tasks exist for the caregiver to brief the next parent. Where do
   those tasks come from? Suggest: auto-generated from a small
   "default brief items" list on the household, or a per-event
   `requires_brief` flag.
2. **External co-parent with 3+ shared kids.** Where does the collapse
   point go? After 2? Render an inline "+ 1 more" link or a count
   pill? Not designed in this pass.
3. **Paired calendar — bi-directional or one-way?** Today the busy-
   block overlay is one-way: shows the external parent their own
   conflicts on the strip. Does the household also see the external
   parent's busy blocks via their own pairing? Probably yes, but the
   strip on the household side doesn't currently surface it.
4. **External co-parent's view of WEEKEND custody.** When the kid is
   with the external parent over the weekend (Sat–Sun), what does
   "next handoff" point to? Suggest: `Returns to Alex Mon 09:00` (the
   custody pattern's anchor); confirm with product.
5. **Caregiver overlap day framing.** When both parents are on duty
   on a single overlap day, is the caregiver's job "support both" or
   "stand down"? Copy currently says `Alex & Riley both on duty` —
   neutral, doesn't tell the caregiver what to do. Confirm whether
   that's right.

---

## Files in this bundle

- `OneNest - UI Explorations (standalone).html` — single self-contained HTML, ~2.4 MB. Opens offline.
- `OneNest - UI Explorations.html` — multi-file version
- `screens-custody-variants.jsx` — **the new work**
- `screens-custody.jsx` — base `CustodyStripToday` (unchanged), for reference
- `direction-c-pro.jsx`, `app.jsx` — supporting

See sibling folders for the related handoffs:
- `design_handoff_custody_surfaces/` — Today/Family Hub/Schedule/Pattern editor
- `design_handoff_calendar_conflicts/` — Calendar FAB rules + List inline-row + conflict access
- `design_handoff_event_responsible/` — Event kebab + multi-responsible model
- `design_handoff_creation_flows/` — Create task/list/contact/child/override
- `design_handoff_lists_v2/` — Lists tab with FAB + tappable list cards
- `design_handoff_fab_rule/` — formal FAB consistency rule
- `design_handoff_task_detail_v2/` — Task detail v2 + bottom-sheet edits
- `design_handoff_settings_subroutes/` — Settings sub-routes + 5-tab nav + Contacts
