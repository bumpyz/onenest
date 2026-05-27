// Round 9 — Calendar month + day views, quick-create chooser, conflict resolution detail.

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR — MONTH VIEW
// ═══════════════════════════════════════════════════════════════════════════
function CalendarMonth({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  // May 2026 — May 1 is a Friday. So 4 blank cells before May 1, then 31 days.
  const monthStart = 5; // Fri (Sun=0)
  const todayD = 26;
  const selectedD = 26;

  // Per-day event dots: up to 3 visible
  const eventsByDay = {
    1: [C.alex, C.mei],
    2: [C.alex],
    4: [C.alex, C.jin],
    5: [C.alex, C.soph],
    6: [C.alex, C.mei, C.jin],
    7: [C.alex],
    8: [C.alex, C.devon, C.soph],
    11: [C.riley],
    12: [C.riley, C.mei],
    13: [C.riley, C.jin, C.casey],
    14: [C.casey, C.oliver],
    15: [C.casey],
    18: [C.alex],
    19: [C.alex, C.soph, C.mei],
    20: [C.alex, C.jin],
    22: [C.alex, C.devon],
    25: [C.alex, C.mei],
    26: [C.alex, C.soph, C.mei, C.jin], // today — 4 events, will show +1
    27: [C.alex, C.casey, C.oliver],
    28: [C.alex, C.jin],
    29: [C.alex, C.mei, C.soph],
    30: [C.devon, C.soph, C.alex],
    31: [C.alex],
  };

  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>2026</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>May</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.inset, padding: 3, borderRadius: 8 }}>
              <CSeg label="D" />
              <CSeg label="W" />
              <CSeg label="M" active />
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ padding: '8px 16px 10px', display: 'flex', gap: 6, alignItems: 'center', overflow: 'hidden' }}>
            <CChip label="Everyone" active />
            <CChip label="Mei" dot={C.mei} />
            <CChip label="Jin" dot={C.jin} />
            <CChip label="Soph" dot={C.soph} />
            <CChip label="Oliver" dot={C.oliver} />
          </div>

          {/* Day-letter row */}
          <div style={{ padding: '0 12px 4px', display: 'flex' }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <div key={i} style={{
                flex: 1, textAlign: 'center',
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                fontWeight: 600, letterSpacing: 0.3, paddingBottom: 4,
              }}>{d}</div>
            ))}
          </div>

          {/* Month grid */}
          <div style={{ padding: '0 12px', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {Array.from({ length: 42 }).map((_, i) => {
              const day = i - monthStart + 1;
              if (day < 1 || day > 31) return <div key={i} style={{ height: 64 }} />;
              const isToday = day === todayD;
              const isSelected = day === selectedD;
              const evs = eventsByDay[day] || [];
              return (
                <div key={i} style={{
                  height: 64, borderRadius: 8,
                  background: isSelected ? C.accent + (dark ? '22' : '18') : C.card,
                  border: `${isSelected ? 1.5 : 0.5}px solid ${isSelected ? C.accent : C.hair}`,
                  padding: '4px 0 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  {/* Day number */}
                  <div style={{
                    fontFamily: C.fontMono, fontSize: 13, fontWeight: isToday ? 600 : 500,
                    color: isToday ? C.onAccent : C.ink, letterSpacing: -0.3,
                    width: 22, height: 22, borderRadius: 11,
                    background: isToday ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{day}</div>
                  {/* Event dots */}
                  <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 36 }}>
                    {evs.slice(0, 3).map((c, j) => (
                      <div key={j} style={{ width: 5, height: 5, borderRadius: 3, background: c }} />
                    ))}
                  </div>
                  {evs.length > 3 && (
                    <div style={{
                      fontFamily: C.fontMono, fontSize: 8.5, color: C.inkMuted, fontWeight: 600,
                      letterSpacing: -0.2, marginTop: -2,
                    }}>+{evs.length - 3}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected-day preview at bottom — full width below the FAB */}
          <div style={{
            position: 'absolute', left: 12, right: 12, bottom: 88,
            background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
            padding: 14,
            boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.04), 0 8px 24px rgba(14,14,16,0.06)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: -0.3 }}>
                  Tue · May 26
                </span>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.accent, letterSpacing: -0.2, fontWeight: 600 }}>
                  TODAY
                </span>
              </div>
              <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                4 events
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <CMTinyEvent time="08:15" title="Oliver · day-care drop" color={C.riley} />
              <CMTinyEvent time="13:00" title="Alex · standup → product review" color={C.alex} />
              <CMTinyEvent time="16:00" title="Soph · piano + Mei rehearsal" color={C.warn} conflict />
              <CMTinyEvent time="17:00" title="Pick up Oliver — hand-off" color={C.casey} />
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, color: C.inkSec, letterSpacing: -0.1 }}>
                Open day view
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 1.5l3.5 3.5L3 8.5" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* FAB — sits above the pinned selected-day preview card. */}
        <div style={{
          position: 'absolute', right: 16, bottom: 232,
          height: 44, padding: '0 16px', borderRadius: 22, background: C.accent,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 16px rgba(14,14,16,0.18)', zIndex: 6,
        }}>
          {CIcon.plus(C.onAccent)}
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>New event</span>
        </div>

        <CBottomNav active="cal" />
      </div>
    </IOSDevice>
  );
}

function CMTinyEvent({ time, title, color, conflict }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 50, fontFamily: C.fontMono, fontSize: 10.5, color: C.inkSec, letterSpacing: -0.2, flexShrink: 0 }}>
        {time}
      </div>
      <div style={{ width: 2, height: 12, borderRadius: 1, background: color, flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 12.5, color: C.ink, fontWeight: 500, letterSpacing: -0.15,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{title}</span>
      {conflict && (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR — DAY VIEW
// ═══════════════════════════════════════════════════════════════════════════
function CalendarDay({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>WEEK 22 · 2026</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Tue · May 26</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.inset, padding: 3, borderRadius: 8 }}>
              <CSeg label="D" active />
              <CSeg label="W" />
              <CSeg label="M" />
            </div>
          </div>

          {/* Date strip with prev/next + custody pill */}
          <div style={{
            padding: '8px 16px 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{
                width: 26, height: 26, borderRadius: 6, background: C.card,
                border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M6.5 1.5L3 5l3.5 3.5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* Mini date strip */}
              {[24, 25, 26, 27, 28].map(d => (
                <div key={d} style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: d === 26 ? C.accent : C.card,
                  border: d === 26 ? 'none' : `0.5px solid ${C.hair}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 8.5,
                    color: d === 26 ? C.onAccent + 'DD' : C.inkMuted,
                    fontWeight: 600, letterSpacing: 0.3,
                  }}>{['S','M','T','W','T'][d - 24]}</span>
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 11.5,
                    color: d === 26 ? C.onAccent : C.ink, fontWeight: 600, letterSpacing: -0.3,
                  }}>{d}</span>
                </div>
              ))}
              <div style={{
                width: 26, height: 26, borderRadius: 6, background: C.card,
                border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3.5 1.5L7 5l-3.5 3.5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Day summary chips */}
          <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <DaySummaryPill icon="cal" label="4 events" />
            <DaySummaryPill icon="warn" label="1 conflict" warn />
            <DaySummaryPill icon="swap" label="1 hand-off" />
            <DaySummaryPill icon="check" label="2 tasks" accent />
          </div>

          {/* All-day strip */}
          <div style={{ padding: '4px 16px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: C.fontMono, fontSize: 9, color: C.inkFaint, letterSpacing: 0.3,
              width: 36, textTransform: 'uppercase',
            }}>ALL DAY</span>
            <div style={{
              flex: 1, padding: '4px 10px', borderRadius: 6,
              background: C.mei + '22', borderLeft: `2px solid ${C.mei}`,
              fontSize: 11, color: C.ink, letterSpacing: -0.2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: C.mei }} />
              Mei · field trip continues (day 2 of 3)
            </div>
          </div>

          {/* Hourly grid */}
          <div style={{ position: 'absolute', top: 246, left: 0, right: 0, bottom: 80, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: '0 12px', overflow: 'auto' }}>
              <div style={{
                position: 'relative', background: C.card, borderRadius: 10,
                border: `0.5px solid ${C.hair}`, paddingBottom: 8,
              }}>
                {hours.map((h, i) => (
                  <div key={i} style={{ display: 'flex', minHeight: 56, borderBottom: `0.5px solid ${C.hairS}` }}>
                    <div style={{
                      width: 44, padding: '4px 0 0 10px', flexShrink: 0,
                      fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, letterSpacing: -0.2,
                    }}>{String(h).padStart(2,'0')}:00</div>
                    <div style={{ flex: 1 }} />
                  </div>
                ))}

                {/* Now line at 13:42 */}
                <div style={{
                  position: 'absolute', left: 44, right: 8, top: (13.7 - 7) * 56, height: 1.5,
                  background: C.accent, zIndex: 3,
                }}>
                  <div style={{ position: 'absolute', left: -4, top: -4, width: 9, height: 9, borderRadius: 5, background: C.accent }} />
                  <div style={{
                    position: 'absolute', left: 12, top: -9, padding: '1px 6px',
                    background: C.accent, color: C.onAccent, borderRadius: 4,
                    fontFamily: C.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: -0.2,
                  }}>NOW · 13:42</div>
                </div>

                {/* Event blocks */}
                <DayBlock startH={8.25} endH={8.75} color={C.riley} title="Oliver day-care drop" sub="Tiny Sprouts · Riley" />
                <DayBlock startH={10.5} endH={11.5} color={C.alex} title="Mei · orthodontist" sub="Dr. Lin · Alex" />
                <DayBlock startH={13} endH={14} color={C.alex} title="Alex · standup → product review" sub="Remote · 1h" done />
                <DayBlock startH={16} endH={16.75} color={C.alex} title="Soph · piano lesson" sub="Anderson Music · Alex" conflict />
                <DayBlock startH={16} endH={17.5} color={C.alex} title="Mei · spring rehearsal" sub="School auditorium · Alex" conflict right />
                <DayBlock startH={17} endH={17.5} color={C.casey} title="Oliver → Casey · hand-off" sub="Day-care pickup · 30m" handoff />
                <DayBlock startH={18.5} endH={19.5} color={C.alex} title="Family dinner · grandma" sub="Home · 1h" />
              </div>
            </div>
          </div>
        </div>

        {/* FAB */}
        <div style={{
          position: 'absolute', right: 16, bottom: 96,
          height: 44, padding: '0 16px', borderRadius: 22, background: C.accent,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 16px rgba(14,14,16,0.18)', zIndex: 6,
        }}>
          {CIcon.plus(C.onAccent)}
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>New event</span>
        </div>

        <CBottomNav active="cal" />
      </div>
    </IOSDevice>
  );
}

function DaySummaryPill({ icon, label, warn, accent }) {
  const tint = warn ? C.warn : accent ? C.accent : C.inkSec;
  const iconNode = {
    cal: (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="3" width="10" height="9" rx="1.5" stroke={tint} strokeWidth="1.3" fill="none"/>
        <path d="M2 6h10M5 1.5v3M9 1.5v3" stroke={tint} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    warn: (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5L13 12H1L7 1.5z" stroke={tint} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
        <path d="M7 6v3M7 10.5v.3" stroke={tint} strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    swap: (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
        <path d="M2 4h9l-2-2M12 10H3l2 2" stroke={tint} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    check: (
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
        <path d="M2 7l3 3 7-7" stroke={tint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  }[icon];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px', borderRadius: 999,
      background: tint + (warn || accent ? '22' : '15'),
      border: `0.5px solid ${tint}44`,
    }}>
      {iconNode}
      <span style={{
        fontFamily: C.fontMono, fontSize: 10, color: tint,
        fontWeight: 600, letterSpacing: -0.2,
      }}>{label}</span>
    </div>
  );
}

function DayBlock({ startH, endH, color, title, sub, conflict, done, handoff, right }) {
  const dark = C.scheme === 'dark';
  const top = (startH - 7) * 56;
  const height = (endH - startH) * 56 - 2;
  const fillAlpha = dark ? '5C' : '22';
  return (
    <div style={{
      position: 'absolute', top, height,
      left: right ? `calc(44px + (100% - 44px) / 2)` : 44,
      right: conflict && !right ? `calc((100% - 44px) / 2)` : 8,
      background: color + fillAlpha,
      borderLeft: `3px solid ${color}`,
      borderRadius: 6,
      padding: '6px 10px',
      overflow: 'hidden',
      opacity: done ? 0.55 : 1,
      boxShadow: conflict ? `inset 0 0 0 1px ${C.warn}80` : 'none',
    }}>
      <div style={{
        fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
        lineHeight: 1.25, marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {handoff && (
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M2 4h9l-2-2M12 10H3l2 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
        {conflict && (
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
            <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
      </div>
      {sub && (
        <div style={{
          fontFamily: C.fontMono, fontSize: 9.5, color: C.inkSec, letterSpacing: -0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{sub}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK CREATE SHEET — what tapping the FAB opens
// ═══════════════════════════════════════════════════════════════════════════
function QuickCreateSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>

        {/* Dimmed Home behind */}
        <div style={{
          position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 88,
          opacity: 0.45, filter: dark ? 'brightness(0.6)' : 'brightness(0.95)',
          pointerEvents: 'none',
        }}>
          <div style={{ padding: '12px 20px 6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Chen-Park</span>
              <CAvatar member={cMembers.alex} size={32} />
            </div>
          </div>
          <div style={{ padding: '14px 20px 0' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted }}>TUE · MAY 26 · 2026</div>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -1, lineHeight: 1.1, marginTop: 4 }}>
              Good morning, Alex.
            </div>
          </div>
        </div>

        {/* Backdrop */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 4 }} />

        {/* FAB "X" indicator at the bottom — this is the active FAB */}
        <div style={{
          position: 'absolute', right: 16, bottom: 96,
          height: 44, width: 44, borderRadius: 22, background: C.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(14,14,16,0.32)', zIndex: 7,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Bottom sheet */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.bg,
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          zIndex: 5,
          paddingBottom: 30,
        }}>
          {/* Drag handle */}
          <div style={{
            paddingTop: 8, paddingBottom: 14,
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: C.inkFaint + '88' }} />
          </div>

          {/* AI parse-paste row — the fast path */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `1px solid ${C.accent}`,
              padding: '13px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: `0 0 0 4px ${C.accent}1A`,
            }}>
              {CIcon.spark(C.accent)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: C.ink, fontWeight: 600, letterSpacing: -0.1 }}>
                  Paste anything
                </div>
                <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2, marginTop: 1 }}>
                  &ldquo;dentist jin tue 9am&rdquo; · &ldquo;buy paper towels @riley&rdquo;
                </div>
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 9.5, color: C.accent,
                padding: '2px 6px', background: C.accent + '22',
                borderRadius: 3, fontWeight: 700, letterSpacing: 0.3,
              }}>⌘V</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 24px 12px',
          }}>
            <div style={{ flex: 1, height: 0.5, background: C.hair }} />
            <span style={{
              fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
              letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600,
            }}>OR PICK A KIND</span>
            <div style={{ flex: 1, height: 0.5, background: C.hair }} />
          </div>

          {/* Grid of options */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <QCOption
                color={C.alex}
                title="Event"
                sub="Calendar entry · time, who, where"
                icon={(
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="4.5" width="14" height="13" rx="2" stroke={C.alex} strokeWidth="1.5"/>
                    <path d="M3 8h14M7 2.5v3M13 2.5v3" stroke={C.alex} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                badge="⌘E"
              />
              <QCOption
                color={C.accent}
                title="Task"
                sub="To-do item · assign, due"
                icon={(
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="2" stroke={C.accent} strokeWidth="1.5"/>
                    <path d="M6 10l3 3 5-6" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                badge="⌘T"
              />
              <QCOption
                color={C.mei}
                title="List"
                sub="New task list · color + sharing"
                icon={(
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 5h14M3 10h14M3 15h14" stroke={C.mei} strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="5" cy="5" r="0.8" fill={C.mei}/>
                    <circle cx="5" cy="10" r="0.8" fill={C.mei}/>
                    <circle cx="5" cy="15" r="0.8" fill={C.mei}/>
                  </svg>
                )}
                badge="⌘L"
              />
              <QCOption
                color="#E5613D"
                title="Contact"
                sub="Doctor, coach, teacher…"
                icon={(
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="3" stroke="#E5613D" strokeWidth="1.5"/>
                    <path d="M3 17c0-3 3-5 7-5s7 2 7 5" stroke="#E5613D" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                badge="⌘C"
              />
            </div>
          </div>

          {/* Less-common — slim row */}
          <div style={{ padding: '4px 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <QCSlimRow
                icon={(
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path d="M3 4h12l-2-2M15 14H3l2 2" stroke={C.devon} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                title="Custody override"
                sub="One-time swap for a date"
                last={false}
              />
              <QCSlimRow
                icon={(
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path d="M9 1l5 2v4c0 3-2.5 6-5 7-2.5-1-5-4-5-7V3l5-2z" stroke={C.jin} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                    <path d="M6.5 9l1.5 1.5L12 6.5" stroke={C.jin} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                title="Reminder"
                sub="Standalone notification, no event"
                last
              />
            </div>
          </div>

          {/* Cancel */}
          <div style={{
            margin: '0 16px',
            padding: '14px 14px', borderRadius: 12,
            background: C.card, border: `0.5px solid ${C.hair}`,
            color: C.inkSec, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            textAlign: 'center',
          }}>
            Cancel
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function QCOption({ color, title, sub, icon, badge }) {
  return (
    <div style={{
      background: C.card, borderRadius: 14,
      border: `0.5px solid ${C.hair}`,
      padding: '14px 14px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Tinted corner accent */}
      <div style={{
        position: 'absolute', top: -16, right: -16, width: 60, height: 60,
        borderRadius: 30, background: color + '18',
      }} />
      <div style={{ position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: color + '22',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}>{icon}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
        <div style={{
          position: 'absolute', top: 0, right: 0,
          fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted,
          padding: '2px 5px', background: C.inset, borderRadius: 3,
          fontWeight: 600, letterSpacing: -0.2,
        }}>{badge}</div>
      </div>
    </div>
  );
}

function QCSlimRow({ icon, title, sub, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{sub}</div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFLICT RESOLUTION — full-screen view of the inline ribbon
// ═══════════════════════════════════════════════════════════════════════════
function ConflictResolution({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 100 }}>

          {/* Top bar */}
          <div style={{
            padding: '8px 16px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke={C.inkSec} strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Resolve conflict
            </span>
            <div style={{ width: 32 }} />
          </div>

          {/* Hero — the conflict statement */}
          <div style={{ padding: '8px 24px 16px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: C.warn + '22', border: `0.5px solid ${C.warn}55`,
              marginBottom: 12,
            }}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.warn, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                Conflict · Tue 16:00
              </span>
            </div>
            <div style={{
              fontSize: 26, fontWeight: 600, color: C.ink,
              letterSpacing: -0.9, lineHeight: 1.15,
            }}>
              Two events, one parent
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, color: C.inkSec, lineHeight: 1.55 }}>
              Both currently assigned to Alex. Pick a path — we&apos;ll handle the rest.
            </div>
          </div>

          {/* The two events */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
              <ConflictCard
                time="16:00 – 16:45"
                title="Soph · piano"
                sub="Anderson Music Studio"
                child={cMembers.soph}
                color={C.alex}
              />
              <div style={{
                width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: C.fontMono, fontSize: 11, color: C.warn, fontWeight: 700, letterSpacing: 0.3,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: C.warn, color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>×</div>
              </div>
              <ConflictCard
                time="16:00 – 17:30"
                title="Mei · rehearsal"
                sub="School auditorium"
                child={cMembers.mei}
                color={C.alex}
              />
            </div>
            {/* Visual overlap bar */}
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: C.warn + '12',
              borderRadius: 8, border: `0.5px dashed ${C.warn}66`,
              fontSize: 11, color: C.inkSec, letterSpacing: -0.1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke={C.warn} strokeWidth="1.4" fill="none"/>
                <path d="M7 4v3l2 1" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <span><span style={{ color: C.warn, fontFamily: C.fontMono, fontWeight: 700 }}>45 MIN</span> of physical overlap · Alex can&apos;t be in both places</span>
            </div>
          </div>

          {/* Suggested resolutions */}
          <div style={{ padding: '0 24px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {CIcon.spark(C.accent)}
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Suggested · 3
              </span>
            </div>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>ranked by ease</span>
          </div>
          <div style={{ padding: '0 16px 14px' }}>
            <ResolutionOption
              recommended
              title="Reassign Mei's rehearsal to Riley"
              effect="Riley is free 15:30 – 17:45 · only event at that time"
              who={cMembers.riley}
              effort="1 tap"
              selected
            />
            <ResolutionOption
              title="Move Soph's piano to 17:00"
              effect="Anderson Music has the 17:00 slot open most Tuesdays"
              icon="clock"
              effort="Confirm with teacher"
            />
            <ResolutionOption
              title="Ask Devon to take Soph this weekend"
              effect="Frees Alex on Sat morning to do a make-up lesson"
              who={cMembers.devon}
              effort="Sends a swap request"
            />
          </div>

          {/* Manual options */}
          <div style={{ padding: '0 24px 8px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Or do it yourself
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <ManualResRow icon="cal" label="Reschedule one event" sub="Pick a new time" />
              <ManualResRow icon="user" label="Assign to a different parent" sub="Choose Riley, Casey, Devon, or Anyone" />
              <ManualResRow icon="x" label="Cancel one of these events" sub="Delete or skip this occurrence" alert />
              <ManualResRow icon="check" label="Mark as not a conflict" sub="Tell OneNest to stop warning about this" muted last />
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
            flex: '0 0 auto', padding: '12px 14px', borderRadius: 10,
            background: C.card, border: `0.5px solid ${C.hair}`, color: C.ink,
            fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
          }}>
            Not now
          </div>
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 10,
            background: C.accent, color: C.onAccent,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Apply · reassign Mei to Riley
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function ConflictCard({ time, title, sub, child, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: C.card, borderRadius: 12,
      border: `0.5px solid ${C.hair}`, borderLeft: `3px solid ${color}`,
      padding: '12px 12px',
    }}>
      <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.ink, fontWeight: 600, letterSpacing: -0.2 }}>
        {time}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
        marginTop: 4, lineHeight: 1.25,
      }}>{title}</div>
      <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 2 }}>{sub}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <CAvatar member={child} size={14} />
        <span style={{ fontSize: 10.5, color: C.inkSec, letterSpacing: -0.1 }}>{child.name}</span>
        <span style={{ color: C.inkFaint, fontSize: 9 }}>·</span>
        <CAvatar member={cMembers.alex} size={14} />
        <span style={{ fontSize: 10.5, color: C.inkSec, letterSpacing: -0.1 }}>Alex</span>
      </div>
    </div>
  );
}

function ResolutionOption({ recommended, title, effect, who, icon, effort, selected }) {
  return (
    <div style={{
      background: selected ? C.accent + '12' : C.card,
      border: `${selected ? 1.5 : 0.5}px solid ${selected ? C.accent : C.hair}`,
      borderRadius: 12, padding: '12px 14px', marginBottom: 8,
      position: 'relative',
    }}>
      {recommended && (
        <span style={{
          position: 'absolute', top: -7, left: 12,
          fontFamily: C.fontMono, fontSize: 9, color: C.accent, fontWeight: 700,
          padding: '2px 7px', background: C.bg,
          border: `0.5px solid ${C.accent}66`, borderRadius: 999,
          letterSpacing: 0.4, textTransform: 'uppercase',
        }}>BEST PICK</span>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 10, flexShrink: 0, marginTop: 2,
          border: `1.5px solid ${selected ? C.accent : C.inkFaint}`,
          background: selected ? C.accent : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && (
            <div style={{ width: 8, height: 8, borderRadius: 4, background: C.onAccent }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.45, marginBottom: 8 }}>
            {effect}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {who && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <CAvatar member={who} size={16} />
                <span style={{ fontSize: 11, color: C.ink, fontWeight: 500, letterSpacing: -0.1 }}>{who.name}</span>
              </span>
            )}
            {icon === 'clock' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: C.inkSec }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke={C.inkSec} strokeWidth="1.3" fill="none"/>
                  <path d="M7 4v3l2 1" stroke={C.inkSec} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: -0.1 }}>17:00</span>
              </span>
            )}
            <span style={{ color: C.inkFaint, fontSize: 10 }}>·</span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              {effort}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualResRow({ icon, label, sub, alert, muted, last }) {
  const color = alert ? C.alert : muted ? C.inkMuted : C.ink;
  const iconNode = {
    cal: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke={color} strokeWidth="1.4"/>
        <path d="M2.5 6.5h11M6 1.5v3M10 1.5v3" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    user: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="6" r="2.5" stroke={color} strokeWidth="1.4"/>
        <path d="M3 14c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    x: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4"/>
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    check: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4"/>
        <path d="M5 8.5l2 2 4-4.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  }[icon];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8,
        background: (alert ? C.alert : color) + '15',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{iconNode}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color, letterSpacing: -0.2,
        }}>{label}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{sub}</div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

Object.assign(window, { CalendarMonth, CalendarDay, QuickCreateSheet, ConflictResolution });
