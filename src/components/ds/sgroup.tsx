// SGroup — the standard "section" container in the new design (Mist Forest /
// Charcoal Forest). A caps SANS label above a white card that holds row
// content. Used by every detail screen and the Settings sub-routes.
//
// Design source: direction-c-pro.jsx ~933-940 ("SGroup label"), and a few
// dozen call sites across screens-extra-*.jsx. Padding / radius / border /
// hairline color are baked in here so callers don't have to thread them.
// The card uses overflow:hidden so per-row borders + the bottom card edge
// don't double up at the corners.

import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

export function SGroup({
    label,
    children,
    style,
}: {
    /** Section title rendered as the caps label above the card. */
    label: string;
    /** Card body — typically one or more SRow children. */
    children: React.ReactNode;
    /** Optional extra style for the outer wrapper (rare; lets callers
     *  override marginBottom when stacking SGroups in a tight layout). */
    style?: ViewStyle;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={[styles.wrap, style]}>
            <View style={styles.header}>
                <ThemedText
                    style={[
                        styles.label,
                        {
                            color: colors.inkSec,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {label.toUpperCase()}
                </ThemedText>
            </View>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: colors.backgroundElement,
                        borderColor: colors.hair,
                    },
                ]}>
                {children}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { marginBottom: 18, gap: 8 },
    header: { paddingHorizontal: 24 },
    // 10/600/0.4 caps — design source `padding: '6px 24px 4px'` + a mono caps
    // label. Padding lives on the header wrapper above instead so callers can
    // pull the label into their own header layouts if they need to.
    label: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    // Card: 12px radius + 0.5px hair border. overflow:hidden keeps the
    // children's per-row borders inside the rounded corners.
    card: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
});
