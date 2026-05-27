# Handoff — FAB consistency rule

## Overview

A small but important consistency fix across all top-level tabs in
OneNest. Formalizes the rule for what the bottom-right FAB does and
labels, fixes three inconsistencies in the existing designs, and gives
implementers a single sentence to apply going forward.

## The rule

> **If a tab's primary content is one specific kind, the FAB
> short-circuits to that kind and the label names it
> (`New <kind>`). If the tab is genuinely multi-content, the FAB
> opens `QuickCreateSheet` and is labeled `New`.**

This matches the iOS Mail / Notes / Reminders pattern: the FAB makes
the *content* of the screen, not the container the screen is named
after. Mail's compose FAB makes a message; Notes' FAB makes a note;
Reminders' FAB makes a reminder.

## What changed

Three FAB labels and routes were inconsistent before this pass.
All three are fixed; the full table is now uniform:

| Tab | FAB label | Opens | Why |
|---|---|---|---|
| Today | `New` | `QuickCreateSheet` | Truly ambiguous — could be event, task, list, contact |
| Calendar — week | `New event` | `EventCreate` | Events are the content |
| Calendar — month | `New event` | `EventCreate` | Events are the content |
| **Calendar — day** | `New event` ← *was `New`* | `EventCreate` | Was a bug; now consistent with Week & Month |
| **Lists** | `New task` ← *was `New`* | `CreateTask` | Tasks are the content of the Lists screen |
| **Contacts** | `New contact` ← *was `Add contact`* | `CreateContact` | Contacts are the content; label now matches the verb pattern |
| Family | `New` | `QuickCreateSheet` | Ambiguous — invite member / add child / add contact |
| Custody schedule | `New override` | `NewOverride` | Overrides are the content |

The label change on Contacts (`Add contact` → `New contact`) is purely
cosmetic — same destination, just matches the `New <kind>` verb pattern
used everywhere else.

## Knock-on consequence — secondary creates need their own affordance

With the FAB committed to one kind per tab, the *less common* creates
on that tab need a discoverable surface. Most are already in place:

| Tab | Primary (FAB) | Secondary creates |
|---|---|---|
| Calendar | Event | (none — Calendar is event-only) |
| Lists | Task | **`+ NEW LIST` link** in the "Your lists" section header → `CreateList` |
| Contacts | Contact | **`+ NEW CATEGORY` link** in the relevant section header → contact-category sheet *(small follow-up — see below)* |

The Lists case is already shipped (see the Lists v2 handoff).
The Contacts case is a small parallel addition not yet designed —
flag if you want it specced. The shape would be: a mono caps
`+ NEW CATEGORY` link sitting where the `+ EDIT` link does today in
the Emergency / Favorites section header.

## Why not always use the chooser sheet?

Tested in the head: making every FAB open `QuickCreateSheet`
would be the simplest mental model, but produces a measurably worse
experience on the kind-committed tabs:

- **One extra tap** for the most common action on that tab (Calendar
  → events, Lists → tasks).
- **One extra decision** the user shouldn't have to make — they're on
  the Calendar tab; they obviously want an event.
- **Loses the "you're in this context" signal**. The shortcut tells
  the user "yes, you're in the right place; just type."

The chooser sheet remains the right answer for Today and Family —
those tabs really *are* multi-content surfaces and the user's intent
isn't predictable from the tab alone.

## Files changed in this bundle

| File | Change |
|---|---|
| `screens-extra-5.jsx` | `CalendarDay` FAB label: `New` → `New event` |
| `screens-lists-v2.jsx` | `ProListsV2` FAB label: `New` → `New task`, route changed to `CreateTask` |
| `screens-extra.jsx` | `ContactsList` FAB label: `Add contact` → `New contact` |
| `screens-task-edit.jsx` | Side fix — `MiniCalendar` day-of-week headers (`S M T W T F S` → `S M T W Th F Sa`) to clear duplicate-key React warnings |

No other files in this bundle were modified — they're carried over so
the standalone HTML renders the full canvas. Open
`OneNest - UI Explorations (standalone).html` and check sections
**02.1** (Today, unchanged for reference), **03.3** (Calendar Day, fixed),
**05.1** (Lists, fixed), **08.1** (Contacts, fixed), and **06.1**
(Custody, unchanged) to verify the rule reads consistently.

## RN porting notes

- All FAB instances should be a **single shared component**, parameterized
  by `label` and `onPress`. Drift across tabs is the failure mode here —
  having one source of truth prevents it.
- The kind-committed FABs (Calendar / Lists / Contacts / Custody) wire
  directly to the respective create route. They skip the chooser.
- The chooser FABs (Today / Family) open the existing
  `QuickCreateSheet` modal.
- Labels are static strings, not computed — no need to overthink i18n
  for the verb prefix here. `t('fab.new_event')` etc.

## Open product questions

1. **Should the Family tab's FAB be kind-committed too?** The most
   common create from Family is probably "invite a member" — but it
   could also be "add a child" or "add a contact." If user research
   shows invite dominates, consider committing the Family FAB to
   "Invite member" → `MembersScreen` invite form.

2. **The chooser sheet on Today** could grow to include "New override"
   for separated households (where overrides happen often). Out of
   scope for this handoff but worth noting — would extend the 2×2
   grid to 2×3.

3. **Long-press on a kind-committed FAB** could open the chooser
   sheet as a power-user escape hatch ("I'm on Calendar but I really
   want to add a task"). iOS Shortcuts uses this pattern. Optional
   polish.

## Files in this bundle

- `OneNest - UI Explorations (standalone).html` — **single self-contained HTML, ~2.3 MB.** Opens offline.
- `OneNest - UI Explorations.html` — multi-file version
- All `.jsx` source files

See sibling folders for the related handoffs:
- `design_handoff_settings_subroutes/` — Settings sub-routes + 5-tab nav + Contacts tab
- `design_handoff_task_detail_v2/` — Task detail v2 + bottom-sheet edits
- `design_handoff_custody_surfaces/` — Today/Family Hub/Schedule/Pattern editor
- `design_handoff_event_responsible/` — Event kebab + multi-responsible model
- `design_handoff_creation_flows/` — Create task/list/contact/child/override
- `design_handoff_lists_v2/` — Lists tab with FAB + tappable list cards
