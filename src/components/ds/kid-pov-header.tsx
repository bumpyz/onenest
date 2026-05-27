// KidPOVHeader — the per-kid POV identity slot inside CustodyStripToday's
// external co-parent variant (#398). Replaces the household-anchored
// "ALT · WK 22" pattern chip with a kid-anchored two-line header:
//
//   ┌──────────────┐  SOPH'S WEEK                    ← mono caps
//   │ ⬤ Soph 22px │  With Alex · comes to you Fri  ← 13/600 ink
//   └──────────────┘
//
// Avatar is owned by the caller (ChildBadge / CAvatar-equivalent at 22px);
// this primitive just renders the text column. Keeps the caller in charge
// of the avatar's color resolution + the ChildBadge variant choice.
//
// Design source: screens-custody-variants.jsx::KidStripDefault (~line 363).

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function KidPOVHeader({
    kidName,
    headline,
}: {
    /** Kid's display name. Renders as `<KID>'S WEEK` in mono caps. The
     *  apostrophe is added here, not in the caller, so a nickname with
     *  trailing punctuation doesn't render `Soph!'S WEEK`. */
    kidName: string;
    /** State-driven headline. Caller picks per resolved-state:
     *    With Alex · comes to you Fri
     *    With you · returns to Alex Wed
     *    Soph comes to you today
     *    Pickup at Lincoln Elementary
     *  ThemedText handles ellipsis on overflow via numberOfLines={1}. */
    headline: string;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={styles.body}>
            <ThemedText
                style={[
                    styles.eyebrow,
                    {
                        color: colors.inkSec,
                        fontFamily: FontFamily.monoSemiBold,
                    },
                ]}
                numberOfLines={1}>
                {`${kidName.toUpperCase()}'S WEEK`}
            </ThemedText>
            <ThemedText
                style={[styles.headline, { color: colors.text }]}
                numberOfLines={1}>
                {headline}
            </ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    body: {
        flex: 1,
        minWidth: 0,
    },
    // Mono caps eyebrow. 9.5/700/0.4 matches ViewingBadge text metrics so
    // the two rows of mono caps in the title row (eyebrow + the VIEWING
    // chip on the right) read as part of the same hierarchy.
    eyebrow: {
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.4,
        marginBottom: 1,
    },
    // Sentence-case headline. 13/600/-0.2 — slightly larger than the
    // base strip's 12.5 pattern title so the kid POV reads as the
    // dominant signal on this surface.
    headline: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
});
