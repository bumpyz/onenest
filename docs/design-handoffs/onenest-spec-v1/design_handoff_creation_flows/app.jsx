// app.jsx — assembles the design canvas
// Round 4: matched light/dark pair · P3 Mist Forest + new P4 Charcoal Forest.

function ReadMe() {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0F1115',
      color: '#E8E8EB', padding: '60px 44px',
      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
      overflow: 'auto', boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: '"Geist Mono", monospace', fontSize: 11,
        color: '#3FC198', letterSpacing: 1.2, fontWeight: 600, marginBottom: 12,
      }}>ROUND 4 · MATCHED PAIR</div>
      <div style={{
        fontSize: 40, fontWeight: 600, letterSpacing: -1.4,
        lineHeight: 1.05, marginBottom: 24, color: '#FFFFFF',
      }}>Mist Forest, light & dark.</div>

      <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#BFC0C5', marginBottom: 28 }}>
        You wanted P4&apos;s dark mode shape with P3&apos;s forest accent — here it is, paired
        with P3 itself as the matched light mode. Same C layout in both, same accent family,
        same member colors brightened for the dark surface.
      </div>

      <PairCard
        leftName="P3 · Mist Forest (light)"
        leftSwatches={['#ECEFEC', '#FFFFFF', '#161C18', '#2D8B6E']}
        rightName="P4-F · Charcoal Forest (dark)"
        rightSwatches={['#15171B', '#1F2128', '#F0F0F2', '#3FC198']}
      />

      <div style={{
        fontFamily: '"Geist Mono", monospace', fontSize: 11,
        color: '#888A92', letterSpacing: 0.4, marginTop: 28, marginBottom: 10,
        textTransform: 'uppercase',
      }}>Accent tuning notes</div>
      <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 12.5, lineHeight: 1.7, color: '#BFC0C5' }}>
        <li>Light accent: <code style={{ fontFamily: '"Geist Mono", monospace', color: '#3FC198' }}>#2D8B6E</code> — deep forest, calm and trustworthy on near-white</li>
        <li>Dark accent: <code style={{ fontFamily: '"Geist Mono", monospace', color: '#3FC198' }}>#3FC198</code> — same hue family, brightened so it pops on near-black (the original #2D8B6E read too muted in dark mode)</li>
        <li>On-accent text: dark in both modes — the green is bright enough to handle dark glyphs at 7:1+ contrast, which gives the FAB / today-marker / active chips a more confident look than white-on-green</li>
        <li>Member colors brightened ~15% in dark mode so identity dots still register</li>
      </ul>

      <div style={{
        marginTop: 28, padding: 16, background: 'rgba(63,193,152,0.08)',
        borderRadius: 12, borderLeft: '3px solid #3FC198',
        fontSize: 12.5, lineHeight: 1.6, color: '#BFC0C5',
      }}>
        <b style={{ color: '#FFFFFF' }}>Where next:</b> if this matched pair feels right,
        we can extend into the screens we skipped (Event detail, Custody schedule, Onboarding),
        or tune accent saturation up/down. The original four palettes (P1 Slate Coral, P2 Bell
        Navy, P4 Charcoal Coral) are kept as reference below.
      </div>
    </div>
  );
}

function PairCard({ leftName, leftSwatches, rightName, rightSwatches }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
    }}>
      <PaletteHalf name={leftName} swatches={leftSwatches} dark={false} />
      <PaletteHalf name={rightName} swatches={rightSwatches} dark={true} />
    </div>
  );
}

function PaletteHalf({ name, swatches, dark }) {
  return (
    <div style={{
      padding: 16, borderRadius: 12,
      background: dark ? '#0B0C0F' : '#FFFFFF',
      border: '1px solid rgba(63,193,152,0.3)',
    }}>
      <div style={{
        fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
        color: dark ? '#F0F0F2' : '#161C18', marginBottom: 12,
      }}>{name}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {swatches.map((c, i) => (
          <div key={i} style={{
            flex: 1, height: 32, borderRadius: 5, background: c,
            border: '0.5px solid rgba(0,0,0,0.08)',
          }} />
        ))}
      </div>
      <div style={{
        fontFamily: '"Geist Mono", monospace', fontSize: 9.5,
        color: dark ? '#6E7079' : '#828B85', marginTop: 8, letterSpacing: -0.2,
        display: 'flex', gap: 4, justifyContent: 'space-between',
      }}>
        {swatches.map((c, i) => <span key={i}>{c.replace('#','').toLowerCase()}</span>)}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <DesignCanvas>
    {/* ───────────────────────────────────────────────────────────────────
        00 · Foundations — palette + intro
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="intro" title="00 · Foundations — Mist Forest, matched pair" subtitle="P3 light + P4 Charcoal Forest dark — same accent family, light/dark schemes">
      <DCArtboard id="readme" label="Read me" width={520} height={874}>
        <ReadMe />
      </DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        01 · Auth & onboarding
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-signin" title="01.1 · Auth — Sign in" subtitle="First touch. Hero accent-band with brand mark · Google / Apple / Email · invite-link helper for co-parents who landed from email.">
      <DCArtboard id="p3-signin"  label="P3 · light"  width={402} height={874}><SignIn palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-signin" label="P4-F · dark" width={402} height={874}><SignIn palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-onboarding" title="01.2 · Onboarding — create household" subtitle="Step 2 of 5 — household name + family type. Single-action focus, mono labels, accent-tinted selected state.">
      <DCArtboard id="p3-onboard"  label="P3 · light"  width={402} height={874}><Onboarding palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-onboard" label="P4-F · dark" width={402} height={874}><Onboarding palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-join" title="01.3 · Join household — what the invitee sees" subtitle="Hero with inviter's avatar · family preview with parents + kids · role picker (Co-parent / Caregiver / External co-parent) · privacy reassurance.">
      <DCArtboard id="p3-join"  label="P3 · light"  width={402} height={874}><JoinHousehold palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-join" label="P4-F · dark" width={402} height={874}><JoinHousehold palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-firstrun" title="01.4 · First-run Home — empty state" subtitle="What a brand-new household sees on Home · welcome card with 4-step setup checklist (invite, add kids, custody, first event), empty timeline placeholder.">
      <DCArtboard id="p3-firstrun"  label="P3 · light"  width={402} height={874}><FirstRunHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-firstrun" label="P4-F · dark" width={402} height={874}><FirstRunHome palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        02 · Today (Home tab)
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-today-custody" title="02.1 · Today — current design (with custody strip)" subtitle="Canonical Home. Compact custody status strip slots in between the AI command bar and the conflict card. Single tap-target that summarizes who has the kids today + when the next handoff happens. Strip hides for single-household families.">
      <DCArtboard id="p3-today-custody"  label="P3 · light"  width={402} height={874}><ProHomeV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-today-custody" label="P4-F · dark" width={402} height={874}><ProHomeV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair" title="02.2 · Today — reference (no custody strip, top + scrolled)" subtitle="Original Home before the custody strip was added. Top + scrolled ~780px so the 'To do' and 'Around the house' sections are visible. Kept as reference.">
      <DCArtboard id="p3-home"            label="P3 · top"            width={402} height={874}><ProHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-home"           label="P4-F · top"          width={402} height={874}><ProHome palette={paletteCharcoalForest} /></DCArtboard>
      <DCArtboard id="p3-home-scrolled"   label="P3 · scrolled"       width={402} height={874}><ProHome palette={paletteMistForest} scrollTop={780} /></DCArtboard>
      <DCArtboard id="p4f-home-scrolled"  label="P4-F · scrolled"     width={402} height={874}><ProHome palette={paletteCharcoalForest} scrollTop={780} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-caregiver" title="02.3 · Today — caregiver view" subtitle="What Nina (the nanny) sees · read-only banner, no FAB, events show a tiny lock badge instead of edit chevron, parent's private items show as 'Busy', tasks assigned to her are fully actionable, explainer card listing exactly what's allowed.">
      <DCArtboard id="p3-caregiver"  label="P3 · light"  width={402} height={874}><CaregiverHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-caregiver" label="P4-F · dark" width={402} height={874}><CaregiverHome palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-quick-create" title="02.4 · Quick-create chooser (FAB)" subtitle="What tapping the FAB opens · AI parse-paste row at top with ⌘V badge, 2×2 grid of primary kinds (Event / Task / List / Contact) each with keyboard shortcut, slim row for Custody override + Reminder, Cancel.">
      <DCArtboard id="p3-quick-create"  label="P3 · light"  width={402} height={874}><QuickCreateSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-quick-create" label="P4-F · dark" width={402} height={874}><QuickCreateSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        03 · Calendar
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-cal" title="03.1 · Calendar — week (default)">
      <DCArtboard id="p3-cal"   label="P3 · light"  width={402} height={874}><ProCalendar palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal"  label="P4-F · dark" width={402} height={874}><ProCalendar palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-cal-month" title="03.2 · Calendar — month" subtitle="5-week grid · per-day event dots (3 visible + N counter), today marker in accent, selected day expands a preview card at the bottom with the day's events + 'Open day view' affordance.">
      <DCArtboard id="p3-cal-month"  label="P3 · light"  width={402} height={874}><CalendarMonth palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal-month" label="P4-F · dark" width={402} height={874}><CalendarMonth palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-cal-day" title="03.3 · Calendar — day" subtitle="Single day · scrollable date strip ←26→, summary pills (4 events / 1 conflict / 1 hand-off / 2 tasks), all-day strip for multi-day events, hourly grid with NOW timestamp, side-by-side conflict blocks at 16:00.">
      <DCArtboard id="p3-cal-day"  label="P3 · light"  width={402} height={874}><CalendarDay palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal-day" label="P4-F · dark" width={402} height={874}><CalendarDay palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        04 · Events
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-event" title="04.1 · Event detail — top + scrolled" subtitle="Soph's piano lesson · two scroll positions for each palette so you can see the upper sections + the Attached list below Location.">
      <DCArtboard id="p3-event-top"        label="P3 · top"           width={402} height={874}><EventDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-event-scrolled"   label="P3 · scrolled 3/4"  width={402} height={874}><EventDetail palette={paletteMistForest} scrollTop={540} /></DCArtboard>
      <DCArtboard id="p4f-event-top"       label="P4-F · top"         width={402} height={874}><EventDetail palette={paletteCharcoalForest} /></DCArtboard>
      <DCArtboard id="p4f-event-scrolled"  label="P4-F · scrolled 3/4" width={402} height={874}><EventDetail palette={paletteCharcoalForest} scrollTop={540} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event-new" title="04.2 · Event create form" subtitle="The daily-use input surface · sticky save bar · AI parse-paste tip · all-day toggle · responsible/for chip pickers · location autocomplete · attach list · smart automation suggestion at the bottom.">
      <DCArtboard id="p3-event-new"  label="P3 · light"  width={402} height={874}><EventCreate palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-event-new" label="P4-F · dark" width={402} height={874}><EventCreate palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event-multi" title="04.3 · Event — multi-responsible (birthday)" subtitle="When more than one parent / caregiver / external co-parent is responsible for an event, the Responsible row becomes a stack of chips instead of a single avatar+name. Tagging is the sharing primitive — anyone tagged sees the full event across both their homes. First-tagged gets the LEAD chip (primary push recipient). Header carries a SHARED · 3 HOMES badge so it's obvious at a glance the event has cross-household visibility. A Guests section accommodates non-member attendees (12 kids at the birthday) without conflating them with responsible adults.">
      <DCArtboard id="p3-event-multi"  label="P3 · light"  width={402} height={874}><EventDetailMulti palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-event-multi" label="P4-F · dark" width={402} height={874}><EventDetailMulti palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event-responsible" title="04.4 · Event — Responsible picker (multi-select)" subtitle="Opens when you tap the Responsible row or any chip in it. Multi-select sheet (square checkboxes, not radios) listing co-parents + external co-parents + caregivers. Each row carries role tags (EXT / CARE) and current state context ('with the kids this week', 'not on this event'). Below the list: a Lead picker row showing who gets the LEAD chip and the primary reminder push. Footer card reinforces the central rule: tagging = visibility, untagged people see 'Busy' only.">
      <DCArtboard id="p3-event-responsible"  label="P3 · light"  width={402} height={874}><EventResponsibleSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-event-responsible" label="P4-F · dark" width={402} height={874}><EventResponsibleSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event-overflow" title="04.5 · Event — ••• overflow sheet" subtitle="Where the kebab in the Event detail top bar leads. Share is intentionally a separate top-level pill (sharing an event is the most-common non-editing action — making people dig through ••• for it would be wrong). The kebab handles everything else. Four grouped sections: recurrence (only for recurring events — edit this/edit series/skip), actions (duplicate, copy-day, convert-to-task, reassign-across-custody as an accent recommendation when there's a conflict, .ics export), visibility (who can see + mark private), and destructive (delete this occurrence vs delete entire series).">
      <DCArtboard id="p3-event-overflow"        label="P3 · recurring"  width={402} height={874}><EventOverflowSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-event-overflow-oneoff" label="P3 · one-off"    width={402} height={874}><EventOverflowSheetOneOff palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-event-overflow"       label="P4-F · dark"     width={402} height={874}><EventOverflowSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-conflict" title="04.6 · Conflict resolution — full screen" subtitle="The full-screen version of the inline conflict ribbon · two event cards with an X glyph between them, 45min overlap bar, 3 ranked suggestions (BEST PICK badge, effort estimate), manual options below, sticky 'Apply' CTA showing the selected outcome.">
      <DCArtboard id="p3-conflict"  label="P3 · light"  width={402} height={874}><ConflictResolution palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-conflict" label="P4-F · dark" width={402} height={874}><ConflictResolution palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        05 · Lists & tasks
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-lists" title="05.1 · Lists overview">
      <DCArtboard id="p3-lists"   label="P3 · light"  width={402} height={874}><ProLists palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-lists"  label="P4-F · dark" width={402} height={874}><ProLists palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-list-detail" title="05.2 · List detail" subtitle="Open the Grocery list · color-tinted header, progress bar, filtered task groups (Today / This week / Done), inline qty + priority chips, list metadata + sharing.">
      <DCArtboard id="p3-list-detail"  label="P3 · light"  width={402} height={874}><ListDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-list-detail" label="P4-F · dark" width={402} height={874}><ListDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-v2" title="05.3 · Task detail — current design (v2)" subtitle="Canonical task detail. Field carets on Details rows open bottom sheets instead of pushing to /edit. Title is inline-editable (no pencil — tap to rename). Priority row joins Details; the HIGH PRIORITY hero pill is read-only status. 'For whom' children chips get their own SGroup.">
      <DCArtboard id="p3-task-v2"            label="P3 · light"             width={402} height={874}><TaskDetailV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-v2-editing"    label="P3 · editing title"     width={402} height={874}><TaskDetailV2 palette={paletteMistForest} editingTitle={true} /></DCArtboard>
      <DCArtboard id="p4f-task-v2"           label="P4-F · dark"            width={402} height={874}><TaskDetailV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-field-sheets" title="05.4 · Task — field-edit sheets" subtitle="The bottom-sheet pattern in place of the old /edit catch-all. Each row's caret on Task detail opens one of these — Due (presets + calendar + time), Reminder (preset list), Assigned to (single-select with auto-assign toggle), Priority (5 levels), Recurring (preset list with custody-aware bi-weekly), Lists & For whom (multi-select with search + create).">
      <DCArtboard id="p3-task-due"        label="Due"          width={402} height={874}><DueDateSheet  palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-reminder"   label="Reminder"     width={402} height={874}><ReminderSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-assign"     label="Assigned to"  width={402} height={874}><AssignSheet   palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-priority"   label="Priority"     width={402} height={874}><PrioritySheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-recurring"  label="Recurring"    width={402} height={874}><RecurringSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-lists"      label="In lists"     width={402} height={874}><ListsSheet    palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-children"   label="For whom"     width={402} height={874}><ChildrenSheet palette={paletteMistForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-overflow" title="05.5 · Task — ••• overflow sheet" subtitle="Where the horizontal kebab in the top bar leads. iOS-style action sheet with three grouped sections — primary actions (Share, Duplicate, Convert to event, Move, Pin), secondary (Archive, Export), and a destructive Delete in its own alert-tinted card.">
      <DCArtboard id="p3-task-overflow"  label="P3 · light"  width={402} height={874}><TaskOverflowSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-task-overflow" label="P4-F · dark" width={402} height={874}><TaskOverflowSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task" title="05.6 · Task detail — reference (v1)" subtitle="Original task detail before the v2 pattern. Kept as before/after reference — superseded by 05.3.">
      <DCArtboard id="p3-task"  label="P3 · light"  width={402} height={874}><TaskDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-task" label="P4-F · dark" width={402} height={874}><TaskDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-create-task" title="05.7 · Create task" subtitle="Reached from the FAB → Task. Follows the canonical create-flow scaffold: Cancel/title/Save sticky top bar, accent-underlined title input with blinking caret, AI parse helper, mono caps section labels. Sections: When (due, reminder, repeats), Who (assigned to + for whom), In lists (multi-select chips), Priority (5-level segmented), Notes. Smart-suggestion card at the bottom proposes attaching to the next relevant hand-off.">
      <DCArtboard id="p3-create-task"  label="P3 · light"  width={402} height={874}><CreateTask palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-create-task" label="P4-F · dark" width={402} height={874}><CreateTask palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-create-list" title="05.8 · Create list" subtitle="Reached from the FAB → List or from Lists → + New. Sections: Kind (Tasks/Grocery/Shopping/Packing segmented — determines whether items have qty + store), Color + icon, For (multi-select kids · sets default 'for whom' on new tasks), Shared with (members multi-select with visibility explainer), Start from (Blank or curated template like 'Soccer prep'). Smart-suggestion offers to auto-attach the list to a recurring event.">
      <DCArtboard id="p3-create-list"  label="P3 · light"  width={402} height={874}><CreateList palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-create-list" label="P4-F · dark" width={402} height={874}><CreateList palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        06 · Custody
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-custody-viewer" title="06.1 · Custody — schedule viewer (current)" subtitle="The canonical Custody Schedule. Calendar layout with the pattern editor exposed via an explicit 'Pattern ⚙' button in the top-right (text not a bare gear, so non-technical co-parents read it as 'edit the rules'). Footer hint explains the distinction between Pattern (rule edits) and long-press a day (one-off swaps).">
      <DCArtboard id="p3-custody-viewer"  label="P3 · light"  width={402} height={874}><CustodyScheduleV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-custody-viewer" label="P4-F · dark" width={402} height={874}><CustodyScheduleV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-custody-pattern" title="06.2 · Custody — pattern editor" subtitle="Replaces the old /settings/custody route. Reached only from the viewer's 'Pattern' button. Top: live 2-week preview that updates as you change rules (red bars mark handoffs). Then: Pattern type (radio cards with mini visualizations), Hand-off (day-of-week segmented + time + location), Anchor (start date + who-starts), Per-child overrides, Behavior toggles, and a destructive 'Stop using a custody pattern' action. Sticky bottom bar shows downstream impact before save.">
      <DCArtboard id="p3-custody-pattern"  label="P3 · light"  width={402} height={874}><CustodyPatternEditor palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-custody-pattern" label="P4-F · dark" width={402} height={874}><CustodyPatternEditor palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-custody-override" title="06.3 · Custody — new override" subtitle="Reached from the FAB on the Custody schedule viewer. A one-off swap for a specific date or range (different from a pattern change, which alters the rule going forward). Live preview shows DEFAULT vs WITH OVERRIDE so changes read at a glance. What-kind chips up top frame the override for everyone affected (Family trip, Birthday, Work travel, Anniversary, Just swapping, Other). When = single-day toggle + date range with preset chips. Affects = multi-select kids with their current default. With whom = single-select caregiver list. Notes optional. The co-parent approval banner is auto-detected and only appears when an external co-parent is affected — explains exactly who needs to approve and why. Sticky bottom shows the override summary + 'Send for approval' CTA (changes to 'Save override' when no external co-parents involved).">
      <DCArtboard id="p3-custody-override"  label="P3 · light"  width={402} height={874}><NewOverride palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-custody-override" label="P4-F · dark" width={402} height={874}><NewOverride palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-handoff" title="06.4 · Custody — hand-off day (Oliver → Casey)" subtitle="What tapping a hand-off opens · countdown, From → To with avatars and the kid in between, before-pickup checklist, the privacy-fenced view of what Casey will actually see.">
      <DCArtboard id="p3-handoff"  label="P3 · light"  width={402} height={874}><HandoffDay palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-handoff" label="P4-F · dark" width={402} height={874}><HandoffDay palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-custody" title="06.5 · Custody — schedule viewer (reference, no Pattern button)" subtitle="Original Custody Schedule before the Pattern button was added. Kept as before/after reference — superseded by 06.1.">
      <DCArtboard id="p3-custody"  label="P3 · light"  width={402} height={874}><CustodySchedule palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-custody" label="P4-F · dark" width={402} height={874}><CustodySchedule palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        07 · Family hub & people
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-family-custody" title="07.1 · Family Hub — current design (custody promoted)" subtitle="Canonical Family tab. Custody schedule is the top-level hero with an explicit 'Open schedule →' CTA, plus a pending-swap nudge when a co-parent has requested a change. The Custody schedule row is removed from the Manage section below — Manage now contains only Connected calendars + Settings.">
      <DCArtboard id="p3-family-custody"  label="P3 · light"  width={402} height={874}><FamilyHubV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-family-custody" label="P4-F · dark" width={402} height={874}><FamilyHubV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-add-child" title="07.2 · Add child" subtitle="Reached from Family Hub → Kids → + ADD. Sections: avatar preview at top (tap to upload photo or accept color+initial), Name, Basics (birthday, pronouns, nickname), Color (8 swatches mapped to the identity palette), Who Theo lives with (multi-select adults — selecting an external co-parent enables shared custody for this child; this is the most consequential field on the screen), School, Health (allergies with severity chip, medications, pediatrician linked from contacts), Visibility (caregiver and external co-parent scoping).">
      <DCArtboard id="p3-add-child"  label="P3 · light"  width={402} height={874}><AddChild palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-add-child" label="P4-F · dark" width={402} height={874}><AddChild palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-child-detail" title="07.3 · Child detail — Soph" subtitle="Child profile · where she is this week (custody mini-bar), upcoming events, lists tagged for her, contacts that belong to her (piano teacher, doctor), allergy notes.">
      <DCArtboard id="p3-child-detail"  label="P3 · light"  width={402} height={874}><ChildDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-child-detail" label="P4-F · dark" width={402} height={874}><ChildDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-remove" title="07.4 · Remove caregiver — bottom sheet" subtitle="Parent's view from Family Hub → tap Nina → this sheet. Hero with her avatar + role + tenure, current access summary, alert-tinted 'happens immediately' consequences, dashed-border 'what stays' (completed tasks + history attribution), destructive Remove + Cancel.">
      <DCArtboard id="p3-remove"  label="P3 · light"  width={402} height={874}><RemoveCaregiverSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-remove" label="P4-F · dark" width={402} height={874}><RemoveCaregiverSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-family-hub" title="07.5 · Family Hub — reference (Manage with Contacts + Custody)" subtitle="Original Family Hub before Custody was promoted and Contacts became a top-level tab. Kept as before/after reference — superseded by 07.1.">
      <DCArtboard id="p3-family-hub"  label="P3 · light"  width={402} height={874}><FamilyHub palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-family-hub" label="P4-F · dark" width={402} height={874}><FamilyHub palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        08 · Contacts (now its own bottom-nav tab)
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-contacts" title="08.1 · Contacts — list" subtitle="Top-level tab in the bottom nav. Search + pinned Emergency strip, favorites, categorized rows (medical / school / activities / family) with per-child tags and quick-action buttons.">
      <DCArtboard id="p3-contacts"  label="P3 · light"  width={402} height={874}><ContactsList palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-contacts" label="P4-F · dark" width={402} height={874}><ContactsList palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-contact-detail" title="08.2 · Contacts — detail" subtitle="Mrs. Anderson · Soph's piano teacher — big quick-action bar, linked recurring event, address with map preview, history.">
      <DCArtboard id="p3-contact-detail"  label="P3 · light"  width={402} height={874}><ContactDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-contact-detail" label="P4-F · dark" width={402} height={874}><ContactDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-create-contact" title="08.3 · Create contact" subtitle="Reached from the FAB → Contact or from Contacts → +. Sections: Type (Medical / School / Activity / Family / Other segmented + sub-type chevron row), Belongs to (multi-select kids — drives visibility · only people who can see those kids see the contact), Contact info (phone / email / address rows with mono right-aligned values + glyph), Linked event (optional — connects to a recurring event like Soph's piano lesson, surfaces both directions), Quick flags (Pin to top, Emergency contact), Notes.">
      <DCArtboard id="p3-create-contact"  label="P3 · light"  width={402} height={874}><CreateContact palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-create-contact" label="P4-F · dark" width={402} height={874}><CreateContact palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        09 · Settings (reached from Family Hub → Settings)
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-settings-v2" title="09.1 · Settings — main" subtitle="Back-carrot top bar (Settings is reached via the Family tab), slim hero now read-only with an Edit chevron that opens /settings/profile, Members + Appearance collapsed to nav rows. The original dashed Invite hero is gone — that surface is now the Members screen.">
      <DCArtboard id="p3-settings-v2"  label="P3 · light"  width={402} height={874}><SettingsV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-settings-v2" label="P4-F · dark" width={402} height={874}><SettingsV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-profile" title="09.2 · Settings — /profile" subtitle="Reached by tapping the avatar (or 'Edit →') in the Settings hero. Display name (was inline-edited in the hero) and the My color picker that maps to the identity palette. Greyed-out swatches are claimed by other members so two people can't end up the same color.">
      <DCArtboard id="p3-profile"  label="P3 · light"  width={402} height={874}><ProfileEdit palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-profile" label="P4-F · dark" width={402} height={874}><ProfileEdit palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-members" title="09.3 · Settings — /members" subtitle="Replaces the invite hero card + read-only Members row. Invite form (email/phone input + role chips + send), Pending invitations with expiry and resend/cancel, Members list with role chips and a three-dot affordance that opens the remove sheet.">
      <DCArtboard id="p3-members"  label="P3 · light"  width={402} height={874}><MembersScreen palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-members" label="P4-F · dark" width={402} height={874}><MembersScreen palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-appearance" title="09.4 · Settings — /appearance" subtitle="Theme picker, Accent (palette + per-element swatch), Compact density toggle. Same /settings/<x> pattern as Household, Children, etc. Includes a live preview card at the top.">
      <DCArtboard id="p3-appearance"  label="P3 · light"  width={402} height={874}><AppearanceScreen palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-appearance" label="P4-F · dark" width={402} height={874}><AppearanceScreen palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        10 · Notifications & out-of-app surfaces
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="pair-inbox" title="10.1 · Notifications — activity inbox" subtitle="All in-app notifications · grouped by day, filter chips (All / Unread / Mentions / Conflicts), unread tint, @YOU mention markers, kind-specific icons.">
      <DCArtboard id="p3-inbox"  label="P3 · light"  width={402} height={874}><NotificationsInbox palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-inbox" label="P4-F · dark" width={402} height={874}><NotificationsInbox palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-digest" title="10.2 · Notifications — Sunday weekly digest" subtitle="The Sunday in-app summary · stat row, conflicts + swap requests needing attention, hand-offs, highlights, task buckets by person.">
      <DCArtboard id="p3-digest"  label="P3 · light"  width={402} height={874}><WeeklyDigest palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-digest" label="P4-F · dark" width={402} height={874}><WeeklyDigest palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="push-lock" title="10.3 · Push — iOS lock screen" subtitle="What OneNest looks like outside the app · Live Activity countdown for the next hand-off, stacked notifications below for conflicts / swap requests / reminders.">
      <DCArtboard id="push-lock-screen" label="Lock screen · dark" width={402} height={874}><PushLockScreen /></DCArtboard>
    </DCSection>

    {/* ───────────────────────────────────────────────────────────────────
        99 · Reference — alternate palette directions
        ─────────────────────────────────────────────────────────────── */}
    <DCSection id="alt-palettes" title="99 · Reference — other palette directions" subtitle="The Home screen in the original four palettes, kept so the matched pair stays in context.">
      <DCArtboard id="p1-home" label="P1 · Slate Coral"     width={402} height={874}><ProHome palette={paletteSlateCoral} /></DCArtboard>
      <DCArtboard id="p2-home" label="P2 · Bell Navy"       width={402} height={874}><ProHome palette={paletteBellNavy} /></DCArtboard>
      <DCArtboard id="p4c-home" label="P4 · Charcoal Coral" width={402} height={874}><ProHome palette={paletteCharcoal} /></DCArtboard>
    </DCSection>
  </DesignCanvas>
);
