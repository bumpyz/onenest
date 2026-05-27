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
    <DCSection id="intro" title="OneNest · Mist Forest, matched pair" subtitle="P3 light + P4 Charcoal Forest dark — same accent family, light/dark schemes">
      <DCArtboard id="readme" label="Read me" width={520} height={874}>
        <ReadMe />
      </DCArtboard>
    </DCSection>

    <DCSection id="pair" title="Matched pair — Home · top + scrolled" subtitle="Light P3 + dark P4-F at the top, and the same two scrolled ~700px down so the standalone 'To do' and 'Around the house' sections are visible.">
      <DCArtboard id="p3-home"            label="P3 · top"            width={402} height={874}><ProHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-home"           label="P4-F · top"          width={402} height={874}><ProHome palette={paletteCharcoalForest} /></DCArtboard>
      <DCArtboard id="p3-home-scrolled"   label="P3 · scrolled"       width={402} height={874}><ProHome palette={paletteMistForest} scrollTop={780} /></DCArtboard>
      <DCArtboard id="p4f-home-scrolled"  label="P4-F · scrolled"     width={402} height={874}><ProHome palette={paletteCharcoalForest} scrollTop={780} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-cal" title="Matched pair — Calendar">
      <DCArtboard id="p3-cal"   label="P3 · light"  width={402} height={874}><ProCalendar palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal"  label="P4-F · dark" width={402} height={874}><ProCalendar palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-lists" title="Matched pair — Lists">
      <DCArtboard id="p3-lists"   label="P3 · light"  width={402} height={874}><ProLists palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-lists"  label="P4-F · dark" width={402} height={874}><ProLists palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event" title="Event detail · top + scrolled" subtitle="Soph's piano lesson · two scroll positions for each palette so you can see the upper sections + the Attached list below Location.">
      <DCArtboard id="p3-event-top"        label="P3 · top"           width={402} height={874}><EventDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-event-scrolled"   label="P3 · scrolled 3/4"  width={402} height={874}><EventDetail palette={paletteMistForest} scrollTop={540} /></DCArtboard>
      <DCArtboard id="p4f-event-top"       label="P4-F · top"         width={402} height={874}><EventDetail palette={paletteCharcoalForest} /></DCArtboard>
      <DCArtboard id="p4f-event-scrolled"  label="P4-F · scrolled 3/4" width={402} height={874}><EventDetail palette={paletteCharcoalForest} scrollTop={540} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-custody" title="Custody schedule" subtitle="Four-week visualization, pending swap requests, upcoming hand-offs, active overrides">
      <DCArtboard id="p3-custody"  label="P3 · light"  width={402} height={874}><CustodySchedule palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-custody" label="P4-F · dark" width={402} height={874}><CustodySchedule palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-onboarding" title="Onboarding · create household" subtitle="Step 2 of 5 — household name + family type. Single-action focus, mono labels, accent-tinted selected state.">
      <DCArtboard id="p3-onboard"  label="P3 · light"  width={402} height={874}><Onboarding palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-onboard" label="P4-F · dark" width={402} height={874}><Onboarding palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-family-hub" title="Family hub" subtitle="What the Family bottom-nav tab opens. Hub for Members, Children, Contacts, Custody Schedule, and Settings — answers the 'how do I get to Settings/Schedule?' question.">
      <DCArtboard id="p3-family-hub"  label="P3 · light"  width={402} height={874}><FamilyHub palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-family-hub" label="P4-F · dark" width={402} height={874}><FamilyHub palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-signin" title="Sign-in · first-touch" subtitle="Hero accent-band with brand mark · Google / Apple / Email options · invite-link helper for co-parents who landed here from an email">
      <DCArtboard id="p3-signin"  label="P3 · light"  width={402} height={874}><SignIn palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-signin" label="P4-F · dark" width={402} height={874}><SignIn palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-join" title="Join household · what the invitee sees" subtitle="Hero with inviter's avatar · family preview with parents + kids · role picker (Co-parent / Caregiver / External co-parent) · privacy reassurance">
      <DCArtboard id="p3-join"  label="P3 · light"  width={402} height={874}><JoinHousehold palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-join" label="P4-F · dark" width={402} height={874}><JoinHousehold palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-event-new" title="Event create form" subtitle="The daily-use input surface · sticky save bar · AI parse-paste tip · all-day toggle · responsible/for chip pickers · location autocomplete · attach list · smart automation suggestion at the bottom">
      <DCArtboard id="p3-event-new"  label="P3 · light"  width={402} height={874}><EventCreate palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-event-new" label="P4-F · dark" width={402} height={874}><EventCreate palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="push-lock" title="Push notifications · iOS lock screen" subtitle="What OneNest looks like outside the app · Live Activity countdown for the next hand-off, stacked notifications below for conflicts / swap requests / reminders">
      <DCArtboard id="push-lock-screen" label="Lock screen · dark" width={402} height={874}><PushLockScreen /></DCArtboard>
    </DCSection>

    <DCSection id="pair-list-detail" title="List detail" subtitle="Open the Grocery list · color-tinted header, progress bar, filtered task groups (Today / This week / Done), inline qty + priority chips, list metadata + sharing">
      <DCArtboard id="p3-list-detail"  label="P3 · light"  width={402} height={874}><ListDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-list-detail" label="P4-F · dark" width={402} height={874}><ListDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-child-detail" title="Child detail · Soph" subtitle="Child profile · where she is this week (custody mini-bar), upcoming events, lists tagged for her, contacts that belong to her (piano teacher, doctor), allergy notes">
      <DCArtboard id="p3-child-detail"  label="P3 · light"  width={402} height={874}><ChildDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-child-detail" label="P4-F · dark" width={402} height={874}><ChildDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-handoff" title="Hand-off day · Oliver → Casey" subtitle="What tapping a hand-off opens · countdown, From → To with avatars and the kid in between, before-pickup checklist, the privacy-fenced view of what Casey will actually see">
      <DCArtboard id="p3-handoff"  label="P3 · light"  width={402} height={874}><HandoffDay palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-handoff" label="P4-F · dark" width={402} height={874}><HandoffDay palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-digest" title="Sunday weekly digest" subtitle="The Sunday in-app summary · stat row, conflicts + swap requests needing attention, hand-offs, highlights, task buckets by person">
      <DCArtboard id="p3-digest"  label="P3 · light"  width={402} height={874}><WeeklyDigest palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-digest" label="P4-F · dark" width={402} height={874}><WeeklyDigest palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-firstrun" title="First-run Home · empty state" subtitle="What a brand-new household sees on Home · welcome card with 4-step setup checklist (invite, add kids, custody, first event), empty timeline placeholder">
      <DCArtboard id="p3-firstrun"  label="P3 · light"  width={402} height={874}><FirstRunHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-firstrun" label="P4-F · dark" width={402} height={874}><FirstRunHome palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task" title="Task detail" subtitle="Open a single task · checkbox + title hero, status pills (overdue / priority), assigned-to and reminder rows, linked event card, lists it belongs to, change history">
      <DCArtboard id="p3-task"  label="P3 · light"  width={402} height={874}><TaskDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-task" label="P4-F · dark" width={402} height={874}><TaskDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-v2" title="Task detail · v2" subtitle="Updated detail screen reflecting the new edit pattern. Field carets on Details rows now open bottom sheets instead of pushing to /edit. Title is inline-editable (no pencil icon — tap to rename). A new Priority row joins Details; the HIGH PRIORITY hero pill becomes read-only status. 'For whom' children chips get their own SGroup. Tap-to-edit hint sits under the status pills.">
      <DCArtboard id="p3-task-v2"            label="P3 · light"             width={402} height={874}><TaskDetailV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-v2-editing"    label="P3 · editing title"     width={402} height={874}><TaskDetailV2 palette={paletteMistForest} editingTitle={true} /></DCArtboard>
      <DCArtboard id="p4f-task-v2"           label="P4-F · dark"            width={402} height={874}><TaskDetailV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-overflow" title="Task overflow · ••• kebab" subtitle="Where the horizontal kebab in the top bar leads. iOS-style action sheet with three grouped sections — primary actions (Share, Duplicate, Convert to event, Move, Pin), secondary (Archive, Export), and a destructive Delete in its own alert-tinted card.">
      <DCArtboard id="p3-task-overflow"  label="P3 · light"  width={402} height={874}><TaskOverflowSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-task-overflow" label="P4-F · dark" width={402} height={874}><TaskOverflowSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-task-field-sheets" title="Task field-edit sheets" subtitle="The bottom-sheet pattern in place of the old /edit catch-all. Each row's caret on Task detail opens one of these — Due (presets + calendar + time), Reminder (preset list), Assigned to (single-select with auto-assign toggle), Priority (5 levels), Recurring (preset list with custody-aware bi-weekly), Lists & For whom (multi-select with search + create).">
      <DCArtboard id="p3-task-due"        label="Due"          width={402} height={874}><DueDateSheet  palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-reminder"   label="Reminder"     width={402} height={874}><ReminderSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-assign"     label="Assigned to"  width={402} height={874}><AssignSheet   palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-priority"   label="Priority"     width={402} height={874}><PrioritySheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-recurring"  label="Recurring"    width={402} height={874}><RecurringSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-lists"      label="In lists"     width={402} height={874}><ListsSheet    palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p3-task-children"   label="For whom"     width={402} height={874}><ChildrenSheet palette={paletteMistForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-inbox" title="Notifications · activity inbox" subtitle="All in-app notifications · grouped by day, filter chips (All / Unread / Mentions / Conflicts), unread tint, @YOU mention markers, kind-specific icons">
      <DCArtboard id="p3-inbox"  label="P3 · light"  width={402} height={874}><NotificationsInbox palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-inbox" label="P4-F · dark" width={402} height={874}><NotificationsInbox palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-caregiver" title="Caregiver view" subtitle="What Nina (the nanny) sees · read-only banner, no FAB, events show a tiny lock badge instead of edit chevron, parent's private items show as 'Busy', tasks assigned to her are fully actionable, explainer card listing exactly what's allowed.">
      <DCArtboard id="p3-caregiver"  label="P3 · light"  width={402} height={874}><CaregiverHome palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-caregiver" label="P4-F · dark" width={402} height={874}><CaregiverHome palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-remove" title="Remove caregiver · bottom sheet" subtitle="Parent's view from Family Hub → tap Nina → this sheet. Hero with her avatar + role + tenure, current access summary, alert-tinted 'happens immediately' consequences, dashed-border 'what stays' (completed tasks + history attribution), destructive Remove + Cancel.">
      <DCArtboard id="p3-remove"  label="P3 · light"  width={402} height={874}><RemoveCaregiverSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-remove" label="P4-F · dark" width={402} height={874}><RemoveCaregiverSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-cal-month" title="Calendar · month view" subtitle="5-week grid · per-day event dots (3 visible + N counter), today marker in accent, selected day expands a preview card at the bottom with the day's events + 'Open day view' affordance">
      <DCArtboard id="p3-cal-month"  label="P3 · light"  width={402} height={874}><CalendarMonth palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal-month" label="P4-F · dark" width={402} height={874}><CalendarMonth palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-cal-day" title="Calendar · day view" subtitle="Single day · scrollable date strip ←26→, summary pills (4 events / 1 conflict / 1 hand-off / 2 tasks), all-day strip for multi-day events, hourly grid with NOW timestamp, side-by-side conflict blocks at 16:00">
      <DCArtboard id="p3-cal-day"  label="P3 · light"  width={402} height={874}><CalendarDay palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-cal-day" label="P4-F · dark" width={402} height={874}><CalendarDay palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-quick-create" title="Quick-create chooser" subtitle="What tapping the FAB opens · AI parse-paste row at top with ⌘V badge, 2×2 grid of primary kinds (Event / Task / List / Contact) each with keyboard shortcut, slim row for Custody override + Reminder, Cancel">
      <DCArtboard id="p3-quick-create"  label="P3 · light"  width={402} height={874}><QuickCreateSheet palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-quick-create" label="P4-F · dark" width={402} height={874}><QuickCreateSheet palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-conflict" title="Conflict resolution · full screen" subtitle="The full-screen version of the inline conflict ribbon · two event cards with an X glyph between them, 45min overlap bar, 3 ranked suggestions (BEST PICK badge, effort estimate), manual options below, sticky 'Apply' CTA showing the selected outcome">
      <DCArtboard id="p3-conflict"  label="P3 · light"  width={402} height={874}><ConflictResolution palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-conflict" label="P4-F · dark" width={402} height={874}><ConflictResolution palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-settings-v2" title="Settings · updated" subtitle="Back-carrot top bar (Settings is reached via the Family tab), slim hero now read-only with an Edit chevron that opens /settings/profile, Members + Appearance collapsed to nav rows. The original dashed Invite hero is gone — that surface is now the Members screen below.">
      <DCArtboard id="p3-settings-v2"  label="P3 · light"  width={402} height={874}><SettingsV2 palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-settings-v2" label="P4-F · dark" width={402} height={874}><SettingsV2 palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-members" title="Members · new sub-route" subtitle="/settings/members — replaces the invite hero card + read-only Members row. Invite form (email/phone input + role chips + send), Pending invitations with expiry and resend/cancel, Members list with role chips and a three-dot affordance that opens the remove sheet.">
      <DCArtboard id="p3-members"  label="P3 · light"  width={402} height={874}><MembersScreen palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-members" label="P4-F · dark" width={402} height={874}><MembersScreen palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-profile" title="Profile · new sub-route" subtitle="/settings/profile — reached by tapping the avatar in the Settings hero. Display name (was inline-edited in the hero) and the My color picker that maps to the identity palette. Greyed-out swatches are claimed by other members so two people can't end up the same color.">
      <DCArtboard id="p3-profile"  label="P3 · light"  width={402} height={874}><ProfileEdit palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-profile" label="P4-F · dark" width={402} height={874}><ProfileEdit palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-appearance" title="Appearance · new sub-route" subtitle="/settings/appearance — Theme picker, Accent (palette + per-element swatch), Compact density toggle. Same /settings/<x> pattern as Household, Children, etc. Includes a live preview card at the top.">
      <DCArtboard id="p3-appearance"  label="P3 · light"  width={402} height={874}><AppearanceScreen palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-appearance" label="P4-F · dark" width={402} height={874}><AppearanceScreen palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-contacts" title="Contacts" subtitle="Search + pinned Emergency strip, favorites, categorized rows (medical / school / activities / family) with per-child tags and quick-action buttons">
      <DCArtboard id="p3-contacts"  label="P3 · light"  width={402} height={874}><ContactsList palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-contacts" label="P4-F · dark" width={402} height={874}><ContactsList palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="pair-contact-detail" title="Contact detail" subtitle="Mrs. Anderson · Soph's piano teacher — big quick-action bar, linked recurring event, address with map preview, history">
      <DCArtboard id="p3-contact-detail"  label="P3 · light"  width={402} height={874}><ContactDetail palette={paletteMistForest} /></DCArtboard>
      <DCArtboard id="p4f-contact-detail" label="P4-F · dark" width={402} height={874}><ContactDetail palette={paletteCharcoalForest} /></DCArtboard>
    </DCSection>

    <DCSection id="alt-palettes" title="Reference — other palette directions" subtitle="The Home screen in the original four palettes, kept so the matched pair stays in context">
      <DCArtboard id="p1-home" label="P1 · Slate Coral"     width={402} height={874}><ProHome palette={paletteSlateCoral} /></DCArtboard>
      <DCArtboard id="p2-home" label="P2 · Bell Navy"       width={402} height={874}><ProHome palette={paletteBellNavy} /></DCArtboard>
      <DCArtboard id="p4c-home" label="P4 · Charcoal Coral" width={402} height={874}><ProHome palette={paletteCharcoal} /></DCArtboard>
    </DCSection>
  </DesignCanvas>
);
