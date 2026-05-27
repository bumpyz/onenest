// Direction C — Calm Pro · palette-parametric
// Linear/Things-tier minimal. Same layout across all four palettes — only the colors change.
// Household: Blended — Alex Chen, Riley Park + 4 kids (Mei 12, Jin 10, Soph 8, Oliver 5)
// across two homes (Oliver's other parent is Casey, Soph's other parent is Devon).

// ─── Palettes ──────────────────────────────────────────────────────────────
// Each palette shares the same shape so the screen components can read from
// the module-scoped `C` proxy below. `accent` is the single brand color;
// `sheet` is the elevated dark surface used for the AI-suggestions block;
// member colors are bundled in since identity should harmonize with theme.

const paletteSlateCoral = {
  name: 'Slate Coral',
  scheme: 'light',
  bg:      '#EEF0F3',
  card:    '#FFFFFF',
  inset:   '#F4F5F8',
  ink:     '#11131A',
  inkSec:  '#4F525A',
  inkMuted:'#828690',
  inkFaint:'#BFC2CA',
  hair:    'rgba(17,19,26,0.08)',
  hairS:   'rgba(17,19,26,0.04)',
  accent:  '#E5613D',          // warm coral — the warmth
  accentSoft: '#FCDED2',
  onAccent: '#FFFFFF',
  alert:   '#C5392E',
  alertSoft: '#F9D9D4',
  warn:    '#D8902C',
  sheet:   '#15171B',          // dark AI/banner surface
  onSheet: '#FFFFFF',
  alex:    '#5667D4',
  riley:   '#D17A3F',
  casey:   '#8369A8',
  devon:   '#3E8A6B',
  mei:     '#C9789E',
  jin:     '#6FA0D1',
  soph:    '#C8A26C',
  oliver:  '#6BC9AF',
  fontSans: '"Geist", -apple-system, "Helvetica Neue", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

const paletteBellNavy = {
  name: 'Bell Navy',
  scheme: 'light',
  bg:      '#EEF1F5',          // matches OneNest's actual brand bg
  card:    '#FFFFFF',
  inset:   '#F4F6FA',
  ink:     '#1F2940',          // OneNest brand navy
  inkSec:  '#56607A',
  inkMuted:'#8FA3BB',
  inkFaint:'#C3CEDC',
  hair:    'rgba(31,41,64,0.08)',
  hairS:   'rgba(31,41,64,0.04)',
  accent:  '#E8A04F',          // amber — warm pop on cool blue-gray
  accentSoft: '#F8E5C8',
  onAccent: '#1F2940',         // navy text on amber for contrast
  alert:   '#D9533F',
  alertSoft: '#F5DBD4',
  warn:    '#C66B4A',
  sheet:   '#1F2940',
  onSheet: '#FFFFFF',
  alex:    '#3F5294',
  riley:   '#C66B4A',
  casey:   '#7A5E9E',
  devon:   '#4E8B6B',
  mei:     '#C26F90',
  jin:     '#5E8FBE',
  soph:    '#BFA163',
  oliver:  '#5DBFA3',
  fontSans: '"Geist", -apple-system, "Helvetica Neue", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

const paletteMistForest = {
  name: 'Mist Forest',
  scheme: 'light',
  bg:      '#ECEFEC',          // pale gray with sage undertone
  card:    '#FFFFFF',
  inset:   '#F3F5F2',
  ink:     '#161C18',
  inkSec:  '#4E5750',
  inkMuted:'#828B85',
  inkFaint:'#BCC4BE',
  hair:    'rgba(22,28,24,0.08)',
  hairS:   'rgba(22,28,24,0.04)',
  accent:  '#2D8B6E',          // deep forest green
  accentSoft: '#CCE5DC',
  onAccent: '#FFFFFF',
  alert:   '#C04A38',
  alertSoft: '#F3D9D2',
  warn:    '#D8902C',
  sheet:   '#161C18',
  onSheet: '#FFFFFF',
  alex:    '#5C77B5',
  riley:   '#C77046',
  casey:   '#8369A8',
  devon:   '#3E8A6B',
  mei:     '#BE7896',
  jin:     '#6F9DC4',
  soph:    '#BFA168',
  oliver:  '#6BC0A6',
  fontSans: '"Geist", -apple-system, "Helvetica Neue", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

const paletteCharcoal = {
  name: 'Charcoal',
  scheme: 'dark',
  bg:      '#15171B',
  card:    '#1F2128',
  inset:   '#272A33',
  ink:     '#F0F0F2',
  inkSec:  '#A8AAB2',
  inkMuted:'#6E7079',
  inkFaint:'#4A4C55',
  hair:    'rgba(255,255,255,0.08)',
  hairS:   'rgba(255,255,255,0.04)',
  accent:  '#FF7B52',          // coral pop on dark
  accentSoft: '#3D241F',
  onAccent: '#FFFFFF',
  alert:   '#FF5C4E',
  alertSoft: '#3A2222',
  warn:    '#E8A33C',
  sheet:   '#0B0C0F',          // even darker than bg
  onSheet: '#FFFFFF',
  alex:    '#8392E5',
  riley:   '#E6975F',
  casey:   '#B294D2',
  devon:   '#6BBF99',
  mei:     '#EAA0C3',
  jin:     '#9FC7E8',
  soph:    '#DEC495',
  oliver:  '#9CE5C8',
  fontSans: '"Geist", -apple-system, "Helvetica Neue", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

// Charcoal Forest — dark shell from paletteCharcoal, accent pulled from the
// Mist Forest light palette and brightened so it pops against the dark surface
// (the light P3 accent #2D8B6E reads too muted on near-black). Paired with
// paletteMistForest as the matched light/dark set the user requested.
const paletteCharcoalForest = {
  name: 'Charcoal Forest',
  scheme: 'dark',
  bg:      '#15171B',
  card:    '#1F2128',
  inset:   '#272A33',
  ink:     '#F0F0F2',
  inkSec:  '#A8AAB2',
  inkMuted:'#6E7079',
  inkFaint:'#4A4C55',
  hair:    'rgba(255,255,255,0.08)',
  hairS:   'rgba(255,255,255,0.04)',
  accent:  '#3FC198',          // forest green, brightened for dark surfaces
  accentSoft: '#1F2A26',
  onAccent: '#0B1310',         // very dark text on bright green
  alert:   '#FF5C4E',
  alertSoft: '#3A2222',
  warn:    '#E8A33C',
  sheet:   '#0B0C0F',
  onSheet: '#FFFFFF',
  alex:    '#8392E5',
  riley:   '#E6975F',
  casey:   '#B294D2',
  devon:   '#6BBF99',
  mei:     '#EAA0C3',
  jin:     '#9FC7E8',
  soph:    '#DEC495',
  oliver:  '#9CE5C8',
  fontSans: '"Geist", -apple-system, "Helvetica Neue", system-ui, sans-serif',
  fontMono: '"Geist Mono", ui-monospace, "SF Mono", monospace',
};

const C_PALETTES = {
  slateCoral: paletteSlateCoral,
  bellNavy: paletteBellNavy,
  mistForest: paletteMistForest,
  charcoal: paletteCharcoal,
  charcoalForest: paletteCharcoalForest,
};

// Module-scoped active palette. Each screen sets this at the top of its
// render before returning JSX; all helper components read from C directly.
// Safe for static renders because React renders siblings sequentially and
// a screen + its descendants share a single value.
let C = paletteSlateCoral;

// cMembers as a Proxy → always reads colors from the current C. Keeps the
// existing `cMembers.alex` call-sites in helpers unchanged.
const _memberLabels = {
  alex: 'Alex', riley: 'Riley', casey: 'Casey', devon: 'Devon',
  mei: 'Mei', jin: 'Jin', soph: 'Soph', oliver: 'Oliver',
};
const _memberAges = { mei: 12, jin: 10, soph: 8, oliver: 5 };
const _externalMembers = { casey: true, devon: true };
const cMembers = new Proxy({}, {
  get(_, key) {
    if (typeof key !== 'string' || !(key in _memberLabels)) return undefined;
    return {
      name: _memberLabels[key],
      initial: _memberLabels[key][0],
      color: C[key],
      age: _memberAges[key],
      external: !!_externalMembers[key],
    };
  },
});

function CAvatar({ member, size = 22 }) {
  if (!member) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size,
      background: member.color, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: C.fontSans, fontSize: size * 0.4, fontWeight: 600,
      flexShrink: 0, letterSpacing: -0.2,
    }}>{member.initial}</div>
  );
}

function CStack({ members, size = 20 }) {
  return (
    <div style={{ display: 'flex' }}>
      {members.map((m, i) => (
        <div key={i} style={{ marginLeft: i ? -5 : 0, border: `1.5px solid ${C.card}`, borderRadius: size + 3 }}>
          <CAvatar member={m} size={size} />
        </div>
      ))}
    </div>
  );
}

const CIcon = {
  search: (c = C.inkMuted) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke={c} strokeWidth="1.4"/>
      <path d="M9.5 9.5l3 3" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  plus: (c = '#fff') => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v11M1.5 7h11" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  spark: (c = C.accent) => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 0.5v3M7 10.5v3M0.5 7h3M10.5 7h3M2.5 2.5l2 2M9.5 9.5l2 2M11.5 2.5l-2 2M2.5 11.5l2-2" stroke={c} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  warn: (c = C.warn) => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5L13 12H1L7 1.5z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M7 6v3M7 10.5v.3" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  arrowR: (c = C.inkMuted) => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3 1.5l3.5 3.5L3 8.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  check: (c = '#fff') => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M1.5 5l2.5 2.5L8.5 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  swap: (c = C.inkSec) => (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h9l-2-2M12 10H3l2 2" stroke={c} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  command: (c = C.inkMuted) => (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
      <path d="M5 5H3a1.5 1.5 0 110-3 1.5 1.5 0 011.5 1.5V5zm0 0v4M5 9H3a1.5 1.5 0 100 3 1.5 1.5 0 001.5-1.5V9zm0 0h4m0 0h2a1.5 1.5 0 110 3 1.5 1.5 0 01-1.5-1.5V9zm0 0V5m0 0h2a1.5 1.5 0 100-3 1.5 1.5 0 00-1.5 1.5V5z" stroke={c} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

function CBottomNav({ active = 'home' }) {
  const items = [
    { id: 'home',     label: 'Today',    d: 'M3 9l7-6 7 6v8a1 1 0 01-1 1h-3v-5H7v5H4a1 1 0 01-1-1V9z' },
    { id: 'cal',      label: 'Calendar', d: 'M3 6a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V6zM3 9h14M7 2v4M13 2v4' },
    { id: 'lists',    label: 'Lists',    d: 'M3 5h14M3 10h14M3 15h14' },
    { id: 'contacts', label: 'Contacts', d: 'M4 4a1 1 0 011-1h9a2 2 0 012 2v10a2 2 0 01-2 2H5a1 1 0 01-1-1V4zM9.5 10a2 2 0 100-4 2 2 0 000 4zM6.5 14c.5-1.5 1.7-2.3 3-2.3s2.5.8 3 2.3M2.5 6h1.5M2.5 10h1.5M2.5 14h1.5' },
    { id: 'people',   label: 'Family',   d: 'M3 16c0-2.8 2.7-5 6-5s6 2.2 6 5M6 6a3 3 0 106 0 3 3 0 00-6 0' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
      background: C.bg + 'F2', backdropFilter: 'blur(20px)',
      borderTop: `0.5px solid ${C.hair}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      padding: '10px 10px 28px', zIndex: 5,
    }}>
      {items.map(it => {
        const on = it.id === active;
        return (
          <div key={it.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d={it.d} stroke={on ? C.ink : C.inkFaint} strokeWidth={on ? 1.6 : 1.3} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontFamily: C.fontSans, fontSize: 9.5, fontWeight: 600,
              color: on ? C.ink : C.inkFaint, letterSpacing: -0.1,
            }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════════════════════════════════════
function ProHome({ palette = paletteSlateCoral, scrollTop = 0 }) {
  C = palette;
  const dark = palette.scheme === 'dark';
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollTop;
  }, [scrollTop]);
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header — compact, info-dense */}
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
              {/* Bell — opens Notifications activity inbox. Badge dot signals unread. */}
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
              <span style={{ fontFamily: C.fontMono, color: C.ink, fontWeight: 500 }}>2</span> tasks today.{' '}
              Oliver moves to Casey&apos;s tomorrow.
            </div>
          </div>

          {/* Command-K style AI bar */}
          <div style={{ padding: '0 16px 14px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 1px 0 rgba(14,14,16,0.02)',
            }}>
              {CIcon.spark(C.accent)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 12.5, color: C.ink, letterSpacing: -0.2 }}>
                  jin orthodontist fri 3:30
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                  padding: '2px 5px', background: C.inset, borderRadius: 3,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>{CIcon.command()} K</span>
              </div>
            </div>
            <div style={{
              padding: '8px 12px', fontSize: 11, color: C.inkSec,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {CIcon.arrowR(C.accent)}
              <span>
                <span style={{ color: C.ink, fontWeight: 500 }}>Friday May 29</span>
                <span style={{ color: C.inkFaint }}> · </span>
                <span style={{ fontFamily: C.fontMono }}>15:30 — 16:00</span>
                <span style={{ color: C.inkFaint }}> · </span>
                <span>for Jin · responsible Riley</span>
              </span>
            </div>
          </div>

          {/* Conflict suggestion */}
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

          {/* Timeline — info dense */}
          <div style={{ padding: '0 16px' }}>
            <div style={{
              padding: '0 4px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Today · Tue 26
              </div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>
                4 events · 8h block free 19:00–
              </div>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
            }}>
              <CEventRow time="07:30" dur="45m" title="Mei · school bus" who={[cMembers.alex]} child={cMembers.mei} past tasks={2} tasksDone={2} />
              <CEventRow time="08:15" dur="30m" title="Oliver · day-care drop" who={[cMembers.riley]} child={cMembers.oliver} past />
              <CEventRow time="13:00" dur="1h" title="Alex · Standup → product review" who={[cMembers.alex]} loc="Remote" />
              <CEventRow time="16:00" dur="45m" title="Soph · piano"
                who={[cMembers.alex]} child={cMembers.soph} conflict
                tasks={5} tasksDone={2}
                expanded
                expandedTasks={[
                  { title: "Soph's sheet music — Czerny book", who: cMembers.alex, due: 'before 16:00' },
                  { title: 'Email teacher about recital piece', who: cMembers.alex, due: 'this week' },
                  { title: 'Confirm next lesson time', who: cMembers.riley, done: true },
                  { title: 'Practice 20 min daily', who: cMembers.soph, done: true },
                  { title: 'Buy new metronome', due: 'anytime' },
                ]}
              />
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

          {/* Activity feed */}
          <div style={{ padding: '24px 16px 0' }}>
            <div style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                Activity
              </div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent }}>LIVE</div>
            </div>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            }}>
              <CActivity who={cMembers.riley} action="added" what="Pediatrician · Friday" when="2h" />
              <CActivity who={cMembers.casey} action="confirmed" what="Oliver pickup tomorrow" when="3h" />
              <CActivity who={cMembers.alex} action="completed" what="Order groceries" when="5h" />
              <CActivity who={cMembers.devon} action="requested swap" what="Soph · Saturday" when="yest" last />
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

function CButton({ children, primary }) {
  return (
    <div style={{
      padding: '5px 10px', borderRadius: 6,
      background: primary ? C.accent : 'transparent',
      color: primary ? C.onAccent : C.ink,
      fontSize: 11, fontWeight: 600, letterSpacing: -0.1,
      border: primary ? 'none' : `0.5px solid ${C.hair}`,
    }}>{children}</div>
  );
}

function CEventRow({ time, dur, title, who, child, loc, conflict, done, past, tasks, tasksDone, expanded, expandedTasks, last }) {
  return (
    <>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: (last && !expanded) ? 'none' : `0.5px solid ${C.hair}`,
      opacity: past ? 0.55 : 1,
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
        background: conflict ? C.warn : (who?.[0]?.color ?? C.inkFaint),
        opacity: past ? 0.5 : 1,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2,
          lineHeight: 1.3,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {/* Tiny check for events explicitly marked attended (different from past). */}
          {done && (
            <span style={{
              width: 12, height: 12, borderRadius: 6, background: C.accent,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          )}
          <span style={{ flex: 1 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.inkMuted, marginTop: 2 }}>
          {child && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: child.color }} />
              {child.name}
            </span>
          )}
          {loc && <span style={{ fontFamily: C.fontMono, letterSpacing: -0.2 }}>· {loc}</span>}
          {conflict && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              color: C.warn, fontWeight: 600,
            }}>
              {CIcon.warn(C.warn)} Conflict
            </span>
          )}
        </div>
      </div>
      {/* Task-count badge — appears when the event has attached tasks.
          Filled (accent) when expanded; outlined when collapsed. */}
      {typeof tasks === 'number' && tasks > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 7px', borderRadius: 999,
          background: expanded ? C.accent + '22' : C.inset,
          border: `0.5px solid ${expanded ? C.accent + '55' : C.hair}`,
          flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <rect x="2" y="2.5" width="10" height="10" rx="1.5" stroke={expanded ? C.accent : C.inkSec} strokeWidth="1.4" fill="none"/>
            <path d="M4.5 7l1.5 1.5L9.5 5.5" stroke={expanded ? C.accent : C.inkSec} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{
            fontFamily: C.fontMono, fontSize: 10, fontWeight: 600, letterSpacing: -0.2,
            color: expanded ? C.accent : C.inkSec,
          }}>{tasksDone || 0}/{tasks}</span>
        </div>
      )}
      <CStack members={who} size={20} />
    </div>
    {/* Expanded task list — rendered inline under the event row.
        The leading rail visually ties tasks to their parent event. */}
    {expanded && expandedTasks && (
      <div style={{
        background: C.accent + (C.scheme === 'dark' ? '0A' : '08'),
        borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
        paddingLeft: 74, paddingRight: 14, paddingTop: 4, paddingBottom: 10,
        position: 'relative',
      }}>
        {/* Leading rail in the parent event's responsible color */}
        <div style={{
          position: 'absolute', left: 62, top: 0, bottom: 0,
          width: 2, borderRadius: 1, background: (who?.[0]?.color ?? C.inkFaint), opacity: 0.5,
        }} />
        {expandedTasks.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '6px 0',
          }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3, flexShrink: 0,
              border: `1.2px solid ${t.done ? C.accent : C.inkFaint}`,
              background: t.done ? C.accent : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{t.done && (
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}</div>
            <span style={{
              flex: 1, fontSize: 12, color: t.done ? C.inkMuted : C.ink, letterSpacing: -0.15,
              textDecoration: t.done ? 'line-through' : 'none', lineHeight: 1.3,
            }}>{t.title}</span>
            {t.due && (
              <span style={{ fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.2 }}>
                {t.due}
              </span>
            )}
            {t.who && <CAvatar member={t.who} size={16} />}
          </div>
        ))}
      </div>
    )}
    </>
  );
}

function CActivity({ who, action, what, when, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <CAvatar member={who} size={22} />
      <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.35 }}>
        <span style={{ fontWeight: 600, color: C.ink }}>{who.name}</span>
        <span style={{ color: C.inkSec }}> {action} </span>
        <span style={{ color: C.ink }}>{what}</span>
      </div>
      <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint }}>{when}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR — Week view, dense
// ═══════════════════════════════════════════════════════════════════════════
function ProCalendar({ palette = paletteSlateCoral }) {
  C = palette;
  const dark = palette.scheme === 'dark';
  const days = [
    { d: 25, n: 'M', custody: [C.alex] },
    { d: 26, n: 'T', custody: [C.alex], today: true },
    { d: 27, n: 'W', custody: [C.alex, C.casey] },         // handoff midday: Oliver to Casey
    { d: 28, n: 'T', custody: [C.casey] },
    { d: 29, n: 'F', custody: [C.casey, C.alex] },
    { d: 30, n: 'S', custody: [C.alex, C.devon] },          // Soph weekend with Devon
    { d: 31, n: 'S', custody: [C.alex] },
  ];
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, paddingTop: 54, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>WEEK 22</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>May 25 – 31</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: C.inset, padding: 3, borderRadius: 8 }}>
              <CSeg label="D" />
              <CSeg label="W" active />
              <CSeg label="M" />
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ padding: '8px 16px 6px', display: 'flex', gap: 6, alignItems: 'center', overflow: 'hidden' }}>
            <CChip label="All" active />
            <CChip label="Mei" dot={C.mei} />
            <CChip label="Jin" dot={C.jin} />
            <CChip label="Soph" dot={C.soph} />
            <CChip label="Oliver" dot={C.oliver} />
          </div>

          {/* Day header */}
          <div style={{ padding: '8px 12px 0', display: 'flex' }}>
            <div style={{ width: 36 }} />
            {days.map(day => (
              <div key={day.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>{day.n}</div>
                <div style={{
                  fontFamily: C.fontMono, fontSize: 13, fontWeight: 600,
                  color: day.today ? C.onAccent : C.ink,
                  background: day.today ? C.accent : 'transparent',
                  width: 22, height: 22, borderRadius: 11,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  letterSpacing: -0.3,
                }}>{day.d}</div>
                {/* Custody segments */}
                <div style={{ display: 'flex', gap: 1, width: 24, height: 3, borderRadius: 2, overflow: 'hidden' }}>
                  {day.custody.map((c, i) => (
                    <div key={i} style={{ flex: 1, background: c }} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* All-day strip */}
          <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 36, fontFamily: C.fontMono, fontSize: 9, color: C.inkFaint, letterSpacing: -0.2 }}>ALL DAY</div>
            <div style={{ flex: 1, position: 'relative', height: 18 }}>
              {/* Wed-Fri Mei field trip */}
              <div style={{
                position: 'absolute', top: 2, height: 14, borderRadius: 4,
                left: '28.5%', right: '14.3%',
                background: C.mei + '30', borderLeft: `2px solid ${C.mei}`,
                fontSize: 9.5, fontFamily: C.fontMono, color: C.ink,
                padding: '0 6px', display: 'flex', alignItems: 'center',
                letterSpacing: -0.2,
              }}>Mei · field trip</div>
            </div>
          </div>

          {/* Grid */}
          <div style={{ position: 'absolute', top: 220, left: 0, right: 0, bottom: 80, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: '0 12px', overflow: 'auto' }}>
              <div style={{ position: 'relative', background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, paddingBottom: 8 }}>
                {hours.map((h, i) => (
                  <div key={i} style={{
                    display: 'flex', minHeight: 40,
                    borderBottom: `0.5px solid ${C.hairS}`,
                  }}>
                    <div style={{
                      width: 36, padding: '4px 0 0 8px', flexShrink: 0,
                      fontFamily: C.fontMono, fontSize: 9.5, color: C.inkFaint, letterSpacing: -0.2,
                    }}>{String(h).padStart(2,'0')}:00</div>
                    {days.map((_, j) => (
                      <div key={j} style={{ flex: 1, borderLeft: `0.5px solid ${C.hairS}` }} />
                    ))}
                  </div>
                ))}

                {/* Now line */}
                <div style={{
                  position: 'absolute', left: 36, right: 8, top: 105, height: 1,
                  background: C.accent, zIndex: 3,
                }}>
                  <div style={{ position: 'absolute', left: -3, top: -3, width: 7, height: 7, borderRadius: 4, background: C.accent }} />
                </div>

                {/* Event blocks for the week */}
                {/* day index: 0=Mon ... 6=Sun */}
                <CCalBlock day={0} startH={8.5} endH={9} color={C.alex} title="Drop-off" />
                <CCalBlock day={0} startH={14} endH={15.5} color={C.riley} title="Standup" />
                <CCalBlock day={1} startH={8.25} endH={9} color={C.alex} title="Mei bus" />
                <CCalBlock day={1} startH={13} endH={14} color={C.alex} title="Standup" />
                <CCalBlock day={1} startH={16} endH={16.75} color={C.alex} title="Soph piano" conflict />
                <CCalBlock day={1} startH={16} endH={17.5} color={C.alex} title="Mei rehearsal" conflict right />
                <CCalBlock day={2} startH={9} endH={10} color={C.casey} title="Pickup Oliver" handoff />
                <CCalBlock day={2} startH={15} endH={16} color={C.alex} title="Jin orthodontist" />
                <CCalBlock day={3} startH={10} endH={11.5} color={C.casey} title="Oliver pediatric" />
                <CCalBlock day={3} startH={14} endH={15.5} color={C.alex} title="1:1 with Mar." />
                <CCalBlock day={4} startH={11} endH={12.5} color={C.alex} title="Lunch · J&M" />
                <CCalBlock day={4} startH={15.5} endH={16} color={C.riley} title="Jin ortho" />
                <CCalBlock day={5} startH={10} endH={12} color={C.devon} title="Soph w/ Devon" handoff />
                <CCalBlock day={5} startH={14} endH={16} color={C.alex} title="Family soccer" />
                <CCalBlock day={6} startH={11} endH={13} color={C.alex} title="Sunday brunch" />

                {/* Drag-ghost block (showing reschedule preview) */}
                <CCalBlock day={1} startH={17.5} endH={18.25} color={C.alex} title="Mei rehearsal" ghost />
              </div>
            </div>
          </div>

          {/* Floating drag-hint footer — full width when present (it's a transient state). */}
          <div style={{
            position: 'absolute', left: 16, right: 16, bottom: 86,
            background: C.sheet + 'F0', color: C.onSheet,
            borderRadius: 10, padding: '8px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 8px 24px rgba(14,14,16,0.2)', zIndex: 4,
          }}>
            {CIcon.swap(C.onSheet)}
            <div style={{ flex: 1, fontSize: 12, letterSpacing: -0.2 }}>
              Drag <span style={{ fontFamily: C.fontMono, color: C.accent }}>Mei rehearsal</span> to <span style={{ fontFamily: C.fontMono, color: C.accent }}>Tue 17:30</span> — resolves conflict
            </div>
            <div style={{
              background: C.accent, color: C.ink, padding: '4px 10px',
              borderRadius: 6, fontSize: 11, fontWeight: 700, letterSpacing: -0.1,
            }}>Apply</div>
          </div>
        </div>

        {/* FAB — sits above the drag-hint banner on the week view. */}
        <div style={{
          position: 'absolute', right: 16, bottom: 152,
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

function CSeg({ label, active }) {
  return (
    <div style={{
      width: 26, height: 22, borderRadius: 5,
      background: active ? C.card : 'transparent',
      color: active ? C.ink : C.inkMuted,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: C.fontMono, fontSize: 11, fontWeight: 600, letterSpacing: -0.2,
      boxShadow: active ? '0 1px 0 rgba(14,14,16,0.04)' : 'none',
    }}>{label}</div>
  );
}

function CChip({ label, active, dot }) {
  return (
    <div style={{
      padding: '4px 10px', borderRadius: 999, flexShrink: 0,
      background: active ? C.accent : C.card,
      color: active ? C.onAccent : C.ink,
      fontSize: 11.5, fontWeight: 600, letterSpacing: -0.1,
      border: active ? 'none' : `0.5px solid ${C.hair}`,
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 3, background: dot }} />}
      {label}
    </div>
  );
}

function CCalBlock({ day, startH, endH, color, title, conflict, ghost, handoff, right }) {
  // Days col widths: each column is 1/7 of (100% - 36px)
  // Hour rows are 40px each starting from h=8.
  // Alpha bumps in dark mode — at the dark surface a 13% member-color overlay
  // disappears into the bg; 36–45% gives blocks visible fill without losing
  // the "tinted, not saturated" feel the layout depends on.
  const dark = C.scheme === 'dark';
  const fillAlpha = ghost ? '' : (handoff ? (dark ? '40' : '20') : (dark ? '5C' : '22'));
  const top = (startH - 8) * 40 + 0;
  const height = (endH - startH) * 40 - 1;
  const leftPct = `calc(36px + (100% - 36px) * ${day / 7} ${right ? '+ ((100% - 36px) / 14)' : ''})`;
  const widthPct = right
    ? `calc(((100% - 36px) / 7) / 2 - 2px)`
    : conflict
      ? `calc(((100% - 36px) / 7) / 2 - 1px)`
      : `calc((100% - 36px) / 7 - 2px)`;
  return (
    <div style={{
      position: 'absolute', top, height,
      left: leftPct, width: widthPct,
      background: ghost ? 'transparent' : color + fillAlpha,
      borderLeft: `2px solid ${color}`,
      borderRadius: 4,
      border: ghost ? `1.5px dashed ${color}` : undefined,
      padding: '2px 4px', overflow: 'hidden',
      opacity: ghost ? 0.7 : 1,
      boxShadow: conflict && !ghost ? `inset 0 0 0 1px ${C.warn}80` : 'none',
    }}>
      <div style={{
        fontSize: 9, color: ghost ? C.inkMuted : C.ink, fontWeight: 600,
        lineHeight: 1.2, letterSpacing: -0.15,
      }}>{title}</div>
      {handoff && (
        <div style={{ position: 'absolute', right: 2, top: 2 }}>{CIcon.swap(color)}</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTS
// ═══════════════════════════════════════════════════════════════════════════
function ProLists({ palette = paletteSlateCoral }) {
  C = palette;
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ padding: '12px 20px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                12 OPEN · 3 OVERDUE · 2 DONE TODAY
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Lists</div>
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{CIcon.search()}</div>
          </div>

          {/* Cmd-K input */}
          <div style={{ padding: '8px 16px 12px' }}>
            <div style={{
              background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`,
              padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              {CIcon.plus(C.inkMuted)}
              <div style={{ flex: 1, fontFamily: C.fontMono, fontSize: 12, color: C.inkFaint, letterSpacing: -0.2 }}>
                add task · use # for list, @ for person
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                padding: '2px 5px', background: C.inset, borderRadius: 3,
                display: 'inline-flex', alignItems: 'center', gap: 3,
              }}>{CIcon.command()} N</span>
            </div>
          </div>

          {/* List chips */}
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CChip label="All · 12" active />
            <CChip label="House" dot={C.alex} />
            <CChip label="Kids" dot={C.mei} />
            <CChip label="Errands" dot={C.riley} />
            <CChip label="School" dot={C.jin} />
            <CChip label="Co-parents" dot={C.casey} />
          </div>

          {/* Section · Overdue */}
          <CGroupHeader label="Overdue" count={3} accent={C.alert} />
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              <CTask title="Sign Soph's field-trip slip" who={cMembers.alex} due="-2d" overdue list={['School']} listC={[C.jin]} />
              <CTask title="Confirm summer-camp deposit · Mei" who={cMembers.riley} due="-1d" overdue list={['Kids']} listC={[C.mei]} />
              <CTask title="Reply to Casey on Oliver pickup" who={cMembers.alex} due="-1d" overdue list={['Co-parents']} listC={[C.casey]} last />
            </div>
          </div>

          {/* Section · Today, with swipe demo */}
          <CGroupHeader label="Today" count={4} />
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {/* Swiped row showing actions */}
              <CSwipedTask />
              <CTask title="Order Jin's retainer cleaner" who={cMembers.riley} due="today" list={['Errands']} listC={[C.riley]} />
              <CTask title="Pack Oliver's bag for Casey" who={cMembers.alex} due="by 17:00" list={['Co-parents','Kids']} listC={[C.casey, C.mei]} />
              <CTask title="Pickup dry-cleaning" anyone due="today" list={['Errands']} listC={[C.riley]} last />
            </div>
          </div>

          {/* Section · This week */}
          <CGroupHeader label="This week" count={5} />
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              <CTask title="Renew Mei's passport" who={cMembers.alex} due="Thu" list={['Kids']} listC={[C.mei]} />
              <CTask title="Soph's recital — Saturday 11:00" who={cMembers.alex} due="Sat" list={['Kids','School']} listC={[C.soph, C.jin]} />
              <CTask title="Coordinate with Devon — Soph weekend" who={cMembers.alex} due="Fri" list={['Co-parents']} listC={[C.devon]} />
              <CTask title="Hire summer babysitter" who={cMembers.riley} due="Fri" list={['Kids']} listC={[C.mei]} />
              <CTask title="Schedule HVAC tune-up" anyone due="Sat" list={['House']} listC={[C.alex]} last />
            </div>
          </div>

          {/* AI suggestion bottom sheet */}
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{
              background: C.sheet, borderRadius: 12, padding: '14px 16px', color: C.onSheet,
              boxShadow: '0 8px 24px rgba(14,14,16,0.16)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {CIcon.spark(C.accent)}
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  Suggested · 3
                </span>
              </div>
              <CSuggest text="Order Jin's retainer cleaner runs out Thu — set as recurring?" />
              <CSuggest text="Soph's recital Sat needs flowers — add as task to Riley?" />
              <CSuggest text="Group 4 of Mei's school items into 'School · Mei'?" last />
            </div>
          </div>
        </div>

        <CBottomNav active="lists" />
      </div>
    </IOSDevice>
  );
}

function CGroupHeader({ label, count, accent }) {
  return (
    <div style={{
      padding: '14px 20px 6px',
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600,
        color: accent ?? C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>{count}</div>
    </div>
  );
}

function CTask({ title, who, anyone, due, overdue, done, last, list, listC }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 12px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
        border: `1.2px solid ${done ? C.accent : C.inkFaint}`,
        background: done ? C.accent : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{done && CIcon.check()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 500, color: done ? C.inkMuted : C.ink,
          letterSpacing: -0.2, textDecoration: done ? 'line-through' : 'none',
          marginBottom: 3, lineHeight: 1.3,
        }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {list?.map((l, i) => (
            <span key={l} style={{
              fontFamily: C.fontMono, fontSize: 10, padding: '1px 5px',
              borderRadius: 3, color: C.inkSec,
              background: listC[i] + '22', letterSpacing: -0.2,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: listC[i] }} />
              {l}
            </span>
          ))}
          <span style={{
            fontFamily: C.fontMono, fontSize: 10,
            color: overdue ? C.alert : C.inkMuted, letterSpacing: -0.2, fontWeight: overdue ? 600 : 500,
          }}>{due}</span>
        </div>
      </div>
      {anyone ? (
        <div style={{
          width: 22, height: 22, borderRadius: 11, border: `1px dashed ${C.inkFaint}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: C.fontMono, fontSize: 10, color: C.inkFaint, fontWeight: 600,
        }}>?</div>
      ) : (
        <CAvatar member={who} size={22} />
      )}
    </div>
  );
}

function CSwipedTask() {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: `0.5px solid ${C.hair}` }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          width: 60, background: C.accent, color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          {CIcon.check('#fff')}
          <span style={{ fontFamily: C.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: -0.2 }}>DONE</span>
        </div>
        <div style={{
          width: 60, background: C.warn, color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="#fff" strokeWidth="1.4"/><path d="M7 4v3l2 1" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span style={{ fontFamily: C.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: -0.2 }}>+1d</span>
        </div>
        <div style={{
          width: 60, background: C.alert, color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5h8M5 5V3h4v2M5 5l1 7h2l1-7" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontFamily: C.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: -0.2 }}>DEL</span>
        </div>
      </div>
      <div style={{
        position: 'relative', background: C.card,
        transform: 'translateX(-180px)',
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
      }}>
        <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.2px solid ${C.inkFaint}` }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2, marginBottom: 3 }}>
            Email Mei's coach about Sat tournament
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{
              fontFamily: C.fontMono, fontSize: 10, padding: '1px 5px',
              borderRadius: 3, color: C.inkSec, background: C.mei + '22',
              letterSpacing: -0.2, display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: 2, background: C.mei }} />
              Kids
            </span>
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>today</span>
          </div>
        </div>
        <CAvatar member={cMembers.alex} size={22} />
      </div>
    </div>
  );
}

function CSuggest({ text, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '8px 0',
      borderBottom: last ? 'none' : `0.5px solid rgba(255,255,255,0.1)`,
    }}>
      <span style={{ color: C.accent, fontFamily: C.fontMono, fontSize: 12 }}>→</span>
      <div style={{ flex: 1, fontSize: 12, color: C.onSheet, lineHeight: 1.4, letterSpacing: -0.1 }}>{text}</div>
      <span style={{ color: C.inkMuted, fontFamily: C.fontMono, fontSize: 10 }}>⌘1</span>
    </div>
  );
}

// Exposed for screens-extra.jsx and any other file that wants to render in C.
function setActivePalette(p) { C = p; }

Object.assign(window, {
  ProHome, ProCalendar, ProLists,
  C_PALETTES,
  paletteSlateCoral, paletteBellNavy, paletteMistForest, paletteCharcoal, paletteCharcoalForest,
  setActivePalette,
  // Helpers used by screens-extra.jsx
  cMembers, CAvatar, CStack, CChip, CButton, CIcon, CBottomNav,
});
