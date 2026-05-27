// SegRow — iOS-style segmented control used by Kind (CreateList),
// Type (CreateContact), and Priority (CreateTask).
//
// Design source: `screens-creation.jsx::SegRow`.
//
// Visual: container is inset bg + hairline border + radius 10 + 3px
// padding. Each segment is 8/10 padded + 8px radius; selected segment
// elevates to card bg with a hairline border and a soft 1px shadow.
// Labels are 12.5 / 600 (selected) or 500 (unselected).
//
// Generic over the option id so callers get type-safe selection. Pass
// `options` as an array of `{ id, label }` and `selected` as the id of
// the active option.

import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

type SegOption<T extends string> = {
    id: T;
    label: string;
};

type Props<T extends string> = {
    options: ReadonlyArray<SegOption<T>>;
    selected: T;
    onSelect: (id: T) => void;
    disabled?: boolean;
};

export function SegRow<T extends string>({
    options,
    selected,
    onSelect,
    disabled = false,
}: Props<T>) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <View
            style={[
                styles.shell,
                {
                    backgroundColor: colors.backgroundInset,
                    borderColor: colors.hair,
                },
            ]}>
            {options.map((opt) => {
                const isSelected = opt.id === selected;
                return (
                    <Pressable
                        key={opt.id}
                        onPress={() => onSelect(opt.id)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ selected: isSelected }}
                        style={({ pressed }) => [
                            styles.segment,
                            isSelected
                                ? {
                                      backgroundColor: colors.backgroundElement,
                                      borderColor: colors.hair,
                                      borderWidth: StyleSheet.hairlineWidth,
                                      // Soft lift — RN ignores boxShadow
                                      // on native; elevation handles
                                      // Android, no-op on iOS where the
                                      // hairline+bg contrast already
                                      // reads as elevated.
                                      elevation: 1,
                                  }
                                : null,
                            pressed && !disabled && !isSelected && styles.pressed,
                        ]}>
                        <ThemedText
                            style={[
                                styles.label,
                                {
                                    color: isSelected
                                        ? colors.text
                                        : colors.inkSec,
                                    fontWeight: isSelected ? '600' : '500',
                                },
                            ]}>
                            {opt.label}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    shell: {
        flexDirection: 'row',
        gap: 3,
        padding: 3,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
    },
    segment: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 12.5,
        letterSpacing: -0.2,
    },
    pressed: { opacity: 0.7 },
});
