import type { HouseholdMember } from './db';

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

export const UNASSIGNED_COLOR = '#9CA3AF'; // grey

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

export function colorForResponsible(
    responsibleProfileId: string | null | undefined,
    colorMap: Map<string, string>,
): string {
    if (!responsibleProfileId) return UNASSIGNED_COLOR;
    return colorMap.get(responsibleProfileId) ?? UNASSIGNED_COLOR;
}
