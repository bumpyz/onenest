// DateRangeBoxes — From / → / To pair of mono-styled date boxes used
// in NewOverride's "When" SGroup (date-range mode). Each box renders a
// caps mono label ("FROM" / "TO") with a primary "Sat · Jun 7" value
// + a secondary year sub.
//
// Design source: screens-custody.jsx DateBoxPicker (~line 1450).

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, FontFamily } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type DateBoxProps = {
    label: 'From' | 'To';
    value: string;
    sub: string;
    onPress?: () => void;
};

function DateBox({ label, value, sub, onPress }: DateBoxProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    // Always render through Pressable, even when there's no onPress.
    // Switching between Pressable and a bare View based on onPress
    // makes RN's flex measurement treat the two boxes asymmetrically:
    // the From box (wrapped) ended up wider than the To box (unwrapped)
    // in single-day mode, where onPressTo is undefined. Keeping the
    // wrapper consistent locks the widths to flex:1 + flexBasis:0 in
    // both states.
    const interactive = typeof onPress === 'function';
    return (
        <Pressable
            onPress={onPress}
            disabled={!interactive}
            accessibilityRole={interactive ? 'button' : 'text'}
            accessibilityLabel={`${label} date · ${value}`}
            style={({ pressed }) => [
                styles.boxPressable,
                pressed && interactive && styles.pressed,
            ]}>
            <View
                style={[
                    styles.box,
                    {
                        backgroundColor: colors.backgroundInset,
                        borderColor: colors.hair,
                    },
                ]}>
                <ThemedText
                    style={[
                        styles.boxLabel,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {label.toUpperCase()}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.boxValue,
                        {
                            color: colors.text,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}
                    numberOfLines={1}>
                    {value}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.boxSub,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {sub}
                </ThemedText>
            </View>
        </Pressable>
    );
}

export function DateRangeBoxes({
    fromValue,
    fromSub,
    toValue,
    toSub,
    onPressFrom,
    onPressTo,
}: {
    fromValue: string;
    fromSub: string;
    toValue: string;
    toSub: string;
    onPressFrom?: () => void;
    onPressTo?: () => void;
}) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    return (
        <View style={styles.row}>
            <DateBox
                label="From"
                value={fromValue}
                sub={fromSub}
                onPress={onPressFrom}
            />
            {/* Arrow separator — kept as a centered mono → so the two
                boxes read as a connected range, not two independent
                fields. */}
            <View style={styles.arrow}>
                <Feather
                    name="arrow-right"
                    size={14}
                    color={colors.inkFaint}
                />
            </View>
            <DateBox
                label="To"
                value={toValue}
                sub={toSub}
                onPress={onPressTo}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'stretch',
    },
    // flex:1 + flexBasis:0 + minWidth:0 forces equal-width regardless
    // of content. Without flexBasis:0 the longer "Sun · Jun 8" value
    // can claim more of the row than "Sat · Jun 7" via content-based
    // sizing. minWidth:0 lets numberOfLines={1} actually clip rather
    // than expanding to fit the value.
    boxPressable: { flex: 1, flexBasis: 0, minWidth: 0 },
    box: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    boxLabel: {
        fontSize: 9,
        letterSpacing: 0.4,
        marginBottom: 3,
    },
    boxValue: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    boxSub: {
        fontSize: 9.5,
        marginTop: 1,
        letterSpacing: -0.1,
    },
    arrow: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    pressed: { opacity: 0.7 },
});
