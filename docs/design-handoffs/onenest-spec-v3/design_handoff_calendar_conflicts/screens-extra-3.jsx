// Round 7 — list detail, child detail, hand-off day, weekly digest,
// first-run home, task detail, notifications center.
// Continues from screens-extra.jsx and screens-extra-2.jsx.

// ═══════════════════════════════════════════════════════════════════════════
// LIST DETAIL — opening a single list
// ═══════════════════════════════════════════════════════════════════════════
function ListDetail({ palette = paletteMistForest, focused = false }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const listColor = '#E5613D'; // Grocery list (warm coral, distinct from accent)
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 100 }}>

          {/* Colored top region — list identity */}
          <div style={{
            background: `linear-gradient(135deg, ${listColor + (dark ? '38' : '22')} 0%, ${listColor + (dark ? '20' : '10')} 100%)`,
            paddingTop: 54, paddingBottom: 20,
          }}>
            <div style={{
              padding: '8px 16px 4px',
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
              <div style={{ display: 'flex', gap: 8 }}>
                <PillBtn icon="share" />
                <PillBtn icon="more" />
              </div>
            </div>

            <div style={{ padding: '14px 24px 6px' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 9px', borderRadius: 999,
                background: listColor + '33', border: `0.5px solid ${listColor}77`,
                marginBottom: 10,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: listColor }} />
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.ink, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  LIST · 12 ITEMS
                </span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, color: C.ink, letterSpacing: -1, lineHeight: 1.1 }}>
                Grocery
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <CStack members={[cMembers.alex, cMembers.riley]} size={20} />
                <span style={{ fontSize: 12, color: C.inkSec, letterSpacing: -0.1 }}>
                  Shared with Alex &amp; Riley
                </span>
                <span style={{ color: C.inkFaint, fontSize: 11 }}>·</span>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                  edited 2h ago
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ marginTop: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 6,
                }}>
                  <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkSec, letterSpacing: -0.2 }}>
                    4 OF 12 DONE
                  </span>
                  <span style={{ fontFamily: C.fontMono, fontSize: 10, color: listColor, fontWeight: 600, letterSpacing: -0.2 }}>
                    33%
                  </span>
                </div>
                <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: 'hidden', border: `0.5px solid ${C.hair}` }}>
                  <div style={{ width: '33%', height: '100%', background: listColor, borderRadius: 3 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{ padding: '14px 16px 12px', display: 'flex', gap: 6 }}>
            <CChip label="All · 12" active />
            <CChip label="Open · 8" />
            <CChip label="Done · 4" />
            <CChip label="Mine · 3" />
          </div>

          {/* Quick add row — placeholder OR focused-state */}
          <div style={{ padding: '0 16px 14px' }}>
            {focused ? (
              <div style={{
                background: C.card, borderRadius: 10,
                border: `1.2px solid ${C.accent}`,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {/* Empty checkbox */}
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `1.4px solid ${C.inkFaint}`,
                }} />
                {/* Typed text + caret */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                    Birthday cake supplies
                  </span>
                  <span style={{
                    width: 1.5, height: 16, background: C.accent,
                    animation: 'blink 1s steps(2) infinite',
                  }} />
                </div>
                {/* Assignee dot + More fields link */}
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600,
                  letterSpacing: 0.3, textTransform: 'uppercase', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  More fields
                  <svg width="6" height="10" viewBox="0 0 8 14" fill="none">
                    <path d="M1 1l6 6-6 6" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9.5, color: C.onAccent,
                  background: C.accent, padding: '2px 6px', borderRadius: 3, flexShrink: 0,
                }}>↵</span>
              </div>
            ) : (
              <div style={{
                background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`,
                padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {CIcon.plus(C.inkMuted)}
                <div style={{ flex: 1, fontFamily: C.fontMono, fontSize: 12, color: C.inkFaint, letterSpacing: -0.2 }}>
                  Add item — use @ for assignee
                </div>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                  padding: '2px 5px', background: C.inset, borderRadius: 3,
                }}>↵</span>
              </div>
            )}
          </div>

          {/* Section: Today */}
          <LDGroup label="Today · 2">
            <LDItem text="Berries · 1 pint" assignee={cMembers.alex} priority />
            <LDItem text="Oat milk · 2 gallons" assignee={cMembers.riley} last />
          </LDGroup>

          {/* Section: This week */}
          <LDGroup label="This week · 6">
            <LDItem text="Sourdough loaf" assignee={cMembers.alex} due="Wed" />
            <LDItem text="Apples · honeycrisp" assignee={cMembers.riley} due="Thu" qty="6" />
            <LDItem text="Dish soap (we&apos;re almost out)" anyone due="Sat" />
            <LDItem text="Avocados · ripe ones" assignee={cMembers.alex} due="Fri" qty="3" />
            <LDItem text="Frozen pizza for kids" assignee={cMembers.riley} due="Sat" />
            <LDItem text="Birthday cake supplies" anyone due="Sat" priority last />
          </LDGroup>

          {/* Section: Done */}
          <LDGroup label="Done · 4" collapsed>
            <LDItem text="Coffee beans" assignee={cMembers.alex} done />
            <LDItem text="Bananas" assignee={cMembers.riley} done />
            <LDItem text="Eggs (2 dozen)" assignee={cMembers.alex} done />
            <LDItem text="Bread for sandwiches" assignee={cMembers.riley} done last />
          </LDGroup>

          {/* List metadata */}
          <div style={{ padding: '20px 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              About this list
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <SRow label="Color" right={
                <span style={{
                  width: 18, height: 18, borderRadius: 9, background: listColor,
                  border: `0.5px solid ${C.hair}`,
                }} />
              } chevron />
              <SRow label="Default assignee" right={
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2,
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 8, border: `1px dashed ${C.inkFaint}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: C.inkFaint, fontWeight: 600,
                  }}>?</span>
                  Anyone
                </span>
              } chevron />
              <SRow label="Notify on add" right={<FormSwitch on />} last />
            </div>
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
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>New task</span>
        </div>
      </div>
    </IOSDevice>
  );
}

function PillBtn({ icon }) {
  const iconNode = icon === 'share' ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v8M4 4l3-3 3 3M3 8v3a1 1 0 001 1h6a1 1 0 001-1V8"
            stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ) : (
    <svg width="14" height="3" viewBox="0 0 14 3" fill="none">
      <circle cx="2" cy="1.5" r="1.4" fill={C.ink}/>
      <circle cx="7" cy="1.5" r="1.4" fill={C.ink}/>
      <circle cx="12" cy="1.5" r="1.4" fill={C.ink}/>
    </svg>
  );
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, background: C.card,
      border: `0.5px solid ${C.hair}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{iconNode}</div>
  );
}

function LDGroup({ label, count, collapsed, children }) {
  return (
    <div style={{ padding: '0 16px 14px' }}>
      <div style={{
        padding: '8px 8px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </span>
        {collapsed && (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 5l4-4 4 4" stroke={C.inkMuted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{
        background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
        overflow: 'hidden',
        opacity: collapsed ? 0.65 : 1,
      }}>{children}</div>
    </div>
  );
}

function LDItem({ text, assignee, anyone, due, done, priority, qty, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 12px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        border: `1.3px solid ${done ? C.accent : C.inkFaint}`,
        background: done ? C.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{done && CIcon.check('#fff')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {priority && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 8.5, color: C.accent, fontWeight: 700,
              padding: '0 4px', background: C.accent + '22',
              borderRadius: 3, letterSpacing: 0.3,
            }}>!</span>
          )}
          <span style={{
            fontSize: 13.5, fontWeight: 500, color: done ? C.inkMuted : C.ink,
            letterSpacing: -0.2, textDecoration: done ? 'line-through' : 'none',
            lineHeight: 1.3,
          }}>{text}</span>
          {qty && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              padding: '1px 5px', background: C.inset, borderRadius: 3, letterSpacing: -0.2,
            }}>×{qty}</span>
          )}
        </div>
        {due && (
          <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2, letterSpacing: -0.2 }}>
            {due}
          </div>
        )}
      </div>
      {anyone ? (
        <div style={{
          width: 22, height: 22, borderRadius: 11, border: `1px dashed ${C.inkFaint}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, fontWeight: 600,
        }}>?</div>
      ) : (
        <CAvatar member={assignee} size={22} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHILD DETAIL — Soph's profile
// ═══════════════════════════════════════════════════════════════════════════
function ChildDetail({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const kidColor = C.soph;
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 24 }}>

          {/* Tinted hero */}
          <div style={{
            background: `linear-gradient(160deg, ${kidColor + (dark ? '40' : '22')} 0%, ${C.bg} 100%)`,
            paddingTop: 54, paddingBottom: 20,
          }}>
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
                  <path d="M9 2L4 7l5 5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <PillBtn icon="more" />
            </div>

            {/* Avatar + name */}
            <div style={{ textAlign: 'center', padding: '8px 24px 0' }}>
              <div style={{
                width: 88, height: 88, borderRadius: 44, margin: '0 auto 14px',
                background: kidColor, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 700, letterSpacing: -0.8,
                border: `3px solid ${C.bg}`,
                boxShadow: `0 0 0 1px ${kidColor}44`,
              }}>S</div>
              <div style={{
                fontSize: 28, fontWeight: 600, color: C.ink,
                letterSpacing: -1, lineHeight: 1.1,
              }}>Soph</div>
              <div style={{
                fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted,
                marginTop: 4, letterSpacing: -0.2,
              }}>
                AGE 8 · 3RD GRADE · BORN MAR 8, 2018
              </div>
              {/* Parent chips */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px 4px 4px', borderRadius: 999,
                  background: C.card, border: `0.5px solid ${C.hair}`,
                }}>
                  <CAvatar member={cMembers.alex} size={18} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>Alex</span>
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px 4px 4px', borderRadius: 999,
                  background: C.card, border: `0.5px solid ${C.hair}`,
                }}>
                  <CAvatar member={cMembers.riley} size={18} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>Riley</span>
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px 4px 4px', borderRadius: 999,
                  background: C.card, border: `0.5px solid ${C.devon}55`,
                }}>
                  <CAvatar member={cMembers.devon} size={18} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>Devon</span>
                  <span style={{
                    fontFamily: C.fontMono, fontSize: 8.5, color: C.inkMuted,
                    padding: '1px 4px', background: C.inset, borderRadius: 3,
                    fontWeight: 600, letterSpacing: 0.3,
                  }}>EXT</span>
                </span>
              </div>
            </div>
          </div>

          {/* Where this week */}
          <EDSectionLabel label="Where this week" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '14px 14px',
            }}>
              <div style={{ display: 'flex', gap: 3 }}>
                {[
                  { d: 'M', c: C.alex }, { d: 'T', c: C.alex, today: true },
                  { d: 'W', c: C.alex }, { d: 'T', c: C.alex },
                  { d: 'F', c: C.alex }, { d: 'S', c: C.devon, swap: true }, { d: 'S', c: C.devon },
                ].map((day, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: '100%', height: 22, borderRadius: 4,
                      background: day.c + (dark ? '60' : '38'),
                      borderTop: `2px solid ${day.c}`,
                      position: 'relative',
                    }}>
                      {day.swap && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{
                          position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                        }}>
                          <path d="M1 3h6l-1.5-1.5M9 5H3l1.5 1.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{
                      fontFamily: C.fontMono, fontSize: 9.5,
                      color: day.today ? C.accent : C.inkMuted,
                      fontWeight: day.today ? 600 : 500, letterSpacing: -0.2,
                    }}>{day.d}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${C.hair}`,
                fontSize: 12, color: C.inkSec, letterSpacing: -0.1,
              }}>
                With Alex Mon–Fri · weekend with Devon · next hand-off <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Sat 10:00</span>
              </div>
            </div>
          </div>

          {/* Upcoming */}
          <EDSectionLabel label="Upcoming" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <ChildEventRow time="Today 16:00" title="Piano lesson · Mrs. Anderson" who={cMembers.alex} />
              <ChildEventRow time="Thu 09:00" title="Class field trip · permission slip" who={cMembers.alex} note />
              <ChildEventRow time="Sat 11:00" title="Spring recital" who={cMembers.alex} flag />
              <ChildEventRow time="Sun 14:00" title="Soccer · with Devon" who={cMembers.devon} last />
            </div>
          </div>

          {/* Lists */}
          <EDSectionLabel label="Lists · 2" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <ChildListRow name="Piano · weekly prep" color={kidColor} progress={40} count="2/5" />
              <ChildListRow name="School · Soph 3rd grade" color="#6FA0D1" progress={60} count="3/5" last />
            </div>
          </div>

          {/* Contacts */}
          <EDSectionLabel label="Contacts · 4" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <ChildContactRow name="Mrs. Anderson" role="Piano teacher" cat="#C9789E" />
              <ChildContactRow name="Ms. Lopez" role="Ballet · Studio One" cat="#C9789E" />
              <ChildContactRow name="Mr. Hernandez" role="3rd grade teacher" cat="#6FA0D1" />
              <ChildContactRow name="Dr. Patel" role="Pediatrician" cat="#E5613D" last />
            </div>
          </div>

          {/* Notes */}
          <EDSectionLabel label="Notes" />
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.55,
            }}>
              <span style={{ color: C.alert, fontWeight: 600 }}>Allergic to peanuts</span> — EpiPen in school bag.
              Reading at a 5th-grade level. Loves chapter books, especially mysteries.
              Prefers comfort foods at Devon&apos;s — has a hard time switching homes Sunday night.
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function ChildEventRow({ time, title, who, note, flag, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ width: 70, flexShrink: 0 }}>
        <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>{time}</div>
      </div>
      <div style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, background: who.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 5 }}>
          {title}
          {note && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 8.5, color: C.warn, fontWeight: 700,
              padding: '1px 4px', background: C.warn + '22', borderRadius: 3, letterSpacing: 0.3,
            }}>TODO</span>
          )}
          {flag && (
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 1v12M3 1l8 2-2 3 2 3-8 0" stroke={C.accent} strokeWidth="1.3" strokeLinejoin="round" fill={C.accent + '44'}/>
            </svg>
          )}
        </div>
      </div>
      <CAvatar member={who} size={20} />
    </div>
  );
}

function ChildListRow({ name, color, progress, count, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: color, minHeight: 24 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2, marginBottom: 4 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 3, background: C.inset, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: color }} />
          </div>
          <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2, whiteSpace: 'nowrap' }}>
            {count}
          </span>
        </div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function ChildContactRow({ name, role, cat, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 15, background: cat + '22',
        border: `0.5px solid ${cat}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.fontSans, fontSize: 11, fontWeight: 700, color: cat, letterSpacing: -0.3,
        flexShrink: 0,
      }}>{name.split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{name}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{role}</div>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: C.accent + '15',
        border: `0.5px solid ${C.accent}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M2.5 1.5h3l1 3-1.5 1c0.5 1.5 1.5 2.5 3 3l1-1.5 3 1v3c0 .5-.5 1-1 1C5 12 2 9 2 2.5c0-.5.5-1 .5-1z"
                stroke={C.accent} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HAND-OFF DAY DETAIL — what tapping a hand-off pill opens
// ═══════════════════════════════════════════════════════════════════════════
function HandoffDay({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 100 }}>

          {/* Header */}
          <div style={{ paddingTop: 54 }}>
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
                  <path d="M9 2L4 7l5 5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Hand-off
              </span>
              <PillBtn icon="more" />
            </div>

            {/* Hero — date + countdown */}
            <div style={{ padding: '8px 24px 20px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
                WED · MAY 27 · 2026
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, color: C.ink, letterSpacing: -1, lineHeight: 1.1 }}>
                Oliver moves to<br />Casey&apos;s tomorrow.
              </div>
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 999,
                  background: C.accent + '15', border: `0.5px solid ${C.accent}40`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: C.accent }} />
                  <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: 0.3 }}>
                    IN 18H 42M
                  </span>
                </div>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                  17:00 day-care pickup
                </span>
              </div>
            </div>
          </div>

          {/* From → To visualization */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 18,
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* From */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <CAvatar member={cMembers.alex} size={56} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 8, letterSpacing: -0.2 }}>
                    Alex
                  </div>
                  <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, marginTop: 2, letterSpacing: 0.3 }}>
                    FROM · WED AM
                  </div>
                </div>
                {/* Arrow + kid */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <CAvatar member={cMembers.oliver} size={28} />
                  <svg width="46" height="14" viewBox="0 0 46 14" fill="none">
                    <path d="M2 7h40M37 3l4 4-4 4" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                {/* To */}
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <CAvatar member={cMembers.casey} size={56} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 8, letterSpacing: -0.2 }}>
                    Casey
                  </div>
                  <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, marginTop: 2, letterSpacing: 0.3 }}>
                    TO · WED 17:00
                  </div>
                </div>
              </div>

              {/* Location + duration */}
              <div style={{
                marginTop: 16, paddingTop: 14, borderTop: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkSec, letterSpacing: -0.1 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M8 0.5C5 0.5 2.5 3 2.5 6c0 4 5.5 9 5.5 9s5.5-5 5.5-9C13.5 3 11 0.5 8 0.5z" stroke={C.inkSec} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                    <circle cx="8" cy="6" r="2" stroke={C.inkSec} strokeWidth="1.3"/>
                  </svg>
                  Tiny Sprouts Day-care
                </div>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                  with Casey 3 nights
                </span>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <EDSectionLabel label="Before pickup · 5 items" />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <EDTaskRow title="Pack overnight bag" who={cMembers.alex} done />
              <EDTaskRow title="Confirm pickup with Casey" who={cMembers.alex} done />
              <EDTaskRow title="Send daycare a heads-up" who={cMembers.riley} due="before 16:00" />
              <EDTaskRow title="Pack Oliver&apos;s lovie + bedtime book" who={cMembers.alex} due="tonight" />
              <EDTaskRow title="Top up Casey on the meds schedule" who={cMembers.alex} last />
            </div>
          </div>

          {/* What Casey needs to know */}
          <EDSectionLabel label="What Casey will see" />
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{
              background: C.card, borderRadius: 12,
              border: `0.5px dashed ${C.accent}55`,
              padding: '14px 14px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600,
                letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.5l5 2v4c0 2.5-2 5-5 6-3-1-5-3.5-5-6v-4l5-2z" stroke={C.accent} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                </svg>
                PRIVACY-FENCED · ONLY THESE 3 ITEMS
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12.5, color: C.inkSec, lineHeight: 1.7, letterSpacing: -0.1 }}>
                <li>Pickup time + location</li>
                <li>Bedtime ritual notes (lovie + book at 7:30)</li>
                <li>Allergy reminder (peanuts) + EpiPen location</li>
              </ul>
              <div style={{
                marginTop: 10, fontSize: 11, color: C.inkMuted, lineHeight: 1.5,
              }}>
                Your day-care title, your phone calendar entries, and the rest of the family&apos;s tasks
                stay private. Casey sees only Oliver&apos;s essentials.
              </div>
            </div>
          </div>

          {/* Hand-off history */}
          <EDSectionLabel label="Recent hand-offs · 3" />
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <EDActivity who={cMembers.casey} action="returned Oliver — Mon 17:30 · on time" when="2d" />
              <EDActivity who={cMembers.casey} action="picked up Oliver — Fri 17:00" when="6d" />
              <EDActivity who={cMembers.casey} action="returned — Mon 18:00 · 30m late" when="9d" last />
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
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Message Casey
          </div>
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 10,
            background: C.accent, color: C.onAccent,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            Mark as handed off
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WEEKLY DIGEST — the Sunday in-app digest
// ═══════════════════════════════════════════════════════════════════════════
function WeeklyDigest({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingBottom: 100 }}>

          {/* Hero */}
          <div style={{ paddingTop: 54 }}>
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
                  <path d="M9 2L4 7l5 5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Sunday digest
              </span>
              <PillBtn icon="share" />
            </div>

            <div style={{ padding: '8px 24px 20px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
                WEEK 22 · MAY 25 – 31
              </div>
              <div style={{ fontSize: 30, fontWeight: 600, color: C.ink, letterSpacing: -1.1, lineHeight: 1.1 }}>
                The week ahead.
              </div>
              <div style={{ marginTop: 8, fontSize: 13.5, color: C.inkSec, lineHeight: 1.55 }}>
                Sent every Sunday at 19:00. Here&apos;s what to look out for.
              </div>
            </div>
          </div>

          {/* Stat row */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <DigestStat label="Events" value="17" />
              <DigestStat label="Hand-offs" value="4" />
              <DigestStat label="Conflicts" value="1" alert />
              <DigestStat label="Open tasks" value="9" warn />
            </div>
          </div>

          {/* Conflict card */}
          <EDSectionLabel label="Needs attention" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              borderLeft: `3px solid ${C.warn}`, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7 1.5L13 12H1L7 1.5z" stroke={C.warn} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                <path d="M7 6v3M7 10.5v.3" stroke={C.warn} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                  Tue 16:00 · Soph piano + Mei rehearsal
                </div>
                <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.45 }}>
                  Both currently with Alex. Tap to resolve.
                </div>
              </div>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              borderLeft: `3px solid ${C.devon}`, padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <CAvatar member={cMembers.devon} size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>
                  Devon swap request · Jun 8–9
                </div>
                <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.45 }}>
                  Soph weekend swap. Family wedding in Tahoe.
                </div>
              </div>
            </div>
          </div>

          {/* Hand-offs */}
          <EDSectionLabel label="Hand-offs this week · 4" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <HandoffRow date="Wed May 27" time="17:00" from={cMembers.alex} to={cMembers.casey} kid="Oliver" detail="day-care pickup" />
              <HandoffRow date="Sat May 30" time="10:00" from={cMembers.alex} to={cMembers.devon} kid="Soph" detail="weekend" />
              <HandoffRow date="Sun May 31" time="18:00" from={cMembers.alex} to={cMembers.riley} kid="all 4" detail="week switch" last />
            </div>
          </div>

          {/* Top events */}
          <EDSectionLabel label="Highlights · 5 of 17" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <DigestEvent time="Tue 10:30" title="Mei orthodontist · 4 hands needed" who={cMembers.alex} />
              <DigestEvent time="Wed 09:00" title="Jin field trip · permission needed" who={cMembers.alex} flag />
              <DigestEvent time="Fri 15:30" title="Family dinner · grandma visiting" who={cMembers.alex} />
              <DigestEvent time="Sat 11:00" title="Soph spring recital" who={cMembers.alex} star />
              <DigestEvent time="Sun 13:00" title="Mei soccer playoffs" who={cMembers.alex} last />
            </div>
          </div>

          {/* Task summary by person */}
          <EDSectionLabel label="Open tasks" />
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <DigestTaskBucket member={cMembers.alex} count={4} desc="3 due this week · 1 overdue" />
              <DigestTaskBucket member={cMembers.riley} count={3} desc="all due Sat–Sun" />
              <DigestTaskBucket anyone count={2} desc="up for grabs" last />
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function DigestStat({ label, value, alert, warn }) {
  const color = alert ? C.alert : warn ? C.warn : C.ink;
  return (
    <div style={{
      background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`,
      padding: '12px 10px',
    }}>
      <div style={{
        fontFamily: C.fontMono, fontSize: 22, fontWeight: 600, color,
        letterSpacing: -0.8, lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
        marginTop: 4, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600,
      }}>{label}</div>
    </div>
  );
}

function DigestEvent({ time, title, who, flag, star, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ width: 60, flexShrink: 0, fontFamily: C.fontMono, fontSize: 10.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
        {time}
      </div>
      <div style={{ width: 2, alignSelf: 'stretch', borderRadius: 1, background: who.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, letterSpacing: -0.2, display: 'flex', alignItems: 'center', gap: 5 }}>
          {title}
          {flag && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 8.5, color: C.warn, fontWeight: 700,
              padding: '1px 4px', background: C.warn + '22', borderRadius: 3, letterSpacing: 0.3,
            }}>TODO</span>
          )}
          {star && (
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 1l1.7 4.2 4.5.3-3.4 3 1.1 4.5L7 10.5l-3.9 2.5 1.1-4.5-3.4-3 4.5-.3L7 1z" fill={C.accent}/>
            </svg>
          )}
        </div>
      </div>
      <CAvatar member={who} size={20} />
    </div>
  );
}

function DigestTaskBucket({ member, anyone, count, desc, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      {anyone ? (
        <div style={{
          width: 26, height: 26, borderRadius: 13, border: `1px dashed ${C.inkFaint}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C.fontMono, fontSize: 12, color: C.inkFaint, fontWeight: 600,
        }}>?</div>
      ) : (
        <CAvatar member={member} size={26} />
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          {anyone ? 'Anyone' : member.name} · <span style={{ fontFamily: C.fontMono, fontWeight: 500 }}>{count}</span>
        </div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>{desc}</div>
      </div>
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
        <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRST-RUN HOME — empty state with welcome card prominent
// ═══════════════════════════════════════════════════════════════════════════
function FirstRunHome({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              }}>1 person</span>
            </div>
            <CAvatar member={cMembers.alex} size={30} />
          </div>

          {/* Greeting */}
          <div style={{ padding: '14px 20px 18px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 4 }}>
              TUE · MAY 26 · 2026
            </div>
            <div style={{
              fontSize: 30, fontWeight: 600, color: C.ink,
              letterSpacing: -1, lineHeight: 1.08, marginBottom: 6,
            }}>Welcome, Alex.</div>
            <div style={{ fontSize: 13.5, color: C.inkSec, lineHeight: 1.5 }}>
              Your household is empty. Let&apos;s get it set up — should take 2 minutes.
            </div>
          </div>

          {/* Welcome / setup card */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 16, border: `0.5px solid ${C.hair}`,
              padding: '20px 18px', position: 'relative', overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              {/* Accent corner decoration */}
              <div style={{
                position: 'absolute', top: -30, right: -30, width: 110, height: 110,
                borderRadius: 60, background: C.accent + (dark ? '20' : '15'),
                opacity: 0.7,
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 9px', borderRadius: 999,
                  background: C.accent + '22', border: `0.5px solid ${C.accent}55`,
                  marginBottom: 14,
                }}>
                  {CIcon.spark(C.accent)}
                  <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    GET STARTED
                  </span>
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 600, color: C.ink,
                  letterSpacing: -0.5, lineHeight: 1.25, marginBottom: 4,
                }}>
                  Four quick steps to make this useful
                </div>
                <div style={{ fontSize: 12.5, color: C.inkMuted, lineHeight: 1.5, marginBottom: 16 }}>
                  Skip any of these — you can always finish later from Settings.
                </div>
                <SetupStep n={1} title="Invite Riley as co-parent" sub="They&apos;ll see what you choose to share" done />
                <SetupStep n={2} title="Add your kids" sub="Mei, Jin, Soph, and Oliver — each gets a color" />
                <SetupStep n={3} title="Set up custody pattern" sub="Alternating weeks, 2-2-3, custom — we have presets" />
                <SetupStep n={4} title="Add your first event" sub="Or paste any phrase — our AI will parse it" last />
              </div>
            </div>
          </div>

          {/* Empty timeline placeholder */}
          <div style={{ padding: '0 16px' }}>
            <div style={{
              padding: '0 4px 8px',
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Today · Tue 26
              </span>
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>0 events</span>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px dashed ${C.hair}`,
              padding: '28px 20px', textAlign: 'center',
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 24, background: C.inset,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="6" width="18" height="15" rx="2" stroke={C.inkMuted} strokeWidth="1.5"/>
                  <path d="M3 10h18M8 3v5M16 3v5" stroke={C.inkMuted} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2, marginBottom: 4 }}>
                Nothing on the calendar yet
              </div>
              <div style={{ fontSize: 12, color: C.inkMuted, lineHeight: 1.5, maxWidth: 240, margin: '0 auto' }}>
                Tap <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontFamily: C.fontMono, fontSize: 11,
                  padding: '1px 6px', background: C.accent + '22', color: C.accent,
                  borderRadius: 4, fontWeight: 600,
                }}>+ New</span> below, or paste &ldquo;dinner Friday 7pm&rdquo; into the AI bar.
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

function SetupStep({ n, title, sub, done, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 13, flexShrink: 0,
        background: done ? C.accent : C.inset,
        border: done ? 'none' : `1px solid ${C.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.fontMono, fontSize: 11, fontWeight: 700,
        color: done ? C.onAccent : C.inkMuted, letterSpacing: -0.2,
      }}>
        {done ? CIcon.check(C.onAccent) : n}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: done ? C.inkMuted : C.ink,
          letterSpacing: -0.2, textDecoration: done ? 'line-through' : 'none',
        }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 1 }}>{sub}</div>
      </div>
      {!done && (
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK DETAIL — opening a single task
// ═══════════════════════════════════════════════════════════════════════════
function TaskDetail({ palette = paletteMistForest }) {
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
                <path d="M9 2L4 7l5 5" stroke={C.ink} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Task
            </span>
            <PillBtn icon="more" />
          </div>

          {/* Title + checkbox */}
          <div style={{ padding: '8px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0, marginTop: 4,
                border: `1.5px solid ${C.accent}`,
                background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 22, fontWeight: 600, color: C.ink,
                  letterSpacing: -0.7, lineHeight: 1.25,
                }}>Pack Theo&apos;s overnight bag for Casey&apos;s</div>
                <div style={{
                  display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap',
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: C.alert + '22', color: C.alert,
                    fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 600, letterSpacing: -0.1,
                  }}>
                    DUE TONIGHT · 21:00
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: C.accent + '22', color: C.accent,
                    fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 600, letterSpacing: -0.1,
                  }}>
                    HIGH PRIORITY
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assign + Schedule */}
          <SGroup label="Details">
            <SRow label="Assigned to" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CAvatar member={cMembers.alex} size={22} />
                <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>Alex</span>
              </div>
            } chevron />
            <SRow label="Due" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.alert, fontWeight: 600, letterSpacing: -0.3 }}>
                Tonight · 21:00
              </span>
            } chevron />
            <SRow label="Reminder" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, letterSpacing: -0.2 }}>
                20:30 · 30 min before
              </span>
            } chevron />
            <SRow label="Recurring" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2 }}>
                One-time
              </span>
            } chevron last />
          </SGroup>

          {/* Linked event */}
          <SGroup label="Linked event">
            <div style={{
              padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: C.casey, minHeight: 40 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
                  Oliver → Casey · hand-off
                </div>
                <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                  Wed May 27 · 17:00 · Tiny Sprouts Day-care
                </div>
              </div>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
                <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </SGroup>

          {/* Lists */}
          <SGroup label="In lists · 2">
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 9px 4px 8px', borderRadius: 999,
                background: '#E5613D22', border: '0.5px solid #E5613D55',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: '#E5613D' }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>House</span>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 9px 4px 8px', borderRadius: 999,
                background: C.casey + '22', border: `0.5px solid ${C.casey}55`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: C.casey }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>Co-parents</span>
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 9px', borderRadius: 999,
                background: 'transparent', border: `0.5px dashed ${C.inkFaint}`,
                color: C.inkMuted, fontFamily: C.fontMono, fontSize: 11, letterSpacing: -0.1,
              }}>+ Add</span>
            </div>
          </SGroup>

          {/* Notes */}
          <SGroup label="Notes">
            <div style={{
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.55,
            }}>
              Pack: 2 outfits, PJs, lovie, &ldquo;Frog and Toad&rdquo; book, EpiPen + meds chart, lunchbox.
              Casey said no need to send sheets — they have a set.
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
              <EDActivity who={cMembers.alex} action="created" when="3d" />
              <EDActivity who={cMembers.riley} action="added 'meds chart' to notes" when="2d" />
              <EDActivity who={cMembers.alex} action="set due to tonight · 21:00" when="1h" last />
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
            background: C.card, border: `0.5px solid ${C.hair}`, color: C.warn,
            fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke={C.warn} strokeWidth="1.4"/>
              <path d="M7 4v3l2 1" stroke={C.warn} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Snooze
          </div>
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 10,
            background: C.accent, color: C.onAccent,
            fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Mark done
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CENTER / ACTIVITY INBOX
// ═══════════════════════════════════════════════════════════════════════════
function NotificationsInbox({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                12 NEW · 8 TODAY
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Activity</div>
            </div>
            <span style={{
              padding: '6px 11px', borderRadius: 7,
              background: C.card, border: `0.5px solid ${C.hair}`,
              fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.1,
            }}>
              Mark all read
            </span>
          </div>

          {/* Filter chips */}
          <div style={{ padding: '8px 16px 14px', display: 'flex', gap: 6 }}>
            <CChip label="All · 24" active />
            <CChip label="Unread · 12" />
            <CChip label="Mentions · 2" dot={C.accent} />
            <CChip label="Conflicts · 1" dot={C.warn} />
          </div>

          {/* Today */}
          <EDSectionLabel label="Today" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <InboxRow
                kind="conflict"
                who={null}
                title="Conflict at 16:00 tomorrow"
                body="Soph piano + Mei rehearsal — tap to resolve"
                time="9m"
                unread
              />
              <InboxRow
                kind="swap"
                who={cMembers.devon}
                title="Devon requested a swap"
                body="Soph · Jun 8–9 · family wedding"
                time="2h"
                unread
                mention
              />
              <InboxRow
                kind="reminder"
                who={null}
                title="Hand-off in 18 hours"
                body="Oliver → Casey · Wed 17:00"
                time="3h"
              />
              <InboxRow
                kind="task"
                who={cMembers.riley}
                title="Riley completed 'Order groceries'"
                body="House list · 3 of 12 done"
                time="5h"
              />
              <InboxRow
                kind="event"
                who={cMembers.riley}
                title="Riley added Pediatrician · Friday"
                body="for Oliver · 10:00 at Dr. Patel"
                time="6h"
                last
              />
            </div>
          </div>

          {/* Yesterday */}
          <EDSectionLabel label="Yesterday" />
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <InboxRow
                kind="claim"
                who={cMembers.casey}
                title="Casey confirmed pickup"
                body="Oliver · Wed 17:00 · Tiny Sprouts"
                time="1d"
              />
              <InboxRow
                kind="mention"
                who={cMembers.riley}
                title="Riley mentioned you in a task"
                body='"Alex — can you grab the cake?"'
                time="1d"
                mention
              />
              <InboxRow
                kind="digest"
                who={null}
                title="Sunday digest delivered"
                body="17 events · 4 hand-offs · 1 conflict ahead"
                time="2d"
                last
              />
            </div>
          </div>

          {/* This week */}
          <EDSectionLabel label="Earlier this week" />
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <InboxRow
                kind="invite"
                who={cMembers.alex}
                title="You invited Casey to the household"
                body="Co-parent for Oliver"
                time="3d"
              />
              <InboxRow
                kind="connect"
                who={null}
                title="Google Calendar synced"
                body="42 events imported · only busy times share"
                time="4d"
                last
              />
            </div>
          </div>
        </div>

        <CBottomNav active="home" />
      </div>
    </IOSDevice>
  );
}

function InboxRow({ kind, who, title, body, time, unread, mention, last }) {
  const iconBg = {
    conflict: C.warn + '22',
    swap: C.devon + '22',
    reminder: C.accent + '15',
    task: C.accent + '15',
    event: C.alex + '22',
    claim: C.accent + '15',
    mention: C.accent + '22',
    digest: C.accent + '15',
    invite: C.accent + '15',
    connect: C.jin + '22',
  }[kind];
  const iconColor = {
    conflict: C.warn,
    swap: C.devon,
    reminder: C.accent,
    task: C.accent,
    event: C.alex,
    claim: C.accent,
    mention: C.accent,
    digest: C.accent,
    invite: C.accent,
    connect: C.jin,
  }[kind];
  const iconNode = {
    conflict: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5L13 12H1L7 1.5z" stroke={iconColor} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
        <path d="M7 6v3M7 10.5v.3" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    swap: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 4h9l-2-2M12 10H3l2 2" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    reminder: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke={iconColor} strokeWidth="1.4"/>
        <path d="M7 4v3l2 1" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    task: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke={iconColor} strokeWidth="1.4"/>
        <path d="M5 7l1.5 1.5L9 5.5" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    event: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="3" width="10" height="9" rx="1.5" stroke={iconColor} strokeWidth="1.4"/>
        <path d="M2 6h10M5 1.5v3M9 1.5v3" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    claim: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7l3 3 7-7" stroke={iconColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    mention: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke={iconColor} strokeWidth="1.4"/>
        <circle cx="7" cy="7" r="2" stroke={iconColor} strokeWidth="1.4"/>
        <path d="M9 7v1c0 1 .8 1.5 1.5 1.5S12 9 12 8V6.5C12 4 9.5 2 7 2" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      </svg>
    ),
    digest: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 3h10M2 7h10M2 11h6" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    invite: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="5" r="2.5" stroke={iconColor} strokeWidth="1.4"/>
        <path d="M2 12c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M11 5h3M12.5 3.5v3" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    connect: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 9l4-4M3 7a3 3 0 014.2 4.2M11 7a3 3 0 00-4.2-4.2" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
      </svg>
    ),
  }[kind];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
      background: unread ? C.accent + '08' : 'transparent',
      position: 'relative',
    }}>
      {/* unread dot */}
      {unread && (
        <div style={{
          position: 'absolute', left: 4, top: 18,
          width: 6, height: 6, borderRadius: 3, background: C.accent,
        }} />
      )}
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        marginTop: 1, position: 'relative',
      }}>
        {iconNode}
        {who && (
          <div style={{
            position: 'absolute', bottom: -3, right: -3, borderRadius: 8,
            border: `1.5px solid ${unread ? C.bg : C.card}`,
          }}>
            <CAvatar member={who} size={14} />
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: unread ? 600 : 500, color: C.ink,
          letterSpacing: -0.2, lineHeight: 1.3, marginBottom: 2,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {title}
          {mention && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 8.5, color: C.accent, fontWeight: 700,
              padding: '1px 4px', background: C.accent + '22',
              borderRadius: 3, letterSpacing: 0.3,
            }}>@YOU</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: C.inkMuted, lineHeight: 1.4 }}>{body}</div>
      </div>
      <span style={{
        fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, letterSpacing: -0.2, flexShrink: 0,
      }}>{time}</span>
    </div>
  );
}

Object.assign(window, {
  ListDetail, ChildDetail, HandoffDay, WeeklyDigest, FirstRunHome, TaskDetail, NotificationsInbox,
});
