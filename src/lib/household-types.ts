import type { HouseholdType } from './db';

export type HouseholdTypeOption = {
    id: HouseholdType;
    label: string;
    description: string;
};

export const HOUSEHOLD_TYPE_OPTIONS: ReadonlyArray<HouseholdTypeOption> = [
    {
        id: 'single_parent',
        label: 'Just me + my kids',
        description:
            'Single parent. Custody schedule and co-parent invites are hidden.',
    },
    {
        id: 'couple',
        label: 'My partner and me',
        description:
            'Couple raising kids together. You can invite your partner; custody is hidden.',
    },
    {
        id: 'separated',
        label: 'Separated co-parents',
        description:
            'Co-parenting across two households. Custody schedule and co-parent invites are both shown.',
    },
];

export function labelForHouseholdType(t: HouseholdType): string {
    return HOUSEHOLD_TYPE_OPTIONS.find((o) => o.id === t)?.label ?? t;
}
