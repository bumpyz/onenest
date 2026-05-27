// Round 6 — auth, create-event form, push notifications.
// Continues from screens-extra.jsx; relies on the same global helpers (C, cMembers, CAvatar, etc.).

// ═══════════════════════════════════════════════════════════════════════════
// SIGN-IN — first-touch screen
// ═══════════════════════════════════════════════════════════════════════════
function SignIn({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        {/* Decorative accent band at top — frames the brand, breaks the monotone */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 320,
          background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accent} 40%, ${C.accent + (dark ? '88' : 'AA')} 100%)`,
          overflow: 'hidden',
        }}>
          {/* Soft house silhouettes for warmth — subtle, white-on-accent */}
          <svg width="100%" height="320" viewBox="0 0 402 320" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, opacity: 0.13 }}>
            <path d="M-20 220 L60 160 L140 220 L140 320 L-20 320 Z" fill="#FFFFFF"/>
            <path d="M120 240 L200 175 L280 240 L280 320 L120 320 Z" fill="#FFFFFF"/>
            <path d="M260 230 L340 170 L420 230 L420 320 L260 320 Z" fill="#FFFFFF"/>
          </svg>
          {/* Brand mark */}
          <div style={{
            position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: '#FFFFFF22', border: `1.5px solid #FFFFFF55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}>
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                <path d="M5 14L17 4l12 10v14a2 2 0 01-2 2h-5v-9h-10v9H7a2 2 0 01-2-2V14z"
                      stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{
              fontSize: 32, fontWeight: 700, color: '#FFFFFF',
              letterSpacing: -1.2, lineHeight: 1,
            }}>OneNest</div>
            <div style={{
              fontSize: 13.5, color: '#FFFFFFCC', textAlign: 'center',
              letterSpacing: -0.1, maxWidth: 260,
            }}>
              The shared calendar for every family shape.
            </div>
          </div>
        </div>

        {/* Lower card */}
        <div style={{
          position: 'absolute', top: 300, left: 0, right: 0, bottom: 0,
          background: C.bg, borderRadius: '24px 24px 0 0',
          padding: '36px 24px 0',
        }}>
          <div style={{
            fontSize: 22, fontWeight: 600, letterSpacing: -0.7,
            color: C.ink, marginBottom: 6,
          }}>
            Welcome back
          </div>
          <div style={{ fontSize: 13, color: C.inkSec, marginBottom: 28, lineHeight: 1.5 }}>
            Sign in to your household. End-to-end encrypted. Co-parents see only what you choose to share.
          </div>

          {/* Continue with Google */}
          <SignInButton
            primary
            label="Continue with Google"
            icon={(
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.7H.9v2.34A8.99 8.99 0 009 18z" fill="#34A853"/>
                <path d="M3.97 10.71A5.41 5.41 0 013.68 9c0-.59.1-1.17.29-1.71V4.96H.9A8.99 8.99 0 000 9c0 1.45.35 2.83.96 4.04l3.01-2.33z" fill="#FBBC05"/>
                <path d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58A8.99 8.99 0 009 0 8.99 8.99 0 00.96 4.96L3.97 7.29C4.68 5.16 6.66 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
          />
          <div style={{ height: 10 }} />
          {/* Apple */}
          <SignInButton
            label="Continue with Apple"
            icon={(
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M14.34 9.51c-.02-2.06 1.68-3.04 1.75-3.09-.95-1.4-2.44-1.59-2.97-1.6-1.26-.13-2.46.75-3.1.75-.64 0-1.63-.74-2.68-.71-1.37.02-2.66.8-3.36 2.04-1.44 2.5-.37 6.18 1.04 8.21.68.99 1.5 2.1 2.58 2.07 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.6.67 2.69.65 1.12-.02 1.82-1 2.5-2 .78-1.15 1.1-2.27 1.12-2.33-.03-.01-2.14-.82-2.16-3.25M12.2 3.05c.56-.68.95-1.62.84-2.55-.81.03-1.79.54-2.38 1.22-.52.6-.98 1.55-.86 2.47.91.07 1.83-.46 2.4-1.14"
                      fill={C.ink}/>
              </svg>
            )}
          />
          <div style={{ height: 10 }} />
          <SignInButton
            label="Continue with email"
            icon={(
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2.5" y="3.5" width="13" height="11" rx="2" stroke={C.ink} strokeWidth="1.4"/>
                <path d="M2.5 4.5L9 10l6.5-5.5" stroke={C.ink} strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            )}
          />

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '24px 0 18px',
          }}>
            <div style={{ flex: 1, height: 1, background: C.hair }} />
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Have an invite?
            </span>
            <div style={{ flex: 1, height: 1, background: C.hair }} />
          </div>

          {/* Invite link helper */}
          <div style={{
            background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.accent + '15',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M8 12L12 8M9 5h5a3 3 0 010 6h-2M11 15H6a3 3 0 010-6h2"
                      stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                Open invite link
              </div>
              <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1 }}>
                From an email or text message
              </div>
            </div>
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
              <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Privacy footer */}
          <div style={{
            position: 'absolute', bottom: 36, left: 24, right: 24,
            fontSize: 11, color: C.inkMuted, textAlign: 'center', lineHeight: 1.5,
          }}>
            By continuing you agree to our{' '}
            <span style={{ color: C.ink, fontWeight: 500, textDecoration: 'underline', textDecorationColor: C.hair }}>Terms</span>
            {' '}and{' '}
            <span style={{ color: C.ink, fontWeight: 500, textDecoration: 'underline', textDecorationColor: C.hair }}>Privacy Policy</span>.
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function SignInButton({ label, icon, primary }) {
  return (
    <div style={{
      height: 50, borderRadius: 12,
      background: primary ? C.ink : C.card,
      color: primary ? (C.scheme === 'dark' ? C.ink : '#FFFFFF') : C.ink,
      border: primary ? 'none' : `0.5px solid ${C.hair}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 14.5, fontWeight: 600, letterSpacing: -0.2,
      boxShadow: primary ? 'none' : '0 1px 0 rgba(14,14,16,0.02)',
    }}>
      <div style={{
        filter: primary && C.scheme !== 'dark' ? 'brightness(0) invert(1)' : 'none',
      }}>{icon}</div>
      <span style={{ color: primary ? (C.scheme === 'dark' ? C.ink : '#FFFFFF') : C.ink }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// JOIN HOUSEHOLD — what the invitee sees after tapping an invite link
// ═══════════════════════════════════════════════════════════════════════════
function JoinHousehold({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 100 }}>

          {/* Top X — decline */}
          <div style={{
            padding: '8px 16px 24px',
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke={C.inkSec} strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          {/* Hero */}
          <div style={{ padding: '8px 28px 24px', textAlign: 'center' }}>
            <div style={{
              fontFamily: C.fontMono, fontSize: 11, color: C.accent,
              letterSpacing: 0.6, fontWeight: 600, textTransform: 'uppercase', marginBottom: 14,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', background: C.accent + '15', borderRadius: 999,
              border: `0.5px solid ${C.accent}40`,
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v3M5 6v3M1 5h3M6 5h3" stroke={C.accent} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              You&apos;ve been invited
            </div>
            <div style={{
              position: 'relative', width: 96, height: 96, margin: '0 auto 18px',
            }}>
              <div style={{ position: 'absolute', inset: 0 }}>
                <CAvatar member={cMembers.alex} size={96} />
              </div>
              {/* Tiny accent ring */}
              <div style={{
                position: 'absolute', inset: -4, borderRadius: 52,
                border: `2px solid ${C.accent}55`,
              }} />
            </div>
            <div style={{
              fontSize: 13, color: C.inkSec, marginBottom: 6,
            }}>
              <span style={{ color: C.ink, fontWeight: 600 }}>Alex Chen</span> invited you to join
            </div>
            <div style={{
              fontSize: 28, fontWeight: 600, color: C.ink,
              letterSpacing: -1, lineHeight: 1.1,
            }}>
              The Chen-Park family
            </div>
            <div style={{
              fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted,
              marginTop: 6, letterSpacing: -0.2,
            }}>
              BLENDED · 4 KIDS · ALTERNATING WEEKS
            </div>
          </div>

          {/* Family preview card */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{
                padding: '14px 14px 12px', borderBottom: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  Who&apos;s here
                </span>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted }}>4 PEOPLE · 4 KIDS</span>
              </div>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 8, letterSpacing: 0.3 }}>
                  PARENTS &amp; CAREGIVERS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CStack members={[cMembers.alex, cMembers.riley, cMembers.casey, cMembers.devon]} size={28} />
                  <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.5 }}>
                    <span style={{ color: C.ink, fontWeight: 500 }}>Alex</span>, Riley · plus Casey &amp; Devon (external co-parents)
                  </div>
                </div>
              </div>
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginBottom: 8, letterSpacing: 0.3 }}>
                  KIDS
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CStack members={[cMembers.mei, cMembers.jin, cMembers.soph, cMembers.oliver]} size={28} />
                  <div style={{ fontSize: 12, color: C.inkSec, lineHeight: 1.5 }}>
                    Mei (12), Jin (10), Soph (8), Oliver (5)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Your role picker */}
          <div style={{ padding: '0 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Join as
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <RoleOption
              title="Co-parent"
              sub="Edit everything · co-own the calendar · invite others"
              selected
            />
            <RoleOption
              title="Caregiver"
              sub="Read-only access · see schedule, get reminders · can&apos;t edit"
            />
            <RoleOption
              title="External co-parent"
              sub="Share custody for one or more kids · privacy-fenced"
            />
          </div>

          {/* Privacy note */}
          <div style={{ padding: '0 24px 18px' }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M7 1.5l5 2v4c0 2.5-2 5-5 6-3-1-5-3.5-5-6v-4l5-2z"
                      stroke={C.inkMuted} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                <path d="M4.5 7l1.5 1.5L9.5 5" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                Your personal calendar stays private. Only the times you mark as &ldquo;busy&rdquo; will
                be shared with co-parents — never titles, locations, or attendees.
              </span>
            </div>
          </div>
        </div>

        {/* Sticky CTA */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: C.bg + 'F2', backdropFilter: 'blur(20px)',
          borderTop: `0.5px solid ${C.hair}`,
          padding: '12px 16px 30px',
          display: 'flex', flexDirection: 'column', gap: 8, zIndex: 5,
        }}>
          <div style={{
            padding: '14px 14px', borderRadius: 12,
            background: C.accent, color: C.onAccent,
            fontSize: 15, fontWeight: 600, letterSpacing: -0.2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Accept invitation
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7h8M8 4l3 3-3 3" stroke={C.onAccent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            padding: '10px 14px', textAlign: 'center',
            color: C.inkSec, fontSize: 12.5, fontWeight: 500, letterSpacing: -0.1,
          }}>
            Decline invitation
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function RoleOption({ title, sub, selected }) {
  return (
    <div style={{
      background: selected ? C.accent + '15' : C.card,
      border: `${selected ? 1.5 : 0.5}px solid ${selected ? C.accent : C.hair}`,
      borderRadius: 12, padding: '14px 14px', marginBottom: 8,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
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
        <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENT CREATE FORM
// ═══════════════════════════════════════════════════════════════════════════
function EventCreate({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>

        {/* Sticky top bar */}
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
            New event
          </span>
          <span style={{
            padding: '4px 10px', borderRadius: 7,
            background: C.accent, color: C.onAccent,
            fontSize: 12.5, fontWeight: 600, letterSpacing: -0.1,
          }}>
            Save
          </span>
        </div>

        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 106, paddingBottom: 24 }}>

          {/* Title input (focused) */}
          <div style={{ padding: '14px 20px 6px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2, marginBottom: 8 }}>
              TITLE
            </div>
            <div style={{
              fontSize: 22, fontWeight: 600, color: C.ink,
              letterSpacing: -0.7, lineHeight: 1.2,
              padding: '4px 0',
              borderBottom: `1.5px solid ${C.accent}`,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span>Soccer practice</span>
              <span style={{
                width: 1.5, height: 22, background: C.accent,
                animation: 'caret 1s ease infinite',
              }} />
            </div>
          </div>

          {/* AI parse helper */}
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
                  &ldquo;soccer mei wed 4pm lincoln park&rdquo; → all fields filled
                </div>
              </div>
            </div>
          </div>

          {/* When */}
          <FormSectionLabel>When</FormSectionLabel>
          <FormGroup>
            <FormRow label="Starts" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>
                Tue May 26 · 16:00
              </span>
            } accentValue />
            <FormRow label="Ends" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 13, color: C.ink, fontWeight: 500, letterSpacing: -0.3 }}>
                Tue May 26 · 17:00
              </span>
            } />
            <FormRow label="All day" value={<FormSwitch />} />
            <FormRow label="Repeats" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.accent, fontWeight: 500, letterSpacing: -0.2 }}>
                Weekly · Tuesdays
              </span>
            } chevron last />
          </FormGroup>

          {/* Who */}
          <FormSectionLabel>Who</FormSectionLabel>
          <FormGroup>
            <div style={{ padding: '12px 14px 10px' }}>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>
                Responsible
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
                <ParentChip member={cMembers.mei} selected />
                <ParentChip member={cMembers.jin} />
                <ParentChip member={cMembers.soph} />
                <ParentChip member={cMembers.oliver} />
              </div>
            </div>
          </FormGroup>

          {/* Where */}
          <FormSectionLabel>Where</FormSectionLabel>
          <FormGroup>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 14px',
              borderBottom: `0.5px solid ${C.hair}`,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M8 0.5C5 0.5 2.5 3 2.5 6c0 4 5.5 9 5.5 9s5.5-5 5.5-9C13.5 3 11 0.5 8 0.5z"
                      stroke={C.accent} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
                <circle cx="8" cy="6" r="2" stroke={C.accent} strokeWidth="1.4"/>
              </svg>
              <span style={{ flex: 1, fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>
                Lincoln Park · Field 3
              </span>
              <span style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                padding: '2px 6px', background: C.inset, borderRadius: 4, letterSpacing: 0.3,
              }}>SAVED</span>
            </div>
            {/* Autocomplete suggestions */}
            <LocSuggestion title="Lincoln Park · Field 3" sub="Last used 5 days ago" recent />
            <LocSuggestion title="Lincoln Elementary School" sub="0.4 mi away" />
            <LocSuggestion title="Lincoln Recreation Center" sub="0.7 mi away" last />
          </FormGroup>

          {/* Attach list */}
          <FormSectionLabel>Attach</FormSectionLabel>
          <FormGroup>
            <FormRow label="To-do list" value={
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: C.mei }} />
                Soccer prep
              </span>
            } chevron />
            <FormRow label="Quick tasks" value={
              <span style={{
                fontFamily: C.fontMono, fontSize: 12, color: C.inkMuted, letterSpacing: -0.2,
              }}>
                None yet · tap to add
              </span>
            } chevron last />
          </FormGroup>

          {/* Notify */}
          <FormSectionLabel>Notifications</FormSectionLabel>
          <FormGroup>
            <FormRow label="Remind me" value={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.ink, letterSpacing: -0.2 }}>
                15 min before
              </span>
            } chevron />
            <FormRow label="Also notify Riley" value={<FormSwitch on />} last />
          </FormGroup>

          {/* Notes */}
          <FormSectionLabel>Notes</FormSectionLabel>
          <div style={{ padding: '0 16px 24px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              padding: '12px 14px', minHeight: 80,
            }}>
              <span style={{ fontSize: 13, color: C.inkMuted, letterSpacing: -0.1, lineHeight: 1.5 }}>
                Bring shin guards. Field 3 is the far one — park on Ash Street.
              </span>
            </div>
          </div>

          {/* Smart suggestion */}
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
                  We noticed soccer happens every Tuesday
                </div>
                <div style={{ fontSize: 11, color: C.inkMuted, lineHeight: 1.5 }}>
                  Want to set a 15-min reminder + automatically attach the &ldquo;Soccer prep&rdquo; list each week?
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

function FormSectionLabel({ children }) {
  return (
    <div style={{ padding: '6px 24px 6px' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  );
}

function FormGroup({ children }) {
  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div style={{
        background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
        overflow: 'hidden',
      }}>{children}</div>
    </div>
  );
}

function FormRow({ label, value, chevron, accentValue, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <span style={{ flex: 1, fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{label}</span>
      <div>{value}</div>
      {chevron && (
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function FormSwitch({ on }) {
  return (
    <div style={{
      width: 42, height: 24, borderRadius: 12,
      background: on ? C.accent : C.inkFaint + '88',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 20 : 2,
        width: 20, height: 20, borderRadius: 10, background: '#FFFFFF',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }} />
    </div>
  );
}

function ParentChip({ member, selected }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px 4px 4px', borderRadius: 999,
      background: selected ? member.color + '22' : C.card,
      border: `${selected ? 1 : 0.5}px solid ${selected ? member.color + '88' : C.hair}`,
    }}>
      <CAvatar member={member} size={20} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>{member.name}</span>
      {selected && (
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
          <path d="M3 7l3 3 5-7" stroke={C.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  );
}

function AnyoneChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px 4px 4px', borderRadius: 999,
      background: C.card, border: `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        border: `1px dashed ${C.inkFaint}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: C.fontMono, fontSize: 9, color: C.inkFaint, fontWeight: 600,
      }}>?</div>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.inkSec, letterSpacing: -0.1 }}>Anyone</span>
    </span>
  );
}

function LocSuggestion({ title, sub, recent, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, background: C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M8 0.5C5 0.5 2.5 3 2.5 6c0 4 5.5 9 5.5 9s5.5-5 5.5-9C13.5 3 11 0.5 8 0.5z"
                stroke={C.inkSec} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          <circle cx="8" cy="6" r="2" stroke={C.inkSec} strokeWidth="1.3"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{title}</div>
        <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>{sub}</div>
      </div>
      {recent && (
        <span style={{
          fontFamily: C.fontMono, fontSize: 9, color: C.accent,
          padding: '2px 6px', background: C.accent + '22',
          borderRadius: 3, fontWeight: 600, letterSpacing: 0.3,
        }}>RECENT</span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — iOS lock screen with OneNest notification stack
// ═══════════════════════════════════════════════════════════════════════════
function PushLockScreen() {
  // Stays dark by convention (iOS lock screen is dark on wake)
  // Reads accent/onAccent from charcoalForest so notification color cohesion holds.
  setActivePalette(paletteCharcoalForest);
  return (
    <IOSDevice dark={true}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, #0A0D14 0%, #1A2228 60%, #2A3530 100%)',
        fontFamily: C.fontSans, color: '#FFFFFF', overflow: 'hidden',
      }}>
        {/* Subtle ambient blobs for warmth */}
        <div style={{
          position: 'absolute', top: -80, right: -60, width: 240, height: 240,
          borderRadius: 200, background: '#3FC198', opacity: 0.10, filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: 60, left: -80, width: 220, height: 220,
          borderRadius: 200, background: '#3FC198', opacity: 0.06, filter: 'blur(40px)',
        }} />

        <div style={{ position: 'absolute', inset: 0, paddingTop: 72, paddingBottom: 60 }}>
          {/* Lock-screen big clock */}
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="6" width="8" height="6" rx="1.5" stroke="#FFFFFF" strokeWidth="1.4" fill="none"/>
                <path d="M5 6V4a2 2 0 014 0v2" stroke="#FFFFFF" strokeWidth="1.4" fill="none"/>
              </svg>
              <span style={{
                fontFamily: 'monospace', fontSize: 13, color: '#FFFFFF',
                letterSpacing: -0.2, fontWeight: 500,
              }}>Tuesday, May 26</span>
            </div>
            <div style={{
              fontSize: 88, fontWeight: 200, color: '#FFFFFF', letterSpacing: -4.5,
              lineHeight: 1, fontFamily: '"SF Pro Display", -apple-system, system-ui, sans-serif',
            }}>
              16:42
            </div>
          </div>

          {/* Live activity / widget — current hand-off countdown */}
          <div style={{ padding: '0 14px 14px' }}>
            <div style={{
              background: '#1F2128CC', backdropFilter: 'blur(20px)',
              borderRadius: 22, padding: '12px 14px',
              border: '0.5px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: '#3FC198',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 6h11l-2-2M17 14H6l2 2" stroke="#0B1310" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 1 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#3FC198', fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                    LIVE · ONENEST
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600, letterSpacing: -0.3 }}>
                  Hand-off in 18 min
                </div>
                <div style={{ fontSize: 11.5, color: '#FFFFFFAA', marginTop: 1, letterSpacing: -0.1 }}>
                  Oliver → Casey · day-care · 17:00
                </div>
              </div>
              <div style={{
                fontFamily: 'monospace', fontSize: 22, fontWeight: 500, color: '#FFFFFF', letterSpacing: -1,
              }}>0:18</div>
            </div>
          </div>

          {/* Notification stack header */}
          <div style={{
            padding: '4px 24px 8px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 10, color: '#FFFFFF99',
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
            }}>
              Notifications · 3
            </span>
            <span style={{ fontSize: 11, color: '#FFFFFF77', letterSpacing: -0.1 }}>Clear all</span>
          </div>

          {/* Notification stack */}
          <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <NotifCard
              app="OneNest" appBg="#3FC198" appFg="#0B1310" appIcon="house"
              time="now"
              title="Conflict tomorrow at 16:00"
              body="Soph's piano lesson overlaps with Mei's rehearsal — both with Alex. Tap to resolve."
              accent
            />
            <NotifCard
              app="OneNest" appBg="#3FC198" appFg="#0B1310" appIcon="house"
              time="2m ago"
              title="Devon requested a swap"
              body="Soph · Jun 8–9. Family wedding in Tahoe."
            />
            <NotifCard
              app="OneNest" appBg="#3FC198" appFg="#0B1310" appIcon="house"
              time="1h ago"
              title="Reminder · pack Oliver's bag"
              body="Hand-off to Casey tomorrow at 17:00."
            />
            {/* Stacked indicator for older items */}
            <div style={{
              background: '#1F212899', backdropFilter: 'blur(20px)',
              borderRadius: 18, padding: '8px 14px',
              border: '0.5px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transform: 'scale(0.96)',
              opacity: 0.85,
            }}>
              <span style={{ fontSize: 12, color: '#FFFFFFAA', letterSpacing: -0.1 }}>
                + 4 older notifications
              </span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 1l4 4 4-4" stroke="#FFFFFF99" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Lock screen bottom controls */}
        <div style={{
          position: 'absolute', bottom: 24, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between',
          padding: '0 28px',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v8M7 7l3-3 3 3" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <rect x="6" y="13" width="8" height="3" rx="0.5" stroke="#FFFFFF" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="6" width="14" height="10" rx="2" stroke="#FFFFFF" strokeWidth="1.6"/>
              <circle cx="9" cy="11" r="2.5" stroke="#FFFFFF" strokeWidth="1.6"/>
              <path d="M6 6V5a1 1 0 011-1h4a1 1 0 011 1v1" stroke="#FFFFFF" strokeWidth="1.6"/>
            </svg>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function NotifCard({ app, appBg, appFg, appIcon, time, title, body, accent }) {
  return (
    <div style={{
      background: '#1F2128E6', backdropFilter: 'blur(20px)',
      borderRadius: 18, padding: '11px 12px',
      border: `0.5px solid ${accent ? '#3FC19844' : 'rgba(255,255,255,0.08)'}`,
      boxShadow: accent ? '0 0 0 1px rgba(63,193,152,0.15)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5, background: appBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L6 2L10 6 M6 6V10" stroke={appFg} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: 10.5, color: '#FFFFFFCC',
          fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase',
        }}>{app}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#FFFFFF77', letterSpacing: -0.2 }}>
          {time}
        </span>
      </div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#FFFFFF',
        letterSpacing: -0.3, lineHeight: 1.25, marginBottom: 3,
      }}>{title}</div>
      <div style={{
        fontSize: 12, color: '#FFFFFFB0', lineHeight: 1.4, letterSpacing: -0.1,
      }}>{body}</div>
    </div>
  );
}

Object.assign(window, { SignIn, JoinHousehold, EventCreate, PushLockScreen });
