// Round 5 — extra screens for the matched P3/P4-F pair.
// Event detail, Custody schedule, and Welcome/Onboarding.
// Reuses helpers + palettes from direction-c-pro.jsx via the global script scope.

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function EventDetail({ palette = paletteMistForest, scrollTop = 0 }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
  }, [scrollTop]);
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Top bar */}
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
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 6 }}>
              {/* recurrence marker */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5a5 5 0 019-2.5M12 9a5 5 0 01-9 2.5M2 2v3h3M12 12V9H9" stroke={C.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                WEEKLY · MAY 26 · 2026
              </span>
            </div>
            <div style={{
              fontSize: 28, fontWeight: 600, letterSpacing: -0.9,
              lineHeight: 1.1, color: C.ink, marginBottom: 10,
            }}>Soph &middot; piano lesson</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{
                fontFamily: C.fontMono, fontSize: 14, fontWeight: 500,
                color: C.ink, letterSpacing: -0.4,
              }}>16:00 — 16:45</div>
              <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted }}>· 45m</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: C.warn + '22', color: C.warn,
                padding: '3px 9px', borderRadius: 999,
                fontFamily: C.fontMono, fontSize: 10, fontWeight: 600, letterSpacing: -0.1,
              }}>
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.3" strokeLinejoin="round"/>
                  <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                CONFLICT
              </div>
            </div>
          </div>

          {/* Conflict resolver ribbon */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              borderLeft: `3px solid ${C.warn}`, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                  Overlaps with Mei rehearsal
                </div>
                <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.5 }}>
                  Both currently with Alex. Move one to Riley, or reassign this lesson?
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <CButton primary>Move Mei → Riley</CButton>
                  <CButton>See all options</CButton>
                </div>
              </div>
            </div>
          </div>

          {/* WHO section */}
          <EDSectionLabel label="Who" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <EDRow label="Responsible" right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CAvatar member={cMembers.alex} size={22} />
                  <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>Alex</span>
                </div>
              } />
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

          {/* FOR section */}
          <EDSectionLabel label="For" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <ChildChip member={cMembers.soph} primary />
            </div>
          </div>

          {/* LOCATION section */}
          <EDSectionLabel label="Location" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              {/* map preview placeholder */}
              <div style={{
                height: 100, position: 'relative',
                background: `linear-gradient(135deg, ${C.inset}, ${C.bg})`,
                borderBottom: `0.5px solid ${C.hair}`,
              }}>
                <svg width="100%" height="100" viewBox="0 0 360 100" style={{ position: 'absolute', inset: 0 }}>
                  <path d="M0 70 Q50 50 90 60 T180 55 T280 65 T360 50" stroke={C.hair} strokeWidth="1.5" fill="none"/>
                  <path d="M-20 30 Q60 45 120 35 T220 28 T320 40" stroke={C.hair} strokeWidth="1.5" fill="none"/>
                  <path d="M40 10 L40 100" stroke={C.hairS} strokeWidth="1"/>
                  <path d="M200 0 L200 100" stroke={C.hairS} strokeWidth="1"/>
                  <circle cx="200" cy="58" r="8" fill={C.accent + '33'} />
                  <circle cx="200" cy="58" r="4" fill={C.accent} />
                </svg>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                  Anderson Music Studio
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2, fontFamily: C.fontMono, letterSpacing: -0.2 }}>
                  482 Park Ave · 6 min drive
                </div>
              </div>
            </div>
          </div>

          {/* ATTACHED LIST section — todo list bound to this event */}
          <div style={{ padding: '12px 24px 4px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Attached list
            </span>
            <span style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.accent, letterSpacing: -0.1,
              fontWeight: 500,
            }}>+ ATTACH ANOTHER</span>
          </div>
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px 10px',
                borderBottom: `0.5px solid ${C.hair}`,
              }}>
                <div style={{
                  width: 4, alignSelf: 'stretch', borderRadius: 2,
                  background: C.mei,
                  minHeight: 32,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                      Piano · weekly prep
                    </span>
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                      padding: '1px 6px', background: C.inset, borderRadius: 3, letterSpacing: 0.2,
                    }}>LIST</span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <div style={{
                      flex: 1, height: 4, background: C.inset, borderRadius: 2, overflow: 'hidden',
                    }}>
                      <div style={{ width: '40%', height: '100%', background: C.accent, borderRadius: 2 }} />
                    </div>
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2,
                      whiteSpace: 'nowrap',
                    }}>2/5 · 1 today</span>
                  </div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <EDTaskRow title="Soph's sheet music — Czerny book" who={cMembers.alex} due="before 16:00" listColor={C.mei} />
              <EDTaskRow title="Confirm next lesson time" who={cMembers.riley} done listColor={C.mei} />
              <EDTaskRow title="Email teacher about recital piece" who={cMembers.alex} due="this week" listColor={C.mei} />
              <EDTaskRow title="Buy new metronome" anyone listColor={C.mei} />
              <EDTaskRow title="Practice 20 min daily" who={cMembers.soph} due="recurring" done listColor={C.mei} last />
            </div>
          </div>

          {/* NOTES */}
          <EDSectionLabel label="Notes" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.5,
            }}>
              Bring the new Czerny book. Mrs. Anderson said Soph is ready for the Bach minuet.
              Parking on the side street is easier after 4.
            </div>
          </div>

          {/* ACTIVITY */}
          <EDSectionLabel label="History" />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <EDActivity who={cMembers.riley} action="created" when="2 weeks ago" />
              <EDActivity who={cMembers.alex} action="changed location to Anderson Music Studio" when="last Tue" />
              <EDActivity who={cMembers.alex} action="marked recurring · weekly" when="last Tue" last />
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

function EDSectionLabel({ label }) {
  return (
    <div style={{ padding: '6px 24px 6px' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function EDRow({ label, right, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>{label}</span>
      <div>{right}</div>
    </div>
  );
}

function ChildChip({ member, primary }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px 5px 5px', borderRadius: 999,
      background: primary ? member.color + '22' : C.card,
      border: `0.5px solid ${primary ? member.color + '55' : C.hair}`,
    }}>
      <CAvatar member={member} size={18} />
      <span style={{ fontSize: 12, color: C.ink, fontWeight: 600, letterSpacing: -0.1 }}>{member.name}</span>
    </span>
  );
}

function EDTaskRow({ title, who, anyone, done, due, listColor, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      position: 'relative',
    }}>
      {/* list indent rail when row is nested inside a list */}
      {listColor && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 2, background: listColor, opacity: 0.4,
        }} />
      )}
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        marginLeft: listColor ? 4 : 0,
        border: `1.2px solid ${done ? C.accent : C.inkFaint}`,
        background: done ? C.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{done && CIcon.check('#fff')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: done ? C.inkMuted : C.ink,
          letterSpacing: -0.2, textDecoration: done ? 'line-through' : 'none', marginBottom: 2,
        }}>{title}</div>
        {due && (
          <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
            {due}
          </span>
        )}
      </div>
      {anyone ? (
        <div style={{
          width: 20, height: 20, borderRadius: 10, border: `1px dashed ${C.inkFaint}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C.fontMono, fontSize: 9, color: C.inkFaint, fontWeight: 600,
        }}>?</div>
      ) : (
        <CAvatar member={who} size={20} />
      )}
    </div>
  );
}

function EDActivity({ who, action, when, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <CAvatar member={who} size={20} />
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35 }}>
        <span style={{ fontWeight: 600, color: C.ink }}>{who.name}</span>
        <span style={{ color: C.inkSec }}> {action}</span>
      </div>
      <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint }}>{when}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTODY SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════
function CustodySchedule({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';

  // Pattern: alternating weeks between Alex and Riley.
  // External co-parents: Casey (Oliver) and Devon (Soph weekends).
  const weeks = [
    { label: 'May 25 – 31', current: true, days: ['alex','alex','alex','alex','casey','alex','alex'] },
    { label: 'Jun 1 – 7',                 days: ['riley','riley','riley','riley','riley','devon','riley'] },
    { label: 'Jun 8 – 14',                days: ['alex','alex','alex','alex','casey','alex','alex'] },
    { label: 'Jun 15 – 21',               days: ['riley','riley','riley','riley','riley','riley','riley'] },
  ];
  const colorFor = (k) => ({
    alex: C.alex, riley: C.riley, casey: C.casey, devon: C.devon,
  }[k]);

  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Header */}
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
              Custody
            </div>
            <div style={{ width: 32 }} />
          </div>

          {/* Pattern + title */}
          <div style={{ padding: '14px 24px 6px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
              PATTERN · ALTERNATING WEEKS
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.9, lineHeight: 1.1, color: C.ink }}>
              Schedule
            </div>
            <div style={{ marginTop: 6, fontSize: 12.5, color: C.inkSec, lineHeight: 1.5 }}>
              Alex&apos;s week this week. Hand-off Sunday May 31 at 18:00.
            </div>
          </div>

          {/* Legend */}
          <div style={{ padding: '8px 24px 14px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <LegendDot color={C.alex} label="Alex" />
            <LegendDot color={C.riley} label="Riley" />
            <LegendDot color={C.casey} label="Casey" subtle />
            <LegendDot color={C.devon} label="Devon" subtle />
          </div>

          {/* Weekly visualizations */}
          <div style={{ padding: '0 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: 14, overflow: 'hidden',
            }}>
              {weeks.map((w, i) => (
                <div key={i} style={{
                  paddingTop: i ? 14 : 0,
                  paddingBottom: i < weeks.length - 1 ? 14 : 0,
                  borderBottom: i < weeks.length - 1 ? `0.5px solid ${C.hair}` : 'none',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 8,
                  }}>
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 11, color: w.current ? C.accent : C.inkSec,
                      letterSpacing: -0.2, fontWeight: w.current ? 600 : 500,
                    }}>
                      {w.label}{w.current && ' · NOW'}
                    </span>
                    <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>
                      Wk {22 + i}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {w.days.map((k, j) => (
                      <div key={j} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: '100%', height: 26, borderRadius: 4,
                          background: colorFor(k) + (dark ? '5C' : '33'),
                          borderTop: `2px solid ${colorFor(k)}`,
                        }} />
                        <span style={{
                          fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: -0.2,
                        }}>{['M','T','W','T','F','S','S'][j]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending requests */}
          <EDSectionLabel label="Pending · 1" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              borderLeft: `3px solid ${C.devon}`, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <CAvatar member={cMembers.devon} size={26} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                    Devon · swap request
                  </div>
                  <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                    Soph · Jun 8 – Jun 9
                  </div>
                </div>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                  padding: '2px 6px', background: C.inset, borderRadius: 4, letterSpacing: 0.2,
                }}>2D AGO</span>
              </div>
              <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.5, marginBottom: 10 }}>
                Devon wants Soph that weekend instead of Jun 14 – 15 — family wedding in Tahoe.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <CButton primary>Accept swap</CButton>
                <CButton>Counter</CButton>
                <CButton>Decline</CButton>
              </div>
            </div>
          </div>

          {/* Upcoming hand-offs */}
          <EDSectionLabel label="Upcoming hand-offs" />
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <HandoffRow date="Wed May 27" time="17:00" from={cMembers.alex} to={cMembers.casey} kid="Oliver" detail="day-care pickup" />
              <HandoffRow date="Sat May 30" time="10:00" from={cMembers.alex} to={cMembers.devon} kid="Soph" detail="weekend with Devon" />
              <HandoffRow date="Sun May 31" time="18:00" from={cMembers.alex} to={cMembers.riley} kid="all 4" detail="week switch" last />
            </div>
          </div>

          {/* Overrides */}
          <EDSectionLabel label="Active overrides · 2" />
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <OverrideRow date="Jul 4 – 6" who="Mei stays with Alex" reason="Family trip" />
              <OverrideRow date="May 31" who="Riley takes Oliver" reason="Anniversary dinner" last />
            </div>
          </div>
        </div>

        {/* Sticky FAB */}
        <div style={{
          position: 'absolute', right: 16, bottom: 28,
          height: 44, padding: '0 16px', borderRadius: 22, background: C.accent,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 16px rgba(14,14,16,0.18)', zIndex: 6,
        }}>
          {CIcon.plus(C.onAccent)}
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>New override</span>
        </div>
      </div>
    </IOSDevice>
  );
}

function LegendDot({ color, label, subtle }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <span style={{ fontFamily: C.fontMono, fontSize: 11, color: subtle ? C.inkMuted : C.inkSec, letterSpacing: -0.2 }}>
        {label}{subtle && ' (ext)'}
      </span>
    </span>
  );
}

function HandoffRow({ date, time, from, to, kid, detail, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ width: 56, flexShrink: 0 }}>
        <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>{date}</div>
        <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.2, marginTop: 1 }}>{time}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <CAvatar member={from} size={20} />
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5h11M9 2l3 3-3 3" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <CAvatar member={to} size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{kid}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}

function OverrideRow({ date, who, reason, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: 4, background: C.warn, flexShrink: 0,
        boxShadow: `0 0 0 3px ${C.warn}22`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{who}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{reason}</div>
      </div>
      <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2 }}>{date}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING / WELCOME — Create household
// ═══════════════════════════════════════════════════════════════════════════
function Onboarding({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 130 }}>

          {/* Top stepper + back */}
          <div style={{
            padding: '12px 20px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2L4 7l5 5" stroke={C.inkSec} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width: i === 1 ? 22 : 6, height: 6, borderRadius: 3,
                  background: i <= 1 ? C.accent : C.inkFaint + '55',
                  transition: 'width .2s ease',
                }} />
              ))}
            </div>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              2 / 5
            </span>
          </div>

          {/* Hero */}
          <div style={{ padding: '14px 28px 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: C.accent + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M5 11l9-7 9 7v12a2 2 0 01-2 2h-4v-7h-6v7H7a2 2 0 01-2-2V11z"
                      stroke={C.accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{
              fontSize: 30, fontWeight: 600, letterSpacing: -1.1,
              lineHeight: 1.1, color: C.ink, marginBottom: 8,
            }}>
              Let&apos;s set up your<br />
              household.
            </div>
            <div style={{ fontSize: 14, color: C.inkSec, lineHeight: 1.55 }}>
              A few details so events, custody, and tasks know who they belong to.
            </div>
          </div>

          {/* Field: household name */}
          <div style={{ padding: '4px 16px 14px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkSec,
              padding: '0 8px 6px', letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
            }}>
              What should we call it?
            </div>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `1.5px solid ${C.accent}`,
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 0 0 4px ${C.accent}22`,
            }}>
              <div style={{
                fontSize: 17, fontWeight: 500, color: C.ink, letterSpacing: -0.3,
                flex: 1,
              }}>The Chen-Park family</div>
              <span style={{
                width: 1.5, height: 18, background: C.accent, animation: 'caret 1s ease infinite',
              }} />
            </div>
            <div style={{
              padding: '6px 8px 0', fontFamily: C.fontMono, fontSize: 10,
              color: C.inkMuted, letterSpacing: -0.2,
            }}>
              You can change this anytime in Settings.
            </div>
          </div>

          {/* Field: family type */}
          <div style={{ padding: '12px 16px 16px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkSec,
              padding: '0 8px 8px', letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
            }}>
              Family type
            </div>
            <FamilyOption
              icon="separated"
              title="Separated co-parents"
              sub="Two homes, custody schedule"
            />
            <FamilyOption
              icon="traditional"
              title="Traditional household"
              sub="One home, shared events"
            />
            <FamilyOption
              icon="blended"
              title="Blended family"
              sub="Two parents, kids across multiple homes"
              selected
            />
          </div>

          {/* Helper tip */}
          <div style={{ padding: '0 24px 12px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke={C.inkMuted} strokeWidth="1.3"/>
                <path d="M7 6.5v3M7 4.5v.3" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <span>You can invite a co-parent on the next step. They&apos;ll get a private email link.</span>
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.bg + 'F2', backdropFilter: 'blur(20px)',
          borderTop: `0.5px solid ${C.hair}`,
          padding: '12px 16px 30px',
          display: 'flex', gap: 8, zIndex: 5,
        }}>
          <div style={{
            flex: '0 0 auto', padding: '12px 16px', borderRadius: 10,
            background: 'transparent',
            color: C.inkSec, fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
          }}>
            Skip
          </div>
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 10,
            background: C.accent, color: C.onAccent,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Continue
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function FamilyOption({ icon, title, sub, selected }) {
  const iconNode = {
    separated: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 10l4-3 4 3v9H4v-9zM12 10l4-3 4 3v9h-8v-9z"
              stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    traditional: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M4 11l8-6 8 6v9a1 1 0 01-1 1H5a1 1 0 01-1-1v-9z"
              stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M10 21v-5h4v5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5"/>
      </svg>
    ),
    blended: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="8" cy="9" r="2.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5"/>
        <circle cx="16" cy="9" r="2.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5"/>
        <path d="M3 19c0-3 2-5 5-5s5 2 5 5M11 19c0-3 2-5 5-5s5 2 5 5"
              stroke={selected ? C.accent : C.inkSec} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  }[icon];

  return (
    <div style={{
      background: selected ? C.accent + '15' : C.card,
      border: `${selected ? 1.5 : 0.5}px solid ${selected ? C.accent : C.hair}`,
      borderRadius: 12,
      padding: '14px 14px',
      marginBottom: 8,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9,
        background: selected ? C.accent + '22' : C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{iconNode}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 1 }}>{sub}</div>
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

Object.assign(window, { EventDetail, CustodySchedule, Onboarding, Settings, ContactsList, ContactDetail, FamilyHub });

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY HUB — the "Family" bottom-nav tab. Navigation entry-point for
// Members, Children, Contacts, Custody Schedule, and Settings.
// ═══════════════════════════════════════════════════════════════════════════
function FamilyHub({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Header */}
          <div style={{
            padding: '12px 20px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                CHEN-PARK · BLENDED · 6 PEOPLE
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Family</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {/* Bell — opens Notifications activity inbox */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: C.card,
                border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
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
              {/* Settings gear */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: C.card,
                border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="2.5" stroke={C.ink} strokeWidth="1.4"/>
                  <path d="M10 1.5l1 2.5 2.5-.5.5 2.5 2.5 1-1 2.5 1.5 2-2 1.5 1 2.5-2.5 1-.5 2.5-2.5-.5-1 2.5-1-2.5-2.5.5-.5-2.5-2.5-1 1-2.5L1.5 10l2-1.5-1-2.5 2.5-1 .5-2.5 2.5.5L9 1.5h1z"
                        stroke={C.ink} strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
              <CAvatar member={cMembers.alex} size={32} />
            </div>
          </div>

          {/* Household card — hero with custody-pattern viz */}
          <div style={{ padding: '6px 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 16, position: 'relative', overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{
                    fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                    letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
                  }}>This week</div>
                  <div style={{
                    fontSize: 19, fontWeight: 600, letterSpacing: -0.5, color: C.ink, marginTop: 2,
                  }}>Alex&apos;s week · 4 hand-offs</div>
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 999,
                  background: C.accent + '22', color: C.accent,
                  fontFamily: C.fontMono, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: 3, background: C.accent }} />
                  ALT. WEEKS
                </div>
              </div>
              {/* Mini custody bar — 7 days */}
              <div style={{ display: 'flex', gap: 3 }}>
                {[C.alex, C.alex, C.alex, C.alex, C.casey, C.alex, C.alex].map((c, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', height: 20, borderRadius: 4,
                      background: c + (dark ? '5C' : '33'),
                      borderTop: `2px solid ${c}`,
                    }} />
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 9, color: i === 1 ? C.accent : C.inkMuted,
                      fontWeight: i === 1 ? 600 : 500, letterSpacing: -0.2,
                    }}>{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 12, color: C.inkSec, letterSpacing: -0.1 }}>
                  Next hand-off · <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 17:00</span> · Oliver → Casey
                </span>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: -0.1 }}>
                  VIEW →
                </span>
              </div>
            </div>
          </div>

          {/* People section */}
          <div style={{ padding: '0 24px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              People · 4
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, letterSpacing: -0.1, fontWeight: 500 }}>
              + INVITE
            </span>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <PersonRow member={cMembers.alex} role="Parent · Admin" sub="You · alex@chenpark.com" />
              <PersonRow member={cMembers.riley} role="Parent" sub="riley@chenpark.com · active 3h" />
              <PersonRow member={cMembers.casey} role="External co-parent" sub="Oliver's other parent" external />
              <PersonRow member={cMembers.devon} role="External co-parent" sub="Soph's other parent · pending swap" external last />
            </div>
          </div>

          {/* Kids section */}
          <div style={{ padding: '0 24px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Kids · 4
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, letterSpacing: -0.1, fontWeight: 500 }}>
              + ADD
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <KidCard member={cMembers.mei} age={12} grade="7th grade" otherParent={null} />
              <KidCard member={cMembers.jin} age={10} grade="5th grade" otherParent={null} />
              <KidCard member={cMembers.soph} age={8} grade="3rd grade" otherParent={cMembers.devon} />
              <KidCard member={cMembers.oliver} age={5} grade="Kindergarten" otherParent={cMembers.casey} />
            </div>
          </div>

          {/* Quick nav to other surfaces */}
          <div style={{ padding: '0 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Manage
            </span>
          </div>
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <NavRow
                icon={(
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M3 6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6zM3 9h14M7 2v4M13 2v4M7 13h2"
                          stroke={C.accent} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
                  </svg>
                )}
                title="Custody schedule"
                right={
                  <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.accent, letterSpacing: -0.2 }}>
                    Alternating weeks
                  </span>
                }
                badge="1"
              />
              <NavRow
                icon={(
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <rect x="2.5" y="3" width="15" height="13" rx="2" stroke={C.jin} strokeWidth="1.5"/>
                    <path d="M2.5 7h15" stroke={C.jin} strokeWidth="1.5"/>
                    <circle cx="10" cy="11" r="2" fill={C.jin} fillOpacity="0.6"/>
                  </svg>
                )}
                title="Connected calendars"
                right={
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600,
                    padding: '2px 7px', background: C.accent + '22', borderRadius: 999, letterSpacing: 0.3,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: C.accent }} />
                    GOOGLE
                  </span>
                }
              />
              <NavRow
                icon={(
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="2.5" stroke={C.inkSec} strokeWidth="1.4"/>
                    <path d="M10 1.5l1 2.5 2.5-.5.5 2.5 2.5 1-1 2.5 1.5 2-2 1.5 1 2.5-2.5 1-.5 2.5-2.5-.5-1 2.5-1-2.5-2.5.5-.5-2.5-2.5-1 1-2.5L1.5 10l2-1.5-1-2.5 2.5-1 .5-2.5 2.5.5L9 1.5h1z"
                          stroke={C.inkSec} strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                  </svg>
                )}
                title="Settings"
                right={
                  <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                    Theme · Mist Forest
                  </span>
                }
                last
              />
            </div>
          </div>

          {/* Recent family activity */}
          <div style={{ padding: '0 24px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Recent activity
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>3 today</span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <EDActivity who={cMembers.riley} action="added Pediatrician · Friday" when="2h" />
              <EDActivity who={cMembers.casey} action="confirmed Oliver pickup" when="3h" />
              <EDActivity who={cMembers.devon} action="requested swap · Jun 8–9" when="yesterday" last />
            </div>
          </div>
        </div>

        <CBottomNav active="people" />
      </div>
    </IOSDevice>
  );
}

function PersonRow({ member, role, sub, external, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <CAvatar member={member} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{member.name}</span>
          {external && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted,
              padding: '1px 5px', background: C.inset, borderRadius: 3,
              fontWeight: 600, letterSpacing: 0.3,
            }}>EXT</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 1 }}>{role}</div>
        <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkFaint, marginTop: 1, letterSpacing: -0.2 }}>
          {sub}
        </div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function KidCard({ member, age, grade, otherParent }) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
      padding: '14px 12px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: member.color,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <CAvatar member={member} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{member.name}</div>
          <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
            {age} yrs · {grade}
          </div>
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 10.5, color: C.inkSec, letterSpacing: -0.1,
      }}>
        {otherParent ? (
          <>
            <CAvatar member={otherParent} size={14} />
            <span>with {otherParent.name}</span>
          </>
        ) : (
          <>
            <CStack members={[cMembers.alex, cMembers.riley]} size={14} />
            <span>Alex &amp; Riley</span>
          </>
        )}
      </div>
    </div>
  );
}

function NavRow({ icon, title, right, badge, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{title}</span>
        {badge && (
          <span style={{
            background: C.accent, color: C.onAccent,
            padding: '0 6px', minWidth: 16, height: 16, borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: C.fontMono, fontSize: 9.5, fontWeight: 700, letterSpacing: -0.2,
          }}>{badge}</span>
        )}
      </div>
      {right}
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0, marginLeft: 6 }}>
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACTS LIST
// ═══════════════════════════════════════════════════════════════════════════
function ContactsList({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                24 PEOPLE · 3 NEEDS UPDATING
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Contacts</div>
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{CIcon.search()}</div>
          </div>

          {/* Search bar */}
          <div style={{ padding: '8px 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`,
              padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {CIcon.search()}
              <div style={{ flex: 1, fontFamily: C.fontMono, fontSize: 12, color: C.inkFaint, letterSpacing: -0.2 }}>
                name, role, child, # phone…
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                padding: '2px 5px', background: C.inset, borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>{CIcon.command()} F</span>
            </div>
          </div>

          {/* Category chips */}
          <div style={{ padding: '0 16px 18px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CChip label="All · 24" active />
            <CChip label="Medical" dot="#E5613D" />
            <CChip label="School" dot={C.jin} />
            <CChip label="Activities" dot={C.mei} />
            <CChip label="Family" dot={C.soph} />
            <CChip label="Emergency" dot={C.alert} />
          </div>

          {/* Emergency strip — always pinned */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.alert + (dark ? '18' : '15'),
              borderRadius: 12, padding: '12px 14px',
              border: `0.5px solid ${C.alert}55`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.alert,
                  fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: C.alert }} />
                  Emergency · always visible
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
                <EmergencyTile label="911" sub="Dial" alert />
                <EmergencyTile label="Casey" sub="Co-parent" avatarMember={cMembers.casey} />
                <EmergencyTile label="Devon" sub="Co-parent" avatarMember={cMembers.devon} />
                <EmergencyTile label="Lisa" sub="Neighbor" initials="LD" color="#8B6FB8" />
              </div>
            </div>
          </div>

          {/* Favorites strip */}
          <div style={{ padding: '0 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Favorites
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ display: 'flex', gap: 14, overflow: 'hidden' }}>
              <FavTile name="Dr. Patel" role="Pediatrician" color="#E5613D" initial="P" />
              <FavTile name="Mrs. Anderson" role="Piano" color={C.mei} initial="A" />
              <FavTile name="Coach Berry" role="Soccer" color={C.alex} initial="B" />
              <FavTile name="Grandma" role="Family" color={C.soph} initial="R" />
            </div>
          </div>

          {/* Recently contacted */}
          <CLSection label="Recently" count={2}>
            <ContactRow
              name="Dr. Anita Patel" role="Pediatrician"
              forKids={[cMembers.oliver, cMembers.soph]}
              phone="(415) 555-0142"
              when="2d ago"
              category="medical"
            />
            <ContactRow
              name="Mr. Hernandez" role="Mei's homeroom teacher"
              forKids={[cMembers.mei]}
              phone="(415) 555-0118"
              when="yesterday"
              category="school"
              last
            />
          </CLSection>

          {/* Medical */}
          <CLSection label="Medical" count={4}>
            <ContactRow
              name="Dr. Anita Patel" role="Pediatrician · UCSF"
              forKids={[cMembers.mei, cMembers.jin, cMembers.soph, cMembers.oliver]}
              phone="(415) 555-0142"
              category="medical"
              star
            />
            <ContactRow
              name="Dr. Mark Davies" role="Dentist · Bright Smiles"
              forKids={[cMembers.mei, cMembers.jin, cMembers.soph, cMembers.oliver]}
              phone="(415) 555-0189"
              category="medical"
            />
            <ContactRow
              name="Dr. Lin Ortho" role="Orthodontist"
              forKids={[cMembers.jin]}
              phone="(415) 555-0223"
              category="medical"
            />
            <ContactRow
              name="SF Children's Hospital" role="Emergency · 24/7"
              phone="(415) 555-0911"
              category="medical"
              last
            />
          </CLSection>

          {/* Activities */}
          <CLSection label="Activities" count={5}>
            <ContactRow
              name="Mrs. Anderson" role="Piano teacher"
              forKids={[cMembers.soph]}
              phone="(415) 555-0177"
              category="activities"
              star
            />
            <ContactRow
              name="Coach Berry" role="Soccer · U12 Bears"
              forKids={[cMembers.mei]}
              phone="(415) 555-0298"
              category="activities"
              outdated
            />
            <ContactRow
              name="Ms. Lopez" role="Ballet · Studio One"
              forKids={[cMembers.soph]}
              phone="(415) 555-0411"
              category="activities"
              last
            />
          </CLSection>

          {/* School */}
          <CLSection label="School" count={6}>
            <ContactRow
              name="Mr. Hernandez" role="Mei · homeroom"
              forKids={[cMembers.mei]}
              phone="(415) 555-0118"
              category="school"
            />
            <ContactRow
              name="Ms. Park" role="Jin · 4th grade"
              forKids={[cMembers.jin]}
              phone="(415) 555-0119"
              category="school"
            />
            <ContactRow
              name="Lincoln Elementary" role="Main office"
              phone="(415) 555-0100"
              category="school"
              last
            />
          </CLSection>
        </div>

        {/* FAB */}
        <div style={{
          position: 'absolute', right: 16, bottom: 96,
          height: 44, padding: '0 16px', borderRadius: 22, background: C.accent,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 16px rgba(14,14,16,0.18)', zIndex: 6,
        }}>
          {CIcon.plus(C.onAccent)}
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>Add contact</span>
        </div>

        <CBottomNav active="contacts" />
      </div>
    </IOSDevice>
  );
}

function CLSection({ label, count, children }) {
  return (
    <div>
      <div style={{
        padding: '14px 24px 6px',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>{count}</span>
      </div>
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
          overflow: 'hidden',
        }}>{children}</div>
      </div>
    </div>
  );
}

function ContactRow({ name, role, forKids, phone, when, category, star, outdated, last }) {
  const catColors = {
    medical: '#E5613D',
    school: C.jin,
    activities: C.mei,
    family: C.soph,
  };
  const catIcons = {
    medical: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
    school: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 5l5-3 5 3-5 3-5-3zM3.5 6.5v3c0 1 1.5 2 3.5 2s3.5-1 3.5-2v-3" stroke="#FFFFFF" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    activities: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="#FFFFFF" strokeWidth="1.4"/>
        <path d="M2 7h10M7 2c1.5 1.5 1.5 8.5 0 10M7 2c-1.5 1.5-1.5 8.5 0 10" stroke="#FFFFFF" strokeWidth="1.2"/>
      </svg>
    ),
  };
  const catColor = catColors[category] ?? C.inkMuted;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      {/* avatar with category badge */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20,
          background: catColor + '22', color: catColor,
          border: `0.5px solid ${catColor}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C.fontSans, fontSize: 13, fontWeight: 700, letterSpacing: -0.3,
        }}>{name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase().replace(/[^A-Z]/g, '') || name.slice(0, 2).toUpperCase()}</div>
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: 8,
          background: catColor, border: `2px solid ${C.card}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {catIcons[category] ?? null}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{name}</span>
          {star && (
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 1l1.7 4.2 4.5.3-3.4 3 1.1 4.5L7 10.5l-3.9 2.5 1.1-4.5-3.4-3 4.5-.3L7 1z"
                    fill={C.accent} stroke={C.accent} strokeWidth="0.8" strokeLinejoin="round"/>
            </svg>
          )}
          {outdated && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 9, color: C.warn,
              padding: '1px 5px', background: C.warn + '22',
              borderRadius: 3, fontWeight: 600, letterSpacing: 0.2,
            }}>STALE</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.inkMuted, marginBottom: 4 }}>{role}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {phone && (
            <span style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkSec, letterSpacing: -0.2 }}>
              {phone}
            </span>
          )}
          {forKids && forKids.length > 0 && (
            <>
              {phone && <span style={{ color: C.inkFaint, fontSize: 10 }}>·</span>}
              <CStack members={forKids} size={14} />
            </>
          )}
          {when && (
            <>
              <span style={{ color: C.inkFaint, fontSize: 10 }}>·</span>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, letterSpacing: -0.2 }}>
                {when}
              </span>
            </>
          )}
        </div>
      </div>
      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <QuickAction kind="phone" />
        <QuickAction kind="message" />
      </div>
    </div>
  );
}

function QuickAction({ kind }) {
  const icons = {
    phone: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2.5 1.5h3l1 3-1.5 1c0.5 1.5 1.5 2.5 3 3l1-1.5 3 1v3c0 .5-.5 1-1 1C5 12 2 9 2 2.5c0-.5.5-1 .5-1z"
              stroke={C.accent} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    message: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 4a2 2 0 012-2h6a2 2 0 012 2v4a2 2 0 01-2 2H6l-3 2.5V10H4a2 2 0 01-2-2V4z"
              stroke={C.inkSec} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  };
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: kind === 'phone' ? C.accent + '15' : C.inset,
      border: `0.5px solid ${kind === 'phone' ? C.accent + '40' : C.hair}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{icons[kind]}</div>
  );
}

function EmergencyTile({ label, sub, avatarMember, initials, color, alert }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: alert ? C.alert : C.card,
      border: `0.5px solid ${alert ? C.alert : C.hair}`,
      borderRadius: 10, padding: '10px 8px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {alert ? (
        <div style={{
          width: 28, height: 28, borderRadius: 14, background: '#FFFFFF22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 1.5h3l1 3-1.5 1c0.5 1.5 1.5 2.5 3 3l1-1.5 3 1v3c0 .5-.5 1-1 1C5 12 2 9 2 2.5c0-.5.5-1 .5-1z"
                  fill="#FFFFFF" stroke="none"/>
          </svg>
        </div>
      ) : avatarMember ? (
        <CAvatar member={avatarMember} size={28} />
      ) : (
        <div style={{
          width: 28, height: 28, borderRadius: 14, background: color,
          color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, letterSpacing: -0.3,
        }}>{initials}</div>
      )}
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: -0.2,
          color: alert ? '#FFFFFF' : C.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        <div style={{
          fontFamily: C.fontMono, fontSize: 9, letterSpacing: -0.2, marginTop: 1,
          color: alert ? '#FFFFFFB0' : C.inkMuted,
        }}>{sub}</div>
      </div>
    </div>
  );
}

function FavTile({ name, role, color, initial }) {
  return (
    <div style={{ width: 60, flexShrink: 0, textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: color + '22', border: `1.5px solid ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 6px',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22, background: color, color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, fontWeight: 700, letterSpacing: -0.4,
        }}>{initial}</div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, letterSpacing: -0.2, lineHeight: 1.2 }}>{name}</div>
      <div style={{ fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: -0.2, marginTop: 1 }}>{role}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTACT DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function ContactDetail({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const accentForRole = C.mei; // Soph's piano teacher → tagged mei pink-rose
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Top bar */}
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
              Contact
            </div>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 2l2 2-7 7H3v-2l7-7z" stroke={C.ink} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
          </div>

          {/* Hero — avatar + name */}
          <div style={{ padding: '18px 24px 6px', textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: 50, margin: '0 auto 16px',
              background: accentForRole + '22', border: `2px solid ${accentForRole}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 84, height: 84, borderRadius: 42,
                background: accentForRole, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, letterSpacing: -0.6,
              }}>EA</div>
              <div style={{
                position: 'absolute', bottom: 0, right: 5,
                width: 28, height: 28, borderRadius: 14,
                background: C.accent, border: `3px solid ${C.bg}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1l1.7 4.2 4.5.3-3.4 3 1.1 4.5L7 10.5l-3.9 2.5 1.1-4.5-3.4-3 4.5-.3L7 1z"
                        fill={C.onAccent} stroke="none"/>
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.7, color: C.ink, lineHeight: 1.15 }}>
              Mrs. Eleanor Anderson
            </div>
            <div style={{ fontSize: 13, color: C.inkSec, marginTop: 4 }}>
              Piano teacher · Soph&apos;s instructor since Sep 2024
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <CategoryPill label="Activities" color={C.mei} />
              <CategoryPill label="Favorite" color={C.accent} icon="star" />
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ padding: '16px 16px 18px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <BigAction icon="phone" label="Call" primary />
              <BigAction icon="message" label="Text" />
              <BigAction icon="mail" label="Email" />
              <BigAction icon="directions" label="Drive" />
            </div>
          </div>

          {/* Contact methods */}
          <SGroup label="Contact">
            <SRow label="Phone" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>
                (415) 555-0177
              </span>
            } />
            <SRow label="Email" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                e.anderson@…
              </span>
            } />
            <SRow label="Best time" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                After 4 PM
              </span>
            } last />
          </SGroup>

          {/* Linked to */}
          <SGroup label="Linked to">
            <div style={{ padding: '14px 14px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                For
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <ChildChip member={cMembers.soph} primary />
              </div>
            </div>
            <div style={{ padding: '12px 14px', borderTop: `0.5px solid ${C.hair}` }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Recurring event
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0',
              }}>
                <div style={{
                  width: 3, height: 32, borderRadius: 2, background: C.alex,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
                    Soph &middot; piano lesson
                  </div>
                  <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                    Weekly · Tuesdays · 16:00 – 16:45 · 38 sessions
                  </div>
                </div>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </SGroup>

          {/* Address */}
          <SGroup label="Address">
            <div style={{
              height: 110, position: 'relative',
              background: `linear-gradient(135deg, ${C.inset}, ${C.bg})`,
              borderBottom: `0.5px solid ${C.hair}`,
            }}>
              <svg width="100%" height="110" viewBox="0 0 360 110" style={{ position: 'absolute', inset: 0 }}>
                <path d="M0 70 Q50 50 90 60 T180 55 T280 65 T360 50" stroke={C.hair} strokeWidth="1.5" fill="none"/>
                <path d="M-20 30 Q60 45 120 35 T220 28 T320 40" stroke={C.hair} strokeWidth="1.5" fill="none"/>
                <path d="M50 0 L50 110M250 0 L250 110" stroke={C.hairS} strokeWidth="1"/>
                <circle cx="180" cy="60" r="10" fill={C.accent + '33'} />
                <circle cx="180" cy="60" r="5" fill={C.accent} />
              </svg>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
                482 Park Ave, Studio 3
              </div>
              <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 2, letterSpacing: -0.2 }}>
                San Francisco · 6 min drive · 14 min walk
              </div>
            </div>
          </SGroup>

          {/* Notes */}
          <SGroup label="Notes">
            <div style={{
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.55, fontStyle: 'normal',
            }}>
              Best to reach after 4 PM — she teaches until then. Speaks Spanish fluently.
              Was Riley&apos;s piano teacher growing up — she&apos;s the reason Soph is enrolled.
              Birthday: March 8th, sends a card.
            </div>
          </SGroup>

          {/* History */}
          <div style={{ padding: '12px 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              History
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <EDActivity who={cMembers.riley} action="added · Sep 2024" when="9 mo" />
              <EDActivity who={cMembers.alex} action="marked as favorite" when="5 mo" />
              <EDActivity who={cMembers.alex} action="updated phone number" when="2 mo" last />
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function CategoryPill({ label, color, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: color + '22',
      border: `0.5px solid ${color}55`,
    }}>
      {icon === 'star' && (
        <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.7 4.2 4.5.3-3.4 3 1.1 4.5L7 10.5l-3.9 2.5 1.1-4.5-3.4-3 4.5-.3L7 1z" fill={color}/>
        </svg>
      )}
      <span style={{
        fontFamily: C.fontMono, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
        textTransform: 'uppercase', color: C.ink,
      }}>{label}</span>
    </span>
  );
}

function BigAction({ icon, label, primary }) {
  const icons = {
    phone: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 2.5h4l1.5 4-2 1.5c.7 2 2.3 3.6 4 4.4l1.5-2 4 1.5v4c0 .8-.7 1.5-1.5 1.5C8 17.4 3 12.4 3 4c0-.8.7-1.5 1.5-1.5z"
              stroke={primary ? C.onAccent : C.accent} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    message: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H9l-4 3.5V13H5a2 2 0 01-2-2V5z"
              stroke={C.ink} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    mail: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2.5" y="4" width="15" height="12" rx="2" stroke={C.ink} strokeWidth="1.5"/>
        <path d="M2.5 5l7.5 6 7.5-6" stroke={C.ink} strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    directions: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 1.5L18 9.5l-8 8-8-8 8-8zM10 6v4M10 10h-2.5" stroke={C.ink} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  };
  return (
    <div style={{
      flex: 1, borderRadius: 12, padding: '14px 8px',
      background: primary ? C.accent : C.card,
      border: primary ? 'none' : `0.5px solid ${C.hair}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    }}>
      {icons[icon]}
      <span style={{
        fontSize: 11.5, fontWeight: 600, letterSpacing: -0.2,
        color: primary ? C.onAccent : C.ink,
      }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function Settings({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 14px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              SIGNED IN AS ALEX@CHENPARK.COM
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.9, marginTop: 2 }}>Settings</div>
          </div>

          {/* Profile card */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 16, display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{ position: 'relative' }}>
                <CAvatar member={cMembers.alex} size={56} />
                <div style={{
                  position: 'absolute', right: -2, bottom: -2,
                  width: 20, height: 20, borderRadius: 10,
                  background: C.accent, border: `2px solid ${C.card}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                    <path d="M9 3l3 3-7 7H2v-3l7-7z" stroke={C.onAccent} strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.ink, letterSpacing: -0.4 }}>Alex Chen</div>
                <div style={{ fontSize: 12, color: C.inkMuted, marginTop: 1, fontFamily: C.fontMono, letterSpacing: -0.2 }}>
                  alex@chenpark.com
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <RolePill label="Parent" color={C.alex} />
                  <RolePill label="Admin" color={C.accent} />
                </div>
              </div>
            </div>
          </div>

          {/* Household */}
          <SGroup label="Household">
            <SRow label="Name" right="Chen-Park" chevron />
            <SRow label="Family type" right="Blended" chevron />
            <SRow label="Members" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CStack members={[cMembers.alex, cMembers.riley, cMembers.casey, cMembers.devon]} size={18} />
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>4</span>
              </div>
            } chevron />
            <SRow label="Children" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CStack members={[cMembers.mei, cMembers.jin, cMembers.soph, cMembers.oliver]} size={18} />
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>4</span>
              </div>
            } chevron />
            <SRow label="Custody schedule" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.accent, fontWeight: 500, letterSpacing: -0.2 }}>
                Alternating weeks
              </span>
            } chevron last />
          </SGroup>

          {/* Invite */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.accent + (dark ? '18' : '15'),
              border: `1px dashed ${C.accent}`,
              borderRadius: 12, padding: '14px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: C.accent, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path d="M3 16c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5M5.5 6a3 3 0 106 0 3 3 0 00-6 0M16 7v6M13 10h6"
                        stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                  Invite someone new
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSec, marginTop: 1, lineHeight: 1.4 }}>
                  Co-parent, caregiver, or family member — they&apos;ll get a private link.
                </div>
              </div>
              <div style={{
                padding: '7px 11px', borderRadius: 8,
                background: C.accent, color: C.onAccent,
                fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
              }}>Invite</div>
            </div>
          </div>

          {/* Notifications */}
          <SGroup label="Notifications">
            <SToggle label="Weekly digest" sub="Sunday at 7pm · conflicts, unassigned, hand-offs" on />
            <SToggle label="Task reminders" sub="15 min before · custom per task" on />
            <SToggle label="Hand-off reminders" sub="2 hours before custody changes" on />
            <SToggle label="Conflict alerts" sub="When new events overlap your schedule" on />
            <SToggle label="Activity from co-parents" sub="When Casey or Devon adds an event" last />
          </SGroup>

          {/* Connected calendars */}
          <SGroup
            label="Connected calendars"
            subLabel="Only busy times sync — never titles, locations, or attendees"
          >
            <SCalendarRow provider="google" email="alex@chenpark.com" status="connected" lastSync="2 min ago" />
            <SCalendarRow provider="microsoft" email="—" status="add" last />
          </SGroup>

          {/* Appearance — the matched-pair picker */}
          <SGroup label="Appearance">
            <div style={{ padding: '14px 14px 10px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>
                Theme
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <ThemeOption mode="light" selected={!dark} />
                <ThemeOption mode="dark" selected={dark} />
                <ThemeOption mode="system" />
              </div>
            </div>
            <div style={{ borderTop: `0.5px solid ${C.hair}`, padding: '14px 14px 10px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
              }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase' }}>
                  Accent
                </div>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2 }}>
                  Mist Forest
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <AccentSwatch color={dark ? '#3FC198' : '#2D8B6E'} selected />
                <AccentSwatch color="#E5613D" />
                <AccentSwatch color="#E8A04F" />
                <AccentSwatch color="#5667D4" />
                <AccentSwatch color="#8369A8" />
              </div>
            </div>
            <SRow label="Compact density" right={
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: C.fontMono,
                fontSize: 12, color: C.inkSec, letterSpacing: -0.2,
              }}>
                Comfortable
              </div>
            } chevron last />
          </SGroup>

          {/* AI & privacy */}
          <SGroup label="AI assistant">
            <SToggle label="Inline parse bar" sub='Type "soccer Wed 4pm" → event' on />
            <SToggle label="Smart suggestions" sub="Conflicts, recurring patterns, delegation" on />
            <SToggle label="Activity summaries" sub="Weekly recap on Sunday" />
            <SRow label="What can the AI see?" right="" chevron last />
          </SGroup>

          {/* About + sign out */}
          <SGroup label="About">
            <SRow label="Help & feedback" chevron />
            <SRow label="Privacy policy" chevron />
            <SRow label="Terms of service" chevron />
            <SRow label="Version" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                2.4.1 · 9b3f8a2
              </span>
            } last />
          </SGroup>

          {/* Danger zone */}
          <div style={{ padding: '8px 16px 24px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 14px',
                color: C.alert, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: `0.5px solid ${C.hair}`,
              }}>Sign out</div>
              <div style={{
                padding: '14px 14px',
                color: C.alert, fontSize: 13, letterSpacing: -0.2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: 0.8,
              }}>Delete account</div>
            </div>
          </div>

          {/* Tagline */}
          <div style={{
            textAlign: 'center', padding: '0 16px 12px',
            fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, letterSpacing: 0.6,
          }}>
            ONENEST · MADE FOR FAMILIES
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function SGroup({ label, subLabel, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ padding: '0 24px 8px' }}>
        <div style={{
          fontFamily: C.fontMono, fontSize: 10, color: C.inkSec,
          letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
        }}>{label}</div>
        {subLabel && (
          <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 4, lineHeight: 1.4 }}>
            {subLabel}
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
          overflow: 'hidden',
        }}>{children}</div>
      </div>
    </div>
  );
}

function SRow({ label, right, chevron, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ flex: 1, fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{label}</div>
      {right !== undefined && <div>{right}</div>}
      {chevron && (
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function SToggle({ label, sub, on, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
        )}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: on ? C.accent : C.inkFaint + '88',
        position: 'relative', flexShrink: 0,
        transition: 'background .15s',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 20, height: 20, borderRadius: 10, background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18), 0 1px 1px rgba(0,0,0,0.06)',
          transition: 'left .15s',
        }} />
      </div>
    </div>
  );
}

function RolePill({ label, color }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999,
      background: color + '22', color: C.ink,
      fontFamily: C.fontMono, fontSize: 9.5, fontWeight: 600,
      letterSpacing: 0.3, textTransform: 'uppercase',
      border: `0.5px solid ${color}55`,
    }}>{label}</span>
  );
}

function SCalendarRow({ provider, email, status, lastSync, last }) {
  const isGoogle = provider === 'google';
  const logo = isGoogle ? (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="3" width="18" height="16" rx="2.5" stroke={C.ink} strokeWidth="1.4"/>
      <path d="M2 7h18M7 1.5v3M15 1.5v3" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="11" cy="13" r="2.5" fill={C.accent} fillOpacity="0.6"/>
    </svg>
  ) : (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="8" height="8" fill={C.ink} fillOpacity="0.6"/>
      <rect x="12" y="2" width="8" height="8" fill={C.ink} fillOpacity="0.4"/>
      <rect x="2" y="12" width="8" height="8" fill={C.ink} fillOpacity="0.4"/>
      <rect x="12" y="12" width="8" height="8" fill={C.ink} fillOpacity="0.8"/>
    </svg>
  );
  const isConnected = status === 'connected';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{logo}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
          {isGoogle ? 'Google Calendar' : 'Microsoft Outlook'}
        </div>
        <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
          {isConnected ? `${email} · synced ${lastSync}` : 'Not connected'}
        </div>
      </div>
      {isConnected ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontFamily: C.fontMono, fontSize: 10, color: C.accent,
          padding: '3px 8px', background: C.accent + '22', borderRadius: 999,
          fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 3, background: C.accent }} />
          Live
        </div>
      ) : (
        <div style={{
          padding: '5px 10px', borderRadius: 6,
          border: `0.5px solid ${C.hair}`, color: C.ink,
          fontSize: 12, fontWeight: 600, letterSpacing: -0.1,
        }}>Connect</div>
      )}
    </div>
  );
}

function ThemeOption({ mode, selected }) {
  // mini-preview of light/dark/system
  const isLight = mode === 'light';
  const isDark = mode === 'dark';
  const isSystem = mode === 'system';
  return (
    <div style={{
      flex: 1,
      border: `${selected ? 1.5 : 0.5}px solid ${selected ? C.accent : C.hair}`,
      borderRadius: 10, padding: 8, background: C.inset,
    }}>
      <div style={{
        height: 70, borderRadius: 6, overflow: 'hidden',
        position: 'relative', marginBottom: 8,
        background: isSystem ? `linear-gradient(135deg, #ECEFEC 50%, #15171B 50%)` :
                  isDark ? '#15171B' : '#ECEFEC',
        border: `0.5px solid ${C.hair}`,
      }}>
        {/* simulated UI inside the swatch */}
        <div style={{
          position: 'absolute', top: 8, left: 8, right: 8, height: 4, borderRadius: 2,
          background: isDark ? '#F0F0F2' : '#161C18', opacity: 0.6,
        }} />
        <div style={{
          position: 'absolute', top: 18, left: 8, width: 26, height: 3, borderRadius: 2,
          background: isDark ? '#F0F0F2' : '#161C18', opacity: 0.3,
        }} />
        <div style={{
          position: 'absolute', bottom: 8, left: 8, right: 8, height: 22, borderRadius: 5,
          background: isDark ? '#1F2128' : '#FFFFFF',
          border: `0.5px solid rgba(127,127,127,0.2)`,
        }}>
          <div style={{
            position: 'absolute', top: 6, left: 6, width: 6, height: 6, borderRadius: 3,
            background: isDark ? '#3FC198' : '#2D8B6E',
          }} />
          <div style={{
            position: 'absolute', top: 7, left: 18, right: 6, height: 4, borderRadius: 2,
            background: isDark ? '#F0F0F2' : '#161C18', opacity: 0.4,
          }} />
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.2, textTransform: 'capitalize' }}>
          {mode}
        </span>
        {selected && (
          <div style={{
            width: 14, height: 14, borderRadius: 7, background: C.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
              <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function AccentSwatch({ color, selected }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: color, position: 'relative',
      boxShadow: selected ? `0 0 0 2px ${C.bg}, 0 0 0 4px ${color}` : 'none',
    }}>
      {selected && (
        <svg width="16" height="16" viewBox="0 0 16 16" style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        }} fill="none">
          <path d="M3 8l3 3 7-7" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}
