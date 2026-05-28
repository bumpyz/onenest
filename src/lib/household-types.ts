import type { HouseholdType } from './db';

/**
 * Per-option display metadata for the household-type picker in the Phase 9
 * onboarding redesign (#296). `iconKind` keys into the FamilyOption icon
 * map in the create-household screen — keeping the icon vocabulary
 * centralized means future re-skins (e.g. swapping single-parent's roof
 * silhouette) only touch the option array.
 *
 * Labels were rewritten for the redesign so they describe what the
 * household IS rather than what the user wants. "Blended family" is
 * covered by `couple` — a couple raising kids together, some of whom
 * may have external co-parents (handled at the per-kid level, not at
 * the household-type level).
 */
export type HouseholdTypeOption = {
    id: HouseholdType;
    label: string;
    description: string;
    /** Maps to the icon component in create-household.tsx's FamilyOption. */
    iconKind: 'single' | 'couple' | 'separated';
};

export const HOUSEHOLD_TYPE_OPTIONS: ReadonlyArray<HouseholdTypeOption> = [
    {
        id: 'separated',
        label: 'Separated co-parents',
        description: 'Two homes, custody schedule',
        iconKind: 'separated',
    },
    {
        id: 'couple',
        label: 'Two parents, one home',
        description: 'Shared events, optional external co-parents per kid',
        iconKind: 'couple',
    },
    {
        id: 'single_parent',
        label: 'Single parent',
        description: 'One home, no custody schedule',
        iconKind: 'single',
    },
];

export function labelForHouseholdType(t: HouseholdType): string {
    return HOUSEHOLD_TYPE_OPTIONS.find((o) => o.id === t)?.label ?? t;
}
