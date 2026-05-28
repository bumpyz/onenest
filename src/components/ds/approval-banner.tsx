// ApprovalBanner — warn-tinted card surfaced in NewOverride when the
// override scopes touch a kid that has an external co-parent. Tells
// the user the override will be sent for approval, names the
// approver, and shows a tiny avatar card + "PENDING ON SAVE" chip so
// the consequence is impossible to miss.
//
// Design source: screens-custody.jsx approval block (~lines 1282-1318).

import { StyleSheet, View } from 'react-native';

import { MemberAvatar } from './member-avatar';
import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

export type ApprovalApprover = {
    profileId: string;
    name: string;
    color: string;
    /** Mono-styled sub line — e.g. "Soph's other parent · typically
     *  responds in 4h". Caller-supplied so the banner stays a dumb
     *  presentation component. */
    sub: string;
};

export function ApprovalBanner({
    body,
    approvers,
    footnote,
}: {
    /** Free-text body that explains the why. The spec uses inline
     *  bolding for the approver names; this prop is plain text and
     *  the banner doesn't bold. Wrap names in <b> tags via the body
     *  string only if you've pre-rendered them as ThemedText
     *  children — easier to keep plain. */
    body: string;
    /** One row per external co-parent who must decide. Usually 1; the
     *  spec example renders only Devon, but blended families can
     *  legitimately have multiple. */
    approvers: ReadonlyArray<ApprovalApprover>;
    /** Optional footnote — explains who ISN'T affected (the spec
     *  shows "Casey isn't affected (Oliver's default…)"). */
    footnote?: string;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: withAlpha(colors.warn, 0x12 / 255),
                    borderColor: withAlpha(colors.warn, 0x55 / 255),
                },
            ]}>
            <ThemedText
                style={[
                    styles.heading,
                    {
                        color: colors.warn,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                NEEDS CO-PARENT APPROVAL
            </ThemedText>
            <ThemedText
                style={[styles.body, { color: colors.text }]}>
                {body}
            </ThemedText>
            <View style={styles.approverList}>
                {approvers.map((a) => (
                    <View
                        key={a.profileId}
                        style={[
                            styles.approverRow,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        <MemberAvatar
                            name={a.name}
                            color={a.color}
                            size="md"
                        />
                        <View style={styles.approverBody}>
                            <ThemedText
                                style={[
                                    styles.approverName,
                                    { color: colors.text },
                                ]}
                                numberOfLines={1}>
                                {a.name}
                            </ThemedText>
                            <ThemedText
                                style={[
                                    styles.approverSub,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoMedium,
                                    },
                                ]}
                                numberOfLines={1}>
                                {a.sub}
                            </ThemedText>
                        </View>
                        <View
                            style={[
                                styles.statusChip,
                                {
                                    backgroundColor: withAlpha(
                                        colors.warn,
                                        0x18 / 255,
                                    ),
                                },
                            ]}>
                            <ThemedText
                                style={[
                                    styles.statusChipText,
                                    {
                                        color: colors.warn,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                PENDING ON SAVE
                            </ThemedText>
                        </View>
                    </View>
                ))}
            </View>
            {footnote ? (
                <ThemedText
                    style={[
                        styles.footnote,
                        { color: colors.inkSec },
                    ]}>
                    {footnote}
                </ThemedText>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        gap: 10,
    },
    heading: {
        fontSize: 10,
        letterSpacing: 0.4,
        fontWeight: '700',
    },
    body: {
        fontSize: 13,
        lineHeight: 19,
        letterSpacing: -0.2,
    },
    approverList: {
        gap: 8,
    },
    approverRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
    },
    approverBody: { flex: 1, minWidth: 0 },
    approverName: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    approverSub: {
        fontSize: 10.5,
        marginTop: 1,
        letterSpacing: -0.2,
    },
    statusChip: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 4,
    },
    statusChipText: {
        fontSize: 9.5,
        letterSpacing: 0.3,
        fontWeight: '700',
    },
    footnote: {
        fontSize: 11.5,
        lineHeight: 16,
        letterSpacing: -0.1,
    },
});
