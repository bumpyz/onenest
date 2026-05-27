// FormCard — the white card wrapper every create / edit form uses for its
// field stack. Mirrors the SettingsSection wrapper but for modal-style forms:
// one cohesive surface that holds inputs + previews + inline errors, with
// destructive actions (Delete) intentionally left OUTSIDE so they don't read
// as part of the form's affirmative actions.
//
// Pulls from the canonical `Surfaces.card` token so the visual treatment
// matches every other card surface in the app (Home day cards, Settings
// sections, Lists task rows). When the palette / radius / shadow ever
// shifts, every form picks it up automatically.

import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Colors, Spacing, Surfaces } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    children: ReactNode;
    /** Override the default vertical gap between children. Defaults to
     *  Spacing.four (24px) — matches the gap previously used inside form
     *  ScrollView contentContainers. Pass a smaller value when wrapping
     *  tighter content (e.g. a confirmation card). */
    gap?: number;
    /** Escape hatch for callers that need to tweak padding / margin. Keep
     *  the visual identity (radius, shadow, fill) — those come from the
     *  Surfaces.card token and shouldn't be overridden ad-hoc. */
    style?: ViewStyle;
};

export function FormCard({ children, gap = Spacing.four, style }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const surface = Surfaces.card;
    return (
        <View
            style={[
                styles.card,
                {
                    backgroundColor: colors[surface.fill],
                    borderRadius: surface.radius,
                    padding: surface.padding,
                    gap,
                },
                surface.shadow,
                style,
            ]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        // All visual properties resolved at render via Surfaces.card. This
        // empty rule exists only so the spread above has a base to merge
        // into without StyleSheet warnings on RN-web.
    },
});
