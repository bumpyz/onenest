// CustodyPatternEditor — replaces /settings/custody entirely.
// Design source: design_handoff_custody_surfaces — CustodyPatternEditor
// (screens-custody.jsx ~167-476) + README "Change 4".
//
// Sections, top to bottom:
//   1. Top bar — Cancel · "Custody pattern" · Save
//   2. Live preview banner — next 2 weeks with hand-off ticks + LIVE chip
//   3. Pattern type — 4 PatternOption radio cards (mini SVG visualization)
//   4. Hand-off — day-of-week segmented + Time row + Location row
//   5. Anchor — Pattern started date + Who has this week
//   6. Per-child overrides — KidPatternRow per child (with optional
//      external-co-parent avatar bug)
//   7. Behavior toggles — 3 switches
//   8. Destructive — "Stop using a custody pattern"
//   9. Sticky save bar — impact warning (N events will be reassigned) +
//      Save pattern accent CTA
//
// Backend gates (stubbed per #371's "Stub UI now, defer backend"):
//   • Per-child overrides → tap surfaces "Coming soon" (no per-child
//     pattern column yet)
//   • Custom pattern type → save returns "Coming soon"
//   • Hand-off time/location → editable in state; persisted into the
//     pattern's name field for now since the schedule schema lacks
//     dedicated columns. Future migration moves them out.
//   • Behavior toggles → local state only (no household-level columns)
//   • Stop using a custody pattern → confirm + "Coming soon" alert
//   • Impact-warning count → naive (counts events in the upcoming 2 weeks
//     with a responsible_profile_id that would flip under the new pattern)

import { Feather } from '@expo/vector-icons';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import { CustodyWeekBar } from '@/components/custody/custody-week-bar';
import { DateTimePickerSheet } from '@/components/ds/date-time-picker-sheet';
import { SheetShell } from '@/components/ds/sheet-shell';
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
import { useLocations } from '@/hooks/use-locations';
import { useMyRole } from '@/hooks/use-my-role';
import {
    buildOverrideMap,
    CUSTODY_PATTERNS,
    findPattern,
    previewImpact,
    resolveCustodianOnDate,
    type CustodyPatternId,
} from '@/lib/custody';
import {
    colorForResponsible,
    memberColorMap,
} from '@/lib/colors';
import {
    disableCustodySchedule,
    upsertCustodySchedule,
    type CustodySchedule,
    type Location,
} from '@/lib/db';
import { errorMessage } from '@/lib/errors';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Design pattern slots map directly to CUSTODY_PATTERNS by id. The
// "Custom · day-by-day" option was specced in the handoff README but
// never given an editor design — pulled per the #377 product call.
// It'll come back when there's a dedicated design pass for the
// day-by-day picker UI. Until then the four presets cover the standard
// custody arrangements.
type EditorPatternId = CustodyPatternId;

// Mirrors the full catalog in lib/custody.ts CUSTODY_PATTERNS so a
// household saved with any preset can re-select its current pattern in
// the editor. Previously only listed the 3 most common (7-7, 2-2-3,
// alternating-weekends), which meant households on 2-2-5-5 / 3-4-4-3 /
// 5-2 silently flipped to 7-7 on Save (the local `patternId` useState
// default would never match their stored value, so the editor showed
// the wrong pattern selected). Caught by UX audit HIGH finding.
const PATTERN_OPTIONS: Array<{
    id: EditorPatternId;
    title: string;
    sub: string;
}> = [
    {
        id: '7-7',
        title: 'Alternating weeks',
        sub: 'One parent each full week · simplest',
    },
    {
        id: '2-2-3',
        title: '2-2-3 rotation',
        sub: 'Mon–Tue with one · Wed–Thu the other · alternate Fri–Sun',
    },
    {
        id: '2-2-5-5',
        title: '2-2-5-5',
        sub: '2 days A · 2 days B · 5 days A · 5 days B · 14-day cycle, 50/50',
    },
    {
        id: '3-4-4-3',
        title: '3-4-4-3',
        sub: '3 days A then 4 with B · next week 4 with A then 3 with B · 14-day cycle, 50/50',
    },
    {
        id: '5-2',
        title: '5-2',
        sub: 'Weekday parent has Mon–Fri · weekend parent has Sat–Sun · primary custody',
    },
    {
        id: 'alternating-weekends',
        title: 'Every other weekend',
        sub: 'One parent has the kids Mon–Thu · other gets Fri–Sun',
    },
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export default function CustodyPatternEditorScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const householdType = household?.household_type ?? 'separated';
    const { schedule, isLoading: scheduleLoading, refetch } =
        useCustodySchedule(household?.id);
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    const { children: householdChildren, isLoading: childrenLoading } =
        useChildren(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Local editor state — seeded from the loaded schedule.
    const [patternId, setPatternId] = useState<EditorPatternId>('7-7');
    // Monday-first per the day-labels convention (cell 0 = M, cell 6 = S).
    // Sunday (cell 6) is the design's default hand-off day; the seed below
    // re-reads from `schedule.handoff_day_index` once the row loads.
    const [handoffDayIndex, setHandoffDayIndex] = useState(6);
    // HH:MM (24h). The DB stores HH:MM:SS but the UI works in HH:MM.
    const [handoffTime, setHandoffTime] = useState<string>('18:00');
    const [handoffLocationId, setHandoffLocationId] =
        useState<string | null>(null);
    const [anchorDate, setAnchorDate] = useState<string>(''); // YYYY-MM-DD
    const [parentAId, setParentAId] = useState<string>('');
    const [parentBId, setParentBId] = useState<string>('');
    const [autoAssign, setAutoAssign] = useState(true);
    const [handoffReminders, setHandoffReminders] = useState(true);
    const [notifyExternals, setNotifyExternals] = useState(false);
    const [saving, setSaving] = useState(false);
    // Sheet open flags (Phase D). One boolean per inline picker keeps the
    // sheet management visible at a glance.
    const [timeSheetOpen, setTimeSheetOpen] = useState(false);
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);
    const [anchorDateSheetOpen, setAnchorDateSheetOpen] = useState(false);
    const [anchorParentSheetOpen, setAnchorParentSheetOpen] = useState(false);

    // Locations cache for the hand-off location sheet (#374).
    const { locations } = useLocations(household?.id);
    const handoffLocation: Location | null = useMemo(() => {
        if (!handoffLocationId) return null;
        return (locations ?? []).find((l) => l.id === handoffLocationId) ?? null;
    }, [locations, handoffLocationId]);

    useEffect(() => {
        if (!schedule) return;
        setPatternId(schedule.pattern_id as EditorPatternId);
        setAnchorDate(schedule.anchor_date);
        setParentAId(schedule.parent_a_profile_id);
        setParentBId(schedule.parent_b_profile_id);
        // Phase 2 columns (migration 0048) — seed from the schedule. The
        // migration backfills defaults for pre-existing rows (handoff_time
        // 18:00, handoff_day_index 0, toggles on except notify_externals)
        // so this works for both old + new households without a special
        // case for null.
        setHandoffDayIndex(schedule.handoff_day_index);
        // HH:MM:SS → HH:MM for the UI.
        setHandoffTime(schedule.handoff_time.slice(0, 5));
        setHandoffLocationId(schedule.handoff_location_id);
        setAutoAssign(schedule.auto_assign);
        setHandoffReminders(schedule.handoff_reminders);
        setNotifyExternals(schedule.notify_externals);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule?.id]);

    // NOTE: do NOT early-return before this point. Every hook below
    // (including the useMemo) must fire on every render to satisfy
    // React's Rules of Hooks — gating on loading / household / role
    // BEFORE useMemo would change the hook count between renders and
    // crash with "change in the order of Hooks called by …" (the
    // exact crash this comment is documenting a fix for).
    //
    // Pre-hook derived values (colorMap, parentA/B, colorA/B) are
    // PURE FUNCTIONS, not hooks, so they're safe to compute here.
    const colorMap = memberColorMap(members ?? []);
    const parentA = (members ?? []).find(
        (m) => m.profile_id === parentAId,
    );
    const parentB = (members ?? []).find(
        (m) => m.profile_id === parentBId,
    );
    const colorA = colorForResponsible(parentAId, colorMap);
    const colorB = colorForResponsible(parentBId, colorMap);

    // Impact-warning inputs (#378). Fetch the next 28 days of events +
    // overrides; previewImpact diffs the current schedule vs. the draft.
    const impactRangeStart = useMemo(() => new Date(), []);
    // Stable YYYY-MM-DD for the hand-off time sheet's `initialDate` —
    // a fresh `new Date()` every render rotated the prop on every parent
    // re-render, which re-fired DateTimePickerSheet's seed effect and
    // could clobber in-progress edits inside the sheet (audit MEDIUM
    // #20). Memoizing once locks the value for the editor's lifetime.
    const timeSheetAnchorDate = useMemo(
        () => format(new Date(), 'yyyy-MM-dd'),
        [],
    );
    const { events: rangeEvents } = useEvents(household?.id, impactRangeStart, 28);
    const { overrides: rangeOverrides } = useCustodyOverrides(
        household?.id,
        impactRangeStart,
        addDays(impactRangeStart, 27),
    );
    const impactPreview = useMemo(() => {
        const draftPattern = findPattern(patternId);
        if (!schedule || !draftPattern || !parentAId || !parentBId || !anchorDate) {
            return { eventCount: 0, sampleDates: [] };
        }
        // Build a draft schedule object from the current editor state so
        // previewImpact can diff it. We synthesize the columns the
        // resolver reads — IDs / parent ids / anchor / cycle_days —
        // ignoring the metadata fields that don't affect resolution.
        const draftSchedule = {
            ...schedule,
            pattern_id: patternId,
            cycle_days: draftPattern.cycle as string[],
            parent_a_profile_id: parentAId,
            parent_b_profile_id: parentBId,
            anchor_date: anchorDate,
            disabled_at: null,
        };
        const overrideMap = buildOverrideMap(rangeOverrides ?? []);
        return previewImpact(
            schedule,
            draftSchedule,
            rangeEvents ?? [],
            overrideMap,
        );
    }, [
        schedule,
        patternId,
        parentAId,
        parentBId,
        anchorDate,
        rangeEvents,
        rangeOverrides,
    ]);

    // Live 2-week preview — runs the SAME resolver the calendar / viewer
    // use, against a synthesized draft schedule. Previously hand-rolled
    // a parallel cycle-math loop (`delta = (now - anchor) / 86_400_000`,
    // ad-hoc modulo) — which drifted off-phase from the real resolver
    // for patterns where the anchor isn't a Monday (especially
    // alternating-weekends, which the README explicitly anchors on
    // Monday). UX audit HIGH flagged the divergence. Sharing the
    // resolver here is the single-source-of-truth fix.
    //
    // No overrides are passed: the editor preview is purely the
    // pattern's rhythm, not the household's per-day exceptions. The
    // live calendar still layers overrides on top.
    const previewWeeks = useMemo(() => {
        const pattern = findPattern(patternId);
        if (!pattern || !parentAId || !parentBId || !anchorDate) {
            return [];
        }
        const draftSchedule: CustodySchedule = {
            ...(schedule ?? ({} as CustodySchedule)),
            id: schedule?.id ?? 'preview',
            household_id: schedule?.household_id ?? household?.id ?? '',
            pattern_id: patternId,
            cycle_days: pattern.cycle as string[],
            parent_a_profile_id: parentAId,
            parent_b_profile_id: parentBId,
            anchor_date: anchorDate,
            disabled_at: null,
        };
        const emptyOverrides = new Map();
        const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
        const buildWeek = (offset: number) =>
            Array.from({ length: 7 }, (_, d) => {
                const date = addDays(monday, offset * 7 + d);
                const r = resolveCustodianOnDate(
                    draftSchedule,
                    emptyOverrides,
                    date,
                );
                if (r.bothPresent) return colors.shared;
                return r.profileId === parentAId ? colorA : colorB;
            });
        return [
            { start: monday, days: buildWeek(0) },
            { start: addDays(monday, 7), days: buildWeek(1) },
        ];
    }, [
        patternId,
        anchorDate,
        parentAId,
        parentBId,
        schedule,
        household?.id,
        colorA,
        colorB,
        colors.shared,
    ]);

    // Early-return guards — moved BELOW all hooks (see the Rules-of-
    // Hooks note above). Render branches: loading → spinner; no auth
    // → sign-in; no household → onboarding; wrong role/type → family
    // hub. Order matters: cheaper checks first so we avoid waiting on
    // role/schedule fetches when auth or household haven't resolved.
    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        childrenLoading ||
        scheduleLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (householdType !== 'separated' || isCaregiver) {
        return <Redirect href="/family" />;
    }

    const handleSave = async () => {
        if (!household || !parentAId || !parentBId || !anchorDate) {
            return;
        }
        const pattern = findPattern(patternId);
        if (!pattern) return;
        setSaving(true);
        try {
            // Thread all the new Phase 2 fields through. The migration's
            // defaults already populate sensible values for existing rows,
            // so saving from the editor always overwrites with the user's
            // explicit choice — which matches the Save button's intent.
            await upsertCustodySchedule(household.id, {
                patternId,
                cycleDays: pattern.cycle as string[],
                parentAProfileId: parentAId,
                parentBProfileId: parentBId,
                anchorDate,
                handoffTime: `${handoffTime}:00`, // DB stores HH:MM:SS
                handoffDayIndex,
                handoffLocationId,
                autoAssign,
                handoffReminders,
                notifyExternals,
            });
            await refetch();
            router.back();
        } catch (err) {
            console.error('save custody pattern failed', err);
            const msg =
                errorMessage(err) ?? 'Please try again in a moment.';
            if (Platform.OS === 'web') alert(`Couldn't save: ${msg}`);
            else Alert.alert("Couldn't save", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleStopUsing = () => {
        if (!household) return;
        const title = 'Stop using a custody pattern?';
        const body =
            'Keeps existing events but disables auto-assignment and reminders. Past schedule stays visible.';
        // Real soft-stop now (#376). Sets `custody_schedules.disabled_at`
        // via disableCustodySchedule; every resolver / hook is wired to
        // treat that the same as no-schedule. Re-enable by editing the
        // pattern again — upsertCustodySchedule clears disabled_at.
        const doDisable = async () => {
            try {
                await disableCustodySchedule(household.id);
                await refetch();
                router.back();
            } catch (err) {
                console.error('disable custody pattern failed', err);
                const msg =
                    errorMessage(err) ?? 'Please try again in a moment.';
                if (Platform.OS === 'web') alert(`Couldn't stop: ${msg}`);
                else Alert.alert("Couldn't stop", msg);
            }
        };
        if (Platform.OS === 'web') {
            if (
                typeof window !== 'undefined' &&
                window.confirm(`${title}\n\n${body}`)
            ) {
                void doDisable();
            }
            return;
        }
        Alert.alert(title, body, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Stop',
                style: 'destructive',
                onPress: () => {
                    void doDisable();
                },
            },
        ]);
    };

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
                        Custody pattern
                    </ThemedText>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Save"
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
                        <View
                            style={[
                                styles.previewCard,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                            ]}>
                            <View style={styles.previewHeader}>
                                <ThemedText
                                    style={[
                                        styles.previewHeaderLabel,
                                        {
                                            color: colors.inkFaint,
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        },
                                    ]}>
                                    PREVIEW · NEXT 2 WEEKS
                                </ThemedText>
                                <View
                                    style={[
                                        styles.liveChip,
                                        {
                                            backgroundColor: withAlpha(
                                                colors.accent,
                                                0x18 / 255,
                                            ),
                                        },
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.liveChipText,
                                            {
                                                color: colors.accent,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        LIVE
                                    </ThemedText>
                                </View>
                            </View>
                            {previewWeeks.map((w, i) => (
                                <View
                                    key={i}
                                    style={{ marginTop: i ? 10 : 0 }}>
                                    <ThemedText
                                        style={[
                                            styles.previewWeekLabel,
                                            {
                                                color: colors.inkFaint,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        WK {isoWeekNumber(w.start)} ·{' '}
                                        {format(w.start, 'MMM d')}–
                                        {format(addDays(w.start, 6), 'd')}
                                    </ThemedText>
                                    <CustodyWeekBar
                                        days={w.days.map((c) => ({
                                            color: c,
                                        }))}
                                        size="sm"
                                        handoffIndex={handoffDayIndex}
                                        hideDayLabels={false}
                                    />
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Pattern type */}
                    <SubGroup
                        label="Pattern"
                        subLabel="How custody alternates between the two parents."
                        colors={colors}>
                        {PATTERN_OPTIONS.map((opt, idx) => {
                            const selected = patternId === opt.id;
                            const isLast =
                                idx === PATTERN_OPTIONS.length - 1;
                            return (
                                <PatternOptionRow
                                    key={opt.id}
                                    title={opt.title}
                                    sub={opt.sub}
                                    selected={selected}
                                    onPress={() => setPatternId(opt.id)}
                                    miniViz={
                                        <PatternMiniViz
                                            id={opt.id}
                                            colorA={colorA}
                                            colorB={colorB}
                                            colors={colors}
                                        />
                                    }
                                    colors={colors}
                                    isLast={isLast}
                                />
                            );
                        })}
                    </SubGroup>

                    {/* Hand-off */}
                    <SubGroup
                        label="Hand-off"
                        subLabel="When the switch happens. Used for the next-handoff timer and reminders."
                        colors={colors}>
                        <View style={styles.handoffDayWrap}>
                            <ThemedText
                                style={[
                                    styles.subSectionLabel,
                                    {
                                        color: colors.inkFaint,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                DAY OF WEEK
                            </ThemedText>
                            <View style={styles.handoffDayRow}>
                                {DAY_LABELS.map((d, i) => {
                                    const sel = i === handoffDayIndex;
                                    return (
                                        <Pressable
                                            key={i}
                                            onPress={() =>
                                                setHandoffDayIndex(i)
                                            }
                                            accessibilityRole="button"
                                            accessibilityLabel={`Hand-off on ${d}`}
                                            accessibilityState={{
                                                selected: sel,
                                            }}
                                            style={({ pressed }) => [
                                                styles.handoffDayCell,
                                                {
                                                    backgroundColor: sel
                                                        ? colors.accent
                                                        : colors.backgroundInset,
                                                    borderColor: sel
                                                        ? colors.accent
                                                        : colors.hair,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.handoffDayLabel,
                                                    {
                                                        color: sel
                                                            ? colors.onAccent
                                                            : colors.inkSec,
                                                        fontFamily:
                                                            FontFamily.monoSemiBold,
                                                    },
                                                ]}>
                                                {d}
                                            </ThemedText>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
                        <SubRow
                            label="Time"
                            value={handoffTime}
                            mono
                            chevron
                            onPress={() => setTimeSheetOpen(true)}
                            colors={colors}
                        />
                        <SubRow
                            label="Hand-off location"
                            sub="Optional · used in reminders"
                            value={handoffLocation?.name ?? 'Not set'}
                            mono
                            chevron
                            isLast
                            onPress={() => setLocationSheetOpen(true)}
                            colors={colors}
                        />
                    </SubGroup>

                    {/* Anchor */}
                    <SubGroup
                        label="Anchor"
                        subLabel="Which week is whose. Editing this shifts all future weeks."
                        colors={colors}>
                        <SubRow
                            label="Pattern started"
                            value={
                                anchorDate
                                    ? format(parseISO(anchorDate), 'MMM d, yyyy')
                                    : 'Set'
                            }
                            mono
                            chevron
                            onPress={() => setAnchorDateSheetOpen(true)}
                            colors={colors}
                        />
                        <SubRow
                            label="Who has this week"
                            value={parentA?.display_name ?? '—'}
                            mono
                            chevron
                            isLast
                            onPress={() => setAnchorParentSheetOpen(true)}
                            colors={colors}
                        />
                    </SubGroup>

                    {/* Per-child overrides */}
                    {(householdChildren ?? []).length > 0 ? (
                        <SubGroup
                            label="Per-child overrides"
                            subLabel="Kids with external co-parents have schedules that layer on top of the alternating pattern."
                            colors={colors}>
                            {(householdChildren ?? []).map((c, idx) => (
                                <KidPatternRow
                                    key={c.id}
                                    displayName={c.display_name}
                                    color={c.color}
                                    summary="Follows main pattern"
                                    detail={
                                        parentA && parentB
                                            ? `${parentA.display_name} ↔ ${parentB.display_name} alternating`
                                            : 'Alternating'
                                    }
                                    onPress={() =>
                                        showComingSoon(
                                            `${c.display_name}'s pattern`,
                                            'Per-child custody overrides are coming soon. They let blended families layer different rhythms for different kids.',
                                        )
                                    }
                                    colors={colors}
                                    isLast={
                                        idx ===
                                        (householdChildren?.length ?? 1) - 1
                                    }
                                />
                            ))}
                        </SubGroup>
                    ) : null}

                    {/* Behavior toggles */}
                    <SubGroup label="Behavior" colors={colors}>
                        <SubToggle
                            label="Auto-assign events to current parent"
                            sub="New events default to whoever has the kids that day"
                            value={autoAssign}
                            onChange={setAutoAssign}
                            colors={colors}
                        />
                        <SubToggle
                            label="Send hand-off reminders"
                            sub="2 hours before each switch · to both parents"
                            value={handoffReminders}
                            onChange={setHandoffReminders}
                            colors={colors}
                        />
                        <SubToggle
                            label="Notify external co-parents of pattern changes"
                            sub="External co-parents see when this rule changes"
                            value={notifyExternals}
                            onChange={setNotifyExternals}
                            colors={colors}
                            isLast
                        />
                    </SubGroup>

                    {/* Destructive — stop using */}
                    <View style={styles.dangerWrap}>
                        <Pressable
                            onPress={handleStopUsing}
                            accessibilityRole="button"
                            accessibilityLabel="Stop using a custody pattern"
                            style={({ pressed }) => [
                                styles.dangerCard,
                                {
                                    backgroundColor:
                                        colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.dangerText,
                                    { color: colors.alert },
                                ]}>
                                Stop using a custody pattern
                            </ThemedText>
                        </Pressable>
                        <ThemedText
                            style={[
                                styles.dangerHint,
                                { color: colors.inkFaint },
                            ]}>
                            Keeps existing events but disables auto-assignment
                            and reminders. Past schedule stays visible.
                        </ThemedText>
                    </View>
                </ScrollView>

                {/* Sticky save bar with impact warning */}
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
                    {/* Impact warning (#378). Hide when zero per design —
                        no point taking the sticky-bar slot when nothing
                        would change. Reads "N events will be reassigned"
                        with the count in warn. */}
                    <View style={styles.impactLeft}>
                        {impactPreview.eventCount > 0 ? (
                            <>
                                <Feather
                                    name="alert-triangle"
                                    size={13}
                                    color={colors.warn}
                                />
                                <ThemedText
                                    style={[
                                        styles.impactText,
                                        { color: colors.inkSec },
                                    ]}>
                                    <ThemedText
                                        style={{
                                            color: colors.warn,
                                            fontWeight: '600',
                                            fontFamily:
                                                FontFamily.monoSemiBold,
                                        }}>
                                        {impactPreview.eventCount}
                                    </ThemedText>{' '}
                                    {impactPreview.eventCount === 1
                                        ? 'event will be reassigned'
                                        : 'events will be reassigned'}
                                </ThemedText>
                            </>
                        ) : null}
                    </View>
                    <Pressable
                        onPress={handleSave}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Save pattern"
                        style={({ pressed }) => [
                            styles.savePrimary,
                            { backgroundColor: colors.accent },
                            saving && { opacity: 0.5 },
                            pressed && !saving && styles.pressed,
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
                            {/* Disabled-schedule label hint (audit MEDIUM
                                #19): when the user opens the editor on a
                                soft-stopped pattern, Save will re-enable
                                it. The button copy makes that explicit so
                                a casual "just look" doesn't accidentally
                                turn auto-assign + reminders back on. */}
                            {schedule?.disabled_at
                                ? 'Re-enable pattern'
                                : 'Save pattern'}
                        </ThemedText>
                    </Pressable>
                </View>

                {/* ── Phase D sheets ──────────────────────────────────
                    Each picker writes back to the editor's local state.
                    Nothing persists until the user taps "Save pattern"
                    on the sticky bar — that's the single commit point. */}

                {/* Hand-off time (#374). Reuses DateTimePickerSheet in
                    a time-focused mode — we pass today's date as a
                    no-op anchor and only consume the .time field on
                    save. The sheet's allDay flag stays false so the
                    time field renders. */}
                <DateTimePickerSheet
                    open={timeSheetOpen}
                    title="Hand-off time"
                    sub="Time of day the kids switch parents. Used for next-handoff timer + reminders."
                    initialDate={timeSheetAnchorDate}
                    initialTime={handoffTime}
                    onSave={(next) => {
                        setHandoffTime(next.time);
                        setTimeSheetOpen(false);
                    }}
                    onClose={() => setTimeSheetOpen(false)}
                />

                {/* Hand-off location (#374). List of household locations
                    + an inline "+ Add location" footer routing to the
                    create modal. Reflects the design's read-only Find &
                    pick semantics — creating a new location is a
                    separate flow on /location/new. */}
                <SheetShell
                    open={locationSheetOpen}
                    onClose={() => setLocationSheetOpen(false)}
                    title="Hand-off location"
                    sub="Optional. Used to pre-fill reminder copy and the calendar map preview."
                    secondary="Clear"
                    onSecondary={() => {
                        setHandoffLocationId(null);
                        setLocationSheetOpen(false);
                    }}
                    height={460}>
                    <View style={{ flex: 1, paddingHorizontal: 4 }}>
                        {(locations ?? []).map((loc, idx) => {
                            const selected = loc.id === handoffLocationId;
                            const isLast = idx === (locations?.length ?? 0) - 1;
                            return (
                                <Pressable
                                    key={loc.id}
                                    onPress={() => {
                                        setHandoffLocationId(loc.id);
                                        setLocationSheetOpen(false);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={loc.name}
                                    accessibilityState={{ selected }}
                                    style={({ pressed }) => [
                                        styles.subRow,
                                        !isLast && {
                                            borderBottomColor: colors.hair,
                                            borderBottomWidth:
                                                StyleSheet.hairlineWidth,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText
                                            style={[
                                                styles.subRowLabel,
                                                { color: colors.text },
                                            ]}>
                                            {loc.name}
                                        </ThemedText>
                                        {loc.formatted_address ? (
                                            <ThemedText
                                                style={[
                                                    styles.subRowSub,
                                                    {
                                                        color: colors.inkFaint,
                                                    },
                                                ]}
                                                numberOfLines={1}>
                                                {loc.formatted_address}
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                    {selected ? (
                                        <Feather
                                            name="check"
                                            size={14}
                                            color={colors.accent}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                        <Pressable
                            onPress={() => {
                                setLocationSheetOpen(false);
                                router.push('/location/new');
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Add a new location"
                            style={({ pressed }) => [
                                styles.subRow,
                                pressed && styles.pressed,
                            ]}>
                            <ThemedText
                                style={[
                                    styles.subRowLabel,
                                    {
                                        color: colors.accent,
                                        fontFamily: FontFamily.monoSemiBold,
                                    },
                                ]}>
                                + ADD LOCATION
                            </ThemedText>
                        </Pressable>
                    </View>
                </SheetShell>

                {/* Anchor date (#375). Date-only via DateTimePickerSheet
                    in allDay mode — same primitive as Event When but
                    without the time pair. */}
                <DateTimePickerSheet
                    open={anchorDateSheetOpen}
                    title="Pattern started"
                    sub="Which week is whose. Shifts all future weeks."
                    initialDate={
                        anchorDate || format(new Date(), 'yyyy-MM-dd')
                    }
                    initialTime=""
                    allDay
                    onSave={(next) => {
                        setAnchorDate(next.date);
                        setAnchorDateSheetOpen(false);
                    }}
                    onClose={() => setAnchorDateSheetOpen(false)}
                />

                {/* Anchor parent (#375). Two-row picker selecting which
                    parent gets the cycle's "A" slot. Swapping A/B is a
                    semantic flip — we keep the cycle_days array as-is
                    and just exchange the profile_id assignments. */}
                <SheetShell
                    open={anchorParentSheetOpen}
                    onClose={() => setAnchorParentSheetOpen(false)}
                    title="Who has this week"
                    sub="Picks which parent the pattern's first week (parent A) belongs to."
                    height={360}>
                    {[parentA, parentB]
                        .filter(
                            (m): m is NonNullable<typeof m> => !!m,
                        )
                        .map((m, idx) => {
                            const isAnchorParent = m.profile_id === parentAId;
                            return (
                                <Pressable
                                    key={m.profile_id}
                                    onPress={() => {
                                        // Setting a different parent as A
                                        // swaps both ids — A↔B is symmetric.
                                        if (m.profile_id === parentBId) {
                                            const oldA = parentAId;
                                            setParentAId(parentBId);
                                            setParentBId(oldA);
                                        }
                                        setAnchorParentSheetOpen(false);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={m.display_name ?? ''}
                                    accessibilityState={{
                                        selected: isAnchorParent,
                                    }}
                                    style={({ pressed }) => [
                                        styles.subRow,
                                        idx === 0 && {
                                            borderBottomColor: colors.hair,
                                            borderBottomWidth:
                                                StyleSheet.hairlineWidth,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <ThemedText
                                        style={[
                                            styles.subRowLabel,
                                            { color: colors.text, flex: 1 },
                                        ]}>
                                        {m.display_name ?? '—'}
                                    </ThemedText>
                                    {isAnchorParent ? (
                                        <Feather
                                            name="check"
                                            size={14}
                                            color={colors.accent}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                </SheetShell>
            </SafeAreaView>
        </ThemedView>
    );
}

// ─── Mini visualization for each pattern option ───────────────────────────

function PatternMiniViz({
    id,
    colorA,
    colorB,
    colors,
}: {
    id: EditorPatternId;
    colorA: string;
    colorB: string;
    colors: Palette;
}) {
    // 32×22 tile background; the colored blocks inside read like a tiny
    // bar chart of the pattern's rhythm.
    const a = withAlpha(colorA, 0x88 / 255);
    const b = withAlpha(colorB, 0x88 / 255);
    const tileBg = colors.backgroundInset;
    let blocks: Array<{ flex: number; color: string }>;
    switch (id) {
        case '7-7':
            blocks = [
                { flex: 1, color: a },
                { flex: 1, color: b },
            ];
            break;
        case '2-2-3':
            blocks = [
                { flex: 2, color: a },
                { flex: 2, color: b },
                { flex: 3, color: a },
            ];
            break;
        case '2-2-5-5':
            // 2 A · 2 B · 5 A · 5 B (14-day cycle).
            blocks = [
                { flex: 2, color: a },
                { flex: 2, color: b },
                { flex: 5, color: a },
                { flex: 5, color: b },
            ];
            break;
        case '3-4-4-3':
            // 3 A · 4 B · 4 A · 3 B (14-day cycle).
            blocks = [
                { flex: 3, color: a },
                { flex: 4, color: b },
                { flex: 4, color: a },
                { flex: 3, color: b },
            ];
            break;
        case '5-2':
            // 5 A · 2 B (weekly, primary custody).
            blocks = [
                { flex: 5, color: a },
                { flex: 2, color: b },
            ];
            break;
        case 'alternating-weekends':
            blocks = [
                { flex: 4, color: a },
                { flex: 3, color: b },
            ];
            break;
        default:
            // Fallback for ids that don't match the current preset
            // catalog (e.g. legacy 'custom' rows from earlier builds —
            // they no longer match an option but we still preview them
            // safely with a generic A/B split).
            blocks = [
                { flex: 1, color: a },
                { flex: 1, color: b },
            ];
            break;
    }
    return (
        <View
            style={[
                styles.miniViz,
                { backgroundColor: tileBg },
            ]}>
            <View style={styles.miniVizRow}>
                {blocks.map((blk, i) => (
                    <View
                        key={i}
                        style={[
                            styles.miniVizBlock,
                            { flex: blk.flex, backgroundColor: blk.color },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

// ─── Sub-* primitives — local to the pattern editor ───────────────────────

function SubGroup({
    label,
    subLabel,
    children,
    colors,
}: {
    label: string;
    subLabel?: string;
    children: React.ReactNode;
    colors: Palette;
}) {
    return (
        <View style={styles.subGroupWrap}>
            <View style={styles.subGroupHeader}>
                <ThemedText
                    style={[
                        styles.subGroupLabel,
                        {
                            color: colors.inkSec,
                            fontFamily: FontFamily.monoSemiBold,
                        },
                    ]}>
                    {label.toUpperCase()}
                </ThemedText>
                {subLabel ? (
                    <ThemedText
                        style={[
                            styles.subGroupSubLabel,
                            { color: colors.inkFaint },
                        ]}>
                        {subLabel}
                    </ThemedText>
                ) : null}
            </View>
            <View
                style={[
                    styles.subGroupCard,
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

function SubRow({
    label,
    sub,
    value,
    mono,
    chevron,
    isLast,
    onPress,
    colors,
}: {
    label: string;
    sub?: string;
    value?: string;
    mono?: boolean;
    chevron?: boolean;
    isLast?: boolean;
    onPress?: () => void;
    colors: Palette;
}) {
    const body = (
        <View
            style={[
                styles.subRow,
                !isLast && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
            ]}>
            <View style={{ flex: 1 }}>
                <ThemedText
                    style={[styles.subRowLabel, { color: colors.text }]}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[
                            styles.subRowSub,
                            { color: colors.inkFaint },
                        ]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            {value ? (
                <ThemedText
                    style={[
                        styles.subRowValue,
                        {
                            color: colors.text,
                            fontFamily: mono
                                ? FontFamily.monoMedium
                                : undefined,
                        },
                    ]}>
                    {value}
                </ThemedText>
            ) : null}
            {chevron ? (
                <Feather
                    name="chevron-right"
                    size={12}
                    color={colors.inkFaint}
                />
            ) : null}
        </View>
    );
    if (!onPress) return body;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [pressed && styles.pressed]}>
            {body}
        </Pressable>
    );
}

function SubToggle({
    label,
    sub,
    value,
    onChange,
    isLast,
    colors,
}: {
    label: string;
    sub?: string;
    value: boolean;
    onChange: (v: boolean) => void;
    isLast?: boolean;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={() => onChange(!value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            accessibilityLabel={label}
            style={({ pressed }) => [
                styles.subRow,
                !isLast && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            <View style={{ flex: 1 }}>
                <ThemedText
                    style={[styles.subRowLabel, { color: colors.text }]}>
                    {label}
                </ThemedText>
                {sub ? (
                    <ThemedText
                        style={[
                            styles.subRowSub,
                            { color: colors.inkFaint },
                        ]}>
                        {sub}
                    </ThemedText>
                ) : null}
            </View>
            <View
                style={[
                    styles.toggle,
                    {
                        backgroundColor: value
                            ? colors.accent
                            : withAlpha(colors.inkFaint, 0.53),
                    },
                ]}>
                <View
                    style={[
                        styles.toggleKnob,
                        value && { left: 16 },
                    ]}
                />
            </View>
        </Pressable>
    );
}

function PatternOptionRow({
    title,
    sub,
    selected,
    onPress,
    miniViz,
    isLast,
    colors,
}: {
    title: string;
    sub: string;
    selected: boolean;
    onPress: () => void;
    miniViz: React.ReactNode;
    isLast?: boolean;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={title}
            style={({ pressed }) => [
                styles.patternRow,
                !isLast && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                selected && {
                    backgroundColor: withAlpha(
                        colors.accent,
                        0x0e / 255,
                    ),
                },
                pressed && styles.pressed,
            ]}>
            {miniViz}
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText
                    style={[
                        styles.patternTitle,
                        { color: colors.text },
                    ]}>
                    {title}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.patternSub,
                        { color: colors.inkFaint },
                    ]}>
                    {sub}
                </ThemedText>
            </View>
            <View
                style={[
                    styles.radio,
                    {
                        borderColor: selected
                            ? colors.accent
                            : colors.inkFaint,
                        backgroundColor: selected
                            ? colors.accent
                            : 'transparent',
                    },
                ]}>
                {selected ? (
                    <Feather
                        name="check"
                        size={11}
                        color={colors.onAccent}
                    />
                ) : null}
            </View>
        </Pressable>
    );
}

function KidPatternRow({
    displayName,
    color,
    summary,
    detail,
    onPress,
    isLast,
    colors,
}: {
    displayName: string;
    color: string;
    summary: string;
    detail: string;
    onPress: () => void;
    isLast?: boolean;
    colors: Palette;
}) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${displayName} custody overrides`}
            style={({ pressed }) => [
                styles.kidRow,
                !isLast && {
                    borderBottomColor: colors.hair,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                },
                pressed && styles.pressed,
            ]}>
            {/* #410 audit: KidPatternRow avatar is 32×32 per spec; bumped
                from md (24px) to lg (36px) — closest available tier to
                the design's 32px. The 4px overshoot is acceptable polish
                vs. widening ChildBadge's size API with a fourth tier
                only this row would consume. */}
            <ChildBadge name={displayName} color={color} size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
                <ThemedText
                    style={[styles.kidName, { color: colors.text }]}>
                    {displayName}
                </ThemedText>
                <ThemedText
                    style={[styles.kidSummary, { color: colors.inkSec }]}>
                    {summary}
                </ThemedText>
                <ThemedText
                    style={[
                        styles.kidDetail,
                        {
                            color: colors.inkFaint,
                            fontFamily: FontFamily.monoMedium,
                        },
                    ]}>
                    {detail}
                </ThemedText>
            </View>
            <Feather
                name="chevron-right"
                size={12}
                color={colors.inkFaint}
            />
        </Pressable>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function showComingSoon(title: string, body: string) {
    if (Platform.OS === 'web') {
        if (typeof window !== 'undefined') {
            window.alert(`${title}\n\n${body}`);
        }
    } else {
        Alert.alert(title, body);
    }
}

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

// `CUSTODY_PATTERNS` referenced for future "Custom" implementation that
// inspects the cycle directly. Silence the unused-warning until then.
void CUSTODY_PATTERNS;

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 100 },

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

    // Preview
    previewWrap: { paddingHorizontal: 16, paddingTop: 14 },
    previewCard: {
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    previewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    previewHeaderLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    liveChip: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    liveChipText: {
        fontSize: 10,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    previewWeekLabel: {
        fontSize: 9.5,
        letterSpacing: -0.2,
        marginBottom: 4,
    },

    // SubGroup
    subGroupWrap: { marginTop: 18 },
    subGroupHeader: { paddingHorizontal: 24, marginBottom: 6 },
    subGroupLabel: {
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    subGroupSubLabel: {
        fontSize: 12,
        lineHeight: 16,
        marginTop: 4,
    },
    subGroupCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },

    // SubRow
    subRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 13,
        paddingHorizontal: 14,
    },
    subRowLabel: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    subRowSub: {
        fontSize: 11.5,
        marginTop: 2,
        lineHeight: 15,
    },
    subRowValue: {
        fontSize: 13,
        fontWeight: '500',
        letterSpacing: -0.2,
    },

    // Toggle
    toggle: {
        width: 36,
        height: 22,
        borderRadius: 11,
        position: 'relative',
    },
    toggleKnob: {
        position: 'absolute',
        top: 2,
        left: 2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFFFFF',
    },

    // Pattern option row
    patternRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    miniViz: {
        width: 32,
        height: 22,
        borderRadius: 4,
        padding: 2,
        overflow: 'hidden',
    },
    miniVizRow: {
        flex: 1,
        flexDirection: 'row',
        gap: 1,
    },
    miniVizBlock: { borderRadius: 1 },
    patternTitle: {
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    patternSub: {
        fontSize: 11,
        marginTop: 1,
        lineHeight: 15,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.4,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Hand-off day row
    handoffDayWrap: { padding: 14 },
    subSectionLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    handoffDayRow: {
        flexDirection: 'row',
        gap: 4,
    },
    handoffDayCell: {
        flex: 1,
        height: 36,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    handoffDayLabel: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    // Kid row
    kidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    kidName: {
        fontSize: 13.5,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    kidSummary: {
        fontSize: 11.5,
        marginTop: 1,
        letterSpacing: -0.1,
    },
    kidDetail: {
        fontSize: 10,
        marginTop: 2,
        letterSpacing: -0.2,
    },

    // Destructive
    dangerWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
    dangerCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 13,
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    dangerText: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    dangerHint: {
        fontSize: 11,
        lineHeight: 15,
        marginTop: 8,
        paddingHorizontal: 12,
        textAlign: 'center',
    },

    // Sticky save bar
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
    },
    impactLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    impactText: {
        flex: 1,
        fontSize: 11.5,
        lineHeight: 15,
    },
    savePrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 11,
        borderRadius: 10,
    },
    savePrimaryText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    pressed: { opacity: 0.7 },
});
