import { addDays, format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

import { DateField } from '@/components/datetime-fields';
import { ThemedText } from '@/components/themed-text';
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { colorForResponsible } from '@/lib/colors';
import {
    CUSTODY_PATTERNS,
    custodianProfileIdOnDate,
    findPattern,
    previewLabels,
    type CustodyPatternId,
} from '@/lib/custody';
import {
    deleteCustodySchedule,
    upsertCustodySchedule,
    type HouseholdMember,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { useAppColorScheme } from '@/providers/theme-provider';

type Props = {
    householdId: string;
    members: HouseholdMember[];
    colorMap: Map<string, string>;
    currentUserId: string;
};

const inputStyleBase = (textColor: string, borderColor: string) => ({
    color: textColor,
    borderColor,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    height: 44,
});

export function CustodyScheduleSection({
    householdId,
    members,
    colorMap,
    currentUserId,
}: Props) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { schedule, refetch, isLoading } = useCustodySchedule(householdId);

    const parents = useMemo(
        () => members.filter((m) => m.role === 'parent'),
        [members],
    );

    const [editing, setEditing] = useState(false);
    const [patternId, setPatternId] = useState<CustodyPatternId>('2-2-3');
    const [parentAId, setParentAId] = useState<string | null>(null);
    const [anchorDate, setAnchorDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Hydrate form state when an existing schedule loads (and after refetch).
    useEffect(() => {
        if (schedule) {
            setPatternId(schedule.pattern_id as CustodyPatternId);
            setParentAId(schedule.parent_a_profile_id);
            setAnchorDate(schedule.anchor_date);
        }
    }, [schedule]);

    // Default Parent A to the current user when starting from scratch, so the user doesn't
    // have to pick themselves first.
    useEffect(() => {
        if (parentAId === null && parents.length > 0) {
            const me = parents.find((p) => p.profile_id === currentUserId);
            setParentAId((me ?? parents[0]).profile_id);
        }
    }, [parents, parentAId, currentUserId]);

    const parentA = parents.find((p) => p.profile_id === parentAId) ?? null;
    const parentB = parents.find((p) => p.profile_id !== parentAId) ?? null;
    const pattern = findPattern(patternId);

    const canSave =
        !!parentA &&
        !!parentB &&
        !!pattern &&
        !!anchorDate &&
        parents.length >= 2 &&
        !saving;

    const handleSave = async () => {
        if (!canSave || !parentA || !parentB || !pattern) return;
        setSaving(true);
        setError(null);
        try {
            await upsertCustodySchedule(householdId, {
                patternId: pattern.id,
                cycleDays: [...pattern.cycle],
                parentAProfileId: parentA.profile_id,
                parentBProfileId: parentB.profile_id,
                anchorDate,
            });
            await refetch();
            setEditing(false);
        } catch (err) {
            console.error('upsertCustodySchedule failed', err);
            setError(errorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!schedule) return;
        const doDelete = async () => {
            try {
                await deleteCustodySchedule(schedule.id);
                await refetch();
                setEditing(false);
            } catch (err) {
                console.error('deleteCustodySchedule failed', err);
                setError(errorMessage(err));
            }
        };
        if (Platform.OS === 'web') {
            const ok = typeof window !== 'undefined' && window.confirm('Remove custody schedule?');
            if (ok) await doDelete();
        } else {
            Alert.alert('Remove custody schedule?', 'You can set up a new one anytime.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: doDelete },
            ]);
        }
    };

    const preview = useMemo(() => {
        if (!pattern || !anchorDate) return null;
        try {
            const anchor = parseISO(anchorDate);
            if (Number.isNaN(anchor.getTime())) return null;
            return previewLabels(
                { cycle_days: [...pattern.cycle], anchor_date: anchorDate },
                anchor,
                14,
            );
        } catch {
            return null;
        }
    }, [pattern, anchorDate]);

    const parentColors = (() => {
        const a = parentA ? colorForResponsible(parentA.profile_id, colorMap) : colors.accent;
        const b = parentB ? colorForResponsible(parentB.profile_id, colorMap) : '#E94B6A';
        return { A: a, B: b };
    })();

    if (isLoading) {
        return (
            <View style={styles.section}>
                <ThemedText type="smallBold">Custody schedule</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                    Loading…
                </ThemedText>
            </View>
        );
    }

    if (parents.length < 2) {
        return (
            <View style={styles.section}>
                <ThemedText type="smallBold">Custody schedule</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                    Custody schedules need two parents in the household. Invite your co-parent above first.
                </ThemedText>
            </View>
        );
    }

    // Summary view when a schedule exists and we're not editing it.
    if (schedule && !editing) {
        const today = new Date();
        const tomorrow = addDays(today, 1);
        const todayCustodian = custodianProfileIdOnDate(schedule, today);
        const tomorrowCustodian = custodianProfileIdOnDate(schedule, tomorrow);
        const todayMember = members.find((m) => m.profile_id === todayCustodian);
        const tomorrowMember = members.find((m) => m.profile_id === tomorrowCustodian);
        const patternMeta = findPattern(schedule.pattern_id);
        const aMember = members.find((m) => m.profile_id === schedule.parent_a_profile_id);
        const bMember = members.find((m) => m.profile_id === schedule.parent_b_profile_id);

        return (
            <View style={styles.section}>
                <ThemedText type="smallBold">Custody schedule</ThemedText>
                <View style={[styles.card, { backgroundColor: colors.backgroundElement }]}>
                    <ThemedText type="smallBold">
                        {patternMeta?.label ?? schedule.pattern_id}
                    </ThemedText>
                    {patternMeta ? (
                        <ThemedText themeColor="textSecondary" type="small">
                            {patternMeta.description}
                        </ThemedText>
                    ) : null}
                    <View style={styles.parentsRow}>
                        <ParentBadge
                            label="A"
                            name={aMember?.display_name ?? '—'}
                            color={colorForResponsible(
                                schedule.parent_a_profile_id,
                                colorMap,
                            )}
                        />
                        <ParentBadge
                            label="B"
                            name={bMember?.display_name ?? '—'}
                            color={colorForResponsible(
                                schedule.parent_b_profile_id,
                                colorMap,
                            )}
                        />
                    </View>
                    <ThemedText themeColor="textSecondary" type="small">
                        Cycle started {format(parseISO(schedule.anchor_date), 'MMM d, yyyy')}
                    </ThemedText>
                    <View style={styles.todayRow}>
                        <CustodianPill
                            label="Today"
                            name={todayMember?.display_name ?? '—'}
                            color={colorForResponsible(todayCustodian, colorMap)}
                        />
                        <CustodianPill
                            label="Tomorrow"
                            name={tomorrowMember?.display_name ?? '—'}
                            color={colorForResponsible(tomorrowCustodian, colorMap)}
                        />
                    </View>
                    <View style={styles.actionsRow}>
                        <Pressable
                            onPress={() => setEditing(true)}
                            style={({ pressed }) => [
                                styles.secondaryBtn,
                                { borderColor: colors.backgroundSelected },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText type="small" style={{ color: colors.accent, fontWeight: '600' }}>
                                Change pattern
                            </ThemedText>
                        </Pressable>
                        <Pressable
                            onPress={handleRemove}
                            style={({ pressed }) => [
                                styles.secondaryBtn,
                                { borderColor: colors.backgroundSelected },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText type="small" style={{ color: BrandColors.error, fontWeight: '600' }}>
                                Remove
                            </ThemedText>
                        </Pressable>
                    </View>
                </View>
            </View>
        );
    }

    // Setup / edit form.
    return (
        <View style={styles.section}>
            <ThemedText type="smallBold">Custody schedule</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
                Pick a pattern. The calendar will automatically show which parent has the kids on each day.
            </ThemedText>

            <View style={[styles.card, { backgroundColor: colors.backgroundElement, gap: Spacing.three }]}>
                {/* Pattern */}
                <View>
                    <ThemedText type="smallBold">Pattern</ThemedText>
                    <View style={styles.chipRow}>
                        {CUSTODY_PATTERNS.map((p) => {
                            const selected = patternId === p.id;
                            return (
                                <Pressable
                                    key={p.id}
                                    onPress={() => setPatternId(p.id)}
                                    disabled={saving}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        {
                                            borderColor: colors.backgroundSelected,
                                            backgroundColor: selected ? colors.accent : 'transparent',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: selected ? '#fff' : colors.text,
                                            fontWeight: '500',
                                        }}>
                                        {p.label}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                    {pattern ? (
                        <ThemedText themeColor="textSecondary" type="small" style={{ marginTop: Spacing.one }}>
                            {pattern.description}
                        </ThemedText>
                    ) : null}
                </View>

                {/* Parent A */}
                <View>
                    <ThemedText type="smallBold">Parent A</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                        The other parent automatically becomes Parent B.
                    </ThemedText>
                    <View style={styles.chipRow}>
                        {parents.map((m) => {
                            const selected = parentAId === m.profile_id;
                            const c = colorForResponsible(m.profile_id, colorMap);
                            const label =
                                currentUserId === m.profile_id ? `${m.display_name} (you)` : m.display_name;
                            return (
                                <Pressable
                                    key={m.profile_id}
                                    onPress={() => setParentAId(m.profile_id)}
                                    disabled={saving}
                                    style={({ pressed }) => [
                                        styles.chip,
                                        {
                                            borderColor: c,
                                            backgroundColor: selected ? c : 'transparent',
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View style={[styles.chipDot, { backgroundColor: c }]} />
                                    <ThemedText
                                        type="small"
                                        style={{
                                            color: selected ? '#fff' : colors.text,
                                            fontWeight: '500',
                                        }}>
                                        {label}
                                    </ThemedText>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* Anchor date */}
                <View>
                    <ThemedText type="smallBold">Cycle starts on</ThemedText>
                    <ThemedText themeColor="textSecondary" type="small">
                        Day 1 of the pattern (Parent A). The cycle repeats from this date forward and backward.
                    </ThemedText>
                    <View style={{ marginTop: Spacing.one }}>
                        <DateField value={anchorDate} onChange={setAnchorDate} />
                    </View>
                </View>

                {/* Preview */}
                {preview && parentA && parentB ? (
                    <View>
                        <ThemedText type="smallBold">Next 14 days</ThemedText>
                        <View style={styles.previewRow}>
                            {preview.map((label, idx) => {
                                const d = addDays(parseISO(anchorDate), idx);
                                const isA = label === 'A';
                                return (
                                    <View key={idx} style={styles.previewCell}>
                                        <View
                                            style={[
                                                styles.previewSwatch,
                                                {
                                                    backgroundColor: isA
                                                        ? parentColors.A
                                                        : parentColors.B,
                                                },
                                            ]}>
                                            <ThemedText style={styles.previewLabel}>{label}</ThemedText>
                                        </View>
                                        <ThemedText
                                            type="small"
                                            themeColor="textSecondary"
                                            style={styles.previewDate}>
                                            {format(d, 'd')}
                                        </ThemedText>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ) : null}

                {error ? (
                    <ThemedText type="small" style={styles.errorText}>
                        {error}
                    </ThemedText>
                ) : null}

                <View style={styles.actionsRow}>
                    <Pressable
                        onPress={handleSave}
                        disabled={!canSave}
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            {
                                backgroundColor: canSave ? colors.accent : colors.backgroundSelected,
                            },
                            pressed && canSave && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: canSave ? '#fff' : colors.textSecondary,
                                fontWeight: '600',
                            }}>
                            {saving ? 'Saving…' : schedule ? 'Update schedule' : 'Save schedule'}
                        </ThemedText>
                    </Pressable>
                    {schedule ? (
                        <Pressable
                            onPress={() => setEditing(false)}
                            disabled={saving}
                            style={({ pressed }) => [
                                styles.secondaryBtn,
                                { borderColor: colors.backgroundSelected },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText themeColor="textSecondary" type="small">
                                Cancel
                            </ThemedText>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

function ParentBadge({ label, name, color }: { label: string; name: string; color: string }) {
    return (
        <View style={styles.parentBadge}>
            <View style={[styles.parentDot, { backgroundColor: color }]} />
            <ThemedText type="smallBold">{label}:</ThemedText>
            <ThemedText type="small">{name}</ThemedText>
        </View>
    );
}

function CustodianPill({ label, name, color }: { label: string; name: string; color: string }) {
    return (
        <View style={[styles.custodianPill, { borderColor: color }]}>
            <View style={[styles.pillDot, { backgroundColor: color }]} />
            <ThemedText type="small" themeColor="textSecondary">
                {label}:
            </ThemedText>
            <ThemedText type="smallBold">{name}</ThemedText>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { gap: Spacing.two },
    card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.two,
        paddingTop: Spacing.one,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    parentsRow: { flexDirection: 'row', gap: Spacing.three, flexWrap: 'wrap' },
    parentBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
    parentDot: { width: 10, height: 10, borderRadius: 5 },
    todayRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
    custodianPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.one,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.one,
    },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    actionsRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
    primaryBtn: {
        height: 40,
        paddingHorizontal: Spacing.four,
        borderRadius: Spacing.two,
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryBtn: {
        height: 40,
        paddingHorizontal: Spacing.three,
        borderRadius: Spacing.two,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingTop: Spacing.one },
    previewCell: { width: 28, alignItems: 'center', gap: 2 },
    previewSwatch: {
        width: 28,
        height: 28,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
    previewDate: { fontSize: 10 },
    errorText: { color: BrandColors.error },
    pressed: { opacity: 0.7 },
});

// inputStyleBase is exposed for callers that need to share the input look; not used inline here.
export { inputStyleBase };
