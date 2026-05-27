// MemberStack — overlapping MemberAvatar row. Used in Family Hub headers,
// "Members" rows in Settings, task-assignee clusters, and anywhere a small
// group of people needs to be summarized inline ("AERCD · 4").
//
// Each avatar after the first gets `marginLeft: -5` to overlap, and a
// card-color border so it reads as distinct rather than blending into the
// neighbor. Order matters — render in the order you want them to stack
// (left-most = bottom of the visual pile, right-most = on top).

import { StyleSheet, View } from 'react-native';

import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';
import { MemberAvatar, type AvatarSize } from './member-avatar';

export type StackMember = {
    /** Display name; only the first initial is rendered. */
    name: string;
    /** Hex background color (the person's stored color). */
    color: string;
    /** Optional key for React reconciliation if the parent re-orders. */
    key?: string;
};

type Props = {
    members: StackMember[];
    size?: AvatarSize;
    /** Cap on visible avatars; surplus shows as a +N counter chip at the
     *  end. Pass 0 (default) for "render all". */
    max?: number;
};

export function MemberStack({ members, size = 'md', max = 0 }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const visible = max > 0 ? members.slice(0, max) : members;
    const overflow = max > 0 ? members.length - visible.length : 0;
    return (
        <View style={styles.row}>
            {visible.map((m, i) => (
                <View
                    key={m.key ?? `${m.name}-${i}`}
                    style={[styles.cell, i > 0 && styles.overlap]}>
                    <MemberAvatar
                        name={m.name}
                        color={m.color}
                        size={size}
                        // White rim on every avatar so overlap is legible.
                        borderColor={colors.backgroundElement}
                    />
                </View>
            ))}
            {overflow > 0 ? (
                <View
                    style={[styles.cell, styles.overlap, styles.overflowChip, {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.backgroundElement,
                    }]}>
                    {/* Plain +N text — mono numeral per the design spec. */}
                    <_OverflowText count={overflow} />
                </View>
            ) : null}
        </View>
    );
}

// Tiny inline helper so MemberStack stays a single export.
function _OverflowText({ count }: { count: number }) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View>
            <View style={styles.overflowTextWrap}>
                {/* Using View+Text directly here keeps the avatar tooling minimal.
                    fontFamily must be set explicitly — RN's <Text> doesn't
                    inherit it, so without monoSemiBold this would render the
                    "+N" overflow numeral in the platform system sans. */}
                <RawText style={{
                    color: colors.textSecondary,
                    fontFamily: FontFamily.monoSemiBold,
                    fontSize: 10,
                    // fontWeight: '600' matches the monoSemiBold family. Was '700'
                    // which RN can't compose against a single-weight family.
                    fontWeight: '600',
                }}>
                    +{count}
                </RawText>
            </View>
        </View>
    );
}

// RawText helper — keeps the import surface narrow.
import { Text as RawText } from 'react-native';

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cell: {},
    overlap: {
        marginLeft: -5,
    },
    overflowChip: {
        // Match avatar geometry — same circle, with a number instead of an initial.
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    overflowTextWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
