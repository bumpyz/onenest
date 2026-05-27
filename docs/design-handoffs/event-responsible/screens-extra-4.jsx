// Round 8 — caregiver view + remove-caregiver bottom sheet.
// Introduces "Nina" as the household's caregiver for the Chen-Park family.

// Caregiver member — not in cMembers since she joined the household later;
// inlined here. Color picked to harmonize with parent palette (warm tan, distinct
// from parents but in the same warmth family as riley).
const ninaMember = { name: 'Nina', initial: 'N', color: '#C99A6F' };

// ═══════════════════════════════════════════════════════════════════════════
// CAREGIVER HOME — what Nina sees when she opens OneNest
// ═══════════════════════════════════════════════════════════════════════════
function CaregiverHome({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header — same household identity but the avatar is Nina */}
          <div style={{ padding: '12px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, background: C.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 8 L6 2 L10 8 Z M6 8 V11" stroke={C.onAccent} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.3 }}>Chen-Park</span>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                padding: '2px 6px', background: C.inset, borderRadius: 4, letterSpacing: -0.2,
              }}>caregiver</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Bell — caregivers do get notified about tasks they've been assigned */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: C.card,
                border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 10h9c-.5-.5-1-1.3-1-2.5V6a3.5 3.5 0 10-7 0v1.5C3 8.7 2.5 9.5 2 10z" stroke={C.ink} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                  <path d="M5.5 12c.3.5.8.8 1 .8s.7-.3 1-.8" stroke={C.ink} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <div style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 8, height: 8, borderRadius: 4,
                  background: C.accent, border: `1.5px solid ${C.card}`,
                }} />
              </div>
              <CAvatar member={ninaMember} size={32} />
            </div>
          </div>

          {/* Greeting */}
          <div style={{ padding: '14px 20px 14px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
              TUE · MAY 26 · 2026
            </div>
            <div style={{
              fontSize: 30, fontWeight: 600, color: C.ink,
              letterSpacing: -1, lineHeight: 1.08, marginBottom: 8,
            }}>Hi, Nina.</div>
            <div style={{ fontSize: 13.5, color: C.inkSec, lineHeight: 1.5 }}>
              Picking up <span style={{ color: C.ink, fontWeight: 500 }}>Oliver from day-care at 17:00</span>.
              Two tasks for you today.
            </div>
          </div>

          {/* Caregiver-mode banner — the read-only signal */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `0.5px solid ${C.hair}`, borderLeft: `3px solid ${ninaMember.color}`,
              padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 11,
                background: ninaMember.color + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                marginTop: 1,
              }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5l5 2v4c0 2.5-2 5-5 6-3-1-5-3.5-5-6v-4l5-2z"
                        stroke={ninaMember.color} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, color: C.ink, fontWeight: 600, letterSpacing: -0.1, marginBottom: 2,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  You&apos;re in caregiver mode
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 9, color: ninaMember.color,
                    padding: '1px 5px', background: ninaMember.color + '22',
                    borderRadius: 3, fontWeight: 600, letterSpacing: 0.3,
                  }}>READ-ONLY</span>
                </div>
                <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5 }}>
                  See the schedule and complete tasks assigned to you. Only parents can add or edit events.
                </div>
              </div>
            </div>
          </div>

          {/* Today timeline — events shown without edit affordances */}
          <div style={{ padding: '0 16px' }}>
            <div style={{
              padding: '0 4px 8px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  Today
                </span>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                  Tue 26
                </span>
              </div>
              {/* Note no "With Alex" pill — caregiver doesn't have personal custody */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2,
                padding: '3px 8px', background: C.inset, borderRadius: 999,
              }}>
                <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7l3 3 6-7" stroke={C.inkMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                READ-ONLY
              </span>
            </div>

            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              {/* Each row has a small lock badge in place of edit chevron */}
              <CGEventRow time="07:30" dur="45m" title="Mei · school bus" who={[cMembers.alex]} child={cMembers.mei} done />
              <CGEventRow time="08:15" dur="30m" title="Oliver · day-care drop" who={[cMembers.riley]} child={cMembers.oliver} />
              <CGEventRow time="13:00" dur="1h" title="Alex · client review" who={[cMembers.alex]} loc="—" hidden />
              <CGEventRow time="17:00" dur="" title="Pick up Oliver · Tiny Sprouts" who={[ninaMember]} child={cMembers.oliver} cg />
              <CGEventRow time="18:00" dur="30m" title="Hand-off · Oliver to Casey" who={[cMembers.alex]} handoff last />
            </div>
          </div>

          {/* My tasks — actionable (caregivers can complete tasks) */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{
              padding: '0 4px 8px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  Your tasks
                </span>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                  2 · 0 done
                </span>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: C.fontMono, fontSize: 10, color: C.accent, letterSpacing: -0.2, fontWeight: 600,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: C.accent }} />
                ACTIONABLE
              </span>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <CGTaskRow title="Pack Oliver&apos;s overnight bag" due="before 17:00" highlight />
              <CGTaskRow title="Pick up dry-cleaning on way home" due="anytime" last />
            </div>
          </div>

          {/* Family activity — see what parents did */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{ padding: '0 4px 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                The family
              </span>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <EDActivity who={cMembers.alex} action="assigned you 'Pack Oliver's bag'" when="1h" />
              <EDActivity who={cMembers.riley} action="moved Oliver pickup to 17:00 (was 16:45)" when="3h" />
              <EDActivity who={cMembers.alex} action="added 'Pick up dry-cleaning' for you" when="yest" last />
            </div>
          </div>

          {/* What you can do — explainer */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px dashed ${C.hair}`,
              padding: '14px 14px',
            }}>
              <div style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10,
              }}>
                Caregiver access · what you can do
              </div>
              <PermissionRow icon="check" label="View the family schedule" />
              <PermissionRow icon="check" label="Complete tasks assigned to you" />
              <PermissionRow icon="check" label="Mark events you attended" />
              <PermissionRow icon="check" label="Message Alex or Riley about logistics" />
              <PermissionRow icon="x" label="Create or edit events" />
              <PermissionRow icon="x" label="See private busy times" />
              <PermissionRow icon="x" label="See or edit custody schedule" last />
            </div>
          </div>
        </div>

        {/* NO FAB — caregivers don't create events. Bottom nav still shows
            primary tabs since they can navigate to Calendar / Lists / Family. */}
        <CBottomNav active="home" />
      </div>
    </IOSDevice>
  );
}

function CGEventRow({ time, dur, title, who, child, loc, conflict, done, handoff, cg, hidden, last }) {
  // hidden = a parent-only private event; caregiver sees the time block but
  // no details (privacy fence). cg = this is the caregiver's responsibility,
  // tinted in her color.
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      opacity: done ? 0.55 : 1,
      background: cg ? ninaMember.color + (C.scheme === 'dark' ? '15' : '10') : 'transparent',
    }}>
      <div style={{ width: 50, flexShrink: 0 }}>
        <div style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>
          {time}
        </div>
        <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.2 }}>
          {dur}
        </div>
      </div>
      <div style={{
        width: 2, alignSelf: 'stretch', borderRadius: 1,
        background: cg ? ninaMember.color : (who?.[0]?.color ?? C.inkFaint),
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2,
          textDecoration: done ? 'line-through' : 'none', lineHeight: 1.3,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {hidden ? (
            <>
              <span style={{ color: C.inkMuted, fontStyle: 'italic' }}>Private · busy</span>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="6" width="8" height="6" rx="1.3" stroke={C.inkMuted} strokeWidth="1.3" fill="none"/>
                <path d="M5 6V4a2 2 0 014 0v2" stroke={C.inkMuted} strokeWidth="1.3" fill="none"/>
              </svg>
            </>
          ) : (
            <>{title}{cg && (
              <span style={{
                fontFamily: C.fontMono, fontSize: 8.5, color: ninaMember.color, fontWeight: 700,
                padding: '1px 5px', background: ninaMember.color + '22',
                borderRadius: 3, letterSpacing: 0.3,
              }}>YOU</span>
            )}</>
          )}
        </div>
        {!hidden && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.inkMuted, marginTop: 2 }}>
            {child && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: child.color }} />
                {child.name}
              </span>
            )}
            {loc && <span style={{ fontFamily: C.fontMono, letterSpacing: -0.2 }}>· {loc}</span>}
            {handoff && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.inkMuted }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M2 4h9l-2-2M12 10H3l2 2" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Alex → Casey
              </span>
            )}
          </div>
        )}
      </div>
      {/* Read-only lock badge — no edit chevron */}
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.35, flexShrink: 0 }}>
        <rect x="3" y="6" width="8" height="6" rx="1.3" stroke={C.inkMuted} strokeWidth="1.3" fill="none"/>
        <path d="M5 6V4a2 2 0 014 0v2" stroke={C.inkMuted} strokeWidth="1.3" fill="none"/>
      </svg>
    </div>
  );
}

function CGTaskRow({ title, due, highlight, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 12px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      background: highlight ? C.accent + (C.scheme === 'dark' ? '12' : '08') : 'transparent',
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
        border: `1.5px solid ${C.accent}`,
        background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2,
          lineHeight: 1.3, marginBottom: 3,
        }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2,
          }}>{due}</span>
          <span style={{
            fontFamily: C.fontMono, fontSize: 8.5, color: ninaMember.color, fontWeight: 700,
            padding: '1px 5px', background: ninaMember.color + '22',
            borderRadius: 3, letterSpacing: 0.3,
          }}>FOR YOU</span>
        </div>
      </div>
      <CAvatar member={ninaMember} size={22} />
    </div>
  );
}

function PermissionRow({ icon, label, last }) {
  const positive = icon === 'check';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 0',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 8, flexShrink: 0,
        background: positive ? C.accent + '22' : C.inkFaint + '22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {positive ? (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M2 2l6 6M8 2l-6 6" stroke={C.inkMuted} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <span style={{
        fontSize: 12.5, color: positive ? C.ink : C.inkMuted,
        letterSpacing: -0.1, lineHeight: 1.4,
      }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// REMOVE CAREGIVER — bottom sheet modal from Family Hub
// ═══════════════════════════════════════════════════════════════════════════
function RemoveCaregiverSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>

        {/* ── Background: dimmed Family Hub preview ── */}
        <div style={{
          position: 'absolute', inset: 0, paddingTop: 54,
          opacity: 0.4, filter: dark ? 'brightness(0.5)' : 'brightness(0.9) contrast(0.7)',
          pointerEvents: 'none',
        }}>
          <div style={{ padding: '12px 20px 8px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              CHEN-PARK · BLENDED · 6 PEOPLE
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Family</div>
          </div>
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase', padding: '0 8px 6px' }}>
              People · 5
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <CAvatar member={cMembers.alex} size={36} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Alex</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <CAvatar member={cMembers.riley} size={36} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Riley</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Backdrop dim ── */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 4 }} />

        {/* ── Bottom sheet ── */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          top: 200, background: C.bg,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          zIndex: 5,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Drag handle */}
          <div style={{
            paddingTop: 8, paddingBottom: 12,
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.inkFaint + '88' }} />
          </div>

          {/* Sheet content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 16 }}>
            {/* Header */}
            <div style={{
              padding: '0 20px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600 }}>
                Manage access
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 14, background: C.inset,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke={C.inkSec} strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* Hero: who we're removing */}
            <div style={{
              padding: '0 20px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <CAvatar member={ninaMember} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: C.ink, letterSpacing: -0.6, lineHeight: 1.1 }}>
                  Nina Park
                </div>
                <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 2, fontFamily: C.fontMono, letterSpacing: -0.2 }}>
                  nina.p@gmail.com
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 9.5, color: ninaMember.color, fontWeight: 700,
                    padding: '2px 7px', background: ninaMember.color + '22',
                    borderRadius: 3, letterSpacing: 0.3, textTransform: 'uppercase',
                    border: `0.5px solid ${ninaMember.color}55`,
                  }}>CAREGIVER</span>
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                    padding: '2px 7px', background: C.inset, borderRadius: 3,
                    letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600,
                  }}>SINCE JAN 2024</span>
                </div>
              </div>
            </div>

            {/* Current access summary */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{
                background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
                padding: '14px 14px',
              }}>
                <div style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.inkSec,
                  letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10,
                }}>
                  Current access
                </div>
                <RCAccessRow label="Sees family schedule" value="Read-only" />
                <RCAccessRow label="Completes assigned tasks" value="Allowed" positive />
                <RCAccessRow label="Edits events / custody" value="Blocked" negative />
                <RCAccessRow label="Last active" value="2 hours ago" last />
              </div>
            </div>

            {/* What happens warning */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{
                background: C.alert + (dark ? '15' : '0F'),
                borderRadius: 12,
                border: `0.5px solid ${C.alert}44`,
                borderLeft: `3px solid ${C.alert}`,
                padding: '14px 14px',
              }}>
                <div style={{
                  fontSize: 13.5, fontWeight: 600, color: C.alert, letterSpacing: -0.2,
                  marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.alert} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                    <path d="M7 6v3M7 10.5v.3" stroke={C.alert} strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  This happens immediately
                </div>
                <RCConsequence text="Nina loses access to OneNest" />
                <RCConsequence text="Her upcoming task assignments unassign back to 'Anyone'" />
                <RCConsequence text="Today&apos;s scheduled push notifications cancel" last />
              </div>
            </div>

            {/* What stays */}
            <div style={{ padding: '0 16px 18px' }}>
              <div style={{
                background: C.card, borderRadius: 12,
                border: `0.5px dashed ${C.hair}`,
                padding: '14px 14px',
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
                  marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3 3 7-7" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  What stays
                </div>
                <RCConsequence text="Her completed tasks (47) stay attributed to Nina" positive />
                <RCConsequence text="History &amp; activity log stays intact" positive />
                <RCConsequence text="Re-invite anytime — settings restore on accept" positive last />
              </div>
            </div>
          </div>

          {/* Sticky action bar */}
          <div style={{
            padding: '12px 16px 30px',
            borderTop: `0.5px solid ${C.hair}`,
            background: C.bg,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              padding: '14px 14px', borderRadius: 12,
              background: C.alert, color: '#FFFFFF',
              fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5h8M5 5V3h4v2M5 5l1 7h2l1-7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Remove Nina
            </div>
            <div style={{
              padding: '10px 14px', textAlign: 'center',
              color: C.inkSec, fontSize: 13, fontWeight: 500, letterSpacing: -0.1,
            }}>
              Cancel
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function RCAccessRow({ label, value, positive, negative, last }) {
  const valueColor = positive ? C.accent : negative ? C.alert : C.inkSec;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      padding: '7px 0',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.1 }}>{label}</span>
      <span style={{
        fontFamily: C.fontMono, fontSize: 11, color: valueColor,
        letterSpacing: -0.2, fontWeight: positive || negative ? 600 : 500,
      }}>{value}</span>
    </div>
  );
}

function RCConsequence({ text, positive, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '5px 0',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}55`,
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: 3, marginTop: 7, flexShrink: 0,
        background: positive ? C.accent : C.alert,
      }} />
      <span style={{ flex: 1, fontSize: 12, color: C.inkSec, letterSpacing: -0.1, lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  );
}

Object.assign(window, { CaregiverHome, RemoveCaregiverSheet });
