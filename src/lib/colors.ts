import type { Child, HouseholdMember } from './db';

// The palette every member's color is picked from. Stays in sync with migration 0005's
// default-color trigger (it uses the same array on the server side) — keep these in lockstep
// when adding new colors.

export const PARENT_PALETTE = [
    '#208AEF', // blue
    '#E94B6A', // rose
    '#F2A93C', // amber
    '#5BBE91', // green
    '#A678D6', // purple
    '#3FAFD6', // cyan
    '#D6803F', // burnt orange
    '#7CB342', // lime
] as const;

// Pastel palette for children — intentionally a different visual family from PARENT_PALETTE
// so a child's badge can sit beside a parent's color block on an event without collision.
// Must stay in sync with migration 0020's default-color trigger (same hex literals on the
// server side).
export const CHILDREN_PALETTE = [
    '#F4A6C0', // soft pink
    '#A8DEC5', // mint
    '#A8C9E8', // sky
    '#C9B0E0', // lavender
    '#F4B895', // peach
    '#F2D88B', // buttercup
    '#F2A088', // coral
    '#A0D8CC', // pale teal
] as const;

export const UNASSIGNED_COLOR = '#9CA3AF'; // grey

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
