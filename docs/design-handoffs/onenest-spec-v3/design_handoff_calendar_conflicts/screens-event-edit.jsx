// screens-event-edit.jsx — Event overflow sheet (••• kebab destination)
//                          + multi-responsible event detail variant
//                          + Responsible multi-select sheet
//
// Two related design moves:
//
//  1. The Event detail top bar has a single kebab (no separate Share pill).
//     Sharing inside the household is implicit — it's a side-effect of tagging
//     the event with responsible parents, caregivers, and external co-parents.
//     A birthday with three responsible people is already shared with all
//     three by virtue of those tags; there's no separate "Share with Casey"
//     affordance because Casey either is or isn't on the event, and that
//     toggle happens via the field chips on the detail page.
//
//  2. Because tagging = visibility, the "Responsible" field becomes a list,
//     not a single value. EventDetailMulti shows Oliver's 6th-birthday with
//     Alex, Riley, AND Casey all responsible (each sees the full event).
//     EventResponsibleSheet is the multi-select picker that opens when you
//     tap the Responsible row or any chip in it.
//
// Reuses the SheetShell + SheetBackdrop primitives from screens-task-edit.jsx.

// ═══════════════════════════════════════════════════════════════════════════
// EVENT OVERFLOW SHEET
// ═══════════════════════════════════════════════════════════════════════════
function EventOverflowSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        {/* Dimmed underlying screen */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
          <EventDetail palette={palette} />
        </div>

        <SheetBackdrop>
          <SheetShell
            title="Soph · piano lesson"
            sub="Wed · 16:00 — 16:45 · Weekly"
            height={620}
            secondary="Cancel"
          >
            {/* Group 1 · Recurrence — only present for recurring events */}
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
              padding: '0 4px 6px',
            }}>This event repeats</div>
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <EOSRow icon="instance" label="Edit only this occurrence" sub="May 27 · won't affect future Wednesdays" />
              <EOSRow icon="series" label="Edit all future occurrences" sub="From May 27 onwards" />
              <EOSRow icon="skip" label="Skip this occurrence" sub="Hide May 27 · series continues" last />
            </div>

            {/* Group 2 · Primary */}
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
              padding: '0 4px 6px',
            }}>Actions</div>
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <EOSRow icon="duplicate" label="Duplicate" sub="Make a copy with same time, who, and lists" />
              <EOSRow icon="copy-day" label="Copy to another day" sub="Same time on a different date" />
              <EOSRow icon="convert" label="Convert to task" sub="Drop the time block, keep details" />
              <EOSRow icon="reassign" label="Reassign across custody" sub="Try moving to Riley to clear the conflict" accent />
              <EOSRow icon="print" label="Export as .ics" sub="For sharing outside OneNest" last />
            </div>

            {/* Group 3 · Privacy / visibility */}
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
              padding: '0 4px 6px',
            }}>Visibility</div>
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <EOSRow icon="eye" label="Who can see this" sub="Currently · Alex, Riley, Casey (busy time only)" />
              <EOSRow icon="lock" label="Mark as private" sub="External co-parents see 'Busy', not the title" />
            </div>

            {/* Group 4 · Destructive */}
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.alert}33`,
              overflow: 'hidden',
            }}>
              <EOSRow icon="trash-one" label="Delete this occurrence" sub="May 27 only · series continues" danger />
              <EOSRow icon="trash-all" label="Delete entire series" sub="All future Wednesdays · cannot be undone" danger last />
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function EOSRow({ icon, label, sub, danger, accent, last }) {
  const tint = danger ? C.alert : accent ? C.accent : C.ink;
  const tileBg = danger ? C.alert + '14' : accent ? C.accent + '18' : C.card;
  const icons = {
    instance: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke={tint} strokeWidth="1.3"/>
        <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke={tint} strokeWidth="1.3" strokeLinecap="round"/>
        <rect x="6" y="8" width="4" height="3" rx="0.5" fill={tint} fillOpacity="0.7"/>
      </svg>
    ),
    series: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 6a4 4 0 016.5-3M14 10a4 4 0 01-6.5 3M2 3v3h3M14 13v-3h-3" stroke={tint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    skip: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke={tint} strokeWidth="1.3"/>
        <path d="M5 9l6-3M5 6l6 3" stroke={tint} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    duplicate: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke={tint} strokeWidth="1.3"/>
        <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" stroke={tint} strokeWidth="1.3" fill={C.inset}/>
      </svg>
    ),
    'copy-day': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke={tint} strokeWidth="1.3"/>
        <path d="M2 6h12" stroke={tint} strokeWidth="1.3"/>
        <path d="M7 10l1.5 1.5M8.5 11.5L10.5 8.5" stroke={accent ? tint : C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    convert: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke={tint} strokeWidth="1.3"/>
        <path d="M5.5 8h5M7 6.5L5.5 8 7 9.5" stroke={tint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    reassign: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="4" cy="6" r="2" stroke={tint} strokeWidth="1.3"/>
        <circle cx="12" cy="10" r="2" stroke={tint} strokeWidth="1.3"/>
        <path d="M6 7l4 1.5M7 5l3-1" stroke={tint} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    print: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={tint} strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5 8h6M5 11h6" stroke={tint} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    eye: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1.5 8C3 4.5 5.5 3 8 3s5 1.5 6.5 5c-1.5 3.5-4 5-6.5 5s-5-1.5-6.5-5z" stroke={tint} strokeWidth="1.3" strokeLinejoin="round"/>
        <circle cx="8" cy="8" r="2" stroke={tint} strokeWidth="1.3"/>
      </svg>
    ),
    lock: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={tint} strokeWidth="1.3"/>
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke={tint} strokeWidth="1.3"/>
      </svg>
    ),
    'trash-one': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M5 4v-1a1 1 0 011-1h4a1 1 0 011 1v1M4 4l1 9a1 1 0 001 1h4a1 1 0 001-1l1-9" stroke={tint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="8" y="11" fontFamily="ui-monospace" fontSize="5" fontWeight="700" fill={tint} textAnchor="middle">1</text>
      </svg>
    ),
    'trash-all': (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M5 4v-1a1 1 0 011-1h4a1 1 0 011 1v1M4 4l1 9a1 1 0 001 1h4a1 1 0 001-1l1-9" stroke={tint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6 7v4M8 7v4M10 7v4" stroke={tint} strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: tileBg, border: `0.5px solid ${C.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icons[icon]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
          color: danger ? C.alert : accent ? C.accent : C.ink,
        }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 1, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      {!danger && (
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT OVERFLOW · NON-RECURRING variant
// (for one-off events that don't have the "This event repeats" group)
// ═══════════════════════════════════════════════════════════════════════════
function EventOverflowSheetOneOff({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
          <EventDetail palette={palette} />
        </div>

        <SheetBackdrop>
          <SheetShell
            title="Alex · standup → product review"
            sub="Wed · 13:00 — 14:00 · Remote"
            height={500}
            secondary="Cancel"
          >
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <EOSRow icon="duplicate" label="Duplicate" sub="Make a copy with same details" />
              <EOSRow icon="copy-day" label="Copy to another day" sub="Same time on a different date" />
              <EOSRow icon="convert" label="Convert to task" sub="Drop the time block, keep details" />
              <EOSRow icon="print" label="Export as .ics" sub="For sharing outside OneNest" last />
            </div>

            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <EOSRow icon="eye" label="Who can see this" sub="Currently · Alex only · private to others" />
              <EOSRow icon="lock" label="Mark as private" sub="Co-parents see 'Busy', not the title" last />
            </div>

            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.alert}33`,
              overflow: 'hidden',
            }}>
              <EOSRow icon="trash-one" label="Delete event" sub="Cannot be undone" danger last />
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DETAIL · MULTI-RESPONSIBLE variant
// Birthday-style event: Alex + Riley + Casey all responsible.
// Responsible row becomes a stack of chips, not a single avatar+name row.
// ═══════════════════════════════════════════════════════════════════════════
function EventDetailMulti({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Top bar — kebab only, no Share pill */}
          <div style={{
            padding: '12px 16px 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Event
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="3" viewBox="0 0 14 3" fill="none">
                <circle cx="2" cy="1.5" r="1.4" fill={C.ink} />
                <circle cx="7" cy="1.5" r="1.4" fill={C.ink} />
                <circle cx="12" cy="1.5" r="1.4" fill={C.ink} />
              </svg>
            </div>
          </div>

          {/* Title + meta */}
          <div style={{ padding: '14px 24px 16px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted,
              letterSpacing: -0.2, marginBottom: 6,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 3, background: C.oliver,
              }} />
              ALL-DAY · SAT JUN 14 · 2026
            </div>
            <div style={{
              fontSize: 28, fontWeight: 600, letterSpacing: -0.9,
              lineHeight: 1.1, color: C.ink, marginBottom: 10,
            }}>Oliver&rsquo;s 6th birthday 🎂</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{
                fontFamily: C.fontMono, fontSize: 14, fontWeight: 500,
                color: C.ink, letterSpacing: -0.4,
              }}>14:00 — 17:00</div>
              <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted }}>· party slot</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: C.accent + '18', color: C.accent,
                padding: '3px 9px', borderRadius: 999,
                fontFamily: C.fontMono, fontSize: 10, fontWeight: 600,
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <circle cx="4" cy="4" r="2.5" stroke={C.accent} strokeWidth="1.2"/>
                  <circle cx="8" cy="8" r="2.5" stroke={C.accent} strokeWidth="1.2"/>
                </svg>
                SHARED · 3 HOMES
              </div>
            </div>
          </div>

          {/* WHO — Responsible is multi-chip; Backup unchanged */}
          <EDSectionLabel label="Who" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${C.hair}` }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                    Responsible
                  </span>
                  <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>3 PEOPLE</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <ResponsibleChip member={cMembers.alex} note="lead" />
                  <ResponsibleChip member={cMembers.riley} />
                  <ResponsibleChip member={cMembers.casey} external />
                  <AddPersonChip />
                </div>
                <div style={{
                  marginTop: 10, padding: '7px 9px', borderRadius: 7,
                  background: C.accent + '10', display: 'flex', alignItems: 'flex-start', gap: 7,
                }}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                    <path d="M1.5 7C3 4.5 5 3.5 7 3.5s4 1 5.5 3.5c-1.5 2.5-3.5 3.5-5.5 3.5s-4-1-5.5-3.5z" stroke={C.accent} strokeWidth="1.2" strokeLinejoin="round"/>
                    <circle cx="7" cy="7" r="1.6" stroke={C.accent} strokeWidth="1.2"/>
                  </svg>
                  <span style={{ fontSize: 11, color: C.inkSec, lineHeight: 1.4 }}>
                    All three see the full event. Casey&rsquo;s on the calendar across both homes — Devon and any caregivers only see &ldquo;Busy&rdquo; unless tagged.
                  </span>
                </div>
              </div>

              <EDRow label="Backup" right={
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 9,
                    border: `1px dashed ${C.inkFaint}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: C.inkFaint, fontWeight: 600,
                  }}>?</span>
                  Anyone
                </span>
              } last />
            </div>
          </div>

          <EDSectionLabel label="For" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <ChildChip member={cMembers.oliver} primary />
            </div>
          </div>

          <EDSectionLabel label="Location" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                Casey&rsquo;s backyard
              </div>
              <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2, fontFamily: C.fontMono, letterSpacing: -0.2 }}>
                14 Linden Way · 12 min drive
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 24px 4px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Guests · 12 kids · 8 adults
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 500, letterSpacing: -0.1 }}>
              + ADD
            </span>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 12.5, color: C.inkSec, lineHeight: 1.5 }}>
                12 kids confirmed · 2 pending · 1 declined.{' '}
                <span style={{ fontFamily: C.fontMono, color: C.accent, fontWeight: 600, letterSpacing: -0.1 }}>
                  Open list →
                </span>
              </div>
            </div>
          </div>

          <EDSectionLabel label="Notes" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.5,
            }}>
              Cake from Sweet Maple (Riley to pick up at 13:00).
              Alex on setup, Casey hosting at her place, Riley on cake duty.
              Allergies: Mateo &mdash; peanuts. Lila &mdash; dairy. Backup activity if it rains: indoor garage with crafts.
            </div>
          </div>

          <EDSectionLabel label="History" />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}` }}>
              <EDActivity who={cMembers.casey} action="created · invited Alex + Riley as responsible" when="2 weeks ago" />
              <EDActivity who={cMembers.alex} action="added Mrs. Anderson (Soph's teacher) to guests" when="last Fri" />
              <EDActivity who={cMembers.riley} action="added cake pickup task" when="yesterday" last />
            </div>
          </div>
        </div>

        {/* Sticky action bar */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.bg + 'F2', backdropFilter: 'blur(20px)',
          borderTop: `0.5px solid ${C.hair}`,
          padding: '12px 16px 30px',
          display: 'flex', gap: 8, zIndex: 5,
        }}>
          <div style={{
            flex: '0 0 auto', padding: '10px 14px', borderRadius: 10,
            background: C.card, border: `0.5px solid ${C.hair}`,
            color: C.alert, fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 5h8M5 5V3h4v2M5 5l1 7h2l1-7" stroke={C.alert} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Delete
          </div>
          <div style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            background: C.accent, color: C.onAccent,
            fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Save changes
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function ResponsibleChip({ member, note, external }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px 4px 4px', borderRadius: 999,
      background: member.color + '22',
      border: `0.5px solid ${member.color + '55'}`,
    }}>
      <CAvatar member={member} size={20} />
      <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, letterSpacing: -0.1 }}>
        {member.name}
      </span>
      {note && (
        <span style={{
          fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, fontWeight: 700,
          padding: '1px 5px', background: C.card + 'AA', borderRadius: 3, letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}>{note}</span>
      )}
      {external && (
        <span style={{
          fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, fontWeight: 600,
          padding: '1px 5px', background: C.card + 'AA', borderRadius: 3, letterSpacing: 0.3,
        }}>EXT</span>
      )}
    </span>
  );
}

function AddPersonChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: 'transparent', border: `0.5px dashed ${C.inkFaint}`,
      color: C.inkMuted, fontFamily: C.fontMono, fontSize: 11, letterSpacing: -0.1,
    }}>+ Add</span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSIBLE MULTI-SELECT SHEET
// Opens when you tap the Responsible row or any chip in it.
// ═══════════════════════════════════════════════════════════════════════════
function EventResponsibleSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const rows = [
    { key: 'alex',  selected: true, lead: true,  sub: 'You · with the kids this week' },
    { key: 'riley', selected: true,              sub: 'Co-parent · active 3h ago' },
    { key: 'casey', selected: true,  external: true, sub: 'External · Oliver\u2019s other parent' },
    { key: 'devon',                  external: true, sub: 'External · Soph\u2019s other parent · not on this event' },
    { key: 'nina',                   caregiver: true, sub: 'Caregiver · weekdays · sees what\u2019s assigned' },
  ];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <EventDetailMulti palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Responsible"
            sub="Anyone tagged here sees the full event — title, location, notes, attached tasks."
            height={620}
            primary="Save · 3 selected"
            secondary="Clear"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden', marginBottom: 12 }}>
              {rows.map((r, i) => {
                const isNina = r.key === 'nina';
                const m = isNina
                  ? { name: 'Nina', initials: 'N', color: C.warn }
                  : cMembers[r.key];
                return (
                  <div key={r.key} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: r.selected ? C.accent + '0e' : 'transparent',
                    borderBottom: i === rows.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                  }}>
                    {isNina ? (
                      <div style={{
                        width: 32, height: 32, borderRadius: 16,
                        background: m.color + '33', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: m.color, letterSpacing: -0.2,
                        flexShrink: 0,
                      }}>N</div>
                    ) : (
                      <CAvatar member={m} size={32} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                          {m.name}
                        </span>
                        {r.lead && (
                          <span style={{
                            fontFamily: C.fontMono, fontSize: 9, color: C.accent, fontWeight: 700,
                            padding: '1px 5px', background: C.accent + '18', borderRadius: 3, letterSpacing: 0.3,
                          }}>LEAD</span>
                        )}
                        {r.external && (
                          <span style={{
                            fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, fontWeight: 600,
                            padding: '1px 5px', background: C.card, borderRadius: 3, letterSpacing: 0.3,
                            border: `0.5px solid ${C.hair}`,
                          }}>EXT</span>
                        )}
                        {r.caregiver && (
                          <span style={{
                            fontFamily: C.fontMono, fontSize: 9, color: C.warn, fontWeight: 700,
                            padding: '1px 5px', background: C.warn + '18', borderRadius: 3, letterSpacing: 0.3,
                          }}>CARE</span>
                        )}
                      </div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                        {r.sub}
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `1.5px solid ${r.selected ? C.accent : C.inkFaint}`,
                      background: r.selected ? C.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {r.selected && (
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{
              padding: '10px 12px', borderRadius: 10,
              border: `0.5px dashed ${C.hair}`,
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10,
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M2 8C4 4.5 6 3.5 8 3.5s4 1 6 4.5c-2 3.5-4 4.5-6 4.5s-4-1-6-4.5z" stroke={C.accent} strokeWidth="1.3" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="2" stroke={C.accent} strokeWidth="1.3"/>
              </svg>
              <div style={{ flex: 1, fontSize: 11.5, color: C.inkSec, lineHeight: 1.45 }}>
                <b style={{ fontWeight: 600, color: C.ink }}>Tagging = visibility.</b>{' '}
                Anyone selected here sees the full event across both their homes.
                Untagged co-parents and caregivers see just &ldquo;Busy&rdquo; in that time slot.
              </div>
            </div>

            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
              padding: '4px 4px 6px',
            }}>Lead</div>
            <div style={{
              background: C.inset, borderRadius: 10, border: `0.5px solid ${C.hair}`,
              padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CAvatar member={cMembers.alex} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>Alex</div>
                <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1, lineHeight: 1.35 }}>
                  Gets the LEAD chip · receives the primary push when reminders fire
                </div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}
