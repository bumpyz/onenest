// screens-task-edit.jsx — TaskDetail v2 + bottom-sheet edit pattern
//
// Answers a set of design questions from Claude Code about how the task
// detail screen handles edits. Decisions:
//
//   • Each field caret on the Details rows opens a bottom-sheet picker
//     instead of pushing to a separate /edit route.
//   • The /edit catch-all route goes away. Every field has a focused sheet.
//   • Title becomes inline-editable — tap the title, the row becomes a
//     text input with a caret. No pencil icon in the hero.
//   • Priority gets its own Details row (and an in-line sheet); the HIGH
//     PRIORITY hero pill is read-only status display.
//   • Lists / Children: each chip is read-only; tapping any chip OR the
//     "+ Add" affordance opens the same multi-select sheet.
//   • Notes stays as its own SGroup with tap-to-edit (inline textarea).
//   • The top-bar kebab (•••) opens TaskOverflowSheet — task-level actions
//     that don't fit on the sticky action bar (Share, Duplicate, Convert
//     to event, Move, Pin, Print, Delete).

// ─── primitives ────────────────────────────────────────────────────────────

function TaskTopBar({ palette }) {
  return (
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
  );
}

// Sheet shell — opaque card with handle + title row + close button.
function SheetShell({ title, sub, children, height = 460, primary, secondary }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      background: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      borderTop: `0.5px solid ${C.hair}`,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
      zIndex: 20, height,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Drag handle */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.inkFaint }} />
      </div>

      {/* Title row */}
      <div style={{
        padding: '10px 16px 8px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
        borderBottom: `0.5px solid ${C.hair}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.ink, letterSpacing: -0.3 }}>
            {title}
          </div>
          {sub && (
            <div style={{ fontSize: 11.5, color: C.inkMuted, marginTop: 2, lineHeight: 1.4 }}>
              {sub}
            </div>
          )}
        </div>
        <div style={{
          width: 28, height: 28, borderRadius: 14, background: C.inset,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1l-8 8" stroke={C.inkSec} strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
        {children}
      </div>

      {/* Footer */}
      {(primary || secondary) && (
        <div style={{
          padding: '10px 16px 28px',
          borderTop: `0.5px solid ${C.hair}`,
          display: 'flex', gap: 8,
        }}>
          {secondary && (
            <div style={{
              flex: '0 0 auto', padding: '11px 14px', borderRadius: 10,
              background: C.inset, border: `0.5px solid ${C.hair}`, color: C.ink,
              fontSize: 13, fontWeight: 600, letterSpacing: -0.2,
            }}>{secondary}</div>
          )}
          {primary && (
            <div style={{
              flex: 1, padding: '12px 14px', borderRadius: 10,
              background: C.accent, color: C.onAccent,
              fontSize: 14, fontWeight: 600, letterSpacing: -0.2, textAlign: 'center',
            }}>{primary}</div>
          )}
        </div>
      )}
    </div>
  );
}

// Backdrop renders the dimmed underlying screen
function SheetBackdrop({ children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(0,0,0,0.42)',
      backdropFilter: 'blur(2px)',
    }}>{children}</div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK DETAIL V2
// ═══════════════════════════════════════════════════════════════════════════
function TaskDetailV2({ palette = paletteMistForest, editingTitle = false }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 100 }}>

          <TaskTopBar palette={palette} />

          {/* Title + checkbox + status pills */}
          <div style={{ padding: '8px 24px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0, marginTop: 4,
                border: `1.5px solid ${C.accent}`, background: 'transparent',
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingTitle ? (
                  <div style={{
                    padding: '6px 10px', marginLeft: -10, borderRadius: 8,
                    background: C.inset, border: `1.2px solid ${C.accent}`,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{
                      fontSize: 22, fontWeight: 600, color: C.ink,
                      letterSpacing: -0.7, lineHeight: 1.25,
                    }}>Pack Theo&apos;s overnight bag for Casey&apos;s</span>
                    <span style={{
                      width: 2, height: 24, background: C.accent,
                      animation: 'blink 1s steps(2) infinite',
                    }} />
                  </div>
                ) : (
                  <div style={{
                    fontSize: 22, fontWeight: 600, color: C.ink,
                    letterSpacing: -0.7, lineHeight: 1.25,
                  }}>Pack Theo&apos;s overnight bag for Casey&apos;s</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: C.alert + '22', color: C.alert,
                    fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 600, letterSpacing: -0.1,
                  }}>DUE TONIGHT · 21:00</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 9px', borderRadius: 999,
                    background: C.accent + '22', color: C.accent,
                    fontFamily: C.fontMono, fontSize: 10.5, fontWeight: 600, letterSpacing: -0.1,
                  }}>HIGH PRIORITY</span>
                </div>
                {!editingTitle && (
                  <div style={{
                    marginTop: 6, fontFamily: C.fontMono, fontSize: 10,
                    color: C.inkMuted, letterSpacing: -0.1,
                  }}>
                    Tap title to rename · ••• for more
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details — now includes Priority */}
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
            } chevron />
            <SRow label="Priority" right={
              <span style={{ fontFamily: C.fontMono, fontSize: 12, color: C.accent, fontWeight: 600, letterSpacing: -0.2 }}>
                High
              </span>
            } chevron last />
          </SGroup>

          {/* For whom — children chips */}
          <SGroup label="For · 1">
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ForChip member={cMembers.oliver} />
              <AddChip />
            </div>
          </SGroup>

          {/* Linked event */}
          <SGroup label="Linked event">
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
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

          {/* In lists */}
          <SGroup label="In lists · 2">
            <div style={{ padding: '12px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ListChip color="#E5613D" label="House" />
              <ListChip color={C.casey} label="Co-parents" />
              <AddChip />
            </div>
          </SGroup>

          {/* Notes — inline editable; in the static mock shows the read state */}
          <SGroup label="Notes">
            <div style={{
              padding: '12px 14px',
              fontSize: 13, color: C.inkSec, lineHeight: 1.55,
              position: 'relative',
            }}>
              Pack: 2 outfits, PJs, lovie, &ldquo;Frog and Toad&rdquo; book, EpiPen + meds chart, lunchbox.
              Casey said no need to send sheets — they have a set.
              <div style={{
                position: 'absolute', top: 10, right: 12,
                fontFamily: C.fontMono, fontSize: 9.5, color: C.inkMuted,
                padding: '2px 6px', background: C.inset, borderRadius: 4,
                letterSpacing: 0.3, fontWeight: 600, textTransform: 'uppercase',
              }}>Tap to edit</div>
            </div>
          </SGroup>

          {/* History */}
          <div style={{ padding: '12px 24px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              History
            </span>
          </div>
          <div style={{ padding: '0 16px 18px' }}>
            <div style={{ background: C.card, borderRadius: 12, border: `0.5px solid ${C.hair}` }}>
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

function ForChip({ member }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 4px', borderRadius: 999,
      background: member.color + '22', border: `0.5px solid ${member.color}55`,
    }}>
      <CAvatar member={member} size={18} />
      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>For {member.name}</span>
    </span>
  );
}

function ListChip({ color, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 9px 4px 8px', borderRadius: 999,
      background: color + '22', border: `0.5px solid ${color}55`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 11.5, fontWeight: 600, color: C.ink, letterSpacing: -0.1 }}>{label}</span>
    </span>
  );
}

function AddChip() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px', borderRadius: 999,
      background: 'transparent', border: `0.5px dashed ${C.inkFaint}`,
      color: C.inkMuted, fontFamily: C.fontMono, fontSize: 11, letterSpacing: -0.1,
    }}>+ Edit</span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK OVERFLOW SHEET — the destination for the ••• kebab in the top bar
// ═══════════════════════════════════════════════════════════════════════════
function TaskOverflowSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        {/* underlying screen — dimmed silhouette so the sheet reads as modal */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
        }}>
          <TaskDetailV2 palette={palette} />
        </div>

        <SheetBackdrop>
          <SheetShell
            title="Pack Theo's overnight bag"
            sub="Task actions"
            height={540}
            secondary="Cancel"
          >
            {/* Primary actions group */}
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <OverflowRow icon="share" label="Share task" sub="Copy link · message · email" />
              <OverflowRow icon="duplicate" label="Duplicate" sub="Make a copy with all fields" />
              <OverflowRow icon="convert" label="Convert to event" sub="Promote to calendar with a time block" />
              <OverflowRow icon="move" label="Move to another list" sub="Reassigns lists in one step" />
              <OverflowRow icon="pin" label="Pin to top of list" last />
            </div>

            {/* Secondary group */}
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`,
              overflow: 'hidden', marginBottom: 14,
            }}>
              <OverflowRow icon="archive" label="Archive without completing" sub="Hide from active views; keep in history" />
              <OverflowRow icon="export" label="Export as PDF" last />
            </div>

            {/* Destructive */}
            <div style={{
              background: C.inset, borderRadius: 12, border: `0.5px solid ${C.alert}33`,
              overflow: 'hidden',
            }}>
              <OverflowRow icon="trash" label="Delete task" sub="Removes for everyone · cannot be undone" danger last />
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function OverflowRow({ icon, label, sub, danger, last }) {
  const iconColor = danger ? C.alert : C.ink;
  const icons = {
    share: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8M8 2l-3 3M8 2l3 3M3 9v4a1 1 0 001 1h8a1 1 0 001-1V9" stroke={iconColor} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    duplicate: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2.5" y="2.5" width="9" height="9" rx="1.5" stroke={iconColor} strokeWidth="1.3"/>
        <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" stroke={iconColor} strokeWidth="1.3" fill={C.inset}/>
      </svg>
    ),
    convert: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke={iconColor} strokeWidth="1.3"/>
        <path d="M2 6h12M5 1.5v3M11 1.5v3" stroke={iconColor} strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M9 10l-2 2-1-1" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    move: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h7M2 12h5" stroke={iconColor} strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M11 11l2 1-2 1m2-1H9" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    pin: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2L6 6h-2l3 3-3 5 5-3 3 3 0-2 -4-4 4-2-4-4z" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
    archive: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="3" rx="1" stroke={iconColor} strokeWidth="1.3"/>
        <path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6M6 9h4" stroke={iconColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    export: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke={iconColor} strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M8 7v5M6 10l2 2 2-2" stroke={C.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    trash: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M5 4v-1a1 1 0 011-1h4a1 1 0 011 1v1M4 4l1 9a1 1 0 001 1h4a1 1 0 001-1l1-9" stroke={iconColor} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
        background: danger ? C.alert + '14' : C.card, border: `0.5px solid ${C.hair}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icons[icon]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: danger ? C.alert : C.ink, letterSpacing: -0.2,
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
// FIELD-EDIT SHEETS — one artboard per kind, plus a survey
// ═══════════════════════════════════════════════════════════════════════════

function DueDateSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Due"
            sub="Tonight · 21:00 (set 1h ago)"
            height={580}
            primary="Save · Tonight 21:00"
            secondary="Clear"
          >
            {/* Quick presets */}
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
            }}>Quick presets</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              <DueChip label="Today · 21:00" sub="In 4 hours" selected />
              <DueChip label="Tomorrow · 09:00" />
              <DueChip label="This weekend" sub="Sat 10:00" />
              <DueChip label="Next week" sub="Mon 09:00" />
              <DueChip label="No due date" muted />
              <DueChip label="Custom…" muted />
            </div>

            {/* Calendar preview */}
            <div style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
            }}>Date · May 2026</div>
            <MiniCalendar />

            {/* Time picker */}
            <div style={{
              marginTop: 14,
              fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted,
              letterSpacing: 0.4, fontWeight: 600, textTransform: 'uppercase', marginBottom: 8,
            }}>Time</div>
            <div style={{
              padding: '10px 12px', borderRadius: 10,
              background: C.inset, border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{
                fontFamily: C.fontMono, fontSize: 28, fontWeight: 600, color: C.ink, letterSpacing: -1,
              }}>21:00</span>
              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                {['18:00', '19:00', '20:00', '21:00'].map(t => (
                  <div key={t} style={{
                    padding: '4px 8px', borderRadius: 6,
                    background: t === '21:00' ? C.accent : C.card,
                    color: t === '21:00' ? C.onAccent : C.inkSec,
                    border: t === '21:00' ? 'none' : `0.5px solid ${C.hair}`,
                    fontFamily: C.fontMono, fontSize: 11, fontWeight: 600, letterSpacing: -0.1,
                  }}>{t}</div>
                ))}
              </div>
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function DueChip({ label, sub, selected, muted }) {
  return (
    <div style={{
      padding: '10px 11px', borderRadius: 10,
      background: selected ? C.accent + '14' : C.inset,
      border: `${selected ? 1.2 : 0.5}px solid ${selected ? C.accent : C.hair}`,
    }}>
      <div style={{
        fontSize: 12.5, fontWeight: 600, letterSpacing: -0.2,
        color: muted ? C.inkMuted : C.ink,
      }}>{label}</div>
      {sub && <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, marginTop: 2, letterSpacing: -0.1 }}>{sub}</div>}
    </div>
  );
}

function MiniCalendar() {
  // Just enough to read as a 5-week mini grid with day 27 selected
  return (
    <div style={{
      padding: 10, borderRadius: 10, background: C.inset, border: `0.5px solid ${C.hair}`,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3,
        fontFamily: C.fontMono, fontSize: 9, color: C.inkMuted, letterSpacing: -0.2,
        textAlign: 'center', marginBottom: 4,
      }}>
        {['S','M','T','W','Th','F','Sa'].map(d => <span key={d}>{d}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {Array.from({ length: 31 }).map((_, i) => {
          const d = i + 1;
          const selected = d === 27;
          const today = d === 25;
          return (
            <div key={d} style={{
              padding: '6px 0', borderRadius: 6, textAlign: 'center',
              background: selected ? C.accent : 'transparent',
              border: today && !selected ? `1px solid ${C.accent}` : 'none',
              fontFamily: C.fontMono, fontSize: 11,
              color: selected ? C.onAccent : (today ? C.accent : C.ink),
              fontWeight: selected || today ? 600 : 500, letterSpacing: -0.2,
            }}>{d}</div>
          );
        })}
      </div>
    </div>
  );
}

function AssignSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const people = ['alex', 'riley', 'casey', 'devon'];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Assign to"
            sub="One person owns each task"
            height={500}
            primary="Save · Alex"
            secondary="Unassign"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {people.map((k, i) => {
                const m = cMembers[k];
                const selected = k === 'alex';
                const isYou = k === 'alex';
                return (
                  <div key={k} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    background: selected ? C.accent + '0e' : 'transparent',
                    borderBottom: i === people.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                  }}>
                    <CAvatar member={m} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                        {m.name}{isYou ? ' (you)' : ''}
                      </div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                        {k === 'alex' ? '3 active tasks · last active 2m' :
                         k === 'riley' ? '5 active tasks · last active 3h' :
                         k === 'casey' ? 'External · 1 shared task' :
                         'External · 0 shared tasks'}
                      </div>
                    </div>
                    <div style={{
                      width: 22, height: 22, borderRadius: 11,
                      border: `1.5px solid ${selected ? C.accent : C.inkFaint}`,
                      background: selected ? C.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {selected && (
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
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              border: `0.5px dashed ${C.hair}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 12, background: C.inset,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: C.fontMono, fontSize: 14, color: C.inkMuted, lineHeight: 1 }}>?</span>
              </div>
              <div style={{ flex: 1, fontSize: 11.5, color: C.inkSec, lineHeight: 1.4 }}>
                <b style={{ fontWeight: 600 }}>Auto-assign</b> — based on who&apos;s with the kid at the due time
              </div>
              <div style={{
                width: 36, height: 22, borderRadius: 11,
                background: C.inkFaint + '88', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 2, left: 2,
                  width: 18, height: 18, borderRadius: 9, background: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                }} />
              </div>
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function ReminderSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const opts = [
    { label: 'Off', sub: 'No reminder' },
    { label: 'At due time', sub: '21:00' },
    { label: '5 min before', sub: '20:55' },
    { label: '15 min before', sub: '20:45' },
    { label: '30 min before', sub: '20:30', selected: true },
    { label: '1 hour before', sub: '20:00' },
    { label: '2 hours before', sub: '19:00' },
    { label: 'Custom…', sub: 'Pick exact time' },
  ];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Reminder"
            sub="When should we ping you?"
            height={560}
            primary="Save · 30 min before"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {opts.map((o, i) => (
                <div key={o.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: o.selected ? C.accent + '0e' : 'transparent',
                  borderBottom: i === opts.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{o.label}</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>{o.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    border: `1.5px solid ${o.selected ? C.accent : C.inkFaint}`,
                    background: o.selected ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {o.selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function RecurringSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const opts = [
    { label: 'One-time', sub: 'No repeat', selected: true },
    { label: 'Daily', sub: 'Every day' },
    { label: 'Weekdays', sub: 'Mon–Fri' },
    { label: 'Weekly', sub: 'Every Wed' },
    { label: 'Bi-weekly', sub: 'Every other Wed · matches custody' },
    { label: 'Monthly', sub: 'On the 27th' },
    { label: 'Custom…', sub: 'Pick days, interval, end' },
  ];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Repeats"
            sub="The new instance inherits notes, lists, and priority."
            height={560}
            primary="Save · One-time"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden', marginBottom: 12 }}>
              {opts.map((o, i) => (
                <div key={o.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: o.selected ? C.accent + '0e' : 'transparent',
                  borderBottom: i === opts.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{o.label}</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 11, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>{o.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    border: `1.5px solid ${o.selected ? C.accent : C.inkFaint}`,
                    background: o.selected ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {o.selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function PrioritySheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const opts = [
    { label: 'None',   sub: 'No priority indicator',    color: C.inkFaint },
    { label: 'Low',    sub: 'Nice to have',             color: C.devon },
    { label: 'Normal', sub: 'Default',                   color: C.alex },
    { label: 'High',   sub: 'Surfaces above Normal',     color: C.accent, selected: true },
    { label: 'Urgent', sub: 'Surfaces above everything', color: C.alert },
  ];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="Priority"
            sub="Sorts above other tasks in lists and the Today view."
            height={460}
            primary="Save · High"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {opts.map((o, i) => (
                <div key={o.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: o.selected ? C.accent + '0e' : 'transparent',
                  borderBottom: i === opts.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: o.color + '22',
                    border: `0.5px solid ${o.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {o.label === 'None' ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5" stroke={o.color} strokeWidth="1.3" strokeDasharray="2 2"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 12V3l4 3 4-3v9" stroke={o.color} strokeWidth="1.4" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: C.inkMuted, marginTop: 1, lineHeight: 1.4 }}>{o.sub}</div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 10,
                    border: `1.5px solid ${o.selected ? C.accent : C.inkFaint}`,
                    background: o.selected ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {o.selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function ListsSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const lists = [
    { name: 'House',       color: '#E5613D', selected: true, count: 12 },
    { name: 'Co-parents',  color: C.casey,   selected: true, count: 6 },
    { name: 'Grocery',     color: '#3E8A6B', count: 8 },
    { name: 'School',      color: C.alex,    count: 14 },
    { name: 'Doctor',      color: C.mei,     count: 3 },
    { name: 'Holiday prep',color: C.warn,    count: 5 },
  ];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="In lists"
            sub="Tasks can live in multiple lists. Uncheck to remove."
            height={580}
            primary="Save · 2 selected"
          >
            {/* Search */}
            <div style={{
              padding: '9px 12px', borderRadius: 10,
              background: C.inset, border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="6" cy="6" r="4" stroke={C.inkMuted} strokeWidth="1.3"/>
                <path d="M9 9l3.5 3.5" stroke={C.inkMuted} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1, fontFamily: C.fontMono, fontSize: 12, color: C.inkFaint, letterSpacing: -0.2 }}>
                Search lists…
              </div>
              <span style={{
                fontFamily: C.fontMono, fontSize: 9.5, color: C.accent,
                padding: '2px 6px', background: C.accent + '14', borderRadius: 4,
                fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase',
              }}>+ New</span>
            </div>

            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {lists.map((l, i) => (
                <div key={l.name} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px',
                  background: l.selected ? C.accent + '0e' : 'transparent',
                  borderBottom: i === lists.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, background: l.color + '33',
                    border: `0.5px solid ${l.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: l.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, letterSpacing: -0.2 }}>{l.name}</div>
                    <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                      {l.count} tasks
                    </div>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: 5,
                    border: `1.5px solid ${l.selected ? C.accent : C.inkFaint}`,
                    background: l.selected ? C.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {l.selected && (
                      <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}

function ChildrenSheet({ palette = paletteMistForest }) {
  setActivePalette(palette);
  const dark = palette.scheme === 'dark';
  const kids = ['mei', 'jin', 'soph', 'oliver'];
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}>
          <TaskDetailV2 palette={palette} />
        </div>
        <SheetBackdrop>
          <SheetShell
            title="For whom"
            sub="External co-parents see the task only for kids they share."
            height={500}
            primary="Save · Oliver"
          >
            <div style={{ background: C.inset, borderRadius: 12, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              {kids.map((k, i) => {
                const m = cMembers[k];
                const selected = k === 'oliver';
                return (
                  <div key={k} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px',
                    background: selected ? C.accent + '0e' : 'transparent',
                    borderBottom: i === kids.length - 1 ? 'none' : `0.5px solid ${C.hair}`,
                  }}>
                    <CAvatar member={m} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
                        {m.name}
                      </div>
                      <div style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, marginTop: 1, letterSpacing: -0.2 }}>
                        {k === 'oliver' ? '5 yrs · Kindergarten · with Casey this week' :
                         k === 'soph'   ? '8 yrs · 3rd grade · with Devon this week' :
                         k === 'jin'    ? '10 yrs · 5th grade' :
                         '12 yrs · 7th grade'}
                      </div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: 5,
                      border: `1.5px solid ${selected ? C.accent : C.inkFaint}`,
                      background: selected ? C.accent : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {selected && (
                        <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5L8.5 2" stroke={C.onAccent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SheetShell>
        </SheetBackdrop>
      </div>
    </IOSDevice>
  );
}
