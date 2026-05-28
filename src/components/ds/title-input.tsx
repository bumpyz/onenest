// TitleInput — the always-first field in every creation flow.
//
// Design source: `screens-creation.jsx::TitleInput` + spec
// "2 · Title input — first field, always".
//
// Mono caps label (e.g. TITLE / NAME / LIST NAME) sits above the value;
// value renders at 22 / 600 / -0.7 with a 1.5px accent underline. No
// full-box input frame — the spec specifically rejects that pattern
// ("signals 'you can just type' without form-box clutter").
//
// The native iOS / Android TextInput cursor already blinks, so we don't
// need to recreate the manual blinking caret from the HTML mock — we
// just pass selectionColor=accent so the native cursor matches the
// design's accent color.

import {
    StyleSheet,
    TextInput,
    View,
    type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    /** Mono caps label rendered above the input — e.g. "TITLE", "NAME". */
    label: string;
    value: string;
    onChangeText: (next: string) => void;
    placeholder?: string;
    /** Render value in mono (used by List name) instead of sans. */
    mono?: boolean;
    autoFocus?: boolean;
    editable?: boolean;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    /** HTML autocomplete hint — drives both Chrome's saved-form prompts
     *  and the password manager's "is this a password field?" heuristic.
     *  Defaults to "off" because most TitleInputs are app-domain values
     *  (event title, list name, task title) that nothing in the browser
     *  has a saved value for. Callers handling identity-shaped values
     *  (Display name, Household name) should pass an explicit hint. */
    autoComplete?: TextInputProps['autoComplete'];
};

export function TitleInput({
    label,
    value,
    onChangeText,
    placeholder,
    mono = false,
    autoFocus = false,
    editable = true,
    autoCapitalize = 'sentences',
    autoComplete = 'off',
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View style={styles.wrap}>
            <ThemedText
                style={[
                    styles.label,
                    {
                        color: colors.inkFaint,
                        fontFamily: FontFamily.monoMedium,
                    },
                ]}>
                {label}
            </ThemedText>
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.inkFaint}
                autoFocus={autoFocus}
                editable={editable}
                autoCapitalize={autoCapitalize}
                autoComplete={autoComplete}
                selectionColor={colors.accent}
                style={[
                    styles.input,
                    {
                        color: colors.text,
                        borderBottomColor: colors.accent,
                        fontFamily: mono
                            ? FontFamily.monoMedium
                            : FontFamily.sansSemiBold,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        paddingTop: 14,
        paddingHorizontal: 20,
        paddingBottom: 6,
    },
    label: {
        fontSize: 10,
        letterSpacing: -0.2,
        marginBottom: 8,
    },
    input: {
        fontSize: 22,
        fontWeight: '600',
        letterSpacing: -0.7,
        lineHeight: 26,
        paddingVertical: 4,
        paddingHorizontal: 0,
        borderBottomWidth: 1.5,
    },
});
