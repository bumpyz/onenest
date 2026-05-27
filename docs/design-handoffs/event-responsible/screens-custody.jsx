// screens-custody.jsx — custody surfacing on Today + Family Hub
//
// Two surfaces that promote custody schedule out of being a buried setting:
//
//   • CustodyStripToday — a compact, tappable status strip that lives on the
//     Today screen between the AI command bar and the conflict card. Shows
//     current parent + next handoff. Opens /custody/schedule.
//   • FamilyHubV2 — updated Family Hub where the existing "This week" custody
//     card is reframed as the primary entry point (tappable card, explicit
//     "Open schedule →" affordance), and the Custody schedule row is removed
//     from the "Manage" section since it would be redundant.
//   • ProHomeV2 — Today screen with the custody strip integrated.

// ═══════════════════════════════════════════════════════════════════════════
// CUSTODY SCHEDULE V2 — adds explicit "Pattern" button in the top bar
// ═══════════════════════════════════════════════════════════════════════════
function CustodyScheduleV2({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const weeks = [
    { label: 'May 25 – 31', current: true, days: ['alex','alex','alex','alex','casey','alex','alex'] },
    { label: 'Jun 1 – 7',                 days: ['riley','riley','riley','riley','riley','devon','riley'] },
    { label: 'Jun 8 – 14',                days: ['alex','alex','alex','alex','casey','alex','alex'] },
    { label: 'Jun 15 – 21',               days: ['riley','riley','riley','riley','riley','riley','riley'] },
  ];
  const colorFor = (k) => ({ alex: C.alex, riley: C.riley, casey: C.casey, devon: C.devon }[k]);

  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 96 }}>

          {/* Header — back · title · Pattern */}
          <div style={{
            padding: '12px 16px 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                <path d="M7 1L1 7l6 6" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Custody
            </div>
            {/* Pattern affordance — explicit text label + small gear so non-technical co-parents read it */}
            <div style={{
              height: 32, padding: '0 10px', borderRadius: 8,
              background: C.card, border: `0.5px solid ${C.hair}`,
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="1.8" stroke={C.ink} strokeWidth="1.2"/>
                <path d="M7 1l.6 1.6 1.7-.3.3 1.7L11.2 5l-.7 1.7 1 1.3-1.4 1 .7 1.7-1.7.7-.3 1.6L7 12l-1.6 1-1.4-1.3-1.6.3-.4-1.7L.4 9.6l.7-1.6L.1 6.7l1-1.4-.6-1.6L2 3l.3-1.6L4 1.7 5.3.3 7 1z"
                      stroke={C.ink} strokeWidth="1" strokeLinejoin="round" fill="none" opacity="0.4"/>
              </svg>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.ink, fontWeight: 600,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Pattern</span>
            </div>
          </div>

          {/* Pattern summary + title */}
          <div style={{ padding: '14px 24px 6px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
              PATTERN · ALTERNATING WEEKS · HANDOFF SUN 18:00
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

          {/* Footer hint pointing at the Pattern button */}
          <div style={{
            padding: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: C.inkMuted, lineHeight: 1.4,
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" stroke={C.inkMuted} strokeWidth="1.2"/>
              <path d="M7 6.5v3M7 4.5v.3" stroke={C.inkMuted} strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <span>
              Tap <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 600 }}>Pattern</span> to change the alternation rule or handoff time. Long-press a day to add a one-off swap.
            </span>
          </div>
        </div>

        {/* FAB */}
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

// ═══════════════════════════════════════════════════════════════════════════
// CUSTODY PATTERN EDITOR — focused editor reached from CustodySchedule
// ═══════════════════════════════════════════════════════════════════════════
function CustodyPatternEditor({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';

  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 76, overflowY: 'auto' }}>

          {/* Top bar — Cancel / title / Save */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: `0.5px solid ${C.hair}`,
          }}>
            <span style={{
              fontFamily: C.fontSans, fontSize: 14, color: C.inkSec, letterSpacing: -0.2, fontWeight: 500,
            }}>Cancel</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: -0.3 }}>
              Custody pattern
            </div>
            <span style={{
              fontFamily: C.fontSans, fontSize: 14, color: C.accent, letterSpacing: -0.2, fontWeight: 600,
            }}>Save</span>
          </div>

          {/* Live preview banner */}
          <div style={{ padding: '14px 16px 6px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: 12, overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
              }}>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                  letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
                }}>Preview · next 2 weeks</span>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.accent,
                  padding: '2px 6px', background: C.accent + '18', borderRadius: 4,
                  letterSpacing: 0.3, fontWeight: 600, textTransform: 'uppercase',
                }}>LIVE</span>
              </div>

              {/* Two-week strip */}
              {[
                { label: 'WK 22 · May 25–31', days: ['alex','alex','alex','alex','alex','alex','alex'] },
                { label: 'WK 23 · Jun 1–7',   days: ['riley','riley','riley','riley','riley','riley','riley'] },
              ].map((w, i) => (
                <div key={i} style={{ marginTop: i ? 10 : 0 }}>
                  <div style={{
                    fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, marginBottom: 4, letterSpacing: -0.2,
                  }}>{w.label}</div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {w.days.map((k, j) => {
                      const c = { alex: C.alex, riley: C.riley }[k];
                      return (
                        <div key={j} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{
                            width: '100%', height: 18, borderRadius: 3,
                            background: c + (dark ? '5C' : '33'),
                            borderTop: `2px solid ${c}`,
                            position: 'relative',
                          }}>
                            {/* Hand-off marker on Sundays */}
                            {j === 6 && (
                              <div style={{
                                position: 'absolute', right: -2, top: -3, width: 5, height: 24,
                                background: C.warn, borderRadius: 1,
                                boxShadow: `0 0 0 1.5px ${C.bg}`,
                              }} />
                            )}
                          </div>
                          <span style={{
                            fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: -0.2,
                          }}>{['M','T','W','T','F','S','S'][j]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION · Pattern type */}
          <SubGroup label="Pattern" subLabel="How custody alternates between Alex and Riley.">
            <PatternOption
              id="alt-weeks"
              title="Alternating weeks"
              sub="One parent each full week · simplest"
              icon={(sel) => (
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <rect x="0.5" y="0.5" width="9" height="13" rx="1.5" fill={sel ? C.accent : C.alex + (dark ? '88' : '55')} />
                  <rect x="10.5" y="0.5" width="9" height="13" rx="1.5" fill={sel ? C.accent + '55' : C.riley + (dark ? '88' : '55')} />
                </svg>
              )}
              selected
            />
            <PatternOption
              id="223"
              title="2-2-3 rotation"
              sub="Mon–Tue with one · Wed–Thu the other · alternate Fri–Sun"
              icon={(sel) => (
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <rect x="0.5" y="0.5" width="4.5" height="13" rx="1" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="5.5" y="0.5" width="4.5" height="13" rx="1" fill={C.riley + (dark ? '88' : '55')} />
                  <rect x="10.5" y="0.5" width="9" height="13" rx="1" fill={C.alex + (dark ? '88' : '55')} />
                </svg>
              )}
            />
            <PatternOption
              id="every-weekend"
              title="Every other weekend"
              sub="One parent has the kids Mon–Thu · other gets Fri–Sun"
              icon={(sel) => (
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <rect x="0.5" y="0.5" width="13.5" height="13" rx="1" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="14.5" y="0.5" width="5" height="13" rx="1" fill={C.riley + (dark ? '88' : '55')} />
                </svg>
              )}
            />
            <PatternOption
              id="custom"
              title="Custom"
              sub="Define day-by-day · for unusual arrangements"
              icon={(sel) => (
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <rect x="0.5" y="0.5" width="2" height="13" rx=".5" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="3" y="0.5" width="2" height="13" rx=".5" fill={C.riley + (dark ? '88' : '55')} />
                  <rect x="5.5" y="0.5" width="2" height="13" rx=".5" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="8" y="0.5" width="2" height="13" rx=".5" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="10.5" y="0.5" width="2" height="13" rx=".5" fill={C.riley + (dark ? '88' : '55')} />
                  <rect x="13" y="0.5" width="2" height="13" rx=".5" fill={C.alex + (dark ? '88' : '55')} />
                  <rect x="15.5" y="0.5" width="2" height="13" rx=".5" fill={C.riley + (dark ? '88' : '55')} />
                </svg>
              )}
              last
            />
          </SubGroup>

          {/* SECTION · Hand-off */}
          <SubGroup label="Hand-off" subLabel="When the switch happens. Used for the next-handoff timer and reminders.">
            <div style={{ padding: '12px 14px' }}>
              <div style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
              }}>Day of week</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} style={{
                    flex: 1, height: 36, borderRadius: 8,
                    background: i === 6 ? C.accent : C.inset,
                    border: i === 6 ? 'none' : `0.5px solid ${C.hair}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: C.fontMono, fontSize: 12, fontWeight: 600,
                    color: i === 6 ? C.onAccent : C.inkSec,
                    letterSpacing: -0.2,
                  }}>{d}</div>
                ))}
              </div>
            </div>
            <SubRow
              label="Time"
              right={
                <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                  18:00
                </span>
              }
              chevron
            />
            <SubRow
              label="Hand-off location"
              sub="Optional · used in reminders"
              right={<MonoRight text="Casey's place" />}
              chevron last
            />
          </SubGroup>

          {/* SECTION · Anchor */}
          <SubGroup
            label="Anchor"
            subLabel="Which week is whose. Editing this shifts all future weeks."
          >
            <SubRow
              label="Pattern started"
              right={<MonoRight text="Mar 4, 2024" />}
              chevron
            />
            <SubRow
              label="Who has this week"
              right={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <CAvatar member={cMembers.alex} size={16} />
                  <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                    Alex
                  </span>
                </span>
              }
              chevron last
            />
          </SubGroup>

          {/* SECTION · Per-child */}
          <SubGroup
            label="Per-child overrides"
            subLabel="Soph and Oliver have external co-parents — their schedules layer on top of the alternating pattern."
          >
            <KidPatternRow
              member={cMembers.mei}
              summary="Follows main pattern"
              detail="Alex ↔ Riley alternating"
            />
            <KidPatternRow
              member={cMembers.jin}
              summary="Follows main pattern"
              detail="Alex ↔ Riley alternating"
            />
            <KidPatternRow
              member={cMembers.soph}
              summary="+ Devon · weekends"
              detail="Every other Sat–Sun"
              external={cMembers.devon}
            />
            <KidPatternRow
              member={cMembers.oliver}
              summary="+ Casey · Wed–Thu"
              detail="Every week · day-care swap"
              external={cMembers.casey}
              last
            />
          </SubGroup>

          {/* SECTION · Behavior */}
          <SubGroup label="Behavior">
            <SubToggle
              label="Auto-assign events to current parent"
              sub="New events default to whoever has the kids that day"
              on
            />
            <SubToggle
              label="Send hand-off reminders"
              sub="2 hours before each switch · to both parents"
              on
            />
            <SubToggle
              label="Notify external co-parents of pattern changes"
              sub="Casey and Devon will see when this rule changes"
              last
            />
          </SubGroup>

          {/* Danger */}
          <div style={{ padding: '8px 16px 24px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '13px 14px', color: C.alert, fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
                textAlign: 'center',
              }}>Stop using a custody pattern</div>
            </div>
            <div style={{
              padding: '8px 12px', fontSize: 11, color: C.inkMuted, lineHeight: 1.4, textAlign: 'center',
            }}>
              Keeps existing events but disables auto-assignment and reminders. Past schedule stays visible.
            </div>
          </div>
        </div>

        {/* Sticky bottom save bar */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '12px 16px 30px',
          background: C.bg + 'F2', backdropFilter: 'blur(20px)',
          borderTop: `0.5px solid ${C.hair}`,
          display: 'flex', alignItems: 'center', gap: 10, zIndex: 5,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1,
            fontSize: 11.5, color: C.inkSec, lineHeight: 1.3,
          }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="7" cy="7" r="5.5" stroke={C.warn} strokeWidth="1.3"/>
              <path d="M7 4.5v3M7 9.5v.3" stroke={C.warn} strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span>
              <span style={{ fontFamily: C.fontMono, color: C.warn, fontWeight: 600 }}>3 events</span> will be reassigned
            </span>
          </div>
          <div style={{
            padding: '11px 18px', borderRadius: 10, background: C.accent,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>
              Save pattern
            </span>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function PatternOption({ title, sub, icon, selected, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      background: selected ? C.accent + '0e' : 'transparent',
    }}>
      <div style={{
        width: 32, height: 22, borderRadius: 4, overflow: 'hidden',
        background: C.inset, padding: 2, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon(selected)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1, lineHeight: 1.35 }}>{sub}</div>
      </div>
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        border: `1.4px solid ${selected ? C.accent : C.inkFaint}`,
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

function KidPatternRow({ member, summary, detail, external, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <CAvatar member={member} size={32} />
        {external && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            background: C.card, borderRadius: 999,
            border: `0.5px solid ${C.hair}`,
            padding: 1,
          }}>
            <CAvatar member={external} size={14} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{member.name}</div>
        <div style={{ fontSize: 11.5, color: C.inkSec, marginTop: 1, letterSpacing: -0.1 }}>{summary}</div>
        <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2, letterSpacing: -0.2 }}>
          {detail}
        </div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CUSTODY STRIP — compact glance for Today
// ═══════════════════════════════════════════════════════════════════════════
function CustodyStripToday() {
  // Days this week and whose they are; today is index 1 (Tue).
  const days = [C.alex, C.alex, C.alex, C.alex, C.casey, C.alex, C.alex];
  const dayLabels = ['M','T','W','T','F','S','S'];
  const todayIdx = 1;

  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div style={{
        background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
        overflow: 'hidden',
        boxShadow: '0 1px 0 rgba(14,14,16,0.02)',
      }}>
        <div style={{
          padding: '11px 14px 10px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: `0.5px solid ${C.hair}`,
        }}>
          {/* Current parent identity dot */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
          }}>
            <CAvatar member={cMembers.alex} size={22} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
              You have the kids
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }} />
          <span style={{
            fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.3,
            textTransform: 'uppercase', fontWeight: 600,
          }}>
            ALT · WK 22
          </span>
          <svg width="7" height="12" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* 7-day mini bar + next handoff */}
        <div style={{ padding: '10px 14px 12px' }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {days.map((c, i) => (
              <div key={i} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <div style={{
                  width: '100%', height: 14, borderRadius: 3,
                  background: c + (C.scheme === 'dark' ? '5C' : '33'),
                  borderTop: `2px solid ${c}`,
                  position: 'relative',
                }}>
                  {i === todayIdx && (
                    <div style={{
                      position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                      width: 5, height: 5, borderRadius: 3, background: C.ink,
                    }} />
                  )}
                </div>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9,
                  color: i === todayIdx ? C.ink : C.inkMuted,
                  fontWeight: i === todayIdx ? 700 : 500, letterSpacing: -0.2,
                }}>{dayLabels[i]}</span>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CAvatar member={cMembers.casey} size={14} />
              <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1 }}>
                Next · <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 17:00</span> · Oliver → Casey
              </span>
            </div>
            <span style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600,
              letterSpacing: -0.1,
            }}>
              IN 1D
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PRO HOME V2 — Today with the custody strip wedged into the layout
// (Re-implements ProHome from direction-c-pro.jsx with one insertion.
//  Kept as a separate function so the original mock stays untouched.)
// ═══════════════════════════════════════════════════════════════════════════
function ProHomeV2({ palette = paletteMistForest }) {
  C = palette;
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 8L5.5 2L9 8z M5.5 8v2" stroke={C.onAccent} strokeWidth="1.2" fill="none" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.3 }}>Chen-Park</span>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                padding: '2px 6px', background: C.inset, borderRadius: 4, letterSpacing: -0.2,
              }}>6 people</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4,
                  background: C.accent, border: `1.5px solid ${C.card}`,
                }} />
              </div>
              <CAvatar member={cMembers.alex} size={32} />
            </div>
          </div>

          {/* Date + greeting */}
          <div style={{ padding: '8px 20px 14px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
              TUE · MAY 26 · 2026
            </div>
            <div style={{
              fontFamily: C.fontSans, fontSize: 32, fontWeight: 600,
              color: C.ink, letterSpacing: -1.2, lineHeight: 1.1, marginTop: 2,
            }}>Good morning, Alex.</div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.inkSec, lineHeight: 1.5, maxWidth: 320 }}>
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>4</span> events,{' '}
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>2</span> tasks today.
            </div>
          </div>

          {/* AI command bar — unchanged */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {CIcon.spark(C.accent)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 12.5, color: C.inkMuted, letterSpacing: -0.2 }}>
                  Ask · "jin orthodontist fri 3:30"
                </div>
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                padding: '2px 5px', background: C.inset, borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>{CIcon.command()} K</span>
            </div>
          </div>

          {/* ✦ NEW · Custody status strip */}
          <CustodyStripToday />

          {/* Conflict */}
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              borderLeft: `3px solid ${C.warn}`, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              {CIcon.warn(C.warn)}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                  Conflict at <span style={{ fontFamily: C.fontMono }}>16:00</span>
                </div>
                <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.45 }}>
                  Soph&apos;s piano lesson overlaps with Mei&apos;s rehearsal. Both currently on Alex.
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <CButton primary>Reassign Mei → Riley</CButton>
                  <CButton>Dismiss</CButton>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ padding: '0 16px' }}>
            <div style={{
              padding: '0 4px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Today · Tue 26
              </div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>
                4 events · free 19:00→
              </div>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden',
            }}>
              <CEventRow time="07:30" dur="45m" title="Mei · school bus" who={[cMembers.alex]} child={cMembers.mei} past tasks={2} tasksDone={2} />
              <CEventRow time="08:15" dur="30m" title="Oliver · day-care drop" who={[cMembers.riley]} child={cMembers.oliver} past />
              <CEventRow time="13:00" dur="1h" title="Alex · Standup → product review" who={[cMembers.alex]} loc="Remote" />
              <CEventRow time="16:00" dur="45m" title="Soph · piano" who={[cMembers.alex]} child={cMembers.soph} conflict tasks={5} tasksDone={2} />
              <CEventRow time="16:00" dur="1h30m" title="Mei · spring rehearsal" who={[cMembers.alex]} child={cMembers.mei} conflict tasks={1} tasksDone={0} last />
            </div>
          </div>

          {/* Tomorrow preview */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Tomorrow · Wed 27
              </div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>2 events · handoff</div>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '10px 14px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: `0.5px solid ${C.hair}`,
              }}>
                {CIcon.swap()}
                <span style={{ fontSize: 12, color: C.ink, fontWeight: 500 }}>
                  Oliver moves to Casey · <span style={{ fontFamily: C.fontMono, color: C.inkMuted }}>17:00 pickup</span>
                </span>
              </div>
              <div style={{ padding: '8px 0 4px', fontSize: 12, color: C.inkSec, fontFamily: C.fontMono }}>
                + 2 more events
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
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>New</span>
        </div>

        <CBottomNav active="home" />
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY HUB V2 — Custody promoted to primary, removed from Manage section
// ═══════════════════════════════════════════════════════════════════════════
function FamilyHubV2({ palette = paletteMistForest }) {
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
                  position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4,
                  background: C.accent, border: `1.5px solid ${C.card}`,
                }} />
              </div>
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

          {/* Custody hero — explicitly tappable now, "Open schedule" CTA */}
          <div style={{ padding: '6px 16px 6px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
              padding: '0 8px 8px',
            }}>Custody schedule</div>

            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 16, position: 'relative', overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CAvatar member={cMembers.alex} size={18} />
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                      letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
                    }}>This week</span>
                  </div>
                  <div style={{
                    fontSize: 19, fontWeight: 600, letterSpacing: -0.5, color: C.ink, marginTop: 4,
                  }}>Alex&apos;s week · 4 hand-offs</div>
                </div>
                <div style={{
                  padding: '3px 8px', borderRadius: 999,
                  background: C.accent + '22', color: C.accent,
                  fontFamily: C.fontMono, fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
                  display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
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
                  Next · <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 17:00</span> · Oliver → Casey
                </span>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 700,
                  letterSpacing: 0.3, textTransform: 'uppercase',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  Open schedule
                  <svg width="7" height="12" viewBox="0 0 8 14" fill="none">
                    <path d="M1 1l6 6-6 6" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>

              {/* Pending swap indicator strip */}
              <div style={{
                marginTop: 10, padding: '8px 10px', borderRadius: 8,
                background: C.warn + '18', border: `0.5px solid ${C.warn}44`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 4h7l-1-1M12 10H5l1 1" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 11.5, color: C.ink, letterSpacing: -0.1, flex: 1 }}>
                  Devon requested a swap · <span style={{ fontFamily: C.fontMono, color: C.inkSec }}>Jun 8–9</span>
                </span>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9.5, color: C.warn, fontWeight: 700,
                  letterSpacing: 0.3, textTransform: 'uppercase',
                }}>Review</span>
              </div>
            </div>
          </div>

          {/* People section */}
          <div style={{ padding: '14px 24px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
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

          {/* Kids */}
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

          {/* Manage — Custody removed (it's the hero now) */}
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

          {/* Recent activity */}
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
