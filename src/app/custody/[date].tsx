// NewOverride editor — design 06.3 (screens-custody.jsx:1078). Replaces
// the v1 single-day stub at this same route with the canonical
// multi-section editor.
//
// Layout, top to bottom:
//   1. Top bar — Cancel · "New override" · Save
//   2. Live preview — DEFAULT vs WITH OVERRIDE strip (OverridePreviewBar)
//   3. "What's happening" SGroup — 6 KindChip pills
//   4. "When" SGroup — Single-day toggle + DateRangeBoxes + preset chips
//      + Time row (always-day for v1; partial-day deferred)
//   5. "Affects" SGroup — KidCheckRow per kid (multi-select; empty
//      selection = household-wide)
//   6. "With whom" SGroup — CaregiverPickRow per parent + external
//      co-parent (single-select)
//   7. "Notes" SGroup — multi-line text
//   8. ApprovalBanner (auto-detected) — visible iff any selected kid
//      has an external co-parent linked
//   9. "Notifications" SGroup — 3 boolean toggles persisted with the
//      override row
//  10. Sticky save bar — summary + CTA that flips between "Send for
//      approval" (external co-parent affected) and "Save override"
//
// Save calls the create_custody_override RPC (migration 0056). The
// server computes requires_approval_from + approval_status from
// child_external_coparents so the client can't lie about who must
// decide.

import { Feather } from '@expo/vector-icons';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    ApprovalBanner,
    CaregiverPickRow,
    DateRangeBoxes,
    DateTimePickerSheet,
    FormSwitch,
    KidCheckRow,
    KindChip,
    type KindChipIcon,
    MemberAvatar,
    OverridePreviewBar,
    type PreviewDay,
    PresetChip,
    SGroup,
    SRow,
} from '@/components/ds';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEvents } from '@/hooks/use-events';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useMyRole } from '@/hooks/use-my-role';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import {
    buildOverrideMap,
    resolveCustodianOnDate,
} from '@/lib/custody';
import {
    createCustodyOverride,
    listHouseholdExternalCoparents,
    type CustodyOverrideKind,
    type HouseholdExternalCoparent,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha, HEAVY_FAB_SHADOW } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

const KIND_OPTIONS: Array<{
    id: CustodyOverrideKind;
    label: string;
    icon: KindChipIcon;
}> = [
    { id: 'family_trip', label: 'Family trip', icon: 'trip' },
    { id: 'birthday', label: 'Birthday / event', icon: 'cake' },
    { id: 'work_travel', label: 'Work travel', icon: 'briefcase' },
    { id: 'anniversary', label: 'Anniversary', icon: 'heart' },
    { id: 'just_swapping', label: 'Just swapping', icon: 'swap' },
    { id: 'other', label: 'Other', icon: 'dots' },
];

// Preset id space stays local — the chips are syntactic sugar over
// (fromDate, toDate) pairs. 'custom' opens the From picker instead of
// seeding.
type PresetId = 'today' | 'tomorrow' | 'this_weekend' | 'next_weekend' | 'custom';

function presetRange(
    preset: PresetId,
    now: Date,
): { from: string; to: string } | null {
    const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
    if (preset === 'today') {
        return { from: fmt(now), to: fmt(now) };
    }
    if (preset === 'tomorrow') {
        const d = addDays(now, 1);
        return { from: fmt(d), to: fmt(d) };
    }
    // ISO week: Sat=5 / Sun=6 from Monday-first. Compute the next
    // Saturday + Sunday.
    if (preset === 'this_weekend') {
        const mon = startOfWeek(now, { weekStartsOn: 1 });
        return {
            from: fmt(addDays(mon, 5)),
            to: fmt(addDays(mon, 6)),
        };
    }
    if (preset === 'next_weekend') {
        const mon = startOfWeek(now, { weekStartsOn: 1 });
        return {
            from: fmt(addDays(mon, 12)),
            to: fmt(addDays(mon, 13)),
        };
    }
    return null;
}

export default function CustodyOverrideEditorScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const params = useLocalSearchParams<{ date?: string | string[] }>();
    const seedDate = useMemo(() => {
        const raw = Array.isArray(params.date) ? params.date[0] : params.date;
        if (raw && !Number.isNaN(parseISO(raw).getTime())) return raw;
        return format(new Date(), 'yyyy-MM-dd');
    }, [params.date]);

    // ─── data fetches ────────────────────────────────────────────────
    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const householdType = household?.household_type ?? 'separated';
    const { schedule, isLoading: scheduleLoading } = useCustodySchedule(
        household?.id,
    );
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    const { children: kids, isLoading: kidsLoading } = useChildren(
        household?.id,
    );
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // External co-parents linked to any household kid. Powers the
    // KidCheckRow externalNote pill + the "With whom" EXT entries +
    // the ApprovalBanner approver list. One fetch on mount; refresh
    // would only matter if a co-parent link changed mid-edit, rare.
    const [externalCoparents, setExternalCoparents] = useState<
        HouseholdExternalCoparent[]
    >([]);
    const [externalsLoaded, setExternalsLoaded] = useState(false);
    useEffect(() => {
        if (!household?.id) return;
        let cancelled = false;
        (async () => {
            try {
                const rows = await listHouseholdExternalCoparents(household.id);
                if (!cancelled) {
                    setExternalCoparents(rows);
                    setExternalsLoaded(true);
                }
            } catch {
                if (!cancelled) {
                    setExternalCoparents([]);
                    setExternalsLoaded(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [household?.id]);

    // ─── editor state ────────────────────────────────────────────────
    const [kind, setKind] = useState<CustodyOverrideKind>('family_trip');
    const [singleDay, setSingleDay] = useState(true);
    const [fromDate, setFromDate] = useState<string>(seedDate);
    const [toDate, setToDate] = useState<string>(seedDate);
    // Selected preset chip — UI affordance only; the actual dates live
    // on fromDate/toDate. Null means "no preset matches" (e.g. user
    // picked custom dates).
    const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(
        'today',
    );
    const [selectedKidIds, setSelectedKidIds] = useState<string[]>([]);
    const [selectedCustodianId, setSelectedCustodianId] = useState<
        string | null
    >(null);
    const [note, setNote] = useState('');
    const [notifyAffected, setNotifyAffected] = useState(true);
    const [addToActivityFeed, setAddToActivityFeed] = useState(true);
    const [reassignEvents, setReassignEvents] = useState(true);
    const [saving, setSaving] = useState(false);

    const [fromSheetOpen, setFromSheetOpen] = useState(false);
    const [toSheetOpen, setToSheetOpen] = useState(false);

    // Default the custodian to the parent who ISN'T currently on duty
    // for the seedDate — that's the most common override intent ("I'm
    // taking the kids today even though it's the other parent's day").
    // Falls back to whoever's first in members if the resolver can't
    // determine a default (e.g. schedule still loading).
    useEffect(() => {
        if (selectedCustodianId) return;
        if (!schedule || !members || members.length === 0) return;
        const today = parseISO(fromDate);
        const r = resolveCustodianOnDate(schedule, new Map(), today);
        if (r.profileId && schedule.parent_a_profile_id && schedule.parent_b_profile_id) {
            const other =
                r.profileId === schedule.parent_a_profile_id
                    ? schedule.parent_b_profile_id
                    : schedule.parent_a_profile_id;
            setSelectedCustodianId(other);
        } else {
            // Fall back to the first parent member.
            const firstParent = members.find((m) => m.role === 'parent');
            if (firstParent) setSelectedCustodianId(firstParent.profile_id);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule?.id, members?.length, fromDate]);

    // Keep toDate >= fromDate. If user pushes fromDate past toDate,
    // snap toDate to match.
    useEffect(() => {
        if (singleDay && fromDate !== toDate) {
            setToDate(fromDate);
        } else if (!singleDay && toDate < fromDate) {
            setToDate(fromDate);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fromDate, singleDay]);

    // ─── range data for preview + conflict count ─────────────────────
    // Pull a week window starting Monday of fromDate so the preview
    // bar can show context around the override.
    const previewWeekStart = useMemo(
        () => startOfWeek(parseISO(fromDate), { weekStartsOn: 1 }),
        [fromDate],
    );
    const previewWeekEnd = useMemo(
        () => addDays(previewWeekStart, 6),
        [previewWeekStart],
    );
    const { overrides: weekOverrides } = useCustodyOverrides(
        household?.id,
        previewWeekStart,
        previewWeekEnd,
    );
    // BUG FIX: useEvents reads its first arg by reference for its
    // effect dep array. Passing a fresh `parseISO(fromDate)` on every
    // render makes useEvents think the start date changed every tick,
    // which kicks off a refetch loop the browser eventually kills
    // with ERR_INSUFFICIENT_RESOURCES. Memoize both args off the
    // string dates so the reference is stable across renders.
    const eventsRangeStart = useMemo(
        () => parseISO(fromDate),
        [fromDate],
    );
    const eventsRangeDays = useMemo(
        () =>
            Math.max(
                1,
                Math.floor(
                    (parseISO(toDate).getTime() -
                        parseISO(fromDate).getTime()) /
                        86_400_000,
                ) + 1,
            ),
        [fromDate, toDate],
    );
    const { events: rangeEvents } = useEvents(
        household?.id,
        eventsRangeStart,
        eventsRangeDays,
    );

    // ─── derived state ───────────────────────────────────────────────
    const colorMap = useMemo(
        () => memberColorMap(members ?? []),
        [members],
    );
    const parents = useMemo(
        () => (members ?? []).filter((m) => m.role === 'parent'),
        [members],
    );

    // External co-parents linked to selected kids (or all household
    // kids when child_ids is empty / household-wide). Drives the
    // ApprovalBanner + the "Send for approval" vs "Save override" CTA.
    const requiredApprovers = useMemo(() => {
        if (externalCoparents.length === 0) return [];
        const seen = new Set<string>();
        const out: HouseholdExternalCoparent[] = [];
        for (const link of externalCoparents) {
            if (selectedKidIds.length > 0) {
                // Per-kid scope: only links for the selected kids
                // count.
                if (!selectedKidIds.includes(link.child_id)) continue;
            }
            // De-dupe by profile_id (one external co-parent can be
            // linked to several kids — they only need to approve once).
            if (seen.has(link.profile_id)) continue;
            seen.add(link.profile_id);
            out.push(link);
        }
        return out;
    }, [externalCoparents, selectedKidIds]);

    const requiresApproval = requiredApprovers.length > 0;

    // Per-kid default custodian for the fromDate, used to populate the
    // KidCheckRow sub line + flag the externalNote pill.
    const kidDefaults = useMemo(() => {
        if (!schedule) return new Map<string, { name: string; isExternal: boolean }>();
        const overrideMap = buildOverrideMap(weekOverrides ?? []);
        const out = new Map<string, { name: string; isExternal: boolean }>();
        const r = resolveCustodianOnDate(
            schedule,
            overrideMap,
            parseISO(fromDate),
        );
        const defaultParent = r.profileId
            ? (members ?? []).find((m) => m.profile_id === r.profileId)
            : null;
        for (const k of kids ?? []) {
            // Per-kid pattern overrides could replace this in the
            // future. For now every kid in the household shares the
            // schedule's default.
            const externalLinkedHere = externalCoparents.some(
                (ec) => ec.child_id === k.id,
            );
            out.set(k.id, {
                name: defaultParent?.display_name ?? '—',
                isExternal: externalLinkedHere,
            });
        }
        return out;
    }, [
        schedule,
        members,
        kids,
        weekOverrides,
        externalCoparents,
        fromDate,
    ]);

    // Preview bar data — DEFAULT row pulls from the resolver against
    // the existing override map; WITH OVERRIDE swaps the custodian on
    // affected days for the selectedCustodianId. Affected = day falls
    // inside [fromDate, toDate].
    const previewBar = useMemo(() => {
        if (!schedule)
            return { defaultDays: [], overrideDays: [] } as {
                defaultDays: PreviewDay[];
                overrideDays: PreviewDay[];
            };
        const overrideMap = buildOverrideMap(weekOverrides ?? []);
        const from = parseISO(fromDate).getTime();
        const to = parseISO(toDate).getTime();
        const days = Array.from({ length: 7 }, (_, i) =>
            addDays(previewWeekStart, i),
        );
        const defaultDays: PreviewDay[] = days.map((d) => {
            const r = resolveCustodianOnDate(schedule, overrideMap, d);
            const c = r.bothPresent
                ? colors.shared
                : colorForResponsible(r.profileId, colorMap);
            const affected = d.getTime() >= from && d.getTime() <= to;
            return { color: c, affected };
        });
        const overrideDays: PreviewDay[] = days.map((d) => {
            const affected = d.getTime() >= from && d.getTime() <= to;
            if (affected && selectedCustodianId) {
                return {
                    color: colorForResponsible(selectedCustodianId, colorMap),
                    affected: true,
                };
            }
            // Outside the range: same as default.
            const r = resolveCustodianOnDate(schedule, overrideMap, d);
            const c = r.bothPresent
                ? colors.shared
                : colorForResponsible(r.profileId, colorMap);
            return { color: c, affected: false };
        });
        return { defaultDays, overrideDays };
    }, [
        schedule,
        weekOverrides,
        previewWeekStart,
        fromDate,
        toDate,
        selectedCustodianId,
        colorMap,
        colors.shared,
    ]);

    // Conflict count — events in [fromDate, toDate] whose
    // responsible_profile_id is set AND differs from the selected
    // custodian. v1 approximation; Phase F will refine when the
    // reassign-on-save logic actually runs.
    const conflictCount = useMemo(() => {
        if (!selectedCustodianId) return 0;
        const fromTs = parseISO(fromDate).getTime();
        const toTs = parseISO(toDate).getTime() + 86_400_000 - 1;
        return (rangeEvents ?? []).filter((e) => {
            if (!e.responsible_profile_id) return false;
            if (e.responsible_profile_id === selectedCustodianId) return false;
            const t = parseISO(e.starts_at).getTime();
            return t >= fromTs && t <= toTs;
        }).length;
    }, [rangeEvents, fromDate, toDate, selectedCustodianId]);

    const selectedCustodian = useMemo(
        () =>
            (members ?? []).find((m) => m.profile_id === selectedCustodianId),
        [members, selectedCustodianId],
    );
    const custodianColor = selectedCustodianId
        ? colorForResponsible(selectedCustodianId, colorMap)
        : colors.inkFaint;

    // ─── early-return guards (after all hooks) ────────────────────────
    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        kidsLoading ||
        scheduleLoading ||
        roleLoading ||
        !externalsLoaded
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (householdType !== 'separated' || isCaregiver) {
        return <Redirect href="/family" />;
    }
    if (!schedule) {
        // Surface an empty-state so users understand they need to set
        // up a custody pattern before they can override it.
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safeCenter} edges={['top']}>
                    <ThemedText
                        type="subtitle"
                        style={{ textAlign: 'center' }}>
                        No custody pattern
                    </ThemedText>
                    <ThemedText
                        themeColor="textSecondary"
                        style={{ textAlign: 'center' }}>
                        Set up a custody pattern first; overrides are
                        one-off exceptions to that rule.
                    </ThemedText>
                    <Pressable
                        onPress={() => router.replace('/custody/pattern')}
                        style={({ pressed }) => [
                            styles.linkBtn,
                            pressed && styles.pressed,
                        ]}>
                        <ThemedText
                            style={{
                                color: colors.accent,
                                fontWeight: '600',
                            }}>
                            Open pattern editor
                        </ThemedText>
                    </Pressable>
                </SafeAreaView>
            </ThemedView>
        );
    }

    // ─── handlers ────────────────────────────────────────────────────
    const onPickPreset = (preset: PresetId) => {
        setSelectedPreset(preset);
        if (preset === 'custom') {
            setFromSheetOpen(true);
            return;
        }
        const range = presetRange(preset, new Date());
        if (!range) return;
        setFromDate(range.from);
        setToDate(range.to);
        // Multi-day presets (weekends) flip singleDay off so the UI
        // matches the actual range.
        setSingleDay(range.from === range.to);
    };

    const onToggleKid = (kidId: string) => {
        setSelectedKidIds((prev) =>
            prev.includes(kidId)
                ? prev.filter((k) => k !== kidId)
                : [...prev, kidId],
        );
    };

    const handleSave = async () => {
        if (!selectedCustodianId) {
            const msg = 'Pick a parent to take the kids during the override.';
            if (Platform.OS === 'web') alert(msg);
            else Alert.alert("Can't save yet", msg);
            return;
        }
        setSaving(true);
        try {
            const result = await createCustodyOverride({
                householdId: household.id,
                startDate: fromDate,
                endDate: toDate,
                custodianProfileId: selectedCustodianId,
                childIds: selectedKidIds, // empty = household-wide
                kind,
                note: note.trim() || null,
                notifyAffected,
                addToActivityFeed,
                reassignEvents,
            });
            // Auto-approved overrides apply immediately, so the user
            // sees the schedule visibly change on the next surface.
            // No confirmation needed — the navigation IS the feedback.
            //
            // Pending overrides DON'T apply yet, so the schedule looks
            // unchanged after save. Without an explicit confirmation
            // the user has no signal the save worked + no idea the
            // override is awaiting approval. Keep the popup here so
            // the latent state isn't mysterious.
            const wasPending = result.approval_status === 'pending';
            if (wasPending) {
                const msg =
                    "Sent for approval. You'll get a notification when the co-parent decides.";
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Sent for approval', msg);
            }
            router.back();
        } catch (err) {
            console.error('createCustodyOverride failed', err);
            const msg = errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't save: ${msg}`);
            else Alert.alert("Couldn't save", msg);
        } finally {
            setSaving(false);
        }
    };

    // ─── render ──────────────────────────────────────────────────────
    const previewHeader = `Preview · Wk ${isoWeekNumber(previewWeekStart)} · ${format(previewWeekStart, 'MMM d')}–${format(addDays(previewWeekStart, 6), 'd')}`;
    const dayCount =
        Math.floor(
            (parseISO(toDate).getTime() - parseISO(fromDate).getTime()) /
                86_400_000,
        ) + 1;
    const kidCount =
        selectedKidIds.length > 0
            ? selectedKidIds.length
            : (kids ?? []).length;
    const previewChip = `${dayCount} ${dayCount === 1 ? 'day' : 'days'} · ${kidCount} ${kidCount === 1 ? 'kid' : 'kids'}`;

    const ctaLabel = saving
        ? 'Saving…'
        : requiresApproval
          ? 'Send for approval'
          : 'Save override';

    // Summary line in the sticky bar — "{Custodian} takes {N kids} · {date}"
    const summaryRangeLabel =
        fromDate === toDate
            ? format(parseISO(fromDate), 'MMM d')
            : `${format(parseISO(fromDate), 'MMM d')}–${format(parseISO(toDate), 'd')}`;
    const summaryKidPhrase =
        selectedKidIds.length === 0
            ? `all ${(kids ?? []).length} ${(kids ?? []).length === 1 ? 'kid' : 'kids'}`
            : `${selectedKidIds.length} ${selectedKidIds.length === 1 ? 'kid' : 'kids'}`;

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar */}
                <View
                    style={[
                        styles.topBar,
                        { borderBottomColor: colors.hair },
                    ]}>
                    <Pressable
                        onPress={() => router.back()}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel">
                        <ThemedText
                            style={[
                                styles.cancelText,
                                { color: colors.inkSec },
                            ]}>
                            Cancel
                        </ThemedText>
                    </Pressable>
                    <ThemedText
                        style={[styles.topTitle, { color: colors.text }]}>
                        New override
                    </ThemedText>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Save override"
                        style={({ pressed }) => [
                            pressed && styles.pressed,
                            saving && { opacity: 0.5 },
                        ]}>
                        <ThemedText
                            style={[
                                styles.saveText,
                                { color: colors.accent },
                            ]}>
                            {saving ? 'Saving…' : 'Save'}
                        </ThemedText>
                    </Pressable>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled">
                    {/* Live preview */}
                    <View style={styles.previewWrap}>
                        <OverridePreviewBar
                            headerLabel={previewHeader}
                            chipLabel={previewChip}
                            defaultDays={previewBar.defaultDays}
                            overrideDays={previewBar.overrideDays}
                        />
                    </View>

                    {/* What's happening */}
                    <SGroup label="What's happening">
                        <View style={styles.kindChipWrap}>
                            {KIND_OPTIONS.map((opt) => (
                                <KindChip
                                    key={opt.id}
                                    label={opt.label}
                                    icon={opt.icon}
                                    selected={kind === opt.id}
                                    onPress={() => setKind(opt.id)}
                                />
                            ))}
                        </View>
                    </SGroup>

                    {/* When */}
                    <SGroup label="When">
                        <SRow
                            label="Single day"
                            right={
                                <FormSwitch
                                    value={singleDay}
                                    onValueChange={(next) => {
                                        setSingleDay(next);
                                        if (next) setToDate(fromDate);
                                    }}
                                />
                            }
                        />
                        <View style={styles.whenPadding}>
                            <ThemedText
                                style={[
                                    styles.whenSubLabel,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                {singleDay ? 'DATE' : 'DATE RANGE'}
                            </ThemedText>
                            <DateRangeBoxes
                                fromValue={format(
                                    parseISO(fromDate),
                                    'EEE · MMM d',
                                )}
                                fromSub={format(parseISO(fromDate), 'yyyy')}
                                toValue={format(
                                    parseISO(toDate),
                                    'EEE · MMM d',
                                )}
                                toSub={format(parseISO(toDate), 'yyyy')}
                                onPressFrom={() => setFromSheetOpen(true)}
                                onPressTo={
                                    singleDay
                                        ? undefined
                                        : () => setToSheetOpen(true)
                                }
                            />
                            <View style={styles.presetRow}>
                                <PresetChip
                                    label="Today"
                                    selected={selectedPreset === 'today'}
                                    onPress={() => onPickPreset('today')}
                                />
                                <PresetChip
                                    label="Tomorrow"
                                    selected={selectedPreset === 'tomorrow'}
                                    onPress={() => onPickPreset('tomorrow')}
                                />
                                <PresetChip
                                    label="This weekend"
                                    selected={selectedPreset === 'this_weekend'}
                                    onPress={() => onPickPreset('this_weekend')}
                                />
                                <PresetChip
                                    label="Next weekend"
                                    selected={selectedPreset === 'next_weekend'}
                                    onPress={() => onPickPreset('next_weekend')}
                                />
                                <PresetChip
                                    label="Custom…"
                                    muted
                                    onPress={() => onPickPreset('custom')}
                                />
                            </View>
                        </View>
                        <SRow
                            label="Time"
                            right={
                                <ThemedText
                                    style={[
                                        styles.timeRight,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    All day
                                </ThemedText>
                            }
                            chevron
                            last
                            onPress={() => {
                                // Partial-day overrides deferred — surface
                                // a coming-soon note rather than a broken
                                // picker. Mirrors the pattern editor's
                                // "Custom… pattern" placeholder.
                                const msg =
                                    'Partial-day overrides coming soon. Today the override applies to the whole day.';
                                if (Platform.OS === 'web') alert(msg);
                                else
                                    Alert.alert(
                                        'Coming soon',
                                        msg,
                                    );
                            }}
                        />
                    </SGroup>

                    {/* Affects */}
                    <SGroup label="Affects">
                        {(kids ?? []).length === 0 ? (
                            <View style={styles.emptyKids}>
                                <ThemedText
                                    style={{ color: colors.inkFaint }}>
                                    No kids added to this household yet.
                                </ThemedText>
                            </View>
                        ) : (
                            (kids ?? []).map((k, idx) => {
                                const meta = kidDefaults.get(k.id);
                                const isSelected = selectedKidIds.includes(
                                    k.id,
                                );
                                const subParts: string[] = [];
                                if (meta) subParts.push(`Default · ${meta.name}`);
                                const externalLink = externalCoparents.find(
                                    (ec) => ec.child_id === k.id,
                                );
                                return (
                                    <KidCheckRow
                                        key={k.id}
                                        name={k.display_name}
                                        color={k.color}
                                        sub={
                                            subParts.join(' · ') ||
                                            'No default'
                                        }
                                        selected={isSelected}
                                        externalNote={
                                            externalLink
                                                ? `${externalLink.profile_display_name || 'Co-parent'} affected`
                                                : null
                                        }
                                        last={idx === (kids ?? []).length - 1}
                                        onPress={() => onToggleKid(k.id)}
                                    />
                                );
                            })
                        )}
                    </SGroup>

                    {/* With whom — household parents first, then external
                        co-parents. The CURRENT effective custodian (pattern
                        + applied overrides) renders muted because saving
                        them is a no-op — they already have the kids.
                        Crucially this is NOT the pattern default; an
                        existing override on the date can flip which
                        parent is muted (and which is the meaningful
                        "switch back" target). */}
                    <SGroup label="With whom">
                        {parents.map((p, idx) => {
                            // Apply existing overrides to determine who
                            // ACTUALLY has the kids on the From date.
                            // Without this, a day that's already
                            // overridden to Parent 2 still mutes Parent
                            // 1 (the pattern default) and you can't
                            // tap them to switch back.
                            const effectiveOverrideMap =
                                buildOverrideMap(weekOverrides ?? []);
                            const effectiveProfileId = schedule
                                ? resolveCustodianOnDate(
                                      schedule,
                                      effectiveOverrideMap,
                                      parseISO(fromDate),
                                  ).profileId
                                : null;
                            const isCurrentCustodian =
                                effectiveProfileId === p.profile_id;
                            return (
                                <CaregiverPickRow
                                    key={p.profile_id}
                                    name={p.display_name}
                                    color={colorForResponsible(
                                        p.profile_id,
                                        colorMap,
                                    )}
                                    sub={
                                        isCurrentCustodian
                                            ? 'Currently has the kids'
                                            : 'Household parent'
                                    }
                                    selected={
                                        selectedCustodianId === p.profile_id
                                    }
                                    muted={isCurrentCustodian}
                                    onPress={() =>
                                        setSelectedCustodianId(p.profile_id)
                                    }
                                    last={
                                        idx === parents.length - 1 &&
                                        externalCoparents.length === 0
                                    }
                                />
                            );
                        })}
                        {/* De-dupe external co-parents by profile_id (one
                            person can be linked to multiple kids). */}
                        {Array.from(
                            new Map(
                                externalCoparents.map((ec) => [
                                    ec.profile_id,
                                    ec,
                                ]),
                            ).values(),
                        ).map((ec, idx, arr) => (
                            <CaregiverPickRow
                                key={ec.profile_id}
                                name={ec.profile_display_name || 'Co-parent'}
                                color={ec.color || colors.accent}
                                sub={`External · ${ec.child_display_name}'s other parent`}
                                selected={
                                    selectedCustodianId === ec.profile_id
                                }
                                external
                                onPress={() =>
                                    setSelectedCustodianId(ec.profile_id)
                                }
                                last={idx === arr.length - 1}
                            />
                        ))}
                    </SGroup>

                    {/* Notes */}
                    <SGroup label="Notes">
                        <View style={styles.notesPadding}>
                            <TextInput
                                value={note}
                                onChangeText={setNote}
                                placeholder="Why this change? e.g. travel, swap, vacation"
                                placeholderTextColor={colors.inkFaint}
                                multiline
                                style={[
                                    styles.noteInput,
                                    {
                                        color: colors.text,
                                        backgroundColor: colors.backgroundInset,
                                        borderColor: colors.hair,
                                    },
                                ]}
                            />
                        </View>
                    </SGroup>

                    {/* Approval banner — only when external co-parent
                        affected. The body sentence names them inline so
                        the user sees the consequence at a glance. */}
                    {requiresApproval ? (
                        <View style={styles.approvalWrap}>
                            <ApprovalBanner
                                body={
                                    requiredApprovers.length === 1
                                        ? `Because ${requiredApprovers[0].profile_display_name || 'a co-parent'} is affected, this override will go to them for approval before it takes effect.`
                                        : `Because ${requiredApprovers.length} co-parents are affected, this override will go to each of them for approval before it takes effect.`
                                }
                                approvers={requiredApprovers.map((ec) => ({
                                    profileId: ec.profile_id,
                                    name:
                                        ec.profile_display_name ||
                                        'Co-parent',
                                    color: ec.color || colors.accent,
                                    sub: `${ec.child_display_name}'s other parent`,
                                }))}
                            />
                        </View>
                    ) : null}

                    {/* Notifications */}
                    <SGroup label="Notifications">
                        <SRow
                            label="Notify everyone affected"
                            right={
                                <FormSwitch
                                    value={notifyAffected}
                                    onValueChange={setNotifyAffected}
                                />
                            }
                        />
                        <SRow
                            label="Add to family activity feed"
                            right={
                                <FormSwitch
                                    value={addToActivityFeed}
                                    onValueChange={setAddToActivityFeed}
                                />
                            }
                        />
                        <SRow
                            label="Reassign existing events"
                            right={
                                <FormSwitch
                                    value={reassignEvents}
                                    onValueChange={setReassignEvents}
                                />
                            }
                            last
                        />
                    </SGroup>

                    {/* Conflict warning — only when there are events that
                        would be reassigned. Dashed border + info icon
                        mirror the design's "soft warning" treatment. */}
                    {conflictCount > 0 && reassignEvents ? (
                        <View
                            style={[
                                styles.conflictCard,
                                { borderColor: colors.hair },
                            ]}>
                            <Feather
                                name="info"
                                size={15}
                                color={colors.inkSec}
                                style={{ marginTop: 1 }}
                            />
                            <ThemedText
                                style={[
                                    styles.conflictText,
                                    { color: colors.inkSec },
                                ]}>
                                <ThemedText
                                    style={{
                                        fontWeight: '600',
                                        color: colors.text,
                                    }}>
                                    {conflictCount} event
                                    {conflictCount === 1 ? '' : 's'} will
                                    be reassigned
                                    {selectedCustodian
                                        ? ` to ${selectedCustodian.display_name}`
                                        : ''}
                                </ThemedText>{' '}
                                when the override is saved.
                            </ThemedText>
                        </View>
                    ) : null}
                </ScrollView>

                {/* Sticky save bar */}
                <View
                    style={[
                        styles.saveBar,
                        {
                            backgroundColor:
                                Platform.OS === 'web'
                                    ? withAlpha(colors.background, 0.95)
                                    : colors.background,
                            borderTopColor: colors.hair,
                        },
                        Platform.OS === 'web'
                            ? ({
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                              } as object)
                            : null,
                    ]}>
                    <View style={styles.saveBarLeft}>
                        {selectedCustodian ? (
                            <MemberAvatar
                                name={selectedCustodian.display_name}
                                color={custodianColor}
                                size="sm"
                            />
                        ) : null}
                        <ThemedText
                            style={[
                                styles.saveBarText,
                                { color: colors.inkSec },
                            ]}
                            numberOfLines={2}>
                            {selectedCustodian?.display_name ?? 'Pick a parent'}{' '}
                            takes{' '}
                            <ThemedText
                                style={{
                                    color: colors.text,
                                    fontWeight: '600',
                                    fontFamily: FontFamily.monoSemiBold,
                                }}>
                                {summaryKidPhrase}
                            </ThemedText>{' '}
                            ·{' '}
                            <ThemedText
                                style={{
                                    color: colors.text,
                                    fontWeight: '600',
                                    fontFamily: FontFamily.monoSemiBold,
                                }}>
                                {summaryRangeLabel}
                            </ThemedText>
                        </ThemedText>
                    </View>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving || !selectedCustodianId}
                        accessibilityRole="button"
                        accessibilityLabel={ctaLabel}
                        style={({ pressed }) => [
                            styles.savePrimary,
                            { backgroundColor: colors.accent },
                            (saving || !selectedCustodianId) && {
                                opacity: 0.5,
                            },
                            pressed &&
                                !saving &&
                                selectedCustodianId &&
                                styles.pressed,
                        ]}>
                        <Feather
                            name="check"
                            size={11}
                            color={colors.onAccent}
                        />
                        <ThemedText
                            style={[
                                styles.savePrimaryText,
                                { color: colors.onAccent },
                            ]}>
                            {ctaLabel}
                        </ThemedText>
                    </Pressable>
                </View>

                {/* Date picker sheets */}
                <DateTimePickerSheet
                    open={fromSheetOpen}
                    title={singleDay ? 'Override date' : 'From date'}
                    sub="Pick the start of the override."
                    initialDate={fromDate}
                    initialTime=""
                    allDay
                    onSave={(next) => {
                        setFromDate(next.date);
                        if (singleDay) setToDate(next.date);
                        setSelectedPreset(null);
                        setFromSheetOpen(false);
                    }}
                    onClose={() => setFromSheetOpen(false)}
                />
                <DateTimePickerSheet
                    open={toSheetOpen}
                    title="To date"
                    sub="Pick the inclusive end of the override range."
                    initialDate={toDate}
                    initialTime=""
                    allDay
                    onSave={(next) => {
                        // Snap to fromDate if user picks something
                        // earlier — keep the range valid without an
                        // error toast.
                        const picked =
                            next.date < fromDate ? fromDate : next.date;
                        setToDate(picked);
                        setSelectedPreset(null);
                        setToSheetOpen(false);
                    }}
                    onClose={() => setToSheetOpen(false)}
                />
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── helpers ───────────────────────────────────────────────────────────

function isoWeekNumber(date: Date): number {
    const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(
        ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    safeCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        paddingHorizontal: 24,
    },
    scroll: { paddingBottom: 120 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    topTitle: {
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.3,
    },
    saveText: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    previewWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

    kindChipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        padding: 12,
    },

    whenPadding: { padding: 14 },
    whenSubLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        marginBottom: 10,
    },
    presetRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
        flexWrap: 'wrap',
    },
    timeRight: {
        fontSize: 13,
        fontWeight: '500',
    },

    emptyKids: { padding: 14 },

    notesPadding: { padding: 12 },
    noteInput: {
        minHeight: 64,
        padding: 12,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        fontSize: 13.5,
        lineHeight: 19,
        textAlignVertical: 'top',
    },

    approvalWrap: {
        paddingHorizontal: 16,
        marginBottom: 18,
    },

    conflictCard: {
        marginHorizontal: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderStyle: 'dashed',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    conflictText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 16,
    },

    saveBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
        ...HEAVY_FAB_SHADOW,
    },
    saveBarLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    saveBarText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 15,
    },
    savePrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 10,
    },
    savePrimaryText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    linkBtn: { padding: 8 },
    pressed: { opacity: 0.7 },
});
