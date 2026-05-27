// RoleBadge — small mono-caps badge that signals what role the current
// viewer is reading a surface as. Three kinds today:
//
//   • viewing — eye glyph + "VIEWING" caps. Used on read-only strip
//     variants (#397 caregiver, #398 external co-parent) so the user
//     understands the surface is informational, not editable.
//   • care    — "CARE" caps with a tiny dot. Surfaces a caregiver in
//     people lists (Family Hub, Members, Settings) so siblings know
//     who's babysitting tonight without reading the role label.
//   • ext     — "EXT" caps with a dashed dot. Surfaces an external
//     co-parent in the same lists. Dashed pairs with the dashed
//     busy-block row's vocabulary ("this is from outside the
//     household"); makes the EXT chip feel like a member of the same
//     visual family.
//
// Visual spec from `design_handoff_strip_variants/screens-custody-
// variants.jsx::ViewingBadge` (~line 107). The mono caps + tracking +
// inset background + hairline border is the design's go-to "this is
// metadata about who's reading, not the data itself" treatment. Reused
// here for the cross-surface "EXT" and "CARE" tags too (#404 follow-up).

import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export type RoleBadgeKind = 'viewing' | 'care' | 'ext';

export function RoleBadge({ kind }: { kind: RoleBadgeKind }) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const label =
        kind === 'viewing' ? 'Viewing' : kind === 'care' ? 'Care' : 'Ext';
    const glyphColor = colors.inkSec;

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: colors.backgroundInset,
                    borderColor: colors.hair,
                },
            ]}>
            {kind === 'viewing' ? (
                // Feather's "eye" — matches the design source's inline
                // SVG semantically (the lens + pupil outline) at the
                // codebase-standard icon scale.
                <Feather name="eye" size={10} color={glyphColor} />
            ) : kind === 'care' ? (
                // Solid 4×4 dot — the role badges that flag a SUPPORT
                // (caregiver) person on the household snapshot.
                <View
                    style={[styles.dot, { backgroundColor: glyphColor }]}
                />
            ) : (
                // Dashed-outline circle for EXT — pairs visually with
                // the dashed-busy-block row's "this data isn't yours"
                // language. 4×4 dot wrapped in a 0.5 dashed border.
                <View
                    style={[
                        styles.dotDashed,
                        { borderColor: glyphColor },
                    ]}
                />
            )}
            <ThemedText
                style={[
                    styles.text,
                    {
                        color: colors.inkSec,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}>
                {label.toUpperCase()}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    // 2px vertical / 6px horizontal pad + 4 radius matches the design.
    // flexShrink: 0 keeps the badge from collapsing when the strip's
    // title row runs out of room (long names ellipsis the title body,
    // not this badge).
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: StyleSheet.hairlineWidth,
        flexShrink: 0,
    },
    text: {
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    dotDashed: {
        width: 6,
        height: 6,
        borderRadius: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
    },
});
