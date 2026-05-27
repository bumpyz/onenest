// screens-lists-v2.jsx — Lists tab with FAB + tappable list cards
//
// Two gaps in the existing ProLists:
//   1. No FAB (every other tab has one — ProHome, ProCalendar, FamilyHub).
//   2. No way to navigate to the List detail screen (05.2). The chips at
//      the top of ProLists are filters that scope the task stream below;
//      they don't navigate.
//
// ProListsV2 keeps the task-stream view intact and adds:
//   • Horizontal scrolling "Your lists" row above the chips — each card
//     shows the list's color, name, owner kid, task count, and progress.
//     Tap a card → opens List detail.
//   • The same accent FAB that exists on Home/Calendar/Family.
//
// Filter chips stay because they have a different job. The task stream
// below is a cross-list inbox view (Overdue / Today / This week); the
// chips scope which lists feed that stream. Cards = navigation, chips =
// filter. Different intents, different affordances.

function ProListsV2({ palette = paletteMistForest }) {
  C = palette;
  const dark = palette.scheme === 'dark';
  return (
    <IOSDevice dark={dark}>
      <div style={{ position: 'absolute', inset: 0, background: C.bg, fontFamily: C.fontSans, color: C.ink, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: 54, paddingBottom: 88 }}>

          {/* Header */}
          <div style={{
            padding: '12px 20px 6px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
                6 LISTS · 12 OPEN · 3 OVERDUE
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, marginTop: 1 }}>Lists</div>
            </div>
            <div style={{
              width: 30, height: 30, borderRadius: 8, background: C.card,
              border: `0.5px solid ${C.hair}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{CIcon.search()}</div>
          </div>

          {/* Cmd-K add row */}
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

          {/* YOUR LISTS — horizontal scroll of cards (navigation) */}
          <div style={{
            padding: '4px 20px 6px',
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Your lists · 6
            </span>
            <span style={{
              fontFamily: C.fontMono, fontSize: 10, color: C.accent, fontWeight: 600, letterSpacing: -0.1,
            }}>+ NEW LIST</span>
          </div>
          <div style={{
            display: 'flex', gap: 10, padding: '4px 16px 14px',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            <ListCardV2 color="#E5613D"   name="House"       owner="Shared"        open={5}  done={12} progress={0.71} />
            <ListCardV2 color={C.casey}   name="Co-parents"  owner="Alex + Riley"  open={6}  done={9}  progress={0.60} />
            <ListCardV2 color={C.mei}     name="Kids · Mei"  owner="For Mei"       open={3}  done={8}  progress={0.73} ownerAvatar={cMembers.mei} />
            <ListCardV2 color={C.riley}   name="Errands"     owner="Anyone"        open={4}  done={6}  progress={0.60} />
            <ListCardV2 color={C.jin}     name="School"      owner="For Jin"       open={2}  done={5}  progress={0.71} ownerAvatar={cMembers.jin} />
            <ListCardV2 color="#3E8A6B"   name="Grocery"     owner="Shared"        open={8}  done={3}  progress={0.27} />
            {/* + New list card */}
            <div style={{
              flexShrink: 0, width: 116, padding: 12, borderRadius: 12,
              border: `0.5px dashed ${C.inkFaint}`, background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, minHeight: 116,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                background: C.inset, border: `0.5px solid ${C.hair}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{CIcon.plus(C.inkMuted)}</div>
              <span style={{ fontFamily: C.fontMono, fontSize: 10.5, color: C.inkMuted, letterSpacing: -0.1 }}>
                New list
              </span>
            </div>
          </div>

          {/* Filter chips — kept, but their job is now explicit */}
          <div style={{ padding: '0 20px 6px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.inkSec, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Tasks · filtered
            </span>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <CChip label="All · 12" active />
            <CChip label="House" dot={C.alex} />
            <CChip label="Kids" dot={C.mei} />
            <CChip label="Errands" dot={C.riley} />
            <CChip label="School" dot={C.jin} />
            <CChip label="Co-parents" dot={C.casey} />
          </div>

          {/* Overdue */}
          <CGroupHeader label="Overdue" count={3} accent={C.alert} />
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              <CTask title="Sign Soph's field-trip slip" who={cMembers.alex} due="-2d" overdue list={['School']} listC={[C.jin]} />
              <CTask title="Confirm summer-camp deposit · Mei" who={cMembers.riley} due="-1d" overdue list={['Kids']} listC={[C.mei]} />
              <CTask title="Reply to Casey on Oliver pickup" who={cMembers.alex} due="-1d" overdue list={['Co-parents']} listC={[C.casey]} last />
            </div>
          </div>

          {/* Today */}
          <CGroupHeader label="Today" count={4} />
          <div style={{ padding: '0 16px' }}>
            <div style={{ background: C.card, borderRadius: 10, border: `0.5px solid ${C.hair}`, overflow: 'hidden' }}>
              <CSwipedTask />
              <CTask title="Order Jin's retainer cleaner" who={cMembers.riley} due="today" list={['Errands']} listC={[C.riley]} />
              <CTask title="Pack Oliver's bag for Casey" who={cMembers.alex} due="by 17:00" list={['Co-parents','Kids']} listC={[C.casey, C.mei]} />
              <CTask title="Pickup dry-cleaning" anyone due="today" list={['Errands']} listC={[C.riley]} last />
            </div>
          </div>

          {/* This week */}
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
        </div>

        {/* FAB — matches Home / Calendar / Family */}
        <div style={{
          position: 'absolute', right: 16, bottom: 96,
          height: 44, padding: '0 16px', borderRadius: 22, background: C.accent,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 6px 16px rgba(14,14,16,0.18)', zIndex: 6,
        }}>
          {CIcon.plus(C.onAccent)}
          <span style={{ color: C.onAccent, fontSize: 13, fontWeight: 600, letterSpacing: -0.2 }}>
            New task
          </span>
        </div>

        <CBottomNav active="lists" />
      </div>
    </IOSDevice>
  );
}

function ListCardV2({ color, name, owner, open, done, progress, ownerAvatar }) {
  return (
    <div style={{
      flexShrink: 0, width: 156, padding: 12, borderRadius: 12,
      background: C.card, border: `0.5px solid ${C.hair}`,
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 0 rgba(14,14,16,0.02)',
    }}>
      {/* Header — color dot + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: C.ink, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</span>
      </div>

      {/* Owner row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 16 }}>
        {ownerAvatar ? (
          <>
            <CAvatar member={ownerAvatar} size={14} />
            <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
              {owner}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.2 }}>
            {owner}
          </span>
        )}
      </div>

      {/* Count row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: C.fontMono, fontSize: 18, fontWeight: 600, color: C.ink, letterSpacing: -0.7 }}>
          {open}
        </span>
        <span style={{ fontFamily: C.fontMono, fontSize: 10, color: C.inkMuted, letterSpacing: -0.1 }}>
          open · {done} done
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3, borderRadius: 2, background: C.inset, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${Math.round(progress * 100)}%`,
          background: color, borderRadius: 2,
        }} />
      </div>
    </div>
  );
}
