// AIHelper — soft accent banner shown below the TitleInput on Task /
// Event / Contact creation flows. Hints that the user can paste a
// phrase (e.g. "pack soph friday 6pm doctor") and the AI parse path
// will pre-fill fields.
//
// Design source: `screens-creation.jsx::AIHelper` + spec "3 · AI parse
// helper". Skipped on List and AddChild (nothing meaningful to parse).
//
// Visual: soft `accent + 12` background, `accent + 33` hairline, radius
// 10, padding 10/12. Sparkle glyph + bold-ish title line + mono example.
// onPaste hook is wired by callers once the AI parse endpoint lands;
// right now the banner is informational + tappable (opens the system
// paste flow on tap).

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { withAlpha } from '@/lib/platform-styles';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    /** Mono example string under the title. */
    example: string;
    /** Optional override for the title line. Defaults to "Tip · paste a phrase". */
    title?: string;
    /** Fired when the banner is tapped — wire to the AI parse handler. */
    onPress?: () => void;
    /** Drop the wrapper's horizontal padding. Use when the parent
     *  scroll/list already provides a horizontal gutter, so AIHelper's
     *  card doesn't double-inset (e.g. inside event-form's ScrollView
     *  which already has `padding: 16`). Other surfaces (child / task /
     *  contact creation) rely on the default 16 here because their
     *  scroll has none. */
    flush?: boolean;
};

export function AIHelper({
    example,
    title = 'Tip · paste a phrase',
    onPress,
    flush = false,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={[styles.wrap, flush && styles.wrapFlush]}>
            <Pressable
                onPress={onPress}
                disabled={!onPress}
                accessibilityRole={onPress ? 'button' : undefined}
                accessibilityLabel={onPress ? `${title}. ${example}` : undefined}
                style={({ pressed }) => [
                    styles.card,
                    {
                        backgroundColor: withAlpha(colors.accent, 0x12 / 255),
                        borderColor: withAlpha(colors.accent, 0x33 / 255),
                    },
                    pressed && !!onPress && styles.pressed,
                ]}>
                <Feather
                    name="zap"
                    size={14}
                    color={colors.accent}
                    style={styles.glyph}
                />
                <View style={styles.body}>
                    <ThemedText
                        style={[
                            styles.title,
                            { color: colors.text },
                        ]}>
                        {title}
                    </ThemedText>
                    <ThemedText
                        style={[
                            styles.example,
                            {
                                color: colors.inkSec,
                                fontFamily: FontFamily.monoMedium,
                            },
                        ]}>
                        {example}
                    </ThemedText>
                </View>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18 },
    wrapFlush: { paddingHorizontal: 0 },
    card: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    glyph: { marginTop: 1 },
    body: { flex: 1, minWidth: 0 },
    title: {
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: -0.1,
        marginBottom: 2,
    },
    example: {
        fontSize: 11,
        letterSpacing: -0.2,
        lineHeight: 16,
    },
    pressed: { opacity: 0.7 },
});
