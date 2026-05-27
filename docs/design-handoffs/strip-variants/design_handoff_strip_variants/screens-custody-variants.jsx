// screens-custody-variants.jsx
//
// Two viewer-perspective variants of CustodyStripToday (the small daily
// "who has the kids" strip on the Today screen).
//
//   Variant A — Caregiver viewer       (issue #397)
//   Variant B — External co-parent     (issue #398)
//
// The base strip in screens-custody.jsx (CustodyStripToday, ~line 589) frames
// the week from a co-parent's POV: "Alex has the kids · Wed 17:00 · Oliver →
// Casey". That framing is wrong for the other two roles:
//
//   • A CAREGIVER (nanny, grandparent) isn't a party to the hand-off —
//     they're an observer/helper who may need to brief the next parent.
//
//   • An EXTERNAL CO-PARENT only cares about the one or two kids they
//     share with the household. They're not on the household's
//     parent_a/parent_b axis at all, and they should not see other kids'
//     schedules or household-internal swap requests.
//
// Both variants reuse the visual vocabulary of CustodyStripToday — same
// card shell, same 7-day bar, same color treatment, same countdown chip —
// but the top-label, next-handoff line, role badge, and (for B) the
// header anchor are reshaped to fit the viewer.

// ─── Local helpers ─────────────────────────────────────────────────────────

function StripCard({ children, dark }) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
      overflow: 'hidden',
      boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.02)',
    }}>{children}</div>
  );
}

function StripTopRow({ children }) {
  return (
    <div style={{
      padding: '11px 14px 10px',
      display: 'flex', alignItems: 'center', gap: 12,
      borderBottom: `0.5px solid ${C.hair}`,
    }}>{children}</div>
  );
}

function StripBottomRow({ children }) {
  return <div style={{ padding: '10px 14px 12px' }}>{children}</div>;
}

// A 7-day bar matching the base strip's treatment.
//  days: array of 7 entries — each is { c, label, marker?, double? }
//  todayIdx: which slot has the today-dot above
//  dark: scheme
function SevenDayBar({ days, todayIdx, dark }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {days.map((d, i) => (
        <div key={i} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          <div style={{
            width: '100%', height: 14, borderRadius: 3,
            background: d.double
              ? `linear-gradient(90deg, ${d.c} 50%, ${d.c2} 50%)`
              : d.c + (dark ? '5C' : '33'),
            borderTop: d.double ? 'none' : `2px solid ${d.c}`,
            position: 'relative',
          }}>
            {d.double && (
              <>
                <div style={{ position: 'absolute', inset: 0, left: 0, width: '50%',
                  background: d.c + (dark ? '5C' : '33'), borderTop: `2px solid ${d.c}` }} />
                <div style={{ position: 'absolute', inset: 0, left: '50%', width: '50%',
                  background: d.c2 + (dark ? '5C' : '33'), borderTop: `2px solid ${d.c2}` }} />
                {/* Hairline divider inside the bar */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%',
                  width: 0.5, background: C.bg }} />
              </>
            )}
            {i === todayIdx && (
              <div style={{
                position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
                width: 5, height: 5, borderRadius: 3, background: C.ink,
              }} />
            )}
            {d.marker && (
              <div style={{
                position: 'absolute', right: -2, top: -3, width: 4, height: 20,
                background: d.marker, borderRadius: 1,
                boxShadow: `0 0 0 1.5px ${C.card}`,
              }} />
            )}
          </div>
          <span style={{
            fontFamily: C.fontMono, fontSize: 9,
            color: i === todayIdx ? C.ink : C.inkMuted,
            fontWeight: i === todayIdx ? 700 : 500, letterSpacing: -0.2,
          }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function ViewingBadge() {
  return (
    <span style={{
      fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
      letterSpacing: 0.4, fontWeight: 700, textTransform: 'uppercase',
      padding: '2px 6px', background: C.inset, borderRadius: 4,
      border: `0.5px solid ${C.hair}`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      flexShrink: 0,
    }}>
      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
        <path d="M1.5 7C3 4.5 5 3.5 7 3.5s4 1 5.5 3.5c-1.5 2.5-3.5 3.5-5.5 3.5s-4-1-5.5-3.5z"
              stroke={C.inkMuted} strokeWidth="1.3" strokeLinejoin="round"/>
        <circle cx="7" cy="7" r="1.6" stroke={C.inkMuted} strokeWidth="1.3"/>
      </svg>
      Viewing
    </span>
  );
}

function PatternChip({ label, muted }) {
  return (
    <span style={{
      fontFamily: C.fontMono, fontSize: 10,
      color: muted ? C.inkFaint : C.inkMuted,
      letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600,
      flexShrink: 0,
    }}>{label}</span>
  );
}

function Countdown({ text, urgent, soft }) {
  return (
    <span style={{
      fontFamily: C.fontMono, fontSize: 10,
      color: urgent ? C.alert : (soft ? C.inkSec : C.accent),
      fontWeight: 600, letterSpacing: -0.1,
    }}>{text}</span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT A — Caregiver viewer (5 states)
// ═══════════════════════════════════════════════════════════════════════════

// Nina the nanny — works weekdays, not part of custody, helps with handoffs.
function CaregiverStripA1Default({ dark }) {
  // Tue · Alex's week · Wed handoff
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.casey, label: 'F' }, { c: C.alex, label: 'S' }, { c: C.alex, label: 'S' },
  ];
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        <CAvatar member={cMembers.alex} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          Alex is on duty this week
        </span>
        <div style={{ flex: 1 }} />
        <PatternChip label="ALT · WK 22" />
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={1} dark={dark} />
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CAvatar member={cMembers.casey} size={14} />
            <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1 }}>
              Hand-off <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 17:00</span> · Casey takes Oliver
            </span>
          </div>
          <Countdown text="IN 1D" soft />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

function CaregiverStripA2HandoffDay({ dark }) {
  // Wed (today is hand-off day) · 5h to go
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W', double: true, c2: C.casey, marker: C.warn },
    { c: C.casey, label: 'T' }, { c: C.casey, label: 'F' },
    { c: C.casey, label: 'S' }, { c: C.casey, label: 'S' },
  ];
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        <CAvatar member={cMembers.alex} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          Hand-off today
        </span>
        <div style={{ flex: 1 }} />
        <PatternChip label="ALT · WK 22" />
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={2} dark={dark} />
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CAvatar member={cMembers.casey} size={14} />
            <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1 }}>
              <span style={{ fontFamily: C.fontMono, color: C.warn, fontWeight: 600 }}>17:00</span> · Casey takes Oliver from day-care
            </span>
          </div>
          <Countdown text="IN 5H" urgent />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

function CaregiverStripA3CountdownActive({ dark }) {
  // Handoff today, 25 min to go — caregiver may be the one handing over
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W', double: true, c2: C.casey, marker: C.warn },
    { c: C.casey, label: 'T' }, { c: C.casey, label: 'F' },
    { c: C.casey, label: 'S' }, { c: C.casey, label: 'S' },
  ];
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        <CAvatar member={cMembers.alex} size={22} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          Brief Casey at pickup
        </span>
        <div style={{ flex: 1 }} />
        <PatternChip label="ALT · WK 22" />
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={2} dark={dark} />
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CAvatar member={cMembers.casey} size={14} />
            <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1 }}>
              <span style={{ fontFamily: C.fontMono, color: C.alert, fontWeight: 600 }}>17:00</span> · Oliver → Casey · 3 prep tasks open
            </span>
          </div>
          <Countdown text="IN 25M" urgent />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

function CaregiverStripA4BothPresent({ dark }) {
  // Pickup overlap — both parents present briefly. AB band on the day.
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'F', double: true, c2: C.riley, marker: C.accent },
    { c: C.riley, label: 'S' }, { c: C.riley, label: 'S' },
  ];
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
          <CAvatar member={cMembers.alex} size={22} />
          <div style={{ marginLeft: -8 }}>
            <CAvatar member={cMembers.riley} size={22} />
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          Alex &amp; Riley both on duty
        </span>
        <div style={{ flex: 1 }} />
        <PatternChip label="ALT · WK 22" />
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={4} dark={dark} />
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CAvatar member={cMembers.riley} size={14} />
            <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1 }}>
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Fri 18:00</span> · Riley takes the week
            </span>
          </div>
          <Countdown text="IN 3D" soft />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

function CaregiverStripA5LongNames({ dark }) {
  // Stress-test long names + clipping behavior
  const longA = { ...cMembers.alex, name: 'Alexandra Maximilian-Chen' };
  const longB = { ...cMembers.casey, name: 'Casey Whittington-Park' };
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.casey, label: 'F' }, { c: C.alex, label: 'S' }, { c: C.alex, label: 'S' },
  ];
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        <CAvatar member={longA} size={22} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>
          Alexandra Maximilian-Chen is on duty
        </span>
        <PatternChip label="ALT · WK 22" />
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={1} dark={dark} />
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            <CAvatar member={longB} size={14} />
            <span style={{
              fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 17:00</span> · Casey Whittington-Park takes Oliver
            </span>
          </div>
          <Countdown text="IN 1D" soft />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANT B — External co-parent viewer (5 states)
// Devon is Soph's biological parent outside the Chen-Park household.
// Devon's app only shows Soph's schedule (and Oliver's if they were also
// linked, which isn't the case here — but the multi-kid state mocks that).
// ═══════════════════════════════════════════════════════════════════════════

// "Your turn" colors: use Devon for Devon, Riley/Alex for the in-household parent.
// External-co-parent strip headers anchor to the KID, not the household.

// Each "kid strip" is essentially the same shape as the original CustodyStripToday
// but scoped to that one child. The header carries "<KID NAME>'S WEEK" instead of
// the household's week-number chip.

function KidStripDefault({ kid, hh, ext, days, todayIdx, label, nextLine, countdown,
                          countdownSoft, countdownUrgent, dark, busyOverlay }) {
  // hh = in-household parent (e.g. Alex), ext = external co-parent (e.g. Devon, viewer)
  return (
    <StripCard dark={dark}>
      <StripTopRow>
        {/* Kid-anchored avatar */}
        <CAvatar member={kid} size={22} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
            letterSpacing: 0.4, fontWeight: 700, textTransform: 'uppercase',
            marginBottom: 1,
          }}>
            {kid.name}&apos;s week
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {label}
          </div>
        </div>
        <ViewingBadge />
      </StripTopRow>
      <StripBottomRow>
        <SevenDayBar days={days} todayIdx={todayIdx} dark={dark} />
        {busyOverlay && (
          <div style={{
            marginTop: 6, padding: '5px 8px', borderRadius: 6,
            background: 'transparent', border: `0.5px dashed ${C.inkFaint}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="10" height="10" rx="1.5" stroke={C.inkMuted} strokeWidth="1" strokeDasharray="1.5 1.5"/>
            </svg>
            <span style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.1 }}>
              {busyOverlay}
            </span>
          </div>
        )}
        <div style={{
          marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
            {nextLine.who && <CAvatar member={nextLine.who} size={14} />}
            <span style={{ fontSize: 11.5, color: C.inkSec, letterSpacing: -0.1,
                           whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nextLine.text}
            </span>
          </div>
          <Countdown text={countdown} soft={countdownSoft} urgent={countdownUrgent} />
        </div>
      </StripBottomRow>
    </StripCard>
  );
}

function ExternalStripB1Default({ dark }) {
  // Devon viewing Soph. Soph is with Chen-Park (Alex) this week; comes to Devon Fri.
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.devon, label: 'F' }, { c: C.devon, label: 'S' }, { c: C.devon, label: 'S' },
  ];
  return (
    <KidStripDefault
      kid={cMembers.soph}
      hh={cMembers.alex}
      ext={cMembers.devon}
      days={days}
      todayIdx={1}
      label="With Alex · comes to you Fri"
      nextLine={{
        who: cMembers.devon,
        text: <>You take Soph <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Fri 17:00</span></>,
      }}
      countdown="IN 3D"
      countdownSoft
      dark={dark}
    />
  );
}

function ExternalStripB2HandoffDay({ dark }) {
  // Friday — Soph comes to Devon today
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'F', double: true, c2: C.devon, marker: C.warn },
    { c: C.devon, label: 'S' }, { c: C.devon, label: 'S' },
  ];
  return (
    <KidStripDefault
      kid={cMembers.soph}
      hh={cMembers.alex}
      ext={cMembers.devon}
      days={days}
      todayIdx={4}
      label="Soph comes to you today"
      nextLine={{
        who: cMembers.devon,
        text: <><span style={{ fontFamily: C.fontMono, color: C.warn, fontWeight: 600 }}>17:00</span> · pickup from Lincoln Elementary</>,
      }}
      countdown="IN 4H"
      countdownUrgent
      dark={dark}
    />
  );
}

function ExternalStripB3CountdownActive({ dark }) {
  // 20 min to pickup
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'F', double: true, c2: C.devon, marker: C.warn },
    { c: C.devon, label: 'S' }, { c: C.devon, label: 'S' },
  ];
  return (
    <KidStripDefault
      kid={cMembers.soph}
      hh={cMembers.alex}
      ext={cMembers.devon}
      days={days}
      todayIdx={4}
      label="Pickup at Lincoln Elementary"
      nextLine={{
        who: cMembers.alex,
        text: <><span style={{ fontFamily: C.fontMono, color: C.alert, fontWeight: 600 }}>17:00</span> · Alex hands over · 2 prep notes</>,
      }}
      countdown="IN 20M"
      countdownUrgent
      dark={dark}
    />
  );
}

function ExternalStripB4MultiKid({ dark }) {
  // Devon shares BOTH Soph and a sibling. Two stacked strips.
  const sophDays = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.devon, label: 'F' }, { c: C.devon, label: 'S' }, { c: C.devon, label: 'S' },
  ];
  const meiDays = [
    { c: C.devon, label: 'M' }, { c: C.devon, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'F' }, { c: C.alex, label: 'S' }, { c: C.alex, label: 'S' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <KidStripDefault
        kid={cMembers.soph}
        hh={cMembers.alex}
        ext={cMembers.devon}
        days={sophDays}
        todayIdx={1}
        label="With Alex · comes to you Fri"
        nextLine={{
          who: cMembers.devon,
          text: <>You take Soph <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Fri 17:00</span></>,
        }}
        countdown="IN 3D"
        countdownSoft
        dark={dark}
      />
      <KidStripDefault
        kid={cMembers.mei}
        hh={cMembers.alex}
        ext={cMembers.devon}
        days={meiDays}
        todayIdx={1}
        label="With you · returns to Alex Wed"
        nextLine={{
          who: cMembers.alex,
          text: <>Alex takes Mei <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Wed 09:00</span></>,
        }}
        countdown="IN 1D"
        countdownSoft
        dark={dark}
      />
    </div>
  );
}

function ExternalStripB5LongNames({ dark }) {
  // Stress-test + busy-block calendar overlay (paired Google/Microsoft cal)
  const longKid = { ...cMembers.soph, name: 'Sophronia Hartwood-Park' };
  const longExt = { ...cMembers.devon, name: 'Devon Whittington-Hartwood' };
  const days = [
    { c: C.alex, label: 'M' }, { c: C.alex, label: 'T' },
    { c: C.alex, label: 'W' }, { c: C.alex, label: 'T' },
    { c: longExt.color || C.devon, label: 'F' },
    { c: longExt.color || C.devon, label: 'S' },
    { c: longExt.color || C.devon, label: 'S' },
  ];
  return (
    <KidStripDefault
      kid={longKid}
      hh={cMembers.alex}
      ext={longExt}
      days={days}
      todayIdx={1}
      label="With Alex · comes to you Fri"
      nextLine={{
        who: longExt,
        text: <>You take Sophronia <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Fri 17:00</span></>,
      }}
      countdown="IN 3D"
      countdownSoft
      busyOverlay="2 busy blocks on your paired calendar this week"
      dark={dark}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHOWCASE — stacks all states with mono caps labels
// ═══════════════════════════════════════════════════════════════════════════

function ShowcaseLabel({ children }) {
  return (
    <div style={{
      fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
      letterSpacing: 0.4, fontWeight: 700, textTransform: 'uppercase',
      padding: '4px 4px 6px',
    }}>{children}</div>
  );
}

function CaregiverShowcase({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg,
                    fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0,
                      overflowY: 'auto', padding: '16px 0 32px' }}>
          {/* Title */}
          <div style={{ padding: '0 20px 14px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2,
            }}>VARIANT A · #397</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 2 }}>
              Caregiver viewer
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.inkSec, lineHeight: 1.45 }}>
              Nina is the household&apos;s nanny. She isn&apos;t party to the hand-off — she observes and may brief the next parent. Read-only.
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            <ShowcaseLabel>① Default · Tue, Alex&apos;s week</ShowcaseLabel>
            <CaregiverStripA1Default dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>② Hand-off day · 5 hours out</ShowcaseLabel>
            <CaregiverStripA2HandoffDay dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>③ Countdown active · brief the next parent</ShowcaseLabel>
            <CaregiverStripA3CountdownActive dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>④ Both parents on duty · Friday overlap</ShowcaseLabel>
            <CaregiverStripA4BothPresent dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>⑤ Overflow · long names</ShowcaseLabel>
            <CaregiverStripA5LongNames dark={dark} />
          </div>
        </div>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 44, left: 0, right: 0,
          padding: '8px 16px 8px', display: 'flex', alignItems: 'center', gap: 8,
          background: C.bg + 'F0', backdropFilter: 'blur(12px)',
          borderBottom: `0.5px solid ${C.hair}`, zIndex: 10,
        }}>
          <CAvatar member={{ name: 'Nina', initials: 'N', color: C.warn }} size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
              Nina · caregiver POV
            </div>
            <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.1 }}>
              Chen-Park household · weekdays
            </div>
          </div>
          <span style={{
            fontFamily: C.fontMono, fontSize: 9.5, color: C.warn,
            padding: '2px 7px', background: C.warn + '18', borderRadius: 4,
            letterSpacing: 0.3, fontWeight: 700, textTransform: 'uppercase',
          }}>Care</span>
        </div>
      </div>
    </IOSDevice>
  );
}

function ExternalShowcase({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg,
                    fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0,
                      overflowY: 'auto', padding: '16px 0 32px' }}>
          {/* Title */}
          <div style={{ padding: '0 20px 14px' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2,
            }}>VARIANT B · #398</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 2 }}>
              External co-parent viewer
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.inkSec, lineHeight: 1.45 }}>
              Devon is Soph&apos;s parent outside the Chen-Park household. The strip anchors to the kid — not the household&apos;s week.
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            <ShowcaseLabel>① Default · Soph with Alex this week</ShowcaseLabel>
            <ExternalStripB1Default dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>② Hand-off day · Soph comes to you</ShowcaseLabel>
            <ExternalStripB2HandoffDay dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>③ Countdown active · pickup in 20 min</ShowcaseLabel>
            <ExternalStripB3CountdownActive dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>④ Multi-kid · Devon shares Soph + Mei</ShowcaseLabel>
            <ExternalStripB4MultiKid dark={dark} />

            <div style={{ height: 14 }} />
            <ShowcaseLabel>⑤ Overflow · long names + paired calendar</ShowcaseLabel>
            <ExternalStripB5LongNames dark={dark} />
          </div>
        </div>

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 44, left: 0, right: 0,
          padding: '8px 16px 8px', display: 'flex', alignItems: 'center', gap: 8,
          background: C.bg + 'F0', backdropFilter: 'blur(12px)',
          borderBottom: `0.5px solid ${C.hair}`, zIndex: 10,
        }}>
          <CAvatar member={cMembers.devon} size={22} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
              Devon · external co-parent POV
            </div>
            <div style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.1 }}>
              Shares Soph with Chen-Park household
            </div>
          </div>
          <span style={{
            fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
            padding: '2px 7px', background: C.card, borderRadius: 4,
            border: `0.5px solid ${C.hair}`,
            letterSpacing: 0.3, fontWeight: 700, textTransform: 'uppercase',
          }}>Ext</span>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// IN-CONTEXT — strip nested inside a Today-like layout for each viewer
// ═══════════════════════════════════════════════════════════════════════════

function CaregiverInContext({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg,
                    fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>
          {/* Caregiver header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: C.warn, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: -0.4 }}>N</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.3 }}>Chen-Park</span>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.warn,
                padding: '2px 6px', background: C.warn + '18', borderRadius: 4, letterSpacing: 0.3,
                fontWeight: 700, textTransform: 'uppercase',
              }}>caregiver</span>
            </div>
            <CAvatar member={{ name: 'Nina', initials: 'N', color: C.warn }} size={32} />
          </div>
          <div style={{ padding: '8px 20px 14px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
              TUE · MAY 26 · 2026
            </div>
            <div style={{
              fontFamily: C.fontSans, fontSize: 30, fontWeight: 600,
              color: C.ink, letterSpacing: -1.1, lineHeight: 1.1, marginTop: 2,
            }}>Good morning, Nina.</div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.inkSec, lineHeight: 1.5 }}>
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>3</span> events,{' '}
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>2</span> tasks assigned to you today.
            </div>
          </div>

          {/* The strip */}
          <div style={{ padding: '0 16px 14px' }}>
            <CaregiverStripA1Default dark={dark} />
          </div>

          {/* Schedule preview placeholder */}
          <div style={{ padding: '0 20px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Today · assigned to you
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>3 items</span>
          </div>
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, padding: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0',
                            borderBottom: `0.5px solid ${C.hair}` }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec }}>13:00</span>
                <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
                  Pick up Oliver from day-care
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0',
                            borderBottom: `0.5px solid ${C.hair}` }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec }}>16:00</span>
                <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
                  Take Soph to piano
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.warn, fontWeight: 600 }}>17:00</span>
                <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
                  Hand Oliver to Casey at the gate
                </span>
              </div>
            </div>
          </div>
        </div>

        <CBottomNav active="home" />
      </div>
    </IOSDevice>
  );
}

function ExternalInContext({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg,
                    fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>
          {/* External co-parent header — note: NO household identity */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5,
                background: C.devon, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: -0.4 }}>D</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.3 }}>Your kids</span>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkSec,
                padding: '2px 6px', background: C.card, borderRadius: 4, letterSpacing: 0.3,
                fontWeight: 700, textTransform: 'uppercase', border: `0.5px solid ${C.hair}`,
              }}>linked</span>
            </div>
            <CAvatar member={cMembers.devon} size={32} />
          </div>
          <div style={{ padding: '8px 20px 14px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
              TUE · MAY 26 · 2026
            </div>
            <div style={{
              fontFamily: C.fontSans, fontSize: 30, fontWeight: 600,
              color: C.ink, letterSpacing: -1.1, lineHeight: 1.1, marginTop: 2,
            }}>Good morning, Devon.</div>
            <div style={{ marginTop: 8, fontSize: 13, color: C.inkSec, lineHeight: 1.5 }}>
              Soph comes to you <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>Fri</span>. Mei&apos;s week is unchanged.
            </div>
          </div>

          {/* The strip */}
          <div style={{ padding: '0 16px 14px' }}>
            <ExternalStripB1Default dark={dark} />
          </div>

          {/* Soph's upcoming items (privacy-scoped) */}
          <div style={{ padding: '0 20px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Soph · upcoming
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>this week</span>
          </div>
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, padding: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0',
                            borderBottom: `0.5px solid ${C.hair}` }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec }}>Wed</span>
                <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
                  Piano lesson · 16:00
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.warn, fontWeight: 600 }}>Fri</span>
                <span style={{ fontSize: 12.5, color: C.ink, letterSpacing: -0.2, fontWeight: 500 }}>
                  Pickup from Lincoln Elementary · 17:00
                </span>
              </div>
            </div>
            <div style={{
              marginTop: 6, padding: '7px 10px', borderRadius: 7,
              background: 'transparent', border: `0.5px dashed ${C.hair}`,
              fontSize: 11, color: C.inkMuted, lineHeight: 1.4, textAlign: 'center',
            }}>
              You only see what&apos;s tagged for Soph. The household&apos;s other plans aren&apos;t shown.
            </div>
          </div>
        </div>

        <CBottomNav active="home" />
      </div>
    </IOSDevice>
  );
}
