// screens-settings.jsx — Settings sub-routes
// New screens requested by Claude Code:
//   • Members — invite (form + role chips + pending) + member list w/ remove affordance
//   • Profile — display name + my color picker (reached from hero avatar tap)
//   • Appearance — theme picker + accent + compact density (sub-route)
//   • SettingsV2 — updated main settings with back carrot, slim read-only hero,
//                  Members nav row replacing invite hero, Appearance row replacing
//                  the inline appearance group
//
// Helpers are namespaced with `Sub` prefix to avoid colliding with the original
// SGroup/SRow/etc in screens-extra.jsx (babel script scopes are shared globally).

// ─── primitives ────────────────────────────────────────────────────────────

function SubTopBar({ title, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 16px 10px',
      borderBottom: `0.5px solid ${C.hair}`,
      background: C.bg,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: C.card, border: `0.5px solid ${C.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
          <path d="M7 1L1 7l6 6" stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{
        fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: -0.3,
      }}>{title}</div>
      <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {right || null}
      </div>
    </div>
  );
}

function SubGroup({ label, subLabel, accessory, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {(label || accessory) && (
        <div style={{
          padding: '0 24px 8px',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <div>
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
          {accessory}
        </div>
      )}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`,
          overflow: 'hidden',
        }}>{children}</div>
      </div>
    </div>
  );
}

function SubRow({ label, right, chevron, last, sub, danger, onSurface }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, letterSpacing: -0.2,
          color: danger ? C.alert : C.ink,
        }}>{label}</div>
        {sub && (
          <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
        )}
      </div>
      {right !== undefined && <div>{right}</div>}
      {chevron && (
        <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M1 1l6 6-6 6" stroke={C.inkFaint} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

function SubToggle({ label, sub, on, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: C.ink, fontWeight: 500, letterSpacing: -0.2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
      </div>
      <div style={{
        width: 42, height: 24, borderRadius: 12,
        background: on ? C.accent : C.inkFaint + '88',
        position: 'relative', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 20, height: 20, borderRadius: 10, background: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18), 0 1px 1px rgba(0,0,0,0.06)',
        }} />
      </div>
    </div>
  );
}

function SubRolePill({ label, color }) {
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

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS V2 — back carrot, slimmer hero, nav rows for Members + Appearance
// ═══════════════════════════════════════════════════════════════════════════
function SettingsV2({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflowY: 'auto', paddingBottom: 80 }}>

          <SubTopBar title="Settings" />

          <div style={{ padding: '14px 20px 10px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              SIGNED IN AS ALEX@CHENPARK.COM
            </div>
          </div>

          {/* Hero — read-only summary + edit chevron, taps to /settings/profile */}
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 14, display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <CAvatar member={cMembers.alex} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: -0.3 }}>Alex Chen</div>
                <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                  alex@chenpark.com
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                  <SubRolePill label="Parent" color={C.alex} />
                  <SubRolePill label="Admin" color={C.accent} />
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                padding: '6px 10px', borderRadius: 8,
                border: `0.5px solid ${C.hair}`, background: C.inset,
              }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Edit
                </span>
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                  <path d="M1 1l6 6-6 6" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Household — now includes Members as a nav row (was a read-only row + a dashed invite hero) */}
          <SubGroup label="Household">
            <SubRow label="Name" right={<MonoRight text="Chen-Park" />} chevron />
            <SubRow label="Family type" right={<MonoRight text="Blended" />} chevron />
            <SubRow label="Members" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CStack members={[cMembers.alex, cMembers.riley, cMembers.casey, cMembers.devon]} size={18} />
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>4 · 2 pending</span>
              </div>
            } chevron />
            <SubRow label="Children" right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CStack members={[cMembers.mei, cMembers.jin, cMembers.soph, cMembers.oliver]} size={18} />
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>4</span>
              </div>
            } chevron />
            <SubRow label="Custody schedule" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.accent, fontWeight: 500, letterSpacing: -0.2 }}>
                Alternating weeks
              </span>
            } chevron last />
          </SubGroup>

          {/* Notifications */}
          <SubGroup label="Notifications">
            <SubToggle label="Weekly digest" sub="Sunday at 7pm · conflicts, unassigned, hand-offs" on />
            <SubToggle label="Task reminders" sub="15 min before · custom per task" on />
            <SubToggle label="Hand-off reminders" sub="2 hours before custody changes" on />
            <SubToggle label="Conflict alerts" sub="When new events overlap your schedule" on />
            <SubToggle label="Activity from co-parents" sub="When Casey or Devon adds an event" last />
          </SubGroup>

          {/* Connected calendars — keep parity with the old screen */}
          <SubGroup
            label="Connected calendars"
            subLabel="Only busy times sync — never titles, locations, or attendees"
          >
            <SCalendarRow provider="google" email="alex@chenpark.com" status="connected" lastSync="2 min ago" />
            <SCalendarRow provider="microsoft" email="—" status="add" last />
          </SubGroup>

          {/* Appearance — collapsed to single nav row; details live in /settings/appearance */}
          <SubGroup label="Appearance">
            <SubRow
              label="Theme & accent"
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, background: C.accent,
                    border: `0.5px solid ${C.hair}`, flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2 }}>
                    {palette.name}
                  </span>
                </div>
              }
              chevron
            />
            <SubRow label="Compact density" right={<MonoRight text="Comfortable" />} chevron last />
          </SubGroup>

          {/* AI & privacy */}
          <SubGroup label="AI assistant">
            <SubToggle label="Inline parse bar" sub='Type "soccer Wed 4pm" → event' on />
            <SubToggle label="Smart suggestions" sub="Conflicts, recurring patterns, delegation" on />
            <SubToggle label="Activity summaries" sub="Weekly recap on Sunday" />
            <SubRow label="What can the AI see?" chevron last />
          </SubGroup>

          {/* About */}
          <SubGroup label="About">
            <SubRow label="Help & feedback" chevron />
            <SubRow label="Privacy policy" chevron />
            <SubRow label="Terms of service" chevron />
            <SubRow label="Version" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>
                2.4.1 · 9b3f8a2
              </span>
            } last />
          </SubGroup>

          {/* Danger */}
          <div style={{ padding: '8px 16px 24px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 14px', color: C.alert, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
                textAlign: 'center', borderBottom: `0.5px solid ${C.hair}`,
              }}>Sign out</div>
              <div style={{
                padding: '14px 14px', color: C.alert, fontSize: 13, letterSpacing: -0.2,
                textAlign: 'center', opacity: 0.8,
              }}>Delete account</div>
            </div>
          </div>

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

function MonoRight({ text }) {
  return (
    <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.inkSec, fontWeight: 500, letterSpacing: -0.2 }}>
      {text}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MEMBERS — invite (form + role chips + pending) + member list w/ remove
// ═══════════════════════════════════════════════════════════════════════════
function MembersScreen({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflowY: 'auto', paddingBottom: 40 }}>

          <SubTopBar title="Members" />

          {/* Header summary */}
          <div style={{ padding: '14px 20px 6px' }}>
            <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              CHEN-PARK · 4 ACTIVE · 2 PENDING
            </div>
            <div style={{ fontSize: 13, color: C.inkSec, marginTop: 4, lineHeight: 1.4 }}>
              People who can see and edit your family&apos;s plans. Co-parents and external co-parents see the schedule;
              caregivers only see what&apos;s assigned to them.
            </div>
          </div>

          {/* Invite form */}
          <div style={{ padding: '14px 16px 18px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{
                padding: '12px 14px 8px',
                borderBottom: `0.5px solid ${C.hair}`,
              }}>
                <div style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                  letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
                  marginBottom: 8,
                }}>Invite someone</div>

                {/* Email / phone input */}
                <div style={{
                  background: C.inset, borderRadius: 10, border: `0.5px solid ${C.hair}`,
                  padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke={C.inkMuted} strokeWidth="1.3"/>
                    <path d="M2 4l6 5 6-5" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <div style={{ flex: 1, fontFamily: C.fontMono, fontSize: 12.5, color: C.ink, letterSpacing: -0.2 }}>
                    casey@example.com
                  </div>
                  <span style={{
                    width: 1.5, height: 14, background: C.accent, animation: 'blink 1s steps(2) infinite',
                  }} />
                </div>
              </div>

              {/* Role chips */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                  letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase',
                  marginBottom: 8,
                }}>Role</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <RoleChip
                    label="Co-parent"
                    desc="Full access · can edit anything"
                    icon="parent"
                    selected={false}
                  />
                  <RoleChip
                    label="External co-parent"
                    desc="Sees the schedule across both homes · separated families"
                    icon="external"
                    selected={true}
                  />
                  <RoleChip
                    label="Caregiver"
                    desc="Read-only · only what's assigned to them"
                    icon="caregiver"
                    selected={false}
                  />
                </div>
              </div>

              {/* Send button */}
              <div style={{ padding: '0 14px 14px' }}>
                <div style={{
                  background: C.accent, borderRadius: 10,
                  padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8l12-6-4 14-3-6-5-2z" stroke={C.onAccent} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
                  </svg>
                  <span style={{ color: C.onAccent, fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
                    Send private invite link
                  </span>
                </div>
                <div style={{
                  marginTop: 8, fontSize: 11, color: C.inkMuted, lineHeight: 1.4, textAlign: 'center',
                }}>
                  They&apos;ll get an email · link expires in 7 days · you can revoke anytime
                </div>
              </div>
            </div>
          </div>

          {/* Pending */}
          <SubGroup
            label="Pending · 2"
            accessory={
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                EXPIRES IN
              </span>
            }
          >
            <PendingRow
              email="nina.alvarez@gmail.com"
              role="Caregiver"
              roleColor={C.devon}
              sent="Sent 2 days ago"
              expires="5d"
            />
            <PendingRow
              email="devon@harperlane.net"
              role="External co-parent"
              roleColor={C.casey}
              sent="Sent 4 hours ago · 2 reminders"
              expires="6d 20h"
              last
            />
          </SubGroup>

          {/* Members */}
          <SubGroup
            label="Members · 4"
            accessory={
              <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                JOINED
              </span>
            }
          >
            <MemberRow
              member={cMembers.alex} role="Parent · Admin" roleColor={C.alex}
              meta="You · alex@chenpark.com" joined="Apr 2024"
              you
            />
            <MemberRow
              member={cMembers.riley} role="Parent" roleColor={C.riley}
              meta="riley@chenpark.com · active 3h ago" joined="Apr 2024"
            />
            <MemberRow
              member={cMembers.casey} role="External co-parent" roleColor={C.casey}
              meta="casey@harborline.com · Oliver&apos;s other parent" joined="May 2024"
              external
            />
            <MemberRow
              member={cMembers.devon} role="External co-parent" roleColor={C.devon}
              meta="devon@harperlane.net · Soph&apos;s other parent" joined="Jun 2024"
              external last
            />
          </SubGroup>

          {/* Help footer */}
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{
              padding: 14, borderRadius: 12, border: `0.5px dashed ${C.hair}`,
              fontSize: 11.5, color: C.inkMuted, lineHeight: 1.5,
            }}>
              <b style={{ color: C.inkSec, fontWeight: 600 }}>What members can see.</b> Co-parents see everything across
              all kids. External co-parents see only the children you share, never the kids from your other relationship.
              Caregivers see only what&apos;s assigned to them.
              <div style={{ marginTop: 8 }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                  Learn more →
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

function RoleChip({ label, desc, icon, selected }) {
  const icons = {
    parent: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="6" r="3" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4"/>
        <path d="M3.5 16c0-3 3-5 6.5-5s6.5 2 6.5 5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    external: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <circle cx="6.5" cy="7" r="2.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4"/>
        <circle cx="13.5" cy="7" r="2.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4"/>
        <path d="M2 17c0-2.5 2-4 4.5-4M18 17c0-2.5-2-4-4.5-4" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M9 13.5l2-1m0 0l-2-1m2 1H5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
      </svg>
    ),
    caregiver: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="6" r="2.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4"/>
        <path d="M5 16c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M14 4l1.5 1.5L19 2" stroke={selected ? C.accent : C.inkSec} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 11px', borderRadius: 10,
      background: selected ? C.accent + '14' : 'transparent',
      border: `${selected ? 1.2 : 0.5}px solid ${selected ? C.accent : C.hair}`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: selected ? C.accent + '22' : C.inset,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icons[icon]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
        }}>{label}</div>
        <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <div style={{
        width: 18, height: 18, borderRadius: 9,
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

function PendingRow({ email, role, roleColor, sent, expires, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999,
        border: `1.2px dashed ${roleColor + '99'}`,
        background: roleColor + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 6l5 4 5-4M3 5h10v7H3z" stroke={roleColor} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: C.fontMono, fontSize: 12.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{email}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <SubRolePill label={role} color={roleColor} />
          <span style={{ fontSize: 10.5, color: C.inkMuted, letterSpacing: -0.1 }}>{sent}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2 }}>{expires}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{
            padding: '3px 7px', borderRadius: 6,
            border: `0.5px solid ${C.hair}`, background: C.inset,
            fontFamily: C.fontMono, fontSize: 9.5, color: C.accent, fontWeight: 600, letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}>Resend</div>
          <div style={{
            padding: '3px 7px', borderRadius: 6,
            border: `0.5px solid ${C.hair}`, background: C.inset,
            fontFamily: C.fontMono, fontSize: 9.5, color: C.alert, fontWeight: 600, letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}>Cancel</div>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member, role, roleColor, meta, joined, you, external, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px',
      borderBottom: last ? 'none' : `0.5px solid ${C.hair}`,
    }}>
      <CAvatar member={member} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
            {member.name}{you ? ' (you)' : ''}
          </span>
          {external && (
            <span style={{
              fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted,
              padding: '1px 5px', background: C.inset, borderRadius: 3,
              fontWeight: 600, letterSpacing: 0.3,
            }}>EXT</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <SubRolePill label={role} color={roleColor} />
        </div>
        <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkFaint, marginTop: 4, letterSpacing: -0.2 }}>
          {meta}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
          {joined}
        </span>
        {you ? (
          <span style={{
            fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: 0.3,
            padding: '2px 6px', borderRadius: 4, background: C.inset,
            fontWeight: 600, textTransform: 'uppercase',
          }}>You</span>
        ) : (
          <div style={{
            width: 24, height: 24, borderRadius: 6,
            border: `0.5px solid ${C.hair}`, background: C.inset,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="3" viewBox="0 0 12 3" fill="none">
              <circle cx="1.5" cy="1.5" r="1.2" fill={C.inkSec}/>
              <circle cx="6" cy="1.5" r="1.2" fill={C.inkSec}/>
              <circle cx="10.5" cy="1.5" r="1.2" fill={C.inkSec}/>
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE — display name + my color (reached via hero avatar tap)
// ═══════════════════════════════════════════════════════════════════════════
function ProfileEdit({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  // Color palette options — the 8 identity slots from the current theme,
  // ordered so they read as a satisfying spectrum.
  const colors = [
    { key: 'alex',   c: C.alex,   label: 'Indigo' },
    { key: 'jin',    c: C.jin,    label: 'Sky' },
    { key: 'devon',  c: C.devon,  label: 'Forest' },
    { key: 'oliver', c: C.oliver, label: 'Mint' },
    { key: 'soph',   c: C.soph,   label: 'Wheat' },
    { key: 'riley',  c: C.riley,  label: 'Rust' },
    { key: 'mei',    c: C.mei,    label: 'Rose' },
    { key: 'casey',  c: C.casey,  label: 'Lilac' },
  ];
  const selectedColor = C.alex;

  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflowY: 'auto', paddingBottom: 40 }}>

          <SubTopBar
            title="Profile"
            right={
              <span style={{
                fontFamily: C.fontMono, fontSize: 11, color: C.accent, fontWeight: 600,
                letterSpacing: 0.3, textTransform: 'uppercase',
              }}>Done</span>
            }
          />

          {/* Avatar preview hero */}
          <div style={{
            padding: '24px 20px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 96, height: 96, borderRadius: 999,
                background: selectedColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: dark ? `0 0 0 4px ${C.bg}, 0 0 0 5px ${selectedColor}44`
                                : `0 0 0 4px ${C.bg}, 0 0 0 5px ${selectedColor}44, 0 6px 24px ${selectedColor}33`,
              }}>
                <span style={{
                  fontFamily: C.fontSans, fontSize: 36, fontWeight: 600,
                  color: '#FFFFFF', letterSpacing: -1,
                }}>A</span>
              </div>
              <div style={{
                position: 'absolute', right: -2, bottom: -2,
                width: 28, height: 28, borderRadius: 14,
                background: C.card, border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 12V14h2L13 5l-2-2L2 12z" stroke={C.ink} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                </svg>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: C.fontMono, letterSpacing: -0.1 }}>
              Tap to upload photo
            </div>
          </div>

          {/* Display name */}
          <SubGroup label="Display name" subLabel="How you appear to others in Chen-Park.">
            <div style={{ padding: '12px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 12px', borderRadius: 10,
                background: C.inset, border: `1.2px solid ${C.accent}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>
                  Alex Chen
                </span>
                <span style={{
                  width: 1.5, height: 16, background: C.accent,
                  animation: 'blink 1s steps(2) infinite',
                }} />
                <div style={{ flex: 1 }} />
                <span style={{
                  fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.1,
                }}>9 / 40</span>
              </div>
            </div>
          </SubGroup>

          {/* My color */}
          <SubGroup
            label="My color"
            subLabel="Used on your events, hand-offs and chips across the family. Each person picks a distinct color."
          >
            <div style={{ padding: '14px 14px 12px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
              }}>
                {colors.map(({ key, c, label }) => {
                  const selected = c === selectedColor;
                  const takenBy =
                    key === 'riley' ? 'Riley' :
                    key === 'casey' ? 'Casey' :
                    key === 'devon' ? 'Devon' :
                    key === 'mei'   ? 'Mei'   :
                    key === 'jin'   ? 'Jin'   :
                    key === 'soph'  ? 'Soph'  :
                    key === 'oliver'? 'Oliver': null;
                  const isMine = key === 'alex';
                  return (
                    <div key={key} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      opacity: takenBy && !isMine ? 0.45 : 1,
                    }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: c, position: 'relative',
                        boxShadow: selected ? `0 0 0 2px ${C.bg}, 0 0 0 4px ${c}` : 'none',
                        border: !selected ? `0.5px solid ${C.hair}` : 'none',
                      }}>
                        {selected && (
                          <svg width="22" height="22" viewBox="0 0 22 22" style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                          }} fill="none">
                            <path d="M5 11l4 4 8-8" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {takenBy && !isMine && (
                          <div style={{
                            position: 'absolute', bottom: -3, right: -3,
                            background: C.card, borderRadius: 999,
                            border: `0.5px solid ${C.hair}`,
                            padding: 2,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <CAvatar member={cMembers[key]} size={14} />
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: 0.1,
                        textTransform: 'uppercase', fontWeight: 600,
                      }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop: 14, padding: '8px 10px', borderRadius: 8,
                background: C.accent + '14',
                fontSize: 11, color: C.inkSec, lineHeight: 1.4,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="7" cy="7" r="5.5" stroke={C.accent} strokeWidth="1.3"/>
                  <path d="M7 4v3M7 9.5v.5" stroke={C.accent} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span>Greyed-out swatches are claimed by other members. Pick a different color to keep things readable on shared views.</span>
              </div>
            </div>
          </SubGroup>

          {/* Account */}
          <SubGroup label="Account">
            <SubRow label="Email" right={<MonoRight text="alex@chenpark.com" />} chevron />
            <SubRow label="Phone" right={<MonoRight text="+1 (415) 555-0142" />} chevron />
            <SubRow label="Time zone" right={<MonoRight text="America / Los Angeles" />} chevron last />
          </SubGroup>

          {/* Danger */}
          <div style={{ padding: '8px 16px 24px' }}>
            <div style={{
              background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 14px', color: C.alert, fontSize: 14, fontWeight: 600, letterSpacing: -0.2,
                textAlign: 'center',
              }}>Sign out of OneNest</div>
            </div>
          </div>
        </div>
      </div>
    </IOSDevice>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEARANCE — theme + accent + compact density
// ═══════════════════════════════════════════════════════════════════════════
function AppearanceScreen({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, bottom: 0, overflowY: 'auto', paddingBottom: 40 }}>

          <SubTopBar title="Appearance" />

          {/* Preview card */}
          <div style={{ padding: '18px 16px 22px' }}>
            <div style={{
              background: C.card, borderRadius: 14, border: `0.5px solid ${C.hair}`,
              padding: 14, overflow: 'hidden', position: 'relative',
              boxShadow: dark ? 'none' : '0 1px 0 rgba(14,14,16,0.03), 0 4px 16px rgba(14,14,16,0.04)',
            }}>
              <div style={{
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: 0.4,
                fontWeight: 600, textTransform: 'uppercase',
              }}>Preview</div>
              <div style={{
                marginTop: 10, padding: 12, borderRadius: 10,
                background: C.inset, border: `0.5px solid ${C.hair}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 4, height: 30, borderRadius: 2, background: C.accent }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                      Soph&apos;s piano lesson
                    </div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, letterSpacing: -0.2 }}>
                      Wed · 16:00 · with Mrs. Anderson
                    </div>
                  </div>
                  <div style={{
                    padding: '2px 7px', borderRadius: 999,
                    background: C.accent, color: C.onAccent,
                    fontFamily: C.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
                  }}>NOW</div>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  paddingTop: 8, borderTop: `0.5px solid ${C.hair}`,
                }}>
                  <CAvatar member={cMembers.soph} size={18} />
                  <span style={{ fontSize: 11, color: C.inkSec, letterSpacing: -0.1 }}>For Soph</span>
                  <span style={{ marginLeft: 'auto', fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: -0.1 }}>
                    OPEN →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Theme */}
          <SubGroup label="Theme">
            <div style={{ padding: '14px 14px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <ThemeOption mode="light" selected={!dark} />
                <ThemeOption mode="dark" selected={dark} />
                <ThemeOption mode="system" />
              </div>
            </div>
          </SubGroup>

          {/* Accent */}
          <SubGroup
            label="Accent"
            accessory={
              <span style={{
                fontFamily: C.fontMono, fontSize: 11, color: C.inkSec, letterSpacing: -0.2,
              }}>{palette.name}</span>
            }
          >
            <div style={{ padding: '14px 14px 8px' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <PaletteSwatch name="Mist Forest" colors={[C.accent, '#A0CFB8']} selected={palette === paletteMistForest || palette === paletteCharcoalForest} />
                <PaletteSwatch name="Slate Coral" colors={['#E5613D', '#F2A98B']} />
                <PaletteSwatch name="Bell Navy" colors={['#E8A04F', '#1F2940']} />
                <PaletteSwatch name="Charcoal" colors={['#FF7B52', '#15171B']} />
              </div>
              <div style={{
                marginTop: 14,
                fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
                letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
              }}>Per-element accent</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <AccentSwatch color={C.accent} selected />
                <AccentSwatch color="#E5613D" />
                <AccentSwatch color="#E8A04F" />
                <AccentSwatch color="#5667D4" />
                <AccentSwatch color="#8369A8" />
                <AccentSwatch color="#C5392E" />
              </div>
            </div>
          </SubGroup>

          {/* Density */}
          <SubGroup label="Density" subLabel="Comfortable spaces out rows for easy tapping; Compact fits more on screen.">
            <div style={{ padding: '12px 14px' }}>
              <div style={{
                display: 'flex', gap: 6, padding: 3,
                background: C.inset, borderRadius: 10,
                border: `0.5px solid ${C.hair}`,
              }}>
                <DensityChoice label="Comfortable" sub="Default" selected />
                <DensityChoice label="Compact" sub="-20% height" />
              </div>
            </div>
            <SubToggle
              label="Reduce motion"
              sub="Disable transitions and parallax across the app"
            />
            <SubToggle
              label="Show monospace metadata"
              sub="Times, IDs and counters in Geist Mono (recommended)"
              on last
            />
          </SubGroup>

          {/* Type scale */}
          <SubGroup label="Text size">
            <div style={{ padding: '14px 14px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, letterSpacing: -0.2 }}>Aa</span>
                <span style={{ fontFamily: C.fontMono, fontSize: 11, color: C.accent, letterSpacing: -0.2, fontWeight: 600 }}>
                  Default · 100%
                </span>
                <span style={{ fontFamily: C.fontSans, fontSize: 16, color: C.inkSec, fontWeight: 500 }}>Aa</span>
              </div>
              <div style={{
                position: 'relative', height: 24, display: 'flex', alignItems: 'center',
              }}>
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
                  background: C.inset, border: `0.5px solid ${C.hair}`,
                }} />
                <div style={{
                  position: 'absolute', left: 0, height: 4, borderRadius: 2,
                  width: '40%', background: C.accent,
                }} />
                <div style={{
                  position: 'absolute', left: 'calc(40% - 10px)', top: 2,
                  width: 20, height: 20, borderRadius: 10,
                  background: C.card, border: `1.5px solid ${C.accent}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                }} />
                {[0, 25, 50, 75, 100].map(p => (
                  <div key={p} style={{
                    position: 'absolute', left: `calc(${p}% - 0.5px)`, top: 18,
                    width: 1, height: 3, background: C.inkFaint,
                  }} />
                ))}
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 4,
                fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, letterSpacing: -0.1,
              }}>
                <span>S</span><span>M</span><span>L</span><span>XL</span><span>XXL</span>
              </div>
            </div>
          </SubGroup>
        </div>
      </div>
    </IOSDevice>
  );
}

function PaletteSwatch({ name, colors, selected }) {
  return (
    <div style={{
      flex: '1 1 calc(50% - 5px)', minWidth: 0,
      padding: 10, borderRadius: 10,
      border: `${selected ? 1.5 : 0.5}px solid ${selected ? C.accent : C.hair}`,
      background: selected ? C.accent + '0e' : C.inset,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ display: 'flex', gap: -4, position: 'relative' }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999, background: colors[0],
          border: `1.5px solid ${C.card}`, position: 'relative', zIndex: 2,
        }} />
        <div style={{
          width: 22, height: 22, borderRadius: 999, background: colors[1],
          border: `1.5px solid ${C.card}`, marginLeft: -8, zIndex: 1,
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{name}</div>
      </div>
      {selected && (
        <div style={{
          width: 14, height: 14, borderRadius: 7, background: C.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function DensityChoice({ label, sub, selected }) {
  return (
    <div style={{
      flex: 1, padding: '9px 10px', borderRadius: 8,
      background: selected ? C.card : 'transparent',
      border: selected ? `0.5px solid ${C.hair}` : 'none',
      boxShadow: selected ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: selected ? C.ink : C.inkSec, letterSpacing: -0.2 }}>
        {label}
      </div>
      <div style={{
        fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.1,
      }}>{sub}</div>
    </div>
  );
}
