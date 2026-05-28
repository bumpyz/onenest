// Design-system barrel — the redesign's foundation components live here.
// Import via `@/components/ds` for any screen porting to the Mist/Charcoal
// Forest visual vocabulary.
//
// Phase 1B set:
//   • SectionHeader  — caps + mono + tracking, used above grouped content
//   • MemberAvatar   — colored circle with initial (per-person identity)
//   • MemberStack    — overlapping avatar row with overflow chip
//   • Chip           — pill filter / toggle with optional dot + active state
//   • MonoTime       — 2-line mono time column for event rows
//   • HairlineDivider — 0.5px line between rows in a card
//   • TintedCard     — card with optional accent-tinted background + leading rail
//
// Phase 11 detail-screen set (lifted from task/[id] for cross-reuse):
//   • SGroup     — caps label + white card wrapper
//   • SRow       — single label/value row with optional chevron + onPress
//   • StatusPill — mono-caps hero pill with tinted bg matching label color
//
// Later phases add: QuickActionPill, StatusBadge, KindIcon, etc. — add to the
// barrel as they ship.

export { SectionHeader } from './section-header';
export { MemberAvatar, type AvatarSize } from './member-avatar';
export { MemberStack, type StackMember } from './member-stack';
export { Chip } from './chip';
export { MonoTime } from './mono-time';
export { HairlineDivider } from './hairline-divider';
export { TintedCard } from './tinted-card';
export { SGroup } from './sgroup';
export { SRow } from './s-row';
export { StatusPill } from './status-pill';
export { ActionSheet } from './action-sheet';
export { SheetShell } from './sheet-shell';
// TaskRow — single primitive for task rows in card-grouped lists.
// Used by Lists (with swipe + cross-list pills) and Home/Today (visual
// base only). Lifted out of lists.tsx so both surfaces share one shape.
export { TaskRow, relativeDueLabel, type TaskRowMember } from './task-row';
// Event/form primitives — caps-mono section label + rounded-12 card.
// Lifted out of event-form.tsx so EventDetail (read view) + EventCreate
// (form) can share one source of truth.
export { FormSectionLabel } from './form-section-label';
export { FormGroup } from './form-group';
// Person/Anyone chips — avatar+name pill used in Responsible/For pickers
// (form) AND in read-mode Who/For rows (detail). Member-color tinted
// when selected.
export { PersonChip, AnyoneChip } from './person-chip';
// LocationSuggestionRow — vertical list row used in EventCreate's Where
// section. Replaces the prior horizontal name-only chip strip with the
// spec's icon-tile + title + address-sub + RECENT/SAVED tag pattern.
export { LocationSuggestionRow } from './location-suggestion-row';
// DetailRow — mono-label / value-right read-only row used inside detail
// screens (EventDetail's Who / For / Location / etc.). Sister primitive
// to SRow but with a tabular vocabulary (mono label vs sentence-case).
export { DetailRow } from './detail-row';
// MiniCalendar — 6×7 month grid used inside field-edit sheets (Due,
// EventWhen, etc.). Lifted out of DuePickerSheet so every date-picker
// sheet shares the same visual + a11y vocabulary (#406).
export { MiniCalendar } from './mini-calendar';

// ── Creation flow v2 primitives (#436) ──────────────────────────────
// Shared scaffold for every Create surface (Event / Task / List /
// Contact / AddChild / NewOverride). One vocabulary across all six.
// Reference: docs/design-handoffs/onenest-spec-v1/design_handoff_creation_flows/.
export { CreateTopBar } from './create-top-bar';
export { TitleInput } from './title-input';
export { AIHelper } from './ai-helper';
export { FormRow } from './form-row';
export { FormSwitch } from './form-switch';
export { ColorSwatch } from './color-swatch';
export { SegRow } from './seg-row';
export { DashedAddChip } from './dashed-add-chip';
export { HealthChip } from './health-chip';
export { ListTagChip } from './list-tag-chip';
export { TmplRow } from './tmpl-row';
export { CIRow } from './ci-row';
export { TextInputSheet } from './text-input-sheet';
export { DateTimePickerSheet } from './date-time-picker-sheet';
// DatePickerSheet — date-only picker that mounts MiniCalendar directly
// in the sheet body. Use this when you want the calendar to BE the
// sheet (no intermediate "Pick a date" trigger button + secondary modal
// hop). The override editor uses it for From/To.
export { DatePickerSheet } from './date-picker-sheet';
export { RepeatsPickerSheet } from './repeats-picker-sheet';

// ── Lists v2 (FAB rule spec v2, design_handoff_fab_rule) ─────────────
// Horizontal-scroll list cards on the Lists tab. ListCardV2 carries the
// per-list summary (color top-bar + name + owner + counts + progress);
// NewListCard is the trailing dashed "+ New list" affordance in the
// same row.
export { ListCardV2, NewListCard, type ListCardV2Child } from './list-card-v2';

// ── Strip variants (design_handoff_strip_variants, #397/#398) ─────────
// Read-only/per-kid POV reshapes of CustodyStripToday. RoleBadge also
// expected to land in Members/Family Hub people rows once #404 ports
// the EXT tag treatment app-wide.
export { RoleBadge, type RoleBadgeKind } from './role-badge';
export { KidPOVHeader } from './kid-pov-header';
export { DashedBusyBlockRow } from './dashed-busy-block-row';

// ── NewOverride primitives (design 06.3, #494) ────────────────────────
// Editor for custody overrides — full multi-section surface replacing
// the legacy /custody/[date] stub. Phase D consumes these.
export { KindChip, type KindChipIcon } from './kind-chip';
export { KidCheckRow } from './kid-check-row';
export { CaregiverPickRow } from './caregiver-pick-row';
export { DateRangeBoxes } from './date-range-boxes';
export { PresetChip } from './preset-chip';
export {
    OverridePreviewBar,
    type PreviewDay,
} from './override-preview-bar';
export {
    ApprovalBanner,
    type ApprovalApprover,
} from './approval-banner';
