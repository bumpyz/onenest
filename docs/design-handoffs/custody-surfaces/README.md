# Handoff — Custody surfaces + Today/Family Hub promotion

## Overview

This handoff covers a focused promotion of **custody schedule** from being
buried in Settings → Household to being a primary surface across the app.
Four changes ship together:

1. **Today (Home tab)** gains a compact **custody status strip** between the
   AI command bar and the conflict card — single tap-target with current
   parent + next handoff. Hides for single-household families.
2. **Family Hub** promotes the custody schedule to its **top-level hero
   card** with an explicit `OPEN SCHEDULE →` CTA, plus an inline pending-swap
   nudge when a co-parent has requested a change. The Custody schedule row
   is removed from the Manage section (it was redundant).
3. **CustodyScheduleV2** — the viewer keeps its calendar layout but exposes
   the pattern editor via an explicit `PATTERN ⚙` button in the top-right.
   A footer hint explains the distinction between **Pattern** (rule edits)
   and **long-press a day** (one-off swaps).
4. **CustodyPatternEditor** — a new focused screen, reached **only** from
   the viewer's Pattern button. **Replaces the old `/settings/custody`
   route entirely.** Pattern type · hand-off day/time · anchor · per-child
   overrides · behavior toggles · live 2-week preview · "events will be
   reassigned" impact warning before save.

This bundle is a **continuation** of the previous handoff at
`design_handoff_settings_subroutes/` (Settings sub-routes + 5-tab bottom
nav + Contacts as a top-level tab). The two read together as the full
recent design pass.

## About the design files

These are **design references created in HTML/React** — prototypes showing
intended look and behavior, not production code to copy directly. The
OneNest app is React Native (Expo Router), so the task is to recreate
these surfaces in the existing RN codebase using its established patterns
(`ThemedView`, `ThemedText`, `Pressable`, the `SGroup` / `SRow` helpers
in `src/app/settings/household.tsx`, etc.).

Open `OneNest - UI Explorations.html` in a browser to see the live mocks.
The sections you care about are:

- `02.1 · Today — current design (with custody strip)`
- `06.1 · Custody — schedule viewer (current)`
- `06.2 · Custody — pattern editor`
- `06.3 · Custody — hand-off day` (carried over, unchanged)
- `07.1 · Family Hub — current design (custody promoted)`

Each shows P3 Mist Forest (light) and P4-F Charcoal Forest (dark) variants.

## Fidelity

**High-fidelity.** Colors, type, spacing, copy, mono labels are all final.
Identity colors map directly to existing member colors (`C.alex`,
`C.riley`, …).

---

## File map (in this bundle)

| File | What's in it |
|---|---|
| `screens-custody.jsx` | **The main new work.** `CustodyStripToday` (the Today strip), `ProHomeV2` (Today with strip integrated), `FamilyHubV2` (custody promoted to hero), `CustodyScheduleV2` (viewer with Pattern button), `CustodyPatternEditor` (the new focused editor), plus `PatternOption` and `KidPatternRow` helpers. |
| `screens-settings.jsx` | The `Sub*` primitives (`SubTopBar`, `SubGroup`, `SubRow`, `SubToggle`, `MonoRight`) used by the pattern editor — also covered in the previous handoff. |
| `screens-extra.jsx` | `FamilyHub` (original, kept for diff reference), `CustodySchedule` (original), `HandoffDay`, plus shared helpers (`PersonRow`, `KidCard`, `NavRow`, `EDActivity`, `LegendDot`, `HandoffRow`, `OverrideRow`). |
| `direction-c-pro.jsx` | Palettes, `cMembers` proxy, `CAvatar`, `CStack`, `CBottomNav` (5 tabs incl. Contacts), `ProHome` (the un-modified Home, for reference). |
| `app.jsx`, `ios-frame.jsx`, `design-canvas.jsx`, `screens-extra-2…5.jsx` | Supporting files so the preview renders. |

---

## Change 1 · Today — custody status strip

**Component**: `CustodyStripToday` in `screens-custody.jsx`.
Integrated by `ProHomeV2` between the AI command bar and the conflict card.

### Where it sits in the layout

```
Header
Date + greeting
AI command bar
─── Custody strip  ←  new
Conflict card (if any)
Timeline
Tomorrow preview
```

### Structure

Outer card: `C.card` background, `borderRadius: 12`, `0.5px solid C.hair`,
`overflow: hidden`, soft shadow `0 1px 0 rgba(14,14,16,0.02)`. Two
horizontal hairline-separated rows.

**Top row** (`padding: 11px 14px 10px`):
- 22px CAvatar of the current parent (Alex)
- Bold ink label: `You have the kids` (13 / 600 / -0.2)
- Spacer
- Mono caps chip on the right: `ALT · WK 22` (10px / 600 / 0.3 / uppercase, `inkMuted`)
- Right chevron in `inkFaint`

**Bottom row** (`padding: 10px 14px 12px`):
- 7-day mini bar — same color treatment as the Family Hub hero (top border
  in solid color, body in color + alpha). Today is index 1 (Tue), marked by
  a 5×5 dark dot **above** the strip (centered on the column) so it doesn't
  fight with the color bar itself. Today's day label below is `C.ink` /
  weight 700.
- Below the bar: 14px CAvatar of the next-handoff recipient (Casey) +
  `Next · Wed 17:00 · Oliver → Casey` (12 / inkSec, time in mono / ink),
  spacer, mono `IN 1D` countdown (10 / accent / 600).

### When to hide

The whole strip should hide if the household isn't using a custody pattern
(`custody_pattern` is null/disabled in the household record). Single-home
families shouldn't see custody UI at all. Caregivers/external co-parents
should see a read-only variant (no chevron, label changes to `Alex has the
kids` instead of `You have…`).

### RN porting notes

- Container is a `Pressable` → `router.push('/custody/schedule')`.
- Wire `currentParentId`, `nextHandoff`, `weekDays`, `weekNumber` from
  the same custody-resolver that powers the calendar.
- The countdown is computed live — show `IN 2H`, `IN 1D`, `IN 6D`, etc.
- The week-number chip (`WK 22`) is optional; it's there to give context for
  parents who track which week of the alternation they're in.

---

## Change 2 · Family Hub — custody as hero

**Component**: `FamilyHubV2` in `screens-custody.jsx`.

### Layout change

**Before** (`FamilyHub` in `screens-extra.jsx`):
- Header
- Custody mini-hero card (no obvious tap-target)
- People · 4
- Kids · 4
- Manage section: **Custody schedule** · Connected calendars · Settings
- Recent activity

**After** (`FamilyHubV2`):
- Header
- Mono caps section label `CUSTODY SCHEDULE`
- Custody hero card — same 7-day visualization + next-handoff line, but
  with:
  - 18px Alex avatar + `THIS WEEK` mono caps label at the top (clearer
    who owns the current week)
  - Explicit `OPEN SCHEDULE →` chip (mono caps, accent) where the timid
    `VIEW →` used to be
  - **New** inline pending-swap banner inside the card when there's a
    swap request (warn-color band, `Devon requested a swap · Jun 8–9`,
    mono `REVIEW` chip on the right)
- People · 4
- Kids · 4
- Manage section: Connected calendars · Settings (Custody row **removed**)
- Recent activity

### Why the row is removed

The custody hero IS the entry point to the schedule. Keeping a row under
Manage that opens the same screen creates two affordances for one action.
The hero handles it.

### RN porting notes

- The hero card is a `Pressable` → `router.push('/custody/schedule')`.
- The pending-swap banner is conditionally rendered — only when
  `household.pending_swap_requests.length > 0`. Tapping `REVIEW` opens the
  schedule viewer scrolled to the Pending section (or a dedicated swap
  detail screen if you have one).
- The `THIS WEEK` label should show the current parent's avatar always —
  if it's a 50/50 split week, fall back to showing both avatars in a stack.

---

## Change 3 · CustodyScheduleV2 — Pattern button in top bar

**Component**: `CustodyScheduleV2` in `screens-custody.jsx`.

### Top bar — three-zone layout

```
[ ← back ]    CUSTODY (centered mono label)    [ ⚙ Pattern ]
```

- **Left**: back chevron, 32×32, `C.card`, `0.5px` hair border
- **Center**: `CUSTODY` mono caps (10px / 0.4 letter-spacing / inkMuted)
- **Right**: explicit **text button** `Pattern` with a small gear glyph.
  Height 32, `padding: 0 10px`, `radius: 8`, `C.card` background, hair
  border. The gear is at 40% opacity behind the text so the **word**
  carries the affordance.

### Why "Pattern" as text, not just a gear

Non-technical co-parents don't read a bare gear icon as "edit the rules of
who gets the kids when" — they read it as "settings, probably notifications."
The explicit word is the affordance; the gear is decoration.

### Subtitle change

Above-the-fold subtitle now reads:

```
PATTERN · ALTERNATING WEEKS · HANDOFF SUN 18:00
```

(was just `PATTERN · ALTERNATING WEEKS`) — more state is exposed at a
glance, fewer reasons to drill into the editor for read-only info.

### Footer hint

A subtle info-card explanation sits at the bottom of the scrolled content:

> Tap **Pattern** to change the alternation rule or handoff time.
> Long-press a day to add a one-off swap.

This pre-empts the most common support question ("how do I move just one
weekend?") by drawing a clean line between **pattern edits** (rule changes)
and **overrides** (one-off swaps).

### RN porting notes

- The Pattern button is a `Pressable` → `router.push('/custody/pattern')`.
- Long-press on a day cell should still open the existing override-creation
  sheet — unchanged from `CustodySchedule`.

---

## Change 4 · CustodyPatternEditor — new focused editor

**Component**: `CustodyPatternEditor` in `screens-custody.jsx`.
**Route**: `/custody/pattern` (or similar — see "Route placement" below).
**Replaces**: the old `/settings/custody` route entirely.

### Top bar

iOS-style modal bar:

```
Cancel        Custody pattern        Save
```

Plain text actions, no chevron. Save is accent-colored to signal it's the
primary action.

### Section 1 · Live preview banner

A `C.card` card at the top showing **the next 2 weeks** as a live preview
that updates as the user changes rules. Each week:

- Mono caps row label (`WK 22 · MAY 25–31`)
- 7-day bar with parent colors
- A 5×24 warn-color tick on Sundays marks where hand-offs land (the bar
  has a 1.5px `C.bg` outline around it so it reads cleanly against the
  day bar)

Top-right of the card: a small `LIVE` chip in `accent + '18'` background
so users feel safe that the preview is real, not static.

### Section 2 · Pattern type

`SubGroup label="Pattern" subLabel="How custody alternates between Alex and Riley."`

Four `PatternOption` radio cards stacked. Each has:
- **Mini visualization** in a 32×22 tile on the left — colored rectangles
  showing the rhythm of the pattern (e.g. Alternating weeks = one large
  half-and-half block; 2-2-3 = two small + one large; Every other weekend =
  one long block + one short; Custom = many thin slivers in alternating
  colors)
- Title (13.5 / 600) + sub (11 / inkMuted / 1.35)
- Right side: 20×20 radio bubble (accent fill + white check when selected)
- Selected state: `accent + '0e'` row background

Patterns in this order:
1. **Alternating weeks** — `One parent each full week · simplest` *(selected by default)*
2. **2-2-3 rotation** — `Mon–Tue with one · Wed–Thu the other · alternate Fri–Sun`
3. **Every other weekend** — `One parent has the kids Mon–Thu · other gets Fri–Sun`
4. **Custom** — `Define day-by-day · for unusual arrangements`

### Section 3 · Hand-off

`SubGroup label="Hand-off" subLabel="When the switch happens..."`

- **Day of week** — Mono caps label, then a 7-wide segmented control of
  day initials (M T W T F S **S**). The selected day is full-accent
  background with `onAccent` text; others are `C.inset` with hair border.
- **Time** — SubRow with mono `18:00` value, chevron → opens a time picker
- **Hand-off location** — SubRow with sub `"Optional · used in reminders"`
  and a `MonoRight` value `Casey's place`, chevron → opens a location picker

### Section 4 · Anchor

`SubGroup label="Anchor" subLabel="Which week is whose. Editing this shifts all future weeks."`

- **Pattern started** — `Mar 4, 2024` (date picker)
- **Who has this week** — Alex (with 16px avatar + mono name), chevron → opens parent picker

The anchor is the single most-asked-about config in shared custody —
"why does Casey have Oliver this week, I thought it was my week?" The
explanatory sub-label is intentional.

### Section 5 · Per-child overrides

`SubGroup label="Per-child overrides" subLabel="Soph and Oliver have external co-parents — their schedules layer on top of the alternating pattern."`

Four `KidPatternRow`s, one per child. Each has:
- 32×32 child avatar; if the child has an external co-parent, a 14px
  external-parent avatar bug sits in the bottom-right corner of the child
  avatar (`C.card` background, hair border, 1px padding)
- Child name (13.5 / 600) + summary (11.5 / inkSec) + detail (10 mono / inkMuted)
- Right chevron

In the mock:
- **Mei** — Follows main pattern · Alex ↔ Riley alternating
- **Jin** — Follows main pattern · Alex ↔ Riley alternating
- **Soph** — + Devon · weekends · Every other Sat–Sun
- **Oliver** — + Casey · Wed–Thu · Every week · day-care swap

This is the section that actually handles the messiness of blended families
where not every kid follows the same rhythm. **Don't cut it** — it's the
reason custody UIs in other apps feel broken to blended-family users.

### Section 6 · Behavior toggles

`SubGroup label="Behavior"`

- `Auto-assign events to current parent` *(on)* — "New events default to
  whoever has the kids that day"
- `Send hand-off reminders` *(on)* — "2 hours before each switch · to
  both parents"
- `Notify external co-parents of pattern changes` *(off)* — "Casey and
  Devon will see when this rule changes"

### Section 7 · Destructive action

A single-row card at the bottom: `Stop using a custody pattern` (alert
color, centered, 14 / 500). Below: small inkMuted explanation —
"Keeps existing events but disables auto-assignment and reminders. Past
schedule stays visible." This is the only path to remove a pattern; it
should require a confirmation step on tap.

### Sticky bottom save bar

Two parts:

1. **Impact warning** on the left — small warn-circle glyph + text
   `3 events will be reassigned` (number in mono / warn / 600). This
   computes downstream changes BEFORE save, so users don't get surprised.
   Hide this if there are no downstream changes.
2. **Save pattern** button on the right — accent background, white
   checkmark + text.

### Route placement

Two reasonable options:

- **Option A (recommended)**: `/custody/pattern` — sibling of
  `/custody/schedule`. Custody becomes its own route family.
- **Option B**: `/settings/custody-pattern` — keep under settings for
  legacy URL reasons. **Avoid `/settings/custody`** — that name strongly
  implies a schedule-viewing page, which it isn't anymore.

Whatever you choose, **redirect the old `/settings/custody` URL** to the
new screen so any deep links (notifications, etc.) keep working during
transition.

---

## Cross-cutting design tokens

All colors come from the active palette
(`paletteMistForest` light / `paletteCharcoalForest` dark). Same tokens as
the previous handoff:

| Token | Light | Dark |
|---|---|---|
| `bg`       | `#ECEFEC` | `#15171B` |
| `card`     | `#FFFFFF` | `#1F2128` |
| `inset`    | `#F3F5F2` | `#272A33` |
| `ink`      | `#161C18` | `#F0F0F2` |
| `inkSec`   | `#4E5750` | `#A8AAB2` |
| `inkMuted` | `#828B85` | `#6E7079` |
| `inkFaint` | `#BCC4BE` | `#4A4C55` |
| `hair`     | `rgba(22,28,24,0.08)` | `rgba(255,255,255,0.08)` |
| `accent`   | `#2D8B6E` | `#3FC198` |
| `onAccent` | `#FFFFFF` | `#0B1310` |
| `alert`    | `#C04A38` | `#FF5C4E` |
| `warn`     | (palette-specific amber) | (palette-specific amber) |

Identity colors used in custody bars: `alex`, `riley`, `casey`, `devon`
(parents only — kid colors don't appear in the schedule bars).

Color treatment for the 7-day bar (consistent across Today strip, Family
Hub hero, viewer, and editor preview):
- Top border: `2px solid <color>` (full saturation)
- Body: `<color> + alpha` — light mode `33` (~20%), dark mode `5C` (~36%)

---

## Open product questions

1. **What does "current parent" mean when both parents are home?**
   In a non-shared-custody household OR on weeks where the pattern places
   both parents together — what does the strip say? Suggested fallback:
   hide the strip, show the strip with `Together this week` and both
   avatars stacked, or fall back to just the next-handoff line. Decide
   before ship.

2. **Strip behavior for external co-parents** (Casey, Devon) — they
   should see a read-only version. Suggested label: `Alex has the kids ·
   you have Oliver next on Wed` (their POV, not the household's).

3. **Pending swap UX** — tapping `REVIEW` on the Family Hub hero banner
   should open... what, exactly? The full schedule scrolled to the
   Pending section (existing behavior), or a dedicated full-screen
   review-and-respond UI? The latter is probably worth designing as a
   follow-up.

4. **The destructive "Stop using a custody pattern" action** — what
   actually happens to existing custody-tagged events? Suggested:
   they stay assigned, but their "custody-aware" reassignment hooks are
   disabled. Tasks tagged "follows custody" become statically-assigned.
   Worth a separate doc.

5. **Per-child override depth** — the per-child rows let you say "Soph +
   Devon · weekends." But what's the actual editor when they tap one of
   those rows? Likely a smaller version of the main pattern editor with
   only that child's schedule visible + a pattern type picker scoped to
   the secondary parent. Not in this handoff — needs its own pass.

---

## Files in this bundle

- `screens-custody.jsx` — **the new work** (custody strip + ProHomeV2 +
  FamilyHubV2 + CustodyScheduleV2 + CustodyPatternEditor + helpers)
- `screens-settings.jsx` — `Sub*` primitives reused by the pattern editor
- `direction-c-pro.jsx` — palettes, `cMembers`, `CAvatar`, `CBottomNav`,
  `ProHome` (unchanged reference)
- `screens-extra.jsx` — original `CustodySchedule`, `FamilyHub`,
  `HandoffDay`, helpers
- `app.jsx` — design canvas wiring with reorganized sections
- `OneNest - UI Explorations.html` — preview entry point; open in a browser
- `ios-frame.jsx`, `design-canvas.jsx`, `screens-extra-2…5.jsx` — supporting

See `design_handoff_settings_subroutes/` (sibling folder in the project)
for the previous handoff covering Settings sub-routes, the 5-tab bottom
nav, and Contacts becoming its own top-level tab.
