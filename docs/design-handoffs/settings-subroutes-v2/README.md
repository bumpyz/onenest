# Handoff — Settings sub-routes + Contacts as a top-level tab

## Overview

This handoff covers a focused redesign of OneNest's Settings surface and a
restructuring of the bottom tab bar. It is a follow-up to the broader OneNest
redesign — visual language, palettes (Mist Forest / Charcoal Forest), member
identity colors, and the existing components (`IOSDevice`, `CAvatar`,
`CBottomNav`, `CStack`) are all carried over unchanged.

Five things change:

1. **Settings top bar** gains a back-chevron (Settings is reached from the
   Family tab, so it needs a way out).
2. **Settings hero** becomes a read-only summary with an `Edit →` affordance.
   Tapping it opens the new Profile screen. The display-name inline-edit on
   the hero is removed.
3. **Household SGroup** no longer contains the dashed Invite hero card or the
   read-only Members row. Both responsibilities collapse into a single
   `Members` nav row that opens the new Members screen.
4. **Appearance section** in Settings collapses to two nav rows
   (`Theme & accent`, `Compact density`) that open the new Appearance screen.
   The inline theme picker + accent swatches are gone from Settings itself.
5. **Bottom tab bar** gains a 5th tab: **Contacts**. The Contacts row in
   `Family Hub → Manage` is removed. ContactsList now reads as the
   `contacts` tab.

Three new sub-route screens are introduced — all follow the existing
`/settings/<x>` pattern (Household, Children, Calendars):

- `/settings/members`
- `/settings/profile`
- `/settings/appearance`

## About the design files

The files in this bundle are **design references created in HTML/React** —
prototypes showing intended look and behavior, not production code to copy
directly. The OneNest app is React Native (Expo Router), so the task is to
**recreate these screens in the existing RN codebase** using its established
patterns (`ThemedView`, `ThemedText`, `Pressable`, the `SGroup` / `SRow`
helpers in `src/app/settings/household.tsx`, etc.).

Open `OneNest - UI Explorations.html` in a browser to see the live mocks.
The sections you care about are:

- `Settings · updated`
- `Members · new sub-route`
- `Profile · new sub-route`
- `Appearance · new sub-route`

Each section shows the screen in both **P3 Mist Forest (light)** and
**P4-F Charcoal Forest (dark)**.

## Fidelity

**High-fidelity.** All colors, typography, spacing, copy, role labels, and
interaction states are final. Identity colors map directly to existing member
colors (`C.alex`, `C.riley`, …). The mono labels (`SIGNED IN AS …`,
`MEMBERS · 4 · 2 PENDING`, `EXPIRES IN`, etc.) are intentional and should
ship as-is.

---

## File map (in this bundle)

| File | What's in it |
|---|---|
| `screens-settings.jsx` | **The new work.** `SettingsV2`, `MembersScreen`, `ProfileEdit`, `AppearanceScreen`, plus the `Sub*` primitives (`SubTopBar`, `SubGroup`, `SubRow`, `SubToggle`, `SubRolePill`) and screen-specific components (`RoleChip`, `PendingRow`, `MemberRow`, `PaletteSwatch`, `DensityChoice`). |
| `direction-c-pro.jsx` | Palettes, `cMembers` proxy, `CAvatar`, `CStack`, `CBottomNav` (now 5 tabs), `ProHome`, `ProCalendar`, `ProLists`. **CBottomNav was edited** — see below. |
| `screens-extra.jsx` | Contains `FamilyHub`, `Settings` (the old version, kept for reference), `ContactsList`, `ContactDetail`. **Two edits**: Contacts row removed from `FamilyHub → Manage`; `ContactsList` now passes `active="contacts"` to `CBottomNav`. |
| `app.jsx` | Design canvas wiring. The four new `DCSection`s replace the old single `pair-settings` section. |
| `ios-frame.jsx`, `design-canvas.jsx`, `screens-extra-2…5.jsx` | Carried over so the HTML preview renders cleanly. Not modified. |

---

## Change 1 · Bottom tab bar (`CBottomNav`)

**File**: `direction-c-pro.jsx`, function `CBottomNav` (~line 281).

Was 4 tabs (Today / Calendar / Lists / Family). Now **5 tabs**:

```
Today  |  Calendar  |  Lists  |  Contacts  |  Family
```

Contacts is inserted between Lists and Family. The icon path is an
address-book card with three side tabs:

```
d="M4 4a1 1 0 011-1h9a2 2 0 012 2v10a2 2 0 01-2 2H5a1 1 0 01-1-1V4z
   M9.5 10a2 2 0 100-4 2 2 0 000 4z
   M6.5 14c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3
   M2.5 6h1.5 M2.5 10h1.5 M2.5 14h1.5"
```

Container horizontal padding tightened from `16px → 10px` so five 20px icons
+ 9.5px labels fit comfortably at 402px viewport width.

**RN port note.** Update the tab bar config (likely in
`src/app/(app)/_layout.tsx`) to include a 5th Tab.Screen for `contacts`. Use
`react-native-svg` to render the path — `stroke={focused ? colors.text :
colors.inkFaint}`, `strokeWidth={focused ? 1.6 : 1.3}`.

**Active values used by screens:**
- `home` — Today / FirstRunHome / CaregiverHome / TaskDetail / NotificationsInbox
- `cal` — Calendar / CalendarMonth / CalendarDay
- `lists` — Lists
- `contacts` — ContactsList ← **changed in this redesign**
- `people` — FamilyHub

---

## Change 2 · Family Hub → Manage section

**File**: `screens-extra.jsx`, function `FamilyHub`.

The `Contacts` NavRow under the "Manage" section is **deleted**. The Manage
section keeps Custody schedule, Connected calendars, and Settings. Contacts
is now its own top-level destination via the tab bar.

No other change to FamilyHub.

---

## Change 3 · Settings (updated)

**Component**: `SettingsV2` in `screens-settings.jsx`.
Width 402 × height 874 (iPhone-class artboard).

### Layout, top to bottom

1. **Top bar** (`SubTopBar`, title `"Settings"`)
   - Back-chevron 32×32 rounded-8 button on the left, card background,
     hairline border, ink-colored chevron path
     `d="M7 1L1 7l6 6"`, strokeWidth 1.6.
   - Centered 15px / 600 weight / -0.3 letter-spacing title.
   - 32×32 spacer on the right to keep the title centered.
   - 0.5px hairline bottom border, `padding: 10px 16px`.

2. **`SIGNED IN AS ALEX@CHENPARK.COM`** — Geist Mono 10px, `inkMuted`,
   `padding: 14px 20px 10px`.

3. **Hero card** — `padding: 0 16px 18px`, then a `C.card` card with
   `borderRadius: 14`, `0.5px solid C.hair`, `padding: 14`, light-mode
   shadow `0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)`.
   Row layout: `display: flex`, `gap: 12`, `align-items: center`.
   - 48px CAvatar (Alex)
   - Stack: name (16px / 600 / -0.3), mono email (11px, inkMuted), then a
     6px-gap row of `SubRolePill`s — `Parent` (tinted with `C.alex`) and
     `Admin` (tinted with `C.accent`).
   - **Edit affordance** — `inset` background, 0.5px hair border, radius 8,
     `padding: 6px 10px`, label `EDIT` in 10px / 600 mono accent + a small
     accent chevron. Tapping opens `/settings/profile`.

4. **Household SGroup** — sub-routes only, no inline editors.
   Rows in order, each tappable, all with chevron:
   - `Name` → right: `Chen-Park` (mono 12 / 500 / inkSec)
   - `Family type` → right: `Blended`
   - **`Members`** → right: `CStack` of 4 member avatars (size 18) +
     mono `4 · 2 pending`. **Opens `/settings/members`.**
   - `Children` → right: `CStack` of 4 kid avatars + mono `4`
   - `Custody schedule` → right: mono accent `Alternating weeks`

5. **Notifications SGroup** — unchanged from existing Settings:
   `Weekly digest`, `Task reminders`, `Hand-off reminders`, `Conflict alerts`,
   `Activity from co-parents`, all `SubToggle` with `sub` copy.

6. **Connected calendars SGroup** — unchanged; uses existing
   `SCalendarRow` (Google connected, Microsoft not connected).

7. **Appearance SGroup** — **collapsed to nav rows.**
   - `Theme & accent` → right: 14×14 accent square + mono palette name
     (`Mist Forest`). Chevron. Opens `/settings/appearance`.
   - `Compact density` → right: mono `Comfortable`. Chevron.

   (The previous inline Theme picker + Accent swatches + Compact density
   row are all gone from this screen.)

8. **AI assistant SGroup** — toggles + `What can the AI see?` row.
   Unchanged.

9. **About SGroup** — Help & feedback, Privacy, Terms, Version. Unchanged.

10. **Danger card** — `Sign out` + `Delete account` stacked, alert color,
    centered, 0.5px hairline between. Unchanged.

11. **`ONENEST · MADE FOR FAMILIES`** tagline footer. Unchanged.

### What was removed from the old Settings

- The standalone dashed-border `Invite someone new` hero card. Lives on the
  Members screen now.
- The inline Theme / Accent / Density section under Appearance. Lives on the
  Appearance screen now.
- The avatar's `pencil` overlay badge — the hero no longer inline-edits
  anything; the explicit `EDIT →` chip carries that affordance.

---

## Change 4 · Members screen (new)

**Route**: `/settings/members`.
**Component**: `MembersScreen` in `screens-settings.jsx`.

### Top bar
`SubTopBar` with title `"Members"`. Back-chevron returns to Settings.

### Header summary
```
CHEN-PARK · 4 ACTIVE · 2 PENDING        (mono 10, inkMuted)
People who can see and edit your family's plans. Co-parents and external
co-parents see the schedule; caregivers only see what's assigned to them.
                                         (13px inkSec, lineHeight 1.4)
```

### Invite form (card)

`C.card` card, `borderRadius: 14`, the same hero-class shadow. Three
internal sections separated by 0.5px hairlines.

1. **Email/phone input** — mono caps label `INVITE SOMEONE`. Below, a
   pill-shaped field with `inset` background, hair border, radius 10,
   left icon (envelope), value `casey@example.com` rendered in mono 12.5,
   a blinking 1.5×14px accent caret. Animation:
   `@keyframes blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }`
   already in the HTML head.

2. **Role chips** — mono caps label `ROLE`. Three `RoleChip` components
   stacked vertically with `gap: 6`. Each chip is a row with:
   - 28×28 icon tile, `inset` background (or `accent + '22'` when selected)
   - Title (13.5 / 600 / -0.2) + subtitle (11 / inkMuted / 1.4)
   - 18×18 radio bubble on the right, filled accent + white check when
     selected.
   - Selected state also tints the whole chip background `accent + '14'`
     and uses a 1.2px accent border (vs 0.5px hair when not selected).

   Three roles, in this order, with this copy:
   - `Co-parent` — "Full access · can edit anything" — icon `parent`
   - `External co-parent` — "Sees the schedule across both homes ·
     separated families" — icon `external` — **selected in the mock**
   - `Caregiver` — "Read-only · only what's assigned to them" — icon `caregiver`

3. **Send button** — full-width accent rectangle, radius 10, padding
   `12px 14px`. Paper-plane SVG + `Send private invite link` (onAccent,
   14 / 600). Below in 11px inkMuted, centered:
   `They'll get an email · link expires in 7 days · you can revoke anytime`

### Pending SGroup

Label `Pending · 2`, accessory mono caps `EXPIRES IN` on the right of the
group header.

Two `PendingRow`s — each row has:
- 36×36 circular tile: `border: 1.2px dashed roleColor·99`,
  background `roleColor + '14'`, an envelope SVG centered in roleColor.
- Email in mono 12.5 / 500 / ink, truncated with ellipsis.
- Below the email: `SubRolePill` (role name + role color tint) +
  mono 10.5 inkMuted meta ("Sent 2 days ago", "Sent 4 hours ago · 2 reminders").
- Right column (flex-column align-end, gap 4):
  - Expires countdown — mono 11 inkSec (`5d`, `6d 20h`).
  - Two small action chips below, side by side: `RESEND` (accent) and
    `CANCEL` (alert). Mono 9.5 / 600 / 0.3 letter-spacing / uppercase,
    `inset` background, hair border, radius 6, padding `3px 7px`.

Pending rows in the mock:
1. `nina.alvarez@gmail.com` — Caregiver (devon color), 2 days ago, 5d left.
2. `devon@harperlane.net` — External co-parent (casey color), 4h ago + 2
   reminders, 6d 20h left.

### Members SGroup

Label `Members · 4`, accessory mono caps `JOINED` on the right.

Four `MemberRow`s with this layout:
- 36px CAvatar
- Stack: name (14 / 600), optional `EXT` tag (mono 9 / 600 / 0.3 in `inset`
  pill) immediately after the name for external co-parents.
  Below: `SubRolePill` with role color.
  Below that: meta in mono 10.5 inkFaint (email + relationship).
- Right column: mono 10 inkMuted joined-month, plus the affordance:
  - **For you**: a `YOU` chip in mono 9.5 / 600 / inset bg / 4px radius.
  - **For others**: a 24×24 rounded-6 button with three horizontal dots
    (kebab menu). Tapping opens the remove-member sheet (already designed —
    see `RemoveCaregiverSheet` in `screens-extra-4.jsx`; generalize it for
    co-parents as well).

Rows in the mock:
1. Alex (`alex` color) — Parent · Admin — `You · alex@chenpark.com` — joined Apr 2024 — `YOU` chip
2. Riley (`riley` color) — Parent — `riley@chenpark.com · active 3h ago` — Apr 2024 — kebab
3. Casey (`casey` color, EXT tag) — External co-parent — `casey@harborline.com · Oliver's other parent` — May 2024 — kebab
4. Devon (`devon` color, EXT tag) — External co-parent — `devon@harperlane.net · Soph's other parent` — Jun 2024 — kebab

### Footer help card

Below the members list, padded `0 24px 24px`. Dashed 0.5px hair border,
radius 12, padding 14, body 11.5 / inkMuted / lineHeight 1.5. Bold lead-in
"What members can see." in inkSec. Closes with a mono `LEARN MORE →` chip
in accent.

---

## Change 5 · Profile screen (new)

**Route**: `/settings/profile`.
**Component**: `ProfileEdit` in `screens-settings.jsx`.

### Top bar
`SubTopBar` with title `"Profile"`, right slot = mono `DONE` chip in accent
(10/600/0.3/uppercase). Back chevron returns to Settings; `Done` is the
save+dismiss action.

### Avatar preview hero

Centered column, `padding: 24px 20px 20px`, gap 10.

- 96×96 circular avatar in the selected identity color. Single white initial
  centered (`A`, Geist 36 / 600 / -1, white).
- Around the avatar: two ring shadows simulating a halo —
  `0 0 0 4px C.bg, 0 0 0 5px <color>·44, 0 6px 24px <color>·33` (light mode).
  Dark mode drops the outer drop-shadow.
- Bottom-right floating pencil bug — 28×28, `C.card` background, hair border,
  pencil SVG, `0 2px 6px rgba(0,0,0,0.12)` shadow.
- Caption below the avatar: mono 11 inkMuted, `Tap to upload photo`.

### Display name SGroup

Group label `Display name`, sub-label `How you appear to others in Chen-Park.`

Inside the card: one row with `inset` background, **1.2px accent border**
(focused state), padding `11px 12px`, gap 10.
- Value `Alex Chen` (14 / 500 / -0.2).
- Blinking 1.5×16 accent caret immediately after.
- Right side: mono 10 inkMuted character counter `9 / 40`.

### My color SGroup

Group label `My color`, sub-label `Used on your events, hand-offs and chips
across the family. Each person picks a distinct color.`

Inside the card: a 4-column CSS grid, gap 10. **Eight swatches** mapped to
the identity palette in this order so they read as a spectrum:

| key | color (Mist Forest) | label |
|---|---|---|
| alex   | `#5C77B5` | Indigo |
| jin    | `#6F9DC4` | Sky    |
| devon  | `#3E8A6B` | Forest |
| oliver | `#6BC0A6` | Mint   |
| soph   | `#BFA168` | Wheat  |
| riley  | `#C77046` | Rust   |
| mei    | `#BE7896` | Rose   |
| casey  | `#8369A8` | Lilac  |

Per swatch:
- 48×48 rounded-12 color tile.
- **Selected** (the user's current color): no border, `box-shadow: 0 0 0 2px
  C.bg, 0 0 0 4px <color>` ring, plus a centered white 22×22 check.
- **Claimed by someone else**: 45% opacity on the whole tile, plus a tiny
  member-avatar bug pinned to the bottom-right corner of the swatch
  (`C.card` background, hair border, 14px CAvatar inside, padding 2).
- **Available and not yours**: regular 0.5px hair border, full opacity.
- Mono 9.5 / 600 / uppercase label beneath each swatch in inkMuted.

In the mock, **Alex (Indigo) is selected**; the other 7 identity colors are
all claimed (Riley/Casey/Devon/Mei/Jin/Soph/Oliver). So all 7 of those
appear dimmed with their owner's avatar bug.

Below the grid: a soft accent banner — `accent + '14'` background, radius 8,
padding `8px 10px`, info-circle icon in accent, text in 11 / inkSec / 1.4:
"Greyed-out swatches are claimed by other members. Pick a different color
to keep things readable on shared views."

### Account SGroup

Three navigation rows with mono-right values:
- `Email` → `alex@chenpark.com`
- `Phone` → `+1 (415) 555-0142`
- `Time zone` → `America / Los Angeles`

### Sign-out card
Standalone card with one alert-colored centered row: `Sign out of OneNest`.

> Note: the Account section + Sign-out aren't in your spec — they were added
> because this is the screen people reach via the avatar, and bunching
> account-edit affordances here felt natural. Drop if you want this screen
> to be strictly Display name + My color.

---

## Change 6 · Appearance screen (new)

**Route**: `/settings/appearance`.
**Component**: `AppearanceScreen` in `screens-settings.jsx`.

### Top bar
`SubTopBar` with title `"Appearance"`. Back chevron only.

### Preview card

A live event-card preview that re-themes with the current selection. Padding
`18px 16px 22px`, then a `C.card` outer card (hero shadow in light mode)
containing mono caps `PREVIEW` label and an `inset` sub-card showing:
- A 4×30 accent vertical bar on the left.
- Title `Soph's piano lesson` (13 / 600) + mono meta `Wed · 16:00 · with
  Mrs. Anderson`.
- A `NOW` pill on the right in accent/onAccent, mono 9 / 700.
- A hairline-separated row below with Soph's avatar (18px), `For Soph`
  (11 inkSec), and a mono `OPEN →` accent chip on the right.

### Theme SGroup

A row of three `ThemeOption` components (the helper already exists in
`screens-extra.jsx`). Light / Dark / System; current scheme is selected.

### Accent SGroup

Group accessory: mono palette name (`Mist Forest`) on the right of the
group header.

Inside the card:
1. **Palette swatches** — `display: flex`, gap 10, wrap. Four
   `PaletteSwatch` cards (`Mist Forest`, `Slate Coral`, `Bell Navy`,
   `Charcoal`). Each is a horizontal pill (`flex: 1 1 calc(50% - 5px)`,
   so they wrap to 2 per row), `padding: 10`, radius 10, `inset` bg or
   `accent + '0e'` when selected with a 1.5px accent border.
   Left side: two 22×22 circular swatches overlapping (`marginLeft: -8`)
   to show the palette's accent + a secondary color. Both circles get a
   1.5px `C.card` border so they read clearly on the inset background.
   Right side: 12 / 600 palette name; a 14×14 accent check bubble appears
   if selected.

2. **Per-element accent row** — below, mono caps label `PER-ELEMENT ACCENT`.
   A row of six 32×32 `AccentSwatch` tiles for tinting specific surfaces
   independently of the chosen palette. First swatch matches the current
   `C.accent` and is selected.

### Density SGroup

Group sub-label: "Comfortable spaces out rows for easy tapping; Compact fits
more on screen."

- A segmented control (`DensityChoice` × 2) inside an `inset` shell:
  `Comfortable / Default` (selected) and `Compact / -20% height`. The
  selected segment gets a `C.card` background, hair border, and a soft
  `0 1px 2px rgba(0,0,0,0.04)` shadow — standard iOS segmented style.
- Two extra related toggles inside the same card:
  - `Reduce motion` — "Disable transitions and parallax across the app"
  - `Show monospace metadata` — "Times, IDs and counters in Geist Mono
    (recommended)" — **on by default**

### Text size SGroup (optional)

A horizontal slider with `Aa` (small) on the left, mono `Default · 100%` in
accent in the middle, and `Aa` (large) on the right. Below: a 4px track in
`inset`, accent fill to 40%, a 20×20 white-knob with a 1.5px accent border
and a soft drop shadow. Tick marks at 0/25/50/75/100% with `S M L XL XXL`
labels in mono 9.5 inkMuted.

> Note: Text size wasn't in your spec — I added it because it's a natural
> neighbor of density and a common iOS settings affordance. Drop if scope
> needs to stay tight.

---

## Cross-cutting design tokens

All of these come from the active palette (`paletteMistForest` light /
`paletteCharcoalForest` dark). Reach for them via the theme provider; do not
hardcode hex values for anything other than the palette swatches themselves.

| Token | Light (Mist Forest) | Dark (Charcoal Forest) |
|---|---|---|
| `bg`        | `#ECEFEC` | `#15171B` |
| `card`      | `#FFFFFF` | `#1F2128` |
| `inset`     | `#F3F5F2` | `#272A33` |
| `ink`       | `#161C18` | `#F0F0F2` |
| `inkSec`    | `#4E5750` | `#A8AAB2` |
| `inkMuted`  | `#828B85` | `#6E7079` |
| `inkFaint`  | `#BCC4BE` | `#4A4C55` |
| `hair`      | `rgba(22,28,24,0.08)` | `rgba(255,255,255,0.08)` |
| `accent`    | `#2D8B6E` | `#3FC198` |
| `onAccent`  | `#FFFFFF` | `#0B1310` |
| `alert`     | `#C04A38` | `#FF5C4E` |
| `sheet`     | `#161C18` | `#0B0C0F` |

Identity colors (used for member dots, role pills, color picker swatches):
`alex` `riley` `casey` `devon` `mei` `jin` `soph` `oliver` — see the
palette objects in `direction-c-pro.jsx` for exact values per scheme.

Type:
- `fontSans`: Geist (-apple-system / system-ui fallback)
- `fontMono`: Geist Mono (ui-monospace / SF Mono fallback)

Spacing rhythm:
- `12px` row vertical padding, `13–14px` row horizontal padding
- `16px` outer screen padding
- `18px` between SGroups
- `0.5px solid C.hair` for all internal dividers, `1px dashed` for
  empty-state / help cards
- `borderRadius`: `8` (chips), `10` (input fields), `12` (cards), `14`
  (hero cards), `999` (pills)

Mono-caps labels (`MEMBERS · 4`, `EXPIRES IN`, `SIGNED IN AS …`) — Geist
Mono, 10px, 0.4 letter-spacing, 600 weight, uppercase, color `inkMuted`
or `inkSec`.

---

## RN porting notes

- **Settings route layout**: The screens at `/settings/household`,
  `/settings/children`, `/settings/calendars`, etc. already use a topBar +
  back chevron pattern (see `src/app/settings/household.tsx`). Mirror that
  for `/settings/members`, `/settings/profile`, `/settings/appearance` —
  same `SafeAreaView` edges, same `topBar` style, same `topBarIconBtn`.
- **`SettingsV2`** maps to the existing main settings file (probably
  `src/app/(app)/settings.tsx`). Wire `Members` to push
  `/settings/members`; wire the hero `EDIT →` chip to push
  `/settings/profile`; wire both Appearance rows to push
  `/settings/appearance`.
- **Existing SGroup / SRow / Pressable** patterns from `household.tsx` are
  the right primitives — the `Sub*` names in this bundle are just to avoid
  collisions in a single-file HTML demo. Use the existing helpers.
- **Invite send** — wire to whatever invite-creation endpoint already
  exists; the Supabase `pending_invitations` shape is referenced in
  `use-pending-invitations.ts`.
- **Color picker** — the "claimed by other members" logic comes from
  `memberColorMap()` in `src/lib/colors.ts`; do not let two members end up
  with the same color.
- **Tab bar** — the iconography in `direction-c-pro.jsx`'s `CBottomNav` is
  illustrative. In RN, use the same icon family the existing bottom nav
  uses (`@expo/vector-icons` Feather, by the look of it). Suggested icon:
  `book-open` or `users` for Contacts — or, to match the address-book
  metaphor, build a custom `react-native-svg` component from the path
  spelled out in Change 1.

---

## Open questions for product

1. **`What members can see` help card on Members** — copy is plausible but
   should be reviewed by whoever owns the privacy explanation in the rest
   of the product (the wording in `JoinHousehold` and the connected-calendar
   privacy note are the existing canonical sources).
2. **`YOU` chip vs no chip** — current spec is the chip; some products use
   "(you)" inline instead. The mock uses both (`Alex Chen (you)` inline
   + a `YOU` chip on the right) — pick one.
3. **Remove flow** — the kebab on each Member row should open
   `RemoveCaregiverSheet` (already designed). Generalize the sheet to
   handle co-parents and external co-parents — copy will need different
   "what stays / what's removed" wording for those roles.

---

## Files in this bundle

- `screens-settings.jsx` — **the new work**
- `direction-c-pro.jsx` — edited: 5-tab bottom nav
- `screens-extra.jsx` — edited: Contacts row removed from FamilyHub, active
  tab updated on ContactsList
- `app.jsx` — design canvas wiring for the four new sections
- `OneNest - UI Explorations.html` — preview entry point; open in a browser
- `ios-frame.jsx`, `design-canvas.jsx`, `screens-extra-2…5.jsx` — supporting
  files so the preview renders
