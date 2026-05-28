// Searchable timezone picker. Used by Settings → Default timezone.
//
// UX: a search box at the top filters the full IANA catalog by IANA name, city, region,
// or offset string ("EST", "GMT-5", "Tokyo", etc.). Tapping a row commits the selection
// immediately — there's no separate Save step, since the list IS the input.
//
// Each row shows the offset label on the left ("GMT-05:00") and the IANA name on the
// right. The currently-selected zone is highlighted. We also surface a "Match device"
// quick action at the top when the device's tz differs from the current value.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { listTimezones, type TimezoneOption } from '@/lib/timezones';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    value: string | null;
    onChange: (tz: string) => void;
    onCancel: () => void;
    /** Optional device tz — shown as a "Match device" shortcut when it differs from value. */
    deviceTimezone?: string | null;
};

export function TimezonePicker({ value, onChange, onCancel, deviceTimezone }: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const [search, setSearch] = useState('');

    const allZones = useMemo(() => listTimezones(), []);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allZones;
        return allZones.filter(
            (z) =>
                z.iana.toLowerCase().includes(q) ||
                z.city.toLowerCase().includes(q) ||
                z.region.toLowerCase().includes(q) ||
                z.offsetLabel.toLowerCase().includes(q),
        );
    }, [allZones, search]);

    const inputStyle = {
        color: colors.text,
        borderColor: colors.backgroundSelected,
        borderWidth: 1,
        borderRadius: Spacing.two,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        fontSize: 16,
        height: 44,
    };

    const showMatchDevice =
        deviceTimezone && deviceTimezone.length > 0 && deviceTimezone !== value;

    return (
        <View style={styles.wrapper}>
            <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search timezone (city, region, GMT offset)"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
                autoFocus
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
            />

            {showMatchDevice ? (
                <Pressable
                    onPress={() => onChange(deviceTimezone!)}
                    style={({ pressed }) => [
                        styles.matchDeviceBtn,
                        { borderColor: colors.backgroundSelected },
                        pressed && styles.pressed,
                    ]}>
                    <ThemedText
                        type="small"
                        style={{ color: colors.accent, fontWeight: '600' }}>
                        Match my device ({deviceTimezone})
                    </ThemedText>
                </Pressable>
            ) : null}

            <View
                style={[
                    styles.listFrame,
                    {
                        borderColor: colors.backgroundSelected,
                        backgroundColor: colors.backgroundElement,
                    },
                ]}>
                <ScrollView
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled">
                    {filtered.length === 0 ? (
                        <View style={styles.emptyRow}>
                            <ThemedText themeColor="textSecondary" type="small">
                                No timezones match &quot;{search.trim()}&quot;.
                            </ThemedText>
                        </View>
                    ) : (
                        filtered.map((opt, idx) => (
                            <TimezoneRow
                                key={opt.iana}
                                option={opt}
                                selected={opt.iana === value}
                                showSeparator={idx > 0}
                                onPress={() => onChange(opt.iana)}
                                borderColor={colors.backgroundSelected}
                                accentColor={colors.accent}
                            />
                        ))
                    )}
                </ScrollView>
            </View>

            <View style={styles.footer}>
                <Pressable
                    onPress={onCancel}
                    style={({ pressed }) => [
                        styles.cancelBtn,
                        { borderColor: colors.backgroundSelected },
                        pressed && styles.pressed,
                    ]}>
                    <ThemedText themeColor="textSecondary" type="small">
                        Cancel
                    </ThemedText>
                </Pressable>
            </View>
        </View>
    );
}

function TimezoneRow({
    option,
    selected,
    showSeparator,
    onPress,
    borderColor,
    accentColor,
}: {
    option: TimezoneOption;
    selected: boolean;
    showSeparator: boolean;
    onPress: () => void;
    borderColor: string;
    accentColor: string;
}) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                showSeparator && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: borderColor,
                },
                selected && { backgroundColor: '#1F294022' },
                pressed && styles.pressed,
            ]}>
            <View style={styles.offsetCol}>
                <ThemedText type="smallBold">{option.offsetLabel}</ThemedText>
            </View>
            <View style={styles.zoneCol}>
                <ThemedText type="small">{option.city}</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                    {option.region}/{option.city.replace(/ /g, '_')}
                </ThemedText>
            </View>
            {selected ? (
                <ThemedText type="small" style={{ color: accentColor, fontWeight: '600' }}>
                    ✓
                </ThemedText>
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: { gap: Spacing.two },
    matchDeviceBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    listFrame: {
        borderWidth: 1,
        borderRadius: Spacing.two,
        overflow: 'hidden',
    },
    list: { maxHeight: 320 },
    listContent: { paddingVertical: Spacing.one },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        gap: Spacing.three,
    },
    offsetCol: { width: 92 },
    zoneCol: { flex: 1 },
    emptyRow: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.three,
    },
    footer: { flexDirection: 'row', justifyContent: 'flex-end' },
    cancelBtn: {
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
        borderRadius: Spacing.two,
        borderWidth: 1,
    },
    pressed: { opacity: 0.6 },
});
