// screens-creation.jsx — Four new creation flows that match EventCreate.
//
//   CreateTask    — task with assignment, due, lists, for-whom
//   CreateContact — contact card with type, linked kids, linked event
//   CreateList    — list with color, kind, shared-with, template
//   AddChild      — child profile with basics, school, health, custody
//
// All four reuse FormSectionLabel · FormGroup · FormRow · FormSwitch ·
// ParentChip · AnyoneChip from screens-extra-2.jsx (where EventCreate lives)
// so the visual language is identical across creation surfaces.
//
// The "Custody override dialog" referenced in the spec is NewOverride in
// screens-custody.jsx (already rendered as 06.3 in the canvas).

// Local helpers — small primitives specific to these flows.

function CreateTopBar({ title, saveLabel = 'Save', saveDisabled }) {
  return (
    <div style={{
      position: 'absolute', top: 54, left: 0, right: 0,
      padding: '8px 16px 10px',
      background: C.bg + 'F0', backdropFilter: 'blur(12px)',
      borderBottom: `0.5px solid ${C.hair}`, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 14, color: C.inkSec, fontWeight: 500, letterSpacing: -0.2 }}>
        Cancel
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
        {title}
      </span>
      <span style={{
        padding: '4px 10px', borderRadius: 7,
        background: saveDisabled ? C.inset : C.accent,
        color: saveDisabled ? C.inkMuted : C.onAccent,
        fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1,
        border: saveDisabled ? `0.5px solid ${C.hair}` : 'none',
      }}>{saveLabel}</span>
    </div>
  );
}

function TitleInput({ label, value, font = 'sans' }) {
  const sans = font === 'sans';
  return (
    <div style={{ padding: '14px 20px 6px' }}>
      <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 600, color: C.ink,
        letterSpacing: -0.7, lineHeight: 1.2,
        padding: '4px 0',
        borderBottom: `1.5px solid ${C.accent}`,
        display: 'flex', alignItems: 'center', gap: 4,
        fontFamily: sans ? C.fontSans : C.fontMono,
      }}>
        <span>{value}</span>
        <span style={{
          width: 1.5, height: 22, background: C.accent,
          animation: 'blink 1s steps(2) infinite',
        }} />
      </div>
    </div>
  );
}

function AIHelper({ text }) {
  return (
    <div style={{ padding: '12px 16px 18px' }}>
      <div style={{
        background: C.accent + '12', borderRadius: 10,
        border: `0.5px solid ${C.accent}33`,
        padding: '10px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        {CIcon.spark(C.accent)}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.ink, fontWeight: 500, letterSpacing: -0.1, marginBottom: 2 }}>
            Tip · paste a phrase
          </div>
          <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2, lineHeight: 1.5 }}>
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorSwatch({ color, selected }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: color, flexShrink: 0,
      boxShadow: selected ? `0 0 0 2px ${C.bg}, 0 0 0 4px ${color}` : 'none',
      border: !selected ? `0.5px solid ${C.hair}` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l3 3 7-8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function SegRow({ options, selected }) {
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3,
      background: C.inset, borderRadius: 10,
      border: `0.5px solid ${C.hair}`,
    }}>
      {options.map(o => (
        <div key={o} style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: o === selected ? C.card : 'transparent',
          border: o === selected ? `0.5px solid ${C.hair}` : 'none',
          boxShadow: o === selected ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
          fontSize: 12.5, fontWeight: o === selected ? 600 : 500,
          color: o === selected ? C.ink : C.inkSec, letterSpacing: -0.2,
          textAlign: 'center',
        }}>{o}</div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE TASK
// ═══════════════════════════════════════════════════════════════════════════
function CreateTask({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <CreateTopBar title="New task" />
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 106, paddingBottom: 24 }}>

          <TitleInput label="TITLE" value="Pack Theo's overnight bag" />

          <AIHelper text={'\u201Cpack soph friday 6pm doctor\u201D \u2192 due, kid, list pre-filled'} />

          {/* WHEN */}
          <FormSectionLabel>When</FormSectionLabel>
          <FormGroup>
            <FormRow label="Due" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.alert, fontWeight: 600, letterSpacing: -0.3 }}>
                Tonight · 21:00
              </span>
            } accentValue chevron />
            <FormRow label="Reminder" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                30 min before
              </span>
            } chevron />
            <FormRow label="Repeats" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                One-time
              </span>
            } chevron last />
          </FormGroup>

          {/* WHO */}
          <FormSectionLabel>Who</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px 10px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Assigned to
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.alex} selected />
                <ParentChip member={cMembers.riley} />
                <AnyoneChip />
              </div>
            </div>
            <div style={{ padding: '12px 14px 12px', borderTop: `0.5px solid ${C.hair}` }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                For
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.oliver} selected />
                <ParentChip member={cMembers.soph} />
                <ParentChip member={cMembers.jin} />
                <ParentChip member={cMembers.mei} />
              </div>
            </div>
          </FormGroup>

          {/* LISTS */}
          <FormSectionLabel>In lists</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ListTagChip color="#E5613D" label="House" selected />
              <ListTagChip color={C.casey} label="Co-parents" selected />
              <ListTagChip color="#3E8A6B" label="Grocery" />
              <ListTagChip color={C.alex} label="School" />
              <DashedAddChip label="+ Pick lists" />
            </div>
          </FormGroup>

          {/* PRIORITY */}
          <FormSectionLabel>Priority</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <SegRow options={['None', 'Low', 'Normal', 'High', 'Urgent']} selected="High" />
            </div>
          </FormGroup>

          {/* NOTES */}
          <FormSectionLabel>Notes</FormSectionLabel>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px', minHeight: 80,
            }}>
              <span style={{ fontSize: 13, color: C.inkMuted, letterSpacing: -0.1, lineHeight: 1.5 }}>
                Pack: 2 outfits, PJs, lovie, EpiPen, lunchbox.
              </span>
            </div>
          </div>

          {/* SMART SUGGESTION */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `0.5px dashed ${C.accent}66`,
              padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              {CIcon.spark(C.accent)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, letterSpacing: -0.1, marginBottom: 2 }}>
                  Attach to Wed&apos;s hand-off?
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, lineHeight: 1.5 }}>
                  &ldquo;Oliver &rarr; Casey&rdquo; on Wed 17:00 is the next hand-off this task supports.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <CButton primary>Attach</CButton>
                  <CButton>Not now</CButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function ListTagChip({ color, label, selected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px 4px 8px', borderRadius: 999,
      background: selected ? color + '22' : C.card,
      border: `${selected ? 1 : 0.5}px solid ${selected ? color + '66' : C.hair}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: selected ? C.ink : C.inkSec, letterSpacing: -0.1 }}>
        {label}
      </span>
      {selected && (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
          <path d="M3 7l3 3 5-7" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  );
}

function DashedAddChip({ label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: 'transparent', border: `0.5px dashed ${C.inkFaint}`,
      color: C.inkMuted, fontFamily: C.fontMono, fontSize: 11, letterSpacing: -0.1,
    }}>{label}</span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE CONTACT
// ═══════════════════════════════════════════════════════════════════════════
function CreateContact({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <CreateTopBar title="New contact" />
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 106, paddingBottom: 24 }}>

          <TitleInput label="NAME" value="Mrs. Anderson" />

          <AIHelper text={'paste a vCard / contact card \u2192 phone + email pre-filled'} />

          {/* TYPE — segmented */}
          <FormSectionLabel>Type</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <SegRow options={['Medical', 'School', 'Activity', 'Family', 'Other']} selected="Activity" />
            </div>
            <FormRow label="Sub-type" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2 }}>
                Piano teacher
              </span>
            } chevron last />
          </FormGroup>

          {/* BELONGS TO */}
          <FormSectionLabel>Belongs to</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Kids · pick at least one
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.soph} selected />
                <ParentChip member={cMembers.mei} />
                <ParentChip member={cMembers.jin} />
                <ParentChip member={cMembers.oliver} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.inkMuted, lineHeight: 1.4 }}>
                Only people who can see Soph will see this contact.
              </div>
            </div>
          </FormGroup>

          {/* CONTACT */}
          <FormSectionLabel>Contact info</FormSectionLabel>
          <FormGroup>
            <CIRow icon="phone" label="Phone" value="(415) 555-0142" mono />
            <CIRow icon="mail" label="Email" value="m.anderson@maplemusic.com" mono />
            <CIRow icon="map" label="Address" value="42 Maple St · Studio 3" />
          </FormGroup>

          {/* LINKED EVENT */}
          <FormSectionLabel>Linked event</FormSectionLabel>
          <FormGroup>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            }}>
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: C.soph, minHeight: 36 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
                  Soph &middot; piano lesson
                </div>
                <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                  Weekly &middot; Wed 16:00
                </div>
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.accent,
                padding: '2px 7px', background: C.accent + '18', borderRadius: 4,
                letterSpacing: 0.3, fontWeight: 600, textTransform: 'uppercase',
              }}>LINKED</span>
            </div>
            <FormRow label="Recurring event" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                Picked from calendar
              </span>
            } chevron last />
          </FormGroup>

          {/* QUICK FLAGS */}
          <FormSectionLabel>Quick flags</FormSectionLabel>
          <FormGroup>
            <FormRow label="Pin to top" value={<FormSwitch />} />
            <FormRow label="Emergency contact" value={<FormSwitch />} last />
          </FormGroup>

          {/* NOTES */}
          <FormSectionLabel>Notes</FormSectionLabel>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px', minHeight: 64,
            }}>
              <span style={{ fontSize: 13, color: C.inkMuted, letterSpacing: -0.1, lineHeight: 1.5 }}>
                Soph&apos;s teacher since Jan. Cash for makeups · prefers texts before 8pm.
              </span>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function CIRow({ icon, label, value, mono, last }) {
  const icons = {
    phone: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h2l1.5 3.5L5 7c1 2 2 3 4 4l1.5-1.5L14 11v2c0 .5-.5 1-1 1A11 11 0 012 3c0-.5.5-1 1-1z" stroke={C.inkSec} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    mail: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke={C.inkSec} strokeWidth="1.3"/>
        <path d="M2 4l6 5 6-5" stroke={C.inkSec} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    map: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 0.5C5 0.5 2.5 3 2.5 6c0 4 5.5 9 5.5 9s5.5-5 5.5-9C13.5 3 11 0.5 8 0.5z" stroke={C.inkSec} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
        <circle cx="8" cy="6" r="2" stroke={C.inkSec} strokeWidth="1.3"/>
      </svg>
    ),
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icons[icon]}
      </div>
      <span style={{ flex: 1, fontFamily: mono ? C.fontMono : C.fontSans,
        fontSize: mono ? 13 : 14, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
        {value}
      </span>
      <span style={{
        fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.3,
        fontWeight: 600, textTransform: 'uppercase',
      }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE LIST
// ═══════════════════════════════════════════════════════════════════════════
function CreateList({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <CreateTopBar title="New list" />
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 106, paddingBottom: 24 }}>

          <TitleInput label="LIST NAME" value="Soccer prep" />

          {/* KIND */}
          <FormSectionLabel>Kind</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <SegRow options={['Tasks', 'Grocery', 'Shopping', 'Packing']} selected="Tasks" />
              <div style={{ marginTop: 8, fontSize: 11, color: C.inkMuted, lineHeight: 1.4 }}>
                Tasks include due dates and assignments. Grocery / Shopping add quantity + store.
              </div>
            </div>
          </FormGroup>

          {/* COLOR + ICON */}
          <FormSectionLabel>Color</FormSectionLabel>
          <FormGroup>
            <div style={{
              padding: '14px 14px',
              display: 'flex', gap: 10, flexWrap: 'wrap',
            }}>
              <ColorSwatch color={C.mei} selected />
              <ColorSwatch color={C.alex} />
              <ColorSwatch color={C.devon} />
              <ColorSwatch color={C.oliver} />
              <ColorSwatch color={C.soph} />
              <ColorSwatch color={C.riley} />
              <ColorSwatch color={C.casey} />
              <ColorSwatch color={C.jin} />
            </div>
            <FormRow label="Icon" value={
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2,
              }}>
                <span style={{ fontSize: 14 }}>⚽</span>
                Soccer ball
              </span>
            } chevron last />
          </FormGroup>

          {/* BELONGS TO */}
          <FormSectionLabel>For</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Kids
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.mei} selected />
                <ParentChip member={cMembers.jin} />
                <ParentChip member={cMembers.soph} />
                <ParentChip member={cMembers.oliver} />
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.inkMuted, lineHeight: 1.4 }}>
                New tasks added to this list will default to &ldquo;For Mei&rdquo;.
              </div>
            </div>
          </FormGroup>

          {/* SHARED WITH */}
          <FormSectionLabel>Shared with</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.alex} selected />
                <ParentChip member={cMembers.riley} selected />
                <ParentChip member={cMembers.casey} />
                <ParentChip member={cMembers.devon} />
                <DashedAddChip label="+ Caregiver" />
              </div>
              <div style={{
                marginTop: 10, padding: '7px 9px', borderRadius: 7,
                background: C.accent + '10',
                display: 'flex', alignItems: 'flex-start', gap: 7,
              }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M1.5 7C3 4.5 5 3.5 7 3.5s4 1 5.5 3.5c-1.5 2.5-3.5 3.5-5.5 3.5s-4-1-5.5-3.5z" stroke={C.accent} strokeWidth="1.2" strokeLinejoin="round"/>
                  <circle cx="7" cy="7" r="1.6" stroke={C.accent} strokeWidth="1.2"/>
                </svg>
                <span style={{ fontSize: 11, color: C.inkSec, lineHeight: 1.4 }}>
                  Anyone shared can add tasks and tick them off. External co-parents only see tasks tagged for kids they share.
                </span>
              </div>
            </div>
          </FormGroup>

          {/* TEMPLATE */}
          <FormSectionLabel>Start from</FormSectionLabel>
          <FormGroup>
            <TmplRow title="Blank list" sub="Just the name and the kid" selected />
            <TmplRow title="Soccer prep" sub="6 typical items · cleats, water, snack, shin guards…" badge="POPULAR" />
            <TmplRow title="School morning" sub="9 typical items · backpack, lunch, library book…" />
            <TmplRow title="Custom paste" sub="Paste a list · we&apos;ll split it into items" last />
          </FormGroup>

          {/* AUTOMATION */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `0.5px dashed ${C.accent}66`,
              padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              {CIcon.spark(C.accent)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 500, letterSpacing: -0.1, marginBottom: 2 }}>
                  Auto-attach to Soccer Practice?
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, lineHeight: 1.5 }}>
                  Mei has &ldquo;Soccer practice&rdquo; weekly on Tue 16:00. Each week, attach this list to that event.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <CButton primary>Yes, automate</CButton>
                  <CButton>Not now</CButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function TmplRow({ title, sub, badge, selected, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      background: selected ? C.accent + '0e' : 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</span>
          {badge && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 9, color: C.accent, fontWeight: 700,
              padding: '1px 5px', background: C.accent + '18', borderRadius: 3, letterSpacing: 0.3,
            }}>{badge}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1, lineHeight: 1.4 }}>{sub}</div>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        border: `1.5px solid ${selected ? C.accent : C.inkFaint}`,
        background: selected ? C.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD CHILD
// ═══════════════════════════════════════════════════════════════════════════
function AddChild({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <CreateTopBar title="Add child" />
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 106, paddingBottom: 24 }}>

          {/* Avatar preview */}
          <div style={{
            padding: '20px 20px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 80, height: 80, borderRadius: 999,
                background: C.warn,
                boxShadow: dark
                  ? `0 0 0 4px ${C.bg}, 0 0 0 5px ${C.warn}44`
                  : `0 0 0 4px ${C.bg}, 0 0 0 5px ${C.warn}44, 0 6px 24px ${C.warn}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 32, fontWeight: 600, color: '#FFFFFF', letterSpacing: -1 }}>T</span>
              </div>
              <div style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 26, height: 26, borderRadius: 13,
                background: C.card, border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12V14h2L13 5l-2-2L2 12z" stroke={C.ink} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: C.fontMono, letterSpacing: -0.1 }}>
              Tap to upload photo
            </div>
          </div>

          <TitleInput label="NAME" value="Theo" />

          {/* BASICS */}
          <FormSectionLabel>Basics</FormSectionLabel>
          <FormGroup>
            <FormRow label="Birthday" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>
                Mar 14, 2018 · 8 yrs
              </span>
            } chevron />
            <FormRow label="Pronouns" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                he / him
              </span>
            } chevron />
            <FormRow label="Nickname" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                None
              </span>
            } chevron last />
          </FormGroup>

          {/* COLOR */}
          <FormSectionLabel>Color</FormSectionLabel>
          <FormGroup>
            <div style={{
              padding: '14px 14px',
              display: 'flex', gap: 10, flexWrap: 'wrap',
            }}>
              <ColorSwatch color={C.warn} selected />
              <ColorSwatch color={C.mei} />
              <ColorSwatch color={C.jin} />
              <ColorSwatch color={C.soph} />
              <ColorSwatch color={C.oliver} />
              <ColorSwatch color={C.devon} />
              <ColorSwatch color={C.casey} />
              <ColorSwatch color={C.riley} />
            </div>
            <div style={{
              padding: '10px 14px 12px', fontSize: 11, color: C.inkMuted,
              lineHeight: 1.4, borderTop: `0.5px solid ${C.hair}`,
            }}>
              Used on Theo&apos;s events, tasks, and chips across the family.
            </div>
          </FormGroup>

          {/* CUSTODY */}
          <FormSectionLabel>Who Theo lives with</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ParentChip member={cMembers.alex} selected />
                <ParentChip member={cMembers.riley} selected />
                <ParentChip member={cMembers.casey} />
                <ParentChip member={cMembers.devon} />
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: C.inkMuted, lineHeight: 1.4 }}>
                If Theo has an external co-parent, tap them to enable shared custody.{' '}
                <span style={{ fontFamily: C.fontMono, color: C.accent, fontWeight: 600, letterSpacing: -0.1 }}>
                  Learn more →
                </span>
              </div>
            </div>
            <FormRow
              label="Follows main pattern"
              value={<FormSwitch on />}
              last
            />
          </FormGroup>

          {/* SCHOOL */}
          <FormSectionLabel>School</FormSectionLabel>
          <FormGroup>
            <FormRow label="School" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2 }}>
                Lincoln Elementary
              </span>
            } chevron />
            <FormRow label="Grade" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                3rd
              </span>
            } chevron />
            <FormRow label="Teacher" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                Ms. Park
              </span>
            } chevron last />
          </FormGroup>

          {/* HEALTH */}
          <FormSectionLabel>Health</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${C.hair}` }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Allergies
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <HealthChip color={C.alert} label="Peanuts" severity="SEVERE" />
                <HealthChip color={C.warn} label="Pollen" />
                <DashedAddChip label="+ Add allergy" />
              </div>
            </div>
            <FormRow label="Medications" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                None
              </span>
            } chevron />
            <FormRow label="Pediatrician" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.accent, letterSpacing: -0.2 }}>
                + Pick from contacts
              </span>
            } chevron last />
          </FormGroup>

          {/* VISIBILITY */}
          <FormSectionLabel>Visibility</FormSectionLabel>
          <FormGroup>
            <FormRow label="Caregivers can see" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2 }}>
                Assigned only
              </span>
            } chevron />
            <FormRow label="External co-parents see" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                Not applicable
              </span>
            } last />
          </FormGroup>
        </div>
      </div>
    </IOSDevice>
  );
}

function HealthChip({ color, label, severity }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px 4px 8px', borderRadius: 999,
      background: color + '22', border: `0.5px solid ${color + '66'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>
        {label}
      </span>
      {severity && (
        <span style={{
          fontFamily: C.fontMono, fontSize: 8.5, color: color, fontWeight: 700,
          padding: '1px 5px', background: C.card, borderRadius: 3, letterSpacing: 0.3,
          border: `0.5px solid ${color}55`,
        }}>{severity}</span>
      )}
    </span>
  );
}
