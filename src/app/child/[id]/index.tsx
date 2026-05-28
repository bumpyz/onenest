// Child detail (read view) — Phase 11 ChildDetail per the canonical
// canvas in docs/design-handoffs/onenest-spec-v3/design_handoff_calendar_conflicts/
// screens-extra-3.jsx:328-515.
//
// Lives at /child/[id] (this file), with the existing edit form
// relocated to /child/[id]/edit.tsx. Mirrors the contact + event +
// task split pattern (read-mode hub at /index, edit form at /edit).
//
// Both Family Hub kid-card taps and Settings → Children row taps
// funnel here. The edit pencil in the top right routes to /edit.
//
// Sections, top to bottom:
//   1. Tinted hero — gradient bg in kid color → bg, big avatar circle,
//      name, mono caps "AGE N · GRADE X · BORN MAR 8, 2018" line,
//      parent + caregiver + external co-parent chip row
//   2. "Where this week" — 7-day mini bar tinted by per-day custody +
//      handoff sub-line ("With X Mon–Fri · weekend with Y · next hand-off Sat 10:00")
//   3. "Upcoming" — event list filtered to this child's id, next 7 days
//   4. "Care plan" — adapted from canvas (which folded allergies into
//      Notes). We surface allergies + medications as their own card
//      because the schema stores them structurally (#438), plus a
//      pediatrician row that deep-links to the contact detail. The
//      allergy chips use BrandColors.error tint to match the canvas's
//      red emphasis on "Allergic to peanuts".
//   5. "Contacts · N" — contacts whose child_ids include this child;
//      tap calls the contact's primary phone (matches canvas action)
//   6. "Notes" — child.notes free-text
//
// Sections from the canvas we DEFERRED for v1:
//   • Lists · N — no per-child list query exists today (lists are
//     household-scoped and don't carry child_ids). Surfacing this
//     would need a tasks→lists rollup that's out of scope for the
//     read-screen split. Tracked as a follow-up.

import { Feather } from '@expo/vector-icons';
import { format, parseISO, startOfDay } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
    BrandColors,
    Colors,
    FontFamily,
    Spacing,
    Typography,
} from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCurrentWeekCustody } from '@/hooks/use-current-week-custody';
import { useEvents } from '@/hooks/use-events';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import {
    getContact,
    getExternalCoparentsByChild,
    listChildAllergies,
    listChildLivingWith,
    listChildMedications,
    type ChildAllergy,
    type ChildExternalCoparent,
    type ChildMedication,
    type Contact,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

type Palette = (typeof Colors)['light'] | (typeof Colors)['dark'];

// Birthday → "AGE n · 3RD GRADE · BORN MAR 8, 2018" mono caps line.
// Grade is optional (children may not have one yet); when unset the
// segment is dropped rather than rendered as "· · BORN".
function pretitleLine(
    birthdate: string | null,
    grade: string | null,
): string {
    const parts: string[] = [];
    if (birthdate) {
        try {
            const d = parseISO(birthdate);
            const ageMs = Date.now() - d.getTime();
            const ageYrs = Math.floor(ageMs / (365.25 * 86_400_000));
            if (ageYrs >= 0 && ageYrs < 30) parts.push(`AGE ${ageYrs}`);
        } catch {
            // ignore
        }
    }
    if (grade && grade.trim().length > 0) parts.push(grade.trim().toUpperCase());
    if (birthdate) {
        try {
            const d = parseISO(birthdate);
            parts.push(`BORN ${format(d, 'MMM d, yyyy').toUpperCase()}`);
        } catch {
            // ignore
        }
    }
    return parts.join(' · ');
}

// Initial letter for the big avatar circle. First letter of display_name
// uppercased, with '?' fallback so we never render an empty avatar.
function initialFor(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
}

export default function ChildDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { members, isLoading: membersLoading } = useHouseholdMembers(
        household?.id,
    );
    // Upcoming events range: today + 7 days. useEvents covers the
    // calendar-view range path; we slice down to events with this
    // child_id in the render path. Memoize startOfDay so the hook
    // doesn't re-fetch on every render.
    const eventsRangeStart = useMemo(() => startOfDay(new Date()), []);
    const { events } = useEvents(household?.id, eventsRangeStart, 7);
    const weekCustody = useCurrentWeekCustody(household?.id);

    const child = useMemo(
        () => (id && children ? children.find((c) => c.id === id) : null),
        [id, children],
    );

    // Lives-with profile ids → which parents this kid lives with.
    // Loaded inside an effect because the data lives in a junction
    // table that ChildForm also reads via the same helper.
    const [livesWith, setLivesWith] = useState<string[] | null>(null);
    const [allergies, setAllergies] = useState<ChildAllergy[] | null>(null);
    const [medications, setMedications] = useState<ChildMedication[] | null>(
        null,
    );
    const [externalCoparents, setExternalCoparents] = useState<
        ChildExternalCoparent[] | null
    >(null);
    const [pediatrician, setPediatrician] = useState<Contact | null>(null);
    useEffect(() => {
        if (!child) return;
        let cancelled = false;
        (async () => {
            const [lw, al, md, ec] = await Promise.all([
                listChildLivingWith(child.id),
                listChildAllergies(child.id),
                listChildMedications(child.id),
                getExternalCoparentsByChild(child.id),
            ]);
            if (cancelled) return;
            setLivesWith(lw);
            setAllergies(al);
            setMedications(md);
            setExternalCoparents(ec);
            // Pediatrician resolved lazily from the contact link so the
            // Care plan row can show the contact's display name without
            // shelling out to /contacts for every nav.
            if (child.pediatrician_contact_id) {
                try {
                    const c = await getContact(child.pediatrician_contact_id);
                    if (!cancelled) setPediatrician(c);
                } catch {
                    if (!cancelled) setPediatrician(null);
                }
            } else {
                setPediatrician(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [child]);

    if (
        authLoading ||
        householdsLoading ||
        childrenLoading ||
        membersLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!child) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            This child may have been deleted.
                        </ThemedText>
                        <Pressable
                            onPress={() => router.replace('/family')}
                            style={styles.linkBtn}>
                            <ThemedText style={{ color: colors.accent }}>
                                Back to Family
                            </ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const kidColor = child.color ?? colors.accent;
    const pretitle = pretitleLine(child.birthdate ?? null, child.grade ?? null);

    // Parent chips data — combine lives-with profile ids + external
    // co-parents, deduped, in (lives-with, external) order so the EXT
    // tags cluster at the right.
    const livesWithSet = new Set(livesWith ?? []);
    const livesWithMembers = (members ?? []).filter((m) =>
        livesWithSet.has(m.profile_id),
    );
    const externalMembers = (externalCoparents ?? []).filter(
        (e) => !livesWithSet.has(e.profile_id),
    );

    // Upcoming = next 7 days, filtered to events whose child_ids include
    // this child. Sorted by start.
    const now = new Date();
    const sevenDaysOut = new Date(now.getTime() + 7 * 86_400_000);
    const upcoming = (events ?? [])
        .filter((e) => e.child_ids.includes(child.id))
        .filter((e) => {
            const starts = new Date(e.starts_at);
            return starts >= now && starts <= sevenDaysOut;
        })
        .sort(
            (a, b) =>
                new Date(a.starts_at).getTime() -
                new Date(b.starts_at).getTime(),
        )
        .slice(0, 6);

    // Contacts section deferred — our schema doesn't tag contacts to
    // specific children (only `child.pediatrician_contact_id` links one
    // specific contact role per kid). The design's "Contacts · N" card
    // implies a per-child tagging shape that we don't have today. The
    // pediatrician already surfaces in the Care plan card above, so
    // shipping a half-fake list here would be worse than dropping the
    // section. Follow-up task tracks adding contact.child_ids.

    // "Where this week" sub-line. Built off the resolved week's
    // current parent + the next-handoff timestamp. Falls back to a
    // gentle copy line when there's no schedule (single_parent /
    // couple households without custody).
    const handoffLine = (() => {
        if (!weekCustody) return null;
        const { weekCustody: wc, nextHandoff } = weekCustody;
        const currentMember = members?.find(
            (m) => m.profile_id === wc.currentParentId,
        );
        const nextMember = members?.find(
            (m) => m.profile_id === nextHandoff?.toProfileId,
        );
        const currentName = currentMember?.display_name?.split(' ')[0] ?? 'them';
        const nextName = nextMember?.display_name?.split(' ')[0] ?? null;
        if (!nextHandoff || !nextName) {
            return wc.bothPresent
                ? 'Both parents home this week'
                : `With ${currentName} this week`;
        }
        const handoffDate = nextHandoff.at;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.round(
            (handoffDate.getTime() - today.getTime()) / 86_400_000,
        );
        const dayLabel =
            diffDays === 0
                ? 'today'
                : diffDays === 1
                  ? 'tomorrow'
                  : format(handoffDate, 'EEE');
        const timeLabel = format(handoffDate, 'HH:mm');
        return `With ${currentName} now · hand-off to ${nextName} ${dayLabel} ${timeLabel}`;
    })();

    return (
        <ThemedView style={styles.container}>
            {/* Hero scrolls under the top bar so the gradient bleeds to
                the very top edge of the screen, matching the canvas's
                gradient-from-bg pattern. The top bar overlays at the
                safe-area top with no background of its own. */}
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    {/* Tinted gradient backdrop — kid color at the top
                        fading into the page bg, matching the canvas's
                        `linear-gradient(160deg, kidColor 22% → bg)` rule.
                        Absolute fill behind the safe-area + top bar so
                        every pixel under the chrome is gradient. */}
                    <LinearGradient
                        colors={[
                            withAlpha(
                                kidColor,
                                scheme === 'dark' ? 0x40 / 255 : 0x22 / 255,
                            ),
                            colors.background,
                        ]}
                        // Pure top-to-bottom — kid color at the very top
                        // edge, fading straight down into the page bg.
                        // Reads more like a "color wash from above" than
                        // the diagonal which felt off-axis.
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {/* Safe-area + top bar */}
                    <SafeAreaView edges={['top']}>
                        <View style={styles.topBar}>
                            <Pressable
                                onPress={() => router.back()}
                                accessibilityRole="button"
                                accessibilityLabel="Back"
                                style={({ pressed }) => [
                                    styles.topBarIconBtn,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="chevron-left"
                                    size={14}
                                    color={colors.text}
                                />
                            </Pressable>
                            <Pressable
                                onPress={() =>
                                    router.push({
                                        pathname: '/child/[id]/edit',
                                        params: { id: child.id },
                                    })
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`Edit ${child.display_name}`}
                                style={({ pressed }) => [
                                    styles.topBarIconBtn,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                    pressed && styles.pressed,
                                ]}>
                                <Feather
                                    name="edit-2"
                                    size={13}
                                    color={colors.text}
                                />
                            </Pressable>
                        </View>

                        {/* Avatar + name */}
                        <View style={styles.heroBody}>
                            <View
                                style={[
                                    styles.avatar,
                                    {
                                        backgroundColor: kidColor,
                                        borderColor: colors.background,
                                        // Soft ring at low-alpha kid color so the
                                        // avatar reads with depth on the tinted hero.
                                        shadowColor: kidColor,
                                    },
                                ]}>
                                <ThemedText style={styles.avatarText}>
                                    {initialFor(
                                        child.nickname ?? child.display_name,
                                    )}
                                </ThemedText>
                            </View>
                            <ThemedText
                                style={[styles.heroName, { color: colors.text }]}>
                                {child.nickname ?? child.display_name}
                            </ThemedText>
                            {pretitle ? (
                                <ThemedText
                                    style={[
                                        styles.heroPretitle,
                                        {
                                            color: colors.textSecondary,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {pretitle}
                                </ThemedText>
                            ) : null}

                            {/* Parent chips */}
                            {(livesWithMembers.length > 0 ||
                                externalMembers.length > 0) && (
                                <View style={styles.parentChipRow}>
                                    {livesWithMembers.map((m) => (
                                        <ParentChip
                                            key={m.profile_id}
                                            name={m.display_name}
                                            color={m.color ?? colors.accent}
                                            colors={colors}
                                        />
                                    ))}
                                    {externalMembers.map((e) => (
                                        <ParentChip
                                            key={e.profile_id}
                                            name={
                                                e.display_name ??
                                                'External co-parent'
                                            }
                                            color={e.color ?? colors.accent}
                                            external
                                            colors={colors}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    </SafeAreaView>
                </View>

                {/* Where this week */}
                {weekCustody ? (
                    <>
                        <SectionLabel colors={colors}>Where this week</SectionLabel>
                        <View style={styles.sectionPad}>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                <WeekStrip
                                    weekCustody={weekCustody.weekCustody}
                                    nextHandoff={weekCustody.nextHandoff}
                                    members={members ?? []}
                                    colors={colors}
                                    scheme={scheme}
                                />
                                {handoffLine ? (
                                    <View
                                        style={[
                                            styles.cardDivider,
                                            { borderTopColor: colors.hair },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.handoffLine,
                                                { color: colors.inkSec },
                                            ]}>
                                            {handoffLine}
                                        </ThemedText>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </>
                ) : null}

                {/* Upcoming */}
                <SectionLabel colors={colors}>
                    {`Upcoming${upcoming.length > 0 ? ` · ${upcoming.length}` : ''}`}
                </SectionLabel>
                <View style={styles.sectionPad}>
                    <View
                        style={[
                            styles.card,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                        ]}>
                        {upcoming.length === 0 ? (
                            <EmptyRow
                                label={`No events for ${child.display_name} in the next 7 days.`}
                                colors={colors}
                            />
                        ) : (
                            upcoming.map((e, idx) => {
                                const responsibleMember = members?.find(
                                    (m) =>
                                        m.profile_id ===
                                        e.responsible_profile_id,
                                );
                                const spineColor =
                                    responsibleMember?.color ?? colors.accent;
                                const starts = new Date(e.starts_at);
                                const dayLabel = (() => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const diff = Math.round(
                                        (starts.getTime() - today.getTime()) /
                                            86_400_000,
                                    );
                                    if (diff === 0) return 'Today';
                                    if (diff === 1) return 'Tomorrow';
                                    return format(starts, 'EEE');
                                })();
                                return (
                                    <Pressable
                                        key={e.id}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/event/[id]',
                                                params: { id: e.id },
                                            })
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open ${e.title}`}
                                        style={({ pressed }) => [
                                            styles.eventRow,
                                            idx < upcoming.length - 1 && {
                                                borderBottomColor: colors.hair,
                                                borderBottomWidth:
                                                    StyleSheet.hairlineWidth,
                                            },
                                            pressed && styles.pressed,
                                        ]}>
                                        <View style={styles.eventTime}>
                                            <ThemedText
                                                style={[
                                                    styles.eventTimeText,
                                                    {
                                                        color: colors.inkFaint,
                                                        fontFamily:
                                                            FontFamily.monoMedium,
                                                    },
                                                ]}>
                                                {`${dayLabel} ${format(starts, 'HH:mm')}`}
                                            </ThemedText>
                                        </View>
                                        <View
                                            style={[
                                                styles.eventSpine,
                                                { backgroundColor: spineColor },
                                            ]}
                                        />
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <ThemedText
                                                numberOfLines={1}
                                                style={[
                                                    styles.eventTitle,
                                                    { color: colors.text },
                                                ]}>
                                                {e.title}
                                            </ThemedText>
                                        </View>
                                        {responsibleMember ? (
                                            <View
                                                style={[
                                                    styles.eventAvatar,
                                                    {
                                                        backgroundColor:
                                                            responsibleMember.color ??
                                                            colors.accent,
                                                    },
                                                ]}>
                                                <ThemedText
                                                    style={styles.eventAvatarText}>
                                                    {initialFor(
                                                        responsibleMember.display_name,
                                                    )}
                                                </ThemedText>
                                            </View>
                                        ) : null}
                                    </Pressable>
                                );
                            })
                        )}
                    </View>
                </View>

                {/* Care plan — adaptation: surfaces allergies + medications +
                    pediatrician structured rows. Notes section below
                    carries the free-text. */}
                {(allergies && allergies.length > 0) ||
                (medications && medications.length > 0) ||
                pediatrician ? (
                    <>
                        <SectionLabel colors={colors}>Care plan</SectionLabel>
                        <View style={styles.sectionPad}>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                    },
                                ]}>
                                {allergies && allergies.length > 0 ? (
                                    <View
                                        style={[
                                            styles.carePlanRow,
                                            {
                                                borderBottomColor: colors.hair,
                                                borderBottomWidth:
                                                    StyleSheet.hairlineWidth,
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.carePlanLabel,
                                                {
                                                    color: BrandColors.error,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            ALLERGIES
                                        </ThemedText>
                                        <View style={styles.allergyChipRow}>
                                            {allergies.map((a) => (
                                                <View
                                                    key={a.id}
                                                    style={[
                                                        styles.allergyChip,
                                                        {
                                                            backgroundColor: withAlpha(
                                                                BrandColors.error,
                                                                0x18 / 255,
                                                            ),
                                                            borderColor: withAlpha(
                                                                BrandColors.error,
                                                                0x55 / 255,
                                                            ),
                                                        },
                                                    ]}>
                                                    <ThemedText
                                                        style={[
                                                            styles.allergyChipText,
                                                            {
                                                                color: BrandColors.error,
                                                            },
                                                        ]}>
                                                        {a.label}
                                                        {a.severity
                                                            ? ` · ${a.severity}`
                                                            : ''}
                                                    </ThemedText>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}
                                {medications && medications.length > 0 ? (
                                    <View
                                        style={[
                                            styles.carePlanRow,
                                            pediatrician
                                                ? {
                                                      borderBottomColor:
                                                          colors.hair,
                                                      borderBottomWidth:
                                                          StyleSheet.hairlineWidth,
                                                  }
                                                : null,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.carePlanLabel,
                                                {
                                                    color: colors.inkSec,
                                                    fontFamily:
                                                        FontFamily.monoSemiBold,
                                                },
                                            ]}>
                                            MEDICATIONS
                                        </ThemedText>
                                        <View style={{ gap: 4 }}>
                                            {medications.map((m) => (
                                                <ThemedText
                                                    key={m.id}
                                                    style={[
                                                        styles.medText,
                                                        { color: colors.text },
                                                    ]}>
                                                    {m.label}
                                                    {m.dose ? (
                                                        <ThemedText
                                                            style={{
                                                                color: colors.inkFaint,
                                                                fontFamily:
                                                                    FontFamily.monoMedium,
                                                            }}>
                                                            {` · ${m.dose}`}
                                                        </ThemedText>
                                                    ) : null}
                                                </ThemedText>
                                            ))}
                                        </View>
                                    </View>
                                ) : null}
                                {pediatrician ? (
                                    <Pressable
                                        onPress={() =>
                                            router.push({
                                                pathname: '/contact/[id]',
                                                params: {
                                                    id: pediatrician.id,
                                                },
                                            })
                                        }
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open ${pediatrician.name}`}
                                        style={({ pressed }) => [
                                            styles.pediatricianRow,
                                            pressed && styles.pressed,
                                        ]}>
                                        <View
                                            style={[
                                                styles.pediatricianIcon,
                                                {
                                                    backgroundColor: withAlpha(
                                                        colors.accent,
                                                        0x15 / 255,
                                                    ),
                                                    borderColor: withAlpha(
                                                        colors.accent,
                                                        0x40 / 255,
                                                    ),
                                                },
                                            ]}>
                                            <Feather
                                                name="heart"
                                                size={13}
                                                color={colors.accent}
                                            />
                                        </View>
                                        <View style={{ flex: 1, minWidth: 0 }}>
                                            <ThemedText
                                                style={[
                                                    styles.pediatricianName,
                                                    { color: colors.text },
                                                ]}>
                                                {pediatrician.name}
                                            </ThemedText>
                                            <ThemedText
                                                style={[
                                                    styles.pediatricianRole,
                                                    {
                                                        color: colors.textSecondary,
                                                    },
                                                ]}>
                                                Pediatrician
                                            </ThemedText>
                                        </View>
                                        <Feather
                                            name="chevron-right"
                                            size={14}
                                            color={colors.inkFaint}
                                        />
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>
                    </>
                ) : null}

                {/* Contacts section deferred — see comment above the
                    `childContacts` block in handleSubmit. Re-add this
                    block when contact.child_ids ships. */}

                {/* Notes */}
                {child.notes && child.notes.trim().length > 0 ? (
                    <>
                        <SectionLabel colors={colors}>Notes</SectionLabel>
                        <View style={styles.sectionPad}>
                            <View
                                style={[
                                    styles.card,
                                    {
                                        backgroundColor: colors.backgroundElement,
                                        borderColor: colors.hair,
                                        padding: 14,
                                    },
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.notesText,
                                        { color: colors.inkSec },
                                    ]}>
                                    {child.notes}
                                </ThemedText>
                            </View>
                        </View>
                    </>
                ) : null}
                <View style={{ height: Spacing.four }} />
            </ScrollView>
        </ThemedView>
    );
}

// ─── Subcomponents ─────────────────────────────────────────────────────────

function SectionLabel({
    children,
    colors,
}: {
    children: React.ReactNode;
    colors: Palette;
}) {
    return (
        <View style={styles.sectionLabelWrap}>
            <ThemedText
                style={{
                    ...Typography.monoCaps,
                    color: colors.inkSec,
                }}>
                {children}
            </ThemedText>
        </View>
    );
}

function EmptyRow({
    label,
    colors,
}: {
    label: string;
    colors: Palette;
}) {
    return (
        <View style={styles.emptyRow}>
            <ThemedText
                style={[
                    styles.emptyRowText,
                    { color: colors.inkFaint },
                ]}>
                {label}
            </ThemedText>
        </View>
    );
}

function ParentChip({
    name,
    color,
    external,
    colors,
}: {
    name: string;
    color: string;
    external?: boolean;
    colors: Palette;
}) {
    const initial = initialFor(name);
    const firstName = name.split(' ')[0] ?? name;
    return (
        <View
            style={[
                styles.parentChip,
                {
                    backgroundColor: colors.backgroundElement,
                    borderColor: external
                        ? withAlpha(color, 0x55 / 255)
                        : colors.hair,
                },
            ]}>
            <View
                style={[
                    styles.parentChipAvatar,
                    { backgroundColor: color },
                ]}>
                <ThemedText style={styles.parentChipInitial}>
                    {initial}
                </ThemedText>
            </View>
            <ThemedText
                style={[styles.parentChipName, { color: colors.text }]}>
                {firstName}
            </ThemedText>
            {external ? (
                <View
                    style={[
                        styles.extTag,
                        { backgroundColor: colors.backgroundInset },
                    ]}>
                    <ThemedText
                        style={[
                            styles.extTagText,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        EXT
                    </ThemedText>
                </View>
            ) : null}
        </View>
    );
}

/** 7-day Mon-first custody strip per the canvas's "Where this week"
 *  bar. Today's column gets an accent letter; days with a custody
 *  transition show a swap glyph centered on the band. */
function WeekStrip({
    weekCustody,
    nextHandoff,
    members,
    colors,
    scheme,
}: {
    weekCustody: ReturnType<typeof useCurrentWeekCustody> extends infer T
        ? T extends { weekCustody: infer W }
            ? W
            : never
        : never;
    nextHandoff: ReturnType<typeof useCurrentWeekCustody> extends infer T
        ? T extends { nextHandoff: infer H }
            ? H
            : never
        : never;
    members: { profile_id: string; color: string | null }[];
    colors: Palette;
    scheme: string;
}) {
    const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const colorFor = (pid: string) =>
        members.find((m) => m.profile_id === pid)?.color ?? colors.accent;
    // Identify which day-cell has the hand-off marker. The next-handoff
    // `at` lands on the END of the giving-up parent's last day, which is
    // the SAME cell index — we mark the day BEFORE the new parent takes
    // over. We compute the marker date relative to weekStart.
    const handoffMs = nextHandoff?.at?.getTime() ?? null;
    return (
        <View style={styles.weekStrip}>
            {LETTERS.map((letter, i) => {
                const day = weekCustody.days[i];
                const dayColor = day?.bothPresent
                    ? colors.accent
                    : day?.profileId
                      ? colorFor(day.profileId)
                      : colors.inkFaint;
                const isToday = i === weekCustody.todayIndex;
                // Show a swap glyph when this day-cell IS the date of the
                // next handoff (handoff happens at end-of-day).
                const cellDate = new Date(weekCustody.weekStart);
                cellDate.setDate(cellDate.getDate() + i);
                cellDate.setHours(0, 0, 0, 0);
                const isSwapDay =
                    handoffMs !== null &&
                    cellDate.getTime() <= handoffMs &&
                    handoffMs <
                        cellDate.getTime() + 86_400_000 - 1;
                return (
                    <View key={i} style={styles.weekStripCell}>
                        <View
                            style={[
                                styles.weekStripBand,
                                {
                                    backgroundColor: withAlpha(
                                        dayColor,
                                        scheme === 'dark'
                                            ? 0x60 / 255
                                            : 0x38 / 255,
                                    ),
                                    borderTopColor: dayColor,
                                },
                            ]}>
                            {isSwapDay ? (
                                <Feather
                                    name="repeat"
                                    size={9}
                                    color="#FFFFFF"
                                    style={styles.weekStripSwap}
                                />
                            ) : null}
                        </View>
                        <ThemedText
                            style={[
                                styles.weekStripLetter,
                                {
                                    color: isToday
                                        ? colors.accent
                                        : colors.inkFaint,
                                    fontFamily: isToday
                                        ? FontFamily.monoSemiBold
                                        : FontFamily.monoMedium,
                                },
                            ]}>
                            {letter}
                        </ThemedText>
                    </View>
                );
            })}
        </View>
    );
}

// ContactRow component removed alongside the Contacts section. The
// schema has no per-contact child tagging today, so a per-child
// contacts list would have to lie about the data. Re-introduce when
// contact.child_ids ships (tracked as a follow-up).

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, padding: Spacing.four, justifyContent: 'center' },
    centered: { alignItems: 'center', gap: Spacing.three },
    center: { textAlign: 'center' },
    linkBtn: { padding: Spacing.two },

    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },

    // Hero
    hero: {
        paddingBottom: 20,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 14,
    },
    topBarIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroBody: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 4 },
    avatar: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        borderWidth: 3,
        // RN-Web: shadow* maps; native: the colored ring also acts as a
        // soft elevation cue without needing a separate halo View.
        shadowOpacity: 0.25,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
    },
    avatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 36,
        fontWeight: '700',
        letterSpacing: -0.8,
    },
    heroName: {
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: -1,
        lineHeight: 31,
    },
    heroPretitle: {
        fontSize: 11,
        marginTop: 4,
        letterSpacing: -0.2,
    },
    parentChipRow: {
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        marginTop: 14,
        flexWrap: 'wrap',
    },
    parentChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingLeft: 4,
        paddingRight: 9,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    parentChipAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    parentChipInitial: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 9,
        fontWeight: '700',
    },
    parentChipName: {
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    extTag: {
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    extTagText: { fontSize: 8.5, letterSpacing: 0.3 },

    // Sections / cards
    sectionLabelWrap: { paddingHorizontal: 24, paddingTop: 6, paddingBottom: 6 },
    sectionPad: { paddingHorizontal: 16, paddingBottom: 14 },
    card: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    cardDivider: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingBottom: 12,
    },
    handoffLine: { fontSize: 12, letterSpacing: -0.1, lineHeight: 17 },

    // Week strip
    weekStrip: {
        flexDirection: 'row',
        gap: 3,
        paddingHorizontal: 14,
        paddingTop: 14,
    },
    weekStripCell: {
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    },
    weekStripBand: {
        width: '100%',
        height: 22,
        borderRadius: 4,
        borderTopWidth: 2,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    weekStripSwap: { marginTop: 2 },
    weekStripLetter: {
        fontSize: 9.5,
        letterSpacing: -0.2,
    },

    // Event row
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    eventTime: { width: 78, flexShrink: 0 },
    eventTimeText: { fontSize: 10, letterSpacing: -0.2 },
    eventSpine: { width: 2, alignSelf: 'stretch', borderRadius: 1 },
    eventTitle: { fontSize: 13, fontWeight: '500', letterSpacing: -0.2 },
    eventAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventAvatarText: {
        color: '#FFFFFF',
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 9,
        fontWeight: '700',
    },

    // Care plan
    carePlanRow: { padding: 14, gap: 8 },
    carePlanLabel: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    allergyChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    allergyChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    allergyChipText: { fontSize: 11.5, fontWeight: '600', letterSpacing: -0.1 },
    medText: { fontSize: 13, letterSpacing: -0.2 },
    pediatricianRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        padding: 14,
    },
    pediatricianIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    pediatricianName: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    pediatricianRole: {
        fontSize: 11,
        marginTop: 1,
    },

    // Contact row
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    contactTile: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactInitials: {
        fontFamily: FontFamily.sansSemiBold,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    contactName: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2 },
    contactRole: { fontSize: 11, marginTop: 1 },
    contactCallBtn: {
        width: 28,
        height: 28,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Notes
    notesText: { fontSize: 13, lineHeight: 20, letterSpacing: -0.1 },

    // Empty
    emptyRow: { padding: 16, alignItems: 'center' },
    emptyRowText: { fontSize: 12, textAlign: 'center', lineHeight: 17 },

    pressed: { opacity: 0.7 },
});
