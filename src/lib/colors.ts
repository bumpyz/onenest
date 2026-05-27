import type { Child, HouseholdMember } from './db';

// Palette every member's color is picked from. Pulled from the redesign handoff's
// P3 Mist Forest member set — saturation-mid colors curated to be visually
// distinguishable from each other AND from CHILDREN_PALETTE's pastels, so a
// parent's color dot reads as "identity" not "background" when it sits next to
// a child badge on an event row.
//
// Stays in sync with migration 0005's default-color trigger (server side picks
// from the same array). Update both when adding new colors.
//
// Dark-mode brightening: when a member color is rendered on dark surfaces, the
// renderer should brighten ~15% per the handoff spec. That transform lives in
// display helpers, not here — these are the canonical "light mode" values
// stored in the DB.
export const PARENT_PALETTE = [
    '#5C77B5', // slate blue
    '#C77046', // warm terracotta
    '#8369A8', // heather purple
    '#3E8A6B', // forest
    '#BE7896', // dusty rose
    '#6F9DC4', // sky blue
    '#BFA168', // sand
    '#6BC0A6', // pale teal
] as const;

// Pastel siblings of the parent palette — same hue families lifted toward
// white so they read as "kid colors" against the white card surface. Distinct
// enough from PARENT_PALETTE that a child's badge can sit beside a parent's
// color block on an event without collision. Must stay in sync with migration
// 0020's default-color trigger.
export const CHILDREN_PALETTE = [
    '#A6B4DE', // soft slate blue
    '#E3A688', // soft terracotta
    '#B9A4D2', // soft heather
    '#90C1AB', // soft forest
    '#DCB1C0', // soft rose
    '#A8C4DF', // soft sky
    '#DDC9A1', // soft sand
    '#A8DDCC', // soft teal
] as const;

// Neutral gray for "no one assigned" / Anyone affordances. Pulled from Mist
// Forest's inkMuted so it harmonizes with the new palette.
export const UNASSIGNED_COLOR = '#828B85';

// Palette for task lists. Pastel and intentionally distinct from PARENT_PALETTE and
// CHILDREN_PALETTE so a list's color chip never collides with a person's color on
// surfaces where they share screen real estate (e.g. the list chip strip in the Lists
// tab). Must stay in sync with migration 0023's list_default_color trigger.
export const LIST_PALETTE = [
    '#FFD3B6', // warm peach
    '#FFAAA5', // salmon
    '#A8E6CF', // mint
    '#DCEDC1', // pale green
    '#B8E0D2', // sage
    '#E8C5E5', // dusty lilac
    '#C7CEEA', // periwinkle
    '#FFDFD3', // blush
] as const;

/** Builds a profile_id → color lookup from the per-member stored color. */
export function memberColorMap(
    members: HouseholdMember[] | null | undefined,
): Map<string, string> {
    const map = new Map<string, string>();
    if (!members) return map;
    for (const m of members) {
        if (m.color) map.set(m.profile_id, m.color);
    }
    return map;
}

/** Builds a child_id → color lookup from the per-child stored color. */
export function childColorMap(
    children: Child[] | null | undefined,
): Map<string, string> {
    const map = new Map<string, string>();
    if (!children) return map;
    for (const c of children) {
        if (c.color) map.set(c.id, c.color);
    }
    return map;
}

export function colorForResponsible(
    responsibleProfileId: string | null | undefined,
    colorMap: Map<string, string>,
): string {
    if (!responsibleProfileId) return UNASSIGNED_COLOR;
    return colorMap.get(responsibleProfileId) ?? UNASSIGNED_COLOR;
}
