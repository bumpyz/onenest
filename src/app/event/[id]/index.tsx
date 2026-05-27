// EventDetail — inline-editable event screen. Phase 5 close-out (#409 /
// closes #292 + #306); inline-edit retrofit per #413. Design source:
// `screens-extra.jsx::EventDetail`.
//
// Edit model (#413): mirrors TaskDetail v2's inline-edit pattern. Title
// and notes are TextInputs in-place — typing populates a draft buffer,
// and the sticky bar's "Save changes" button commits them via
// updateEvent. The button is grayed out (disabled, opacity 0.4) until
// at least one draft differs from the persisted value. Long-pressing
// the sticky button opens the legacy /event/[id]/edit modal as an
// escape hatch for fields that don't yet have inline editors (date/
// time, location, recurrence, children — those land in #413 follow-up
// sheets). The Responsible row is already inline-editable via
// EventResponsibleSheet from #412.
//
// Layout, top-to-bottom:
//   1. Top bar: back / `EVENT` mono pretitle / `•••` kebab
//   2. Hero: recurrence-marker pretitle + 28/600 title (TextInput for
//      parents, ThemedText for caregivers) + mono time + duration meta
//      + conflict pill + SHARED · N HOMES chip
//   3. Conflict resolver ribbon (when in conflict bucket)
//   4. Who SGroup — Responsible row (tap → EventResponsibleSheet) or
//      multi-responsible chip rack + Backup row (stubbed per #307)
//   5. For SGroup — child chips
//   6. Location SGroup — MapPreview + address
//   7. Attached list SGroup — task rows + "+ ATTACH ANOTHER"
//   8. Notes SGroup — inline TextInput for parents; hidden when empty
//      for caregivers
//   9. History SGroup — created-at + stub (full log = #310)
//  10. Sticky action bar — Delete (left, alert) + Save changes (right,
//      accent, disabled until dirty)
//
// Caregivers land here too — same read view, but the sticky bar hides
// Delete/Save and the kebab is gone (no destructive affordances for a
// read-only role). Title + notes render as static text. RLS in
// migration 0031 enforces the same rule server-side.

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChildBadge } from '@/components/child-badge';
import {
    DetailRow,
    FormGroup,
    FormSectionLabel,
    HairlineDivider,
    TaskRow,
} from '@/components/ds';
import { EventOverflowSheet } from '@/components/event/event-overflow-sheet';
import { LoadingScreen } from '@/components/loading-screen';
import { MapPreview } from '@/components/map-preview';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, FontFamily, Spacing } from '@/constants/theme';
import { useChildren } from '@/hooks/use-children';
import { useCustodyOverrides } from '@/hooks/use-custody-overrides';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEvent } from '@/hooks/use-event';
import { useEventOccurrenceOverrides } from '@/hooks/use-event-occurrence-overrides';
import { useEventTasks } from '@/hooks/use-event-tasks';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useLocations } from '@/hooks/use-locations';
import { useMyRole } from '@/hooks/use-my-role';
import { useWeekSummary } from '@/hooks/use-week-summary';
import {
    AddPersonChip,
    ResponsibleChip,
    type ResponsibleChipNote,
} from '@/components/ds/responsible-chip';
import { EventChildrenSheet } from '@/components/event/event-children-sheet';
import { EventLocationSheet } from '@/components/event/event-location-sheet';
import { EventRecurrenceSheet } from '@/components/event/event-recurrence-sheet';
import {
    EventResponsibleSheet,
    type EventResponsibleSheetSelection,
} from '@/components/event/event-responsible-sheet';
import { EventWhenSheet } from '@/components/event/event-when-sheet';
import { colorForResponsible, memberColorMap } from '@/lib/colors';
import { buildOverrideMap } from '@/lib/custody';
import {
    createTask,
    deleteEvent,
    setTaskCompleted,
    updateEvent,
    type Event,
    type HouseholdMember,
    type NewEventResponsibleInput,
} from '@/lib/db';
import { withAlpha } from '@/lib/platform-styles';
import {
    formatRecurrenceLabel,
} from '@/lib/recurrence';
import { resolveResponsibleProfileId } from '@/lib/responsible-resolver';
import { computeWeekSummary } from '@/lib/summary';
import { shouldHideEventAsPrivate } from '@/lib/event-visibility';
import { useAuth } from '@/providers/auth-provider';
import { useAppColorScheme } from '@/providers/theme-provider';

export default function EventDetailScreen() {
    const router = useRouter();
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

    const params = useLocalSearchParams<{
        id?: string | string[];
        date?: string | string[];
    }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    // Carries through to /edit so the Apply-To toggle keeps working when
    // the user navigates from Calendar via a specific occurrence date.
    const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
    const occurrenceDate =
        rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

    // Kebab → EventOverflowSheet open state. Lives at the screen root
    // so the sheet survives re-renders triggered by data refetches.
    const [overflowOpen, setOverflowOpen] = useState(false);
    // Responsible row tap → EventResponsibleSheet. Same screen-root
    // lifetime so a refetch mid-edit doesn't blow away the picker.
    const [respSheetOpen, setRespSheetOpen] = useState(false);
    // Field-edit sheets (#422). Each row in EventDetail has a tap target
    // that opens its corresponding sheet; the sheet writes via
    // updateEvent and closes. Same lifetime guarantee as the picker
    // above — refetches don't drop the sheet state.
    const [whenSheetOpen, setWhenSheetOpen] = useState(false);
    const [locationSheetOpen, setLocationSheetOpen] = useState(false);
    const [childrenSheetOpen, setChildrenSheetOpen] = useState(false);
    const [recurrenceSheetOpen, setRecurrenceSheetOpen] = useState(false);

    // Inline edit state (#413) — mirrors TaskDetail v2 pattern. Title,
    // notes, AND child_ids are drafts that hold edits until the user
    // taps "Save changes" in the sticky bar. Date/time, location, and
    // recurrence commit immediately via their existing inline-edit
    // sheets; the sticky button is gated on whether title, notes, or
    // children have unsaved changes relative to the underlying event
    // row.
    //
    // The children draft was added in response to a bug report —
    // "adding a kid in the For section doesn't save when clicking
    // Save changes." Previously the EventChildrenSheet wrote to the DB
    // on its own internal Save button, but users tapping outside the
    // sheet (backdrop / X) lost their selection silently, and tapping
    // the main "Save changes" did nothing because children weren't in
    // the dirty set. Now the sheet pushes selection up via onApply and
    // the main Save button commits everything together.
    const [titleDraft, setTitleDraft] = useState<string | null>(null);
    const [notesDraft, setNotesDraft] = useState<string | null>(null);
    const [childIdsDraft, setChildIdsDraft] = useState<string[] | null>(null);
    const [savingChanges, setSavingChanges] = useState(false);

    // Inline "+ ADD TASK" quick-add (#467). State for the ATTACHED
    // section's bottom row: draft text + in-flight flag. Tapping the
    // dashed "+ ADD TASK" row expands an inline TextInput, type +
    // Enter creates a task scoped to this event (eventId), inheriting
    // child_ids + the event's responsibles as assignees by default
    // (matches the auto-assign behavior expected by #384). Closing
    // happens on blur with an empty draft OR after a successful add
    // (draft clears, row stays expanded so users can rapid-fire add
    // several tasks).
    const [addTaskText, setAddTaskText] = useState('');
    const [addingTask, setAddingTask] = useState(false);

    // Discard pending drafts when the screen blurs (user navigates away).
    // Without this, a stale draft survives navigation and on return can
    // silently clobber a concurrent edit from another device when the
    // user taps "Save changes" with no intent to overwrite. QA-found
    // bug — "titleDraft survives navigation/refetch, masking remote
    // updates." We only clear on BLUR, not on every refetch — a refetch
    // while the user is actively typing would otherwise erase
    // in-progress text, which is the inverse failure mode.
    useFocusEffect(
        useCallback(() => {
            return () => {
                setTitleDraft(null);
                setNotesDraft(null);
                setChildIdsDraft(null);
            };
        }, []),
    );

    const { session, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const { event, isLoading: eventLoading, refetch: refetchEvent } = useEvent(id);
    const { members } = useHouseholdMembers(household?.id);
    const { children } = useChildren(household?.id);
    const { locations } = useLocations(household?.id);
    const { lists: allLists } = useLists(household?.id);
    const { schedule: custodySchedule } = useCustodySchedule(household?.id);
    const { tasks: eventTasks, refetch: refetchEventTasks } = useEventTasks(id);
    // Conflict detection — useWeekSummary already does the heavy lift
    // (events vs each member's busy blocks, custody-aware). We just
    // filter to the conflicts that mention THIS event id and render
    // them as a warn-tinted ribbon below the hero.
    //
    // We also pull the hook's raw `inputs` (events + busy blocks +
    // custody data) so we can re-run computeWeekSummary locally with a
    // virtually-modified version of THIS event when the user has
    // pending edits (e.g. a child added/removed via the For sheet but
    // not yet committed via "Save changes"). That way the conflict
    // ribbon reflects what the user is about to commit, not what's
    // currently in the database. `refetch` is called after any commit
    // (responsibles sheet apply, sticky-bar save) so the post-commit
    // ribbon reads from fresh data instead of stale cache.
    const {
        summary: weekSummary,
        inputs: weekSummaryInputs,
        refetch: refetchWeekSummary,
    } = useWeekSummary(household?.id);

    // Per-occurrence resolution — when the user navigated from
    // Calendar with `?date=`, prefer that specific override over the
    // series default. resolveResponsibleProfileId already cascades
    // occurrence-override → alternation (custody-aware) → static for us.
    const occurrenceRangeDate = useMemo(
        () => (occurrenceDate ? parseISO(occurrenceDate) : new Date()),
        [occurrenceDate],
    );
    const { overrideMap: occurrenceOverrideMap } = useEventOccurrenceOverrides(
        household?.id,
        occurrenceRangeDate,
        occurrenceRangeDate,
    );
    // Custody overrides for the single occurrence date — feeds the
    // alternation resolver path so weekday-of-custodian rules work
    // even when this specific day was swapped.
    const { overrides: rawCustodyOverrides } = useCustodyOverrides(
        household?.id,
        occurrenceRangeDate,
        occurrenceRangeDate,
    );
    const custodyOverrides = useMemo(
        () => buildOverrideMap(rawCustodyOverrides ?? []),
        [rawCustodyOverrides],
    );

    const colorMap = useMemo(() => memberColorMap(members ?? []), [members]);
    const resolvedResponsibleId = useMemo(() => {
        if (!event) return null;
        return resolveResponsibleProfileId({
            event,
            occurrenceDate: occurrenceRangeDate,
            custodySchedule,
            custodyOverrides,
            occurrenceOverrides: occurrenceOverrideMap,
        });
    }, [
        event,
        occurrenceRangeDate,
        custodySchedule,
        custodyOverrides,
        occurrenceOverrideMap,
    ]);
    const responsibleMember = useMemo(
        () =>
            resolvedResponsibleId
                ? (members ?? []).find(
                      (m) => m.profile_id === resolvedResponsibleId,
                  ) ?? null
                : null,
        [resolvedResponsibleId, members],
    );

    // Multi-responsible derivations — fed by the new events_responsible join.
    // `responsibleProfiles` is the list of HouseholdMember rows for everyone
    // tagged on this event (lead first). `leadProfileId` is the explicit
    // is_lead row; falls back to the first profile when none is flagged
    // (matches the resolver's tolerance of partially-migrated data).
    const responsibleProfiles = useMemo<HouseholdMember[]>(() => {
        if (!event?.responsibles?.length) return [];
        // Sort: lead first, others by created_at order (stable list shape).
        const sorted = [...event.responsibles].sort((a, b) => {
            if (a.is_lead && !b.is_lead) return -1;
            if (!a.is_lead && b.is_lead) return 1;
            return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        });
        return sorted
            .map((r) =>
                (members ?? []).find((m) => m.profile_id === r.profile_id) ??
                null,
            )
            .filter((m): m is HouseholdMember => m !== null);
    }, [event, members]);
    const leadProfileId = useMemo<string | null>(() => {
        if (!event?.responsibles?.length) return null;
        const explicit = event.responsibles.find((r) => r.is_lead);
        if (explicit) return explicit.profile_id;
        return event.responsibles[0].profile_id;
    }, [event]);
    const currentResponsibleProfileIds = useMemo<string[]>(
        () => (event?.responsibles ?? []).map((r) => r.profile_id),
        [event],
    );
    // True multi-responsible only when >1 tagged. Single-responsible events
    // (legacy + most existing rows) skip the chip rack and keep the original
    // avatar-and-name row.
    const isMultiResponsible = responsibleProfiles.length > 1;
    // Distinct households among responsibles — the SHARED chip counts homes,
    // not people, per the design spec. Today all members live in one
    // household so this is a placeholder of 1; when external co-parent
    // profiles are introduced (a separate household_id per other home),
    // the count becomes meaningful without changing this code.
    const distinctHouseholds = useMemo(() => {
        const hids = new Set(responsibleProfiles.map((m) => m.household_id));
        return hids.size;
    }, [responsibleProfiles]);

    // Save handler for EventResponsibleSheet. Writes via updateEvent with
    // the new responsibles list; setEventResponsibles enforces the
    // exactly-one-lead invariant server-side. The legacy
    // responsible_profile_id column is mirrored to the lead in the writer.
    //
    // After the write we refetch BOTH the event row (so the Who section,
    // chip rack, leadProfileId, etc. flip immediately) AND the week
    // summary (so the conflict ribbon re-evaluates against the new
    // responsibles — a parent change can introduce or clear conflicts in
    // one shot). Both refetches run before we close the sheet so the
    // user doesn't see a one-frame flash of stale data underneath.
    // Reported bug: "Changing responsible parent on an event doesn't
    // immediately reflect on event detail page when saving the change."
    const handleResponsibleSave = async (
        sel: EventResponsibleSheetSelection,
    ) => {
        if (!event) return;
        const next: NewEventResponsibleInput[] = sel.profileIds.map((pid) => ({
            profileId: pid,
            isLead: pid === sel.leadProfileId,
        }));
        try {
            await updateEvent(event.id, {
                title: event.title,
                startsAt: new Date(event.starts_at),
                endsAt: new Date(event.ends_at),
                allDay: event.all_day,
                description: event.description,
                location: event.location,
                locationId: event.location_id,
                recurrenceRule: event.recurrence_rule,
                eventType: event.event_type,
                timezone: event.timezone,
                childIds: event.child_ids,
                responsibleAlternation: event.responsible_alternation,
                responsibles: next,
            });
            // Reload the event row + summary in parallel so the screen
            // re-renders with the new responsibles AND with a
            // freshly-computed conflict assessment before the sheet
            // dismount. Promise.all instead of awaiting sequentially so
            // the user sees the change as quickly as the slower of the
            // two completes.
            await Promise.all([refetchEvent(), refetchWeekSummary()]);
            setRespSheetOpen(false);
        } catch (err) {
            console.error('update responsibles failed', err);
            const msg = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined')
                    window.alert(`Couldn't save\n\n${msg}`);
            } else {
                Alert.alert("Couldn't save", msg);
            }
        }
    };

    // For section — child chips for every tagged kid. Reads from the
    // pending draft when one exists so the visible chips reflect what
    // the user JUST selected in the sheet (pre-Save), then falls back
    // to the committed event.child_ids.
    const effectiveChildIds = useMemo(
        () => childIdsDraft ?? event?.child_ids ?? [],
        [childIdsDraft, event],
    );

    // Inline "+ ADD TASK" handler (#467). Creates a task linked to this
    // event, inheriting:
    //   - eventId         → the task shows up in this section + on the
    //                       event's row in Lists
    //   - childIds        → the task auto-tags the same kids the event
    //                       is tagged with (so a soccer-practice event
    //                       tagged on Alex creates "Pack cleats" tagged
    //                       on Alex without an extra picker step)
    //   - assigneeProfileIds → the event's lead responsible adult so
    //                       the task lands on the right person's Home
    //                       digest. Falls back to "Anyone" if no lead.
    //   - listIds         → none; createTask falls through to Inbox by
    //                       default. List attachment is #468's job.
    // Rapid-fire add: clears `addTaskText` on success so the input stays
    // ready for the next title without an extra tap. Errors surface via
    // platform alert (same pattern as handleResponsibleSave).
    const handleAddTask = useCallback(async () => {
        if (!event || !household) return;
        const title = addTaskText.trim();
        if (!title || addingTask) return;
        setAddingTask(true);
        try {
            await createTask(household.id, {
                title,
                eventId: event.id,
                childIds: event.child_ids,
                assigneeProfileIds: leadProfileId ? [leadProfileId] : [],
            });
            setAddTaskText('');
            await refetchEventTasks();
        } catch (err) {
            console.error('add task to event failed', err);
            const msg = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined')
                    window.alert(`Couldn't add task\n\n${msg}`);
            } else {
                Alert.alert("Couldn't add task", msg);
            }
        } finally {
            setAddingTask(false);
        }
    }, [
        addTaskText,
        addingTask,
        event,
        household,
        leadProfileId,
        refetchEventTasks,
    ]);
    const taggedChildren = useMemo(() => {
        if (!effectiveChildIds.length) return [];
        return effectiveChildIds
            .map((cid) => (children ?? []).find((c) => c.id === cid))
            .filter((c): c is NonNullable<typeof c> => !!c);
    }, [effectiveChildIds, children]);

    // Location lookup — the event row only stores the FK; we resolve
    // name + address + lat/lng from the locations cache. Renders null
    // when the event has no location.
    const location = useMemo(() => {
        if (!event?.location_id) return null;
        return (locations ?? []).find((l) => l.id === event.location_id) ?? null;
    }, [event, locations]);

    // Build an "effective event" that overlays any pending drafts onto
    // the persisted row. Today the only field with a pre-commit draft is
    // `child_ids` (via EventChildrenSheet's onApply → setChildIdsDraft).
    // Title and notes drafts don't influence conflict detection, so we
    // skip them — keeps the deps tight. Responsibles commit immediately
    // via handleResponsibleSave + refetch, so there's no draft to
    // overlay for them; the post-commit refetch is enough.
    //
    // Set-equal short-circuit: when the draft is non-null but contains
    // the same ids as the persisted row (user opened the sheet, toggled
    // a kid, then toggled back), we want to return the original `event`
    // reference rather than a new object. Otherwise downstream memos
    // keyed on `effectiveEvent` (conflict recompute, weekSummary swap)
    // see a fresh identity every render and redo the work for nothing.
    // Mirrors the value-equal check used in `childrenHasChange` below.
    const effectiveEvent = useMemo<Event | null>(() => {
        if (!event) return null;
        if (childIdsDraft === null) return event;
        const sameSet =
            childIdsDraft.length === event.child_ids.length &&
            childIdsDraft.every((id) => event.child_ids.includes(id));
        if (sameSet) return event;
        return { ...event, child_ids: childIdsDraft };
    }, [event, childIdsDraft]);

    // Pull this event's first conflict using the effective event. We
    // only surface one ribbon at a time — multi-conflict events are
    // rare and the design's CONFLICT ribbon is a single-card affordance.
    // The resolver's verbose "options" sheet (#299 Phase 12) is the full
    // multi-way fix; here we just route to the calendar so the user can
    // see the overlap in context.
    //
    // Two code paths:
    //   1. No pending child_ids draft → read straight from weekSummary
    //      (cheap; already computed once at fetch time).
    //   2. With a draft → swap the effective event into the inputs and
    //      re-run computeWeekSummary locally. That way the ribbon
    //      reflects what the user is about to commit, including
    //      *newly-introduced* shared-child double-booking and
    //      *cleared* conflicts when a kid is removed. Without this the
    //      ribbon would lag a network round-trip.
    //
    // If inputs aren't loaded yet (initial mount or error), fall back to
    // the cached summary so we don't drop the ribbon mid-edit. Recurring
    // events that fall outside the 7-day window won't match either way
    // — that's a pre-existing limitation of the conflict check.
    const conflict = useMemo(() => {
        if (!event || !effectiveEvent) return null;
        if (childIdsDraft === null || !weekSummaryInputs) {
            // Fast path — use the cached summary directly. Same lookup
            // by event id (recurring instances share an id; week summary
            // collapses to first match, which is the design intent).
            return (
                weekSummary?.conflicts.find((c) => c.event.id === event.id) ??
                null
            );
        }
        // Slow path — recompute with the draft-overlaid event swapped
        // into the world. If our event isn't in the original window
        // (e.g. it's >7 days out and the summary skipped it), we still
        // include it via the swap so the user gets feedback for the
        // current edit even on out-of-window events.
        const baseEvents = weekSummaryInputs.events;
        const hasOriginal = baseEvents.some((e) => e.id === event.id);
        const swappedEvents = hasOriginal
            ? baseEvents.map((e) => (e.id === event.id ? effectiveEvent : e))
            : [...baseEvents, effectiveEvent];
        const recomputed = computeWeekSummary(
            swappedEvents,
            weekSummaryInputs.busyBlocks,
            weekSummaryInputs.custodySchedule,
            weekSummaryInputs.custodyOverrides,
            weekSummaryInputs.occurrenceOverrides,
        );
        return (
            recomputed.conflicts.find((c) => c.event.id === event.id) ?? null
        );
    }, [event, effectiveEvent, childIdsDraft, weekSummary, weekSummaryInputs]);
    const conflictingMember = useMemo(() => {
        if (!conflict) return null;
        return (
            (members ?? []).find(
                (m) => m.profile_id === conflict.profileId,
            ) ?? null
        );
    }, [conflict, members]);

    // Recurrence mono pretitle — design shows "WEEKLY · MAY 26 · 2026".
    // formatRecurrenceLabel handles the preset → display string lookup,
    // including the custom-byday case ("MON · WED · FRI"), and returns
    // null for non-recurring events so we drop the prefix cleanly.
    // The date itself is the event's start (for recurring events the
    // user is viewing a specific instance — pre-filled via `date` query
    // param when relevant).
    const recurrenceLabel = useMemo(
        () => (event ? formatRecurrenceLabel(event.recurrence_rule) : null),
        [event],
    );

    // Auth + household gates first (cheaper than touching event data).
    if (authLoading || householdsLoading) return <LoadingScreen />;
    if (!session) return <Redirect href="/(auth)/sign-in" />;
    if (!household) return <Redirect href="/(onboarding)/create-household" />;
    if (!id) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe} edges={['top']}>
                    <ThemedText style={{ padding: Spacing.three }}>
                        Missing event id.
                    </ThemedText>
                </SafeAreaView>
            </ThemedView>
        );
    }
    if (eventLoading || roleLoading) return <LoadingScreen />;
    if (!event) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe} edges={['top']}>
                    <ThemedText style={{ padding: Spacing.three }}>
                        Event not found.
                    </ThemedText>
                </SafeAreaView>
            </ThemedView>
        );
    }

    // Privacy gate (#469): if this event is private AND the current
    // viewer isn't tagged as a responsible, the detail screen would
    // leak the title, location, notes, and tagged kids by simply
    // rendering. Bounce to /calendar instead — the user can't see the
    // event from any list/calendar surface (those gates render it as
    // "Busy") so reaching here means a stale deep link or direct URL.
    // Redirecting rather than showing a "private slot" placeholder
    // keeps the UI honest: there's nothing meaningful to show.
    if (shouldHideEventAsPrivate(event, session?.user?.id)) {
        return <Redirect href="/calendar" />;
    }

    // Hero meta — `16:00 — 16:45` + `45m` duration. All-day events skip
    // the time entirely and show "All day" instead.
    const starts = parseISO(event.starts_at);
    const ends = event.ends_at ? parseISO(event.ends_at) : null;
    const isAllDay = event.all_day ?? false;
    const timeLabel = isAllDay
        ? 'All day'
        : ends
          ? `${format(starts, 'HH:mm')} — ${format(ends, 'HH:mm')}`
          : format(starts, 'HH:mm');
    const durationLabel =
        !isAllDay && ends
            ? formatDuration(ends.getTime() - starts.getTime())
            : null;
    const heroDateLabel = format(starts, 'MMM d').toUpperCase();
    const heroYearLabel = format(starts, 'yyyy');
    // Pretitle composition (design source screens-event-edit.jsx:316 for
    // multi all-day events). Precedence:
    //   1. ALL-DAY · prefix when the event is all-day (overrides recurrence
    //      since "ALL-DAY · WEEKLY · MAY 26" double-encodes "WEEKLY",
    //      which only makes sense in the single-occurrence view — for
    //      recurring all-day instances the design keeps just ALL-DAY).
    //   2. recurrenceLabel · prefix when recurring + timed.
    //   3. Bare date · year otherwise.
    const pretitle = isAllDay
        ? `ALL-DAY · ${heroDateLabel} · ${heroYearLabel}`
        : recurrenceLabel
          ? `${recurrenceLabel} · ${heroDateLabel} · ${heroYearLabel}`
          : `${heroDateLabel} · ${heroYearLabel}`;

    const goEdit = () => {
        router.push({
            pathname: '/event/[id]/edit',
            params: occurrenceDate
                ? { id, date: occurrenceDate }
                : { id },
        });
    };

    // #413: inline edit state derivation. `isDirty` becomes true when the
    // user has typed a different value into either the title or the notes
    // field. The sticky bar's primary button reads this to decide between
    // disabled ("nothing to save") and accent ("Save changes"). Trimming
    // matches the writer's normalization so a stray space doesn't enable
    // Save against an effectively-identical value.
    const titleHasChange =
        titleDraft !== null && titleDraft.trim() !== event.title.trim();
    const currentNotesText = event.description ?? '';
    const notesHasChange =
        notesDraft !== null && notesDraft !== currentNotesText;
    // children dirty-check: set-equal comparison so order swaps don't
    // count as a change (junction-table writes already normalize order).
    const childrenHasChange =
        childIdsDraft !== null &&
        (childIdsDraft.length !== event.child_ids.length ||
            childIdsDraft.some((id) => !event.child_ids.includes(id)));
    const isDirty = titleHasChange || notesHasChange || childrenHasChange;

    // Preserve-all writer payload — every field except the ones the caller
    // wants to mutate is read straight off the in-memory `event` row. The
    // responsibles list has a back-compat wrinkle: if the event hasn't
    // been touched by migration 0039's new model yet (events_responsible
    // backfill skipped, partial network read, etc.) `event.responsibles`
    // can be empty even though `event.responsible_profile_id` still holds
    // a valid lead. We rebuild a single-row list from the legacy column
    // in that case so the writer doesn't silently clobber Anyone onto a
    // legacy event during an unrelated edit. Identified by the QA review
    // — "silent lead-clobber on save when responsibles is empty."
    const buildPreservedResponsibles = (): NewEventResponsibleInput[] => {
        if (event.responsibles.length > 0) {
            return event.responsibles.map((r) => ({
                profileId: r.profile_id,
                isLead: r.is_lead,
            }));
        }
        if (event.responsible_profile_id) {
            return [
                { profileId: event.responsible_profile_id, isLead: true },
            ];
        }
        return [];
    };

    const handleSaveChanges = async () => {
        if (!isDirty || savingChanges) return;
        setSavingChanges(true);
        try {
            const nextTitle = titleHasChange
                ? (titleDraft as string).trim()
                : event.title;
            // Notes is nullable in the schema; trim and treat empty as null
            // so the column doesn't accumulate whitespace-only rows over
            // edit cycles.
            const nextDescription = notesHasChange
                ? ((notesDraft as string).trim() || null)
                : event.description;
            const nextChildIds = childrenHasChange
                ? (childIdsDraft as string[])
                : event.child_ids;
            await updateEvent(event.id, {
                title: nextTitle,
                startsAt: new Date(event.starts_at),
                endsAt: new Date(event.ends_at),
                allDay: event.all_day,
                description: nextDescription,
                location: event.location,
                locationId: event.location_id,
                recurrenceRule: event.recurrence_rule,
                eventType: event.event_type,
                timezone: event.timezone,
                childIds: nextChildIds,
                responsibleAlternation: event.responsible_alternation,
                responsibles: buildPreservedResponsibles(),
            });
            // Clear drafts so the dirty derivation flips back to false.
            // useEvent's query cache will refresh on next focus / refetch.
            setTitleDraft(null);
            setNotesDraft(null);
            setChildIdsDraft(null);
            // Pull the fresh row so the For section + chip counts reflect
            // the just-committed selection without waiting for a focus
            // event. Same pattern as the responsibles sheet's onSaved.
            // Also refetch the week summary — child_ids changes can
            // introduce or clear shared-child double-booking conflicts,
            // and we want the ribbon to reflect committed state once the
            // draft re-overlay is gone. Parallel so the user-visible
            // delay is the slower of the two, not the sum.
            await Promise.all([refetchEvent(), refetchWeekSummary()]);
        } catch (err) {
            console.error('save event changes failed', err);
            const msg = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined')
                    window.alert(`Couldn't save\n\n${msg}`);
            } else {
                Alert.alert("Couldn't save", msg);
            }
        } finally {
            setSavingChanges(false);
        }
    };

    const confirmDelete = async () => {
        // Cross-platform confirm. RN's Alert.alert is a no-op stub on
        // react-native-web — calling it on the web build dismisses
        // silently and the destructive button never fires (which was
        // the "delete does nothing" bug). Same fix the EventOverflow
        // and Task overflow sheets already use; lift to a shared
        // helper if a 4th caller appears.
        const confirmed =
            Platform.OS === 'web'
                ? typeof window !== 'undefined' &&
                  window.confirm(
                      'Delete this event?\n\nThis permanently removes the event for everyone in the household.',
                  )
                : await new Promise<boolean>((resolve) => {
                      Alert.alert(
                          'Delete this event?',
                          'This permanently removes the event for everyone in the household.',
                          [
                              {
                                  text: 'Cancel',
                                  style: 'cancel',
                                  onPress: () => resolve(false),
                              },
                              {
                                  text: 'Delete',
                                  style: 'destructive',
                                  onPress: () => resolve(true),
                              },
                          ],
                      );
                  });
        if (!confirmed) return;
        try {
            await deleteEvent(id);
            router.back();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (Platform.OS === 'web') {
                if (typeof window !== 'undefined') window.alert(`Delete failed\n\n${msg}`);
            } else {
                Alert.alert('Delete failed', msg);
            }
        }
    };

    return (
        <ThemedView style={styles.container}>
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Top bar — back / EVENT pretitle / kebab. Spec line
                    19-48. Three equal-width slots so the centered pretitle
                    stays centered regardless of left/right button widths. */}
                <View style={styles.topBar}>
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                        style={({ pressed }) => [
                            styles.topBarBtn,
                            {
                                backgroundColor: colors.backgroundElement,
                                borderColor: colors.hair,
                            },
                            pressed && styles.pressed,
                        ]}>
                        <Feather name="chevron-left" size={16} color={colors.text} />
                    </Pressable>
                    <ThemedText
                        style={[
                            styles.topBarPretitle,
                            {
                                color: colors.textSecondary,
                                fontFamily: FontFamily.monoSemiBold,
                            },
                        ]}>
                        EVENT
                    </ThemedText>
                    {!isCaregiver ? (
                        <Pressable
                            onPress={() => setOverflowOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel="More actions"
                            style={({ pressed }) => [
                                styles.topBarBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather name="more-horizontal" size={16} color={colors.text} />
                        </Pressable>
                    ) : (
                        <View style={styles.topBarBtnSpacer} />
                    )}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}>
                    {/* Hero: pretitle + title + time meta. Spec lines 51-84. */}
                    <View style={styles.hero}>
                        {/* Pretitle line — optional leading glyph + mono text.
                            Tapping opens EventRecurrenceSheet (#422). The
                            whole line is the tap target so the glyph counts
                            too; caregivers get a non-tappable rendering.
                            Design source screens-extra.jsx:54-59 (single
                            recurring) draws a small SVG recurrence arrow
                            before the text; multi all-day uses a 6×6
                            child-color dot (screens-event-edit.jsx:313-315).
                            We approximate: Feather `refresh-cw` 11px / accent
                            for recurring; a 6×6 first-tagged-child color dot
                            when all-day AND ≥1 child tagged. No glyph for
                            plain one-off events. */}
                        <Pressable
                            onPress={
                                isCaregiver
                                    ? undefined
                                    : () => setRecurrenceSheetOpen(true)
                            }
                            accessibilityRole={isCaregiver ? undefined : 'button'}
                            accessibilityLabel="Edit recurrence"
                            style={({ pressed }) => [
                                styles.heroPretitleRow,
                                pressed && !isCaregiver && styles.pressed,
                            ]}>
                            {recurrenceLabel ? (
                                <Feather
                                    name="refresh-cw"
                                    size={11}
                                    color={colors.accent}
                                    style={styles.heroPretitleIcon}
                                />
                            ) : isAllDay && taggedChildren.length > 0 ? (
                                <View
                                    style={[
                                        styles.heroPretitleChildDot,
                                        {
                                            backgroundColor:
                                                taggedChildren[0].color,
                                        },
                                    ]}
                                />
                            ) : null}
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
                        </Pressable>
                        {/* Inline-editable title (#413). Caregivers see a
                            read-only ThemedText; parents see a TextInput
                            that mirrors the title font + size. Typing
                            populates `titleDraft`; the sticky bar's "Save
                            changes" commits via updateEvent. Multiline
                            allowed so longer titles wrap inside the hero
                            without overflowing the right edge. */}
                        {isCaregiver ? (
                            <ThemedText
                                style={[
                                    styles.heroTitle,
                                    { color: colors.text },
                                ]}>
                                {event.title}
                            </ThemedText>
                        ) : (
                            <TextInput
                                value={titleDraft ?? event.title}
                                onChangeText={setTitleDraft}
                                editable={!savingChanges}
                                multiline
                                placeholder="Untitled event"
                                placeholderTextColor={colors.inkFaint}
                                style={[
                                    styles.heroTitle,
                                    styles.heroTitleInput,
                                    { color: colors.text },
                                ]}
                                accessibilityLabel="Event title"
                            />
                        )}
                        <View style={styles.heroMetaRow}>
                            {/* Time + duration are a tap target — opens
                                EventWhenSheet for parents (#422). The
                                Pressable wraps just the time/duration text
                                so the SHARED chip + CONFLICT pill below
                                remain independently tappable / inert. */}
                            <Pressable
                                onPress={
                                    isCaregiver
                                        ? undefined
                                        : () => setWhenSheetOpen(true)
                                }
                                accessibilityRole={
                                    isCaregiver ? undefined : 'button'
                                }
                                accessibilityLabel="Edit date and time"
                                style={({ pressed }) => [
                                    styles.heroMetaTimeSlot,
                                    pressed && !isCaregiver && styles.pressed,
                                ]}>
                                <ThemedText
                                    style={[
                                        styles.heroTime,
                                        {
                                            color: colors.text,
                                            fontFamily: FontFamily.monoMedium,
                                        },
                                    ]}>
                                    {timeLabel}
                                </ThemedText>
                                {durationLabel ? (
                                    <ThemedText
                                        style={[
                                            styles.heroDuration,
                                            {
                                                color: colors.textSecondary,
                                                fontFamily: FontFamily.monoRegular,
                                            },
                                        ]}>
                                        · {durationLabel}
                                    </ThemedText>
                                ) : null}
                            </Pressable>
                            {/* Inline SHARED · N HOMES chip — only renders
                                when this event is multi-responsible AND the
                                responsibles span more than one household.
                                The design's "Tagging = visibility" rule
                                means a single-household crew tagging 3 of
                                its own members isn't actually crossing
                                homes, so the chip would mislead. Spec lines
                                329-339. */}
                            {isMultiResponsible && distinctHouseholds > 1 ? (
                                <View
                                    style={[
                                        styles.sharedChip,
                                        {
                                            backgroundColor: withAlpha(
                                                colors.accent,
                                                0.094,
                                            ),
                                        },
                                    ]}>
                                    {/* Two overlapping outlined circles —
                                        design source lines 334-337. The
                                        metaphor is "homes linked", not
                                        the chain-link/URL look that
                                        Feather `link-2` evokes. Built
                                        from two Views to avoid pulling
                                        in react-native-svg for one
                                        10×10 glyph. */}
                                    <View style={styles.sharedIcon}>
                                        <View
                                            style={[
                                                styles.sharedIconCircle,
                                                {
                                                    borderColor:
                                                        colors.accent,
                                                    left: 0,
                                                    top: 0,
                                                },
                                            ]}
                                        />
                                        <View
                                            style={[
                                                styles.sharedIconCircle,
                                                {
                                                    borderColor:
                                                        colors.accent,
                                                    left: 4,
                                                    top: 4,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <ThemedText
                                        style={[
                                            styles.sharedChipText,
                                            {
                                                color: colors.accent,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        {`SHARED · ${distinctHouseholds} HOMES`}
                                    </ThemedText>
                                </View>
                            ) : null}
                            {/* Inline CONFLICT pill in the hero meta row.
                                Warn-tinted mono pill that mirrors the
                                spec (line 71-83). The pill is now a
                                Pressable per the v3 spec (onenest-spec-
                                v3/design_handoff_calendar_conflicts §The
                                conflict-resolver access rule) — taps
                                open /conflict/[id], the resolver
                                scaffold. The chip gets a 0.5px
                                warn-tinted border + trailing chevron
                                to signal interactivity; the inline
                                resolver ribbon below stays so the user
                                still has context-in-place without a
                                navigation step. */}
                            {conflict ? (
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/conflict/[id]',
                                            params: { id: event.id },
                                        })
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel="Open conflict resolver"
                                    style={({ pressed }) => [
                                        styles.conflictPill,
                                        {
                                            backgroundColor: withAlpha(
                                                colors.warn,
                                                0.13,
                                            ),
                                            borderColor: withAlpha(
                                                colors.warn,
                                                0.33,
                                            ),
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    <Feather
                                        name="alert-triangle"
                                        size={9}
                                        color={colors.warn}
                                    />
                                    <ThemedText
                                        style={[
                                            styles.conflictPillText,
                                            {
                                                color: colors.warn,
                                                fontFamily:
                                                    FontFamily.monoSemiBold,
                                            },
                                        ]}>
                                        CONFLICT
                                    </ThemedText>
                                    <Feather
                                        name="chevron-right"
                                        size={9}
                                        color={colors.warn}
                                    />
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    {/* CONFLICT resolver ribbon — appears below the hero
                        when this event has at least one conflict in the
                        week summary. Branches copy on the conflict's
                        shape so the user reads accurate copy for each:
                          1. !withEvent  → external busy block on the
                             responsible parent's connected calendar.
                          2. withEvent && !withChildId → same parent is
                             already responsible for another event at
                             this time (their own double-booking).
                          3. withEvent && withChildId → the same child
                             is tagged on another simultaneous event
                             with a different parent (kid double-
                             booked across parents). Spec lines 86-110.
                        Single "Open in calendar" primary CTA for now;
                        the full in-line "move X → Y" resolver is the
                        Phase 12 / #299 work. TintedCard pattern: warn
                        left rail + warn icon + 2-line body + button. */}
                    {conflict ? (() => {
                        const otherEvent = conflict.withEvent ?? null;
                        const sharedChild = conflict.withChildId
                            ? (children ?? []).find(
                                  (c) => c.id === conflict.withChildId,
                              ) ?? null
                            : null;
                        // Privacy gate (#469): if the OTHER event in the
                        // conflict is private and the viewer isn't a
                        // responsible on it, don't leak its title in
                        // the ribbon copy. Fall back to a neutral
                        // description ("another commitment").
                        const otherEventTitle =
                            otherEvent &&
                            !shouldHideEventAsPrivate(
                                otherEvent,
                                session?.user?.id,
                            )
                                ? otherEvent.title
                                : 'another commitment';
                        // Three distinct (title, body) copy pairs. The
                        // body always ends in the same "See it in
                        // context …" trailer; only the first sentence
                        // varies by conflict shape.
                        let title: string;
                        let bodyHead: string;
                        if (otherEvent && sharedChild) {
                            // Shared-child double-booking.
                            title = `${sharedChild.display_name} is double-booked`;
                            bodyHead = `Also tagged on "${otherEventTitle}" at the same time — the same kid can't be in two places.`;
                        } else if (otherEvent) {
                            // Same-parent double-booking.
                            const who =
                                conflictingMember?.display_name ?? 'The responsible parent';
                            title = `${who} is double-booked`;
                            bodyHead = `Also responsible for "${otherEventTitle}" at this time.`;
                        } else {
                            // External busy-block conflict (original case).
                            title = conflictingMember
                                ? `Overlaps ${conflictingMember.display_name}'s schedule`
                                : 'Overlaps another commitment';
                            bodyHead = conflictingMember
                                ? `${conflictingMember.display_name} is busy in their connected calendar during this event.`
                                : 'Someone is busy in their connected calendar during this event.';
                        }
                        return (
                        <View style={styles.sectionWrap}>
                            <View
                                style={[
                                    styles.conflictCard,
                                    {
                                        backgroundColor:
                                            colors.backgroundElement,
                                        borderColor: colors.hair,
                                        borderLeftColor: colors.warn,
                                    },
                                ]}>
                                <Feather
                                    name="alert-triangle"
                                    size={14}
                                    color={colors.warn}
                                    style={styles.conflictIcon}
                                />
                                <View style={styles.conflictBody}>
                                    <ThemedText
                                        style={[
                                            styles.conflictTitle,
                                            { color: colors.text },
                                        ]}>
                                        {title}
                                    </ThemedText>
                                    <ThemedText
                                        style={[
                                            styles.conflictBodyText,
                                            { color: colors.inkSec },
                                        ]}>
                                        {bodyHead}{' '}
                                        See it in context to decide how to
                                        resolve.
                                    </ThemedText>
                                    <View style={styles.conflictActions}>
                                        <Pressable
                                            onPress={() => {
                                                // Deep-link into Day view
                                                // landing on this event's
                                                // date AND time so the
                                                // grid centers on the
                                                // overlap. Calendar reads
                                                // these params once on
                                                // mount/focus (then snaps
                                                // back to its "scroll to
                                                // now" default on next
                                                // focus). Time is the
                                                // event's local start
                                                // — 24h HH:MM.
                                                router.push({
                                                    pathname: '/calendar',
                                                    params: {
                                                        view: 'day',
                                                        date: format(
                                                            starts,
                                                            'yyyy-MM-dd',
                                                        ),
                                                        time: format(
                                                            starts,
                                                            'HH:mm',
                                                        ),
                                                    },
                                                });
                                            }}
                                            accessibilityRole="button"
                                            accessibilityLabel="Open calendar"
                                            style={({ pressed }) => [
                                                styles.conflictBtnPrimary,
                                                {
                                                    backgroundColor:
                                                        colors.accent,
                                                },
                                                pressed && styles.pressed,
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.conflictBtnText,
                                                    { color: colors.onAccent },
                                                ]}>
                                                Open in calendar
                                            </ThemedText>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        </View>
                        );
                    })() : null}

                    {/* WHO — Responsible row + Backup row (Backup stubbed
                        per #307 until the column ships). Spec lines
                        113-140.
                        Multi-responsible variant (>1 tagged) replaces the
                        single avatar+name slot with a chip rack + inline
                        accent-tinted explanation card. Single-responsible
                        keeps the original layout for visual continuity. */}
                    <FormSectionLabel>Who</FormSectionLabel>
                    <View style={styles.sectionWrap}>
                        <FormGroup gap={0}>
                            {isMultiResponsible ? (
                                <View style={styles.responsibleRackOuter}>
                                    <View style={styles.responsibleRackHeader}>
                                        <ThemedText
                                            style={[
                                                styles.responsibleRackLabel,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoRegular,
                                                },
                                            ]}>
                                            Responsible
                                        </ThemedText>
                                        <ThemedText
                                            style={[
                                                styles.responsibleRackCount,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoRegular,
                                                },
                                            ]}>
                                            {`${responsibleProfiles.length} PEOPLE`}
                                        </ThemedText>
                                    </View>
                                    <View style={styles.responsibleRack}>
                                        {responsibleProfiles.map((m) => {
                                            const note: ResponsibleChipNote | undefined =
                                                m.profile_id === leadProfileId
                                                    ? 'LEAD'
                                                    : m.role === 'caregiver'
                                                      ? 'CARE'
                                                      : undefined;
                                            return (
                                                <ResponsibleChip
                                                    key={m.profile_id}
                                                    name={m.display_name}
                                                    color={
                                                        m.color ??
                                                        colorForResponsible(
                                                            m.profile_id,
                                                            colorMap,
                                                        )
                                                    }
                                                    note={note}
                                                    onPress={
                                                        isCaregiver
                                                            ? undefined
                                                            : () =>
                                                                  setRespSheetOpen(
                                                                      true,
                                                                  )
                                                    }
                                                />
                                            );
                                        })}
                                        {!isCaregiver ? (
                                            <AddPersonChip
                                                onPress={() =>
                                                    setRespSheetOpen(true)
                                                }
                                            />
                                        ) : null}
                                    </View>
                                    {/* Tagging-= visibility explanation card.
                                        Only when multi-responsible — single
                                        responsibles don't need the rule. */}
                                    <View
                                        style={[
                                            styles.taggingCard,
                                            {
                                                backgroundColor: withAlpha(
                                                    colors.accent,
                                                    0.063,
                                                ),
                                            },
                                        ]}>
                                        <Feather
                                            name="eye"
                                            size={11}
                                            color={colors.accent}
                                            style={styles.taggingIcon}
                                        />
                                        <ThemedText
                                            style={[
                                                styles.taggingText,
                                                { color: colors.inkSec },
                                            ]}>
                                            All tagged here see the full event.
                                            Untagged co-parents and caregivers
                                            see &ldquo;Busy&rdquo; in that time slot.
                                        </ThemedText>
                                    </View>
                                </View>
                            ) : (
                            <DetailRow
                                label="Responsible"
                                onPress={
                                    isCaregiver
                                        ? undefined
                                        : () => setRespSheetOpen(true)
                                }
                                right={
                                    responsibleMember ? (
                                        <View style={styles.responsibleSlot}>
                                            <View
                                                style={[
                                                    styles.responsibleAvatar,
                                                    {
                                                        backgroundColor: colorForResponsible(
                                                            responsibleMember.profile_id,
                                                            colorMap,
                                                        ),
                                                    },
                                                ]}>
                                                <ThemedText
                                                    style={
                                                        styles.responsibleInitial
                                                    }>
                                                    {(
                                                        responsibleMember.display_name?.[0] ??
                                                        '?'
                                                    ).toUpperCase()}
                                                </ThemedText>
                                            </View>
                                            <ThemedText
                                                style={[
                                                    styles.responsibleName,
                                                    { color: colors.text },
                                                ]}>
                                                {responsibleMember.display_name}
                                            </ThemedText>
                                        </View>
                                    ) : (
                                        <ThemedText
                                            style={[
                                                styles.anyoneText,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            Anyone
                                        </ThemedText>
                                    )
                                }
                            />
                            )}
                            <DetailRow
                                label="Backup"
                                last
                                right={
                                    // Design source screens-event-edit.jsx
                                    // lines 380-393: dashed `?` 18×18 avatar +
                                    // "Anyone" mono label. Backup is a stub
                                    // semantically (#307) but the visual
                                    // placeholder reads as "no backup set —
                                    // anyone can pick this up" rather than
                                    // "feature not built", which matches the
                                    // design's intent and de-stigmatizes the
                                    // empty state for users on this build.
                                    <View style={styles.backupSlot}>
                                        <View
                                            style={[
                                                styles.backupDashedAvatar,
                                                { borderColor: colors.inkFaint },
                                            ]}>
                                            <ThemedText
                                                style={[
                                                    styles.backupDashedQ,
                                                    { color: colors.inkFaint },
                                                ]}>
                                                ?
                                            </ThemedText>
                                        </View>
                                        <ThemedText
                                            style={[
                                                styles.anyoneText,
                                                {
                                                    color: colors.textSecondary,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            Anyone
                                        </ThemedText>
                                    </View>
                                }
                            />
                        </FormGroup>
                    </View>

                    {/* FOR — child chip strip. Hidden entirely when the
                        event has no kids tagged AND the user is a caregiver
                        (caregivers can't edit). Parents see the empty
                        section with a "+ Add kids" placeholder so they
                        can tag kids without leaving the screen. Spec
                        lines 142-153 + #422 inline edit. */}
                    {taggedChildren.length > 0 || !isCaregiver ? (
                        <>
                            <FormSectionLabel>For</FormSectionLabel>
                            <View style={styles.sectionWrap}>
                                <Pressable
                                    onPress={
                                        isCaregiver
                                            ? undefined
                                            : () => setChildrenSheetOpen(true)
                                    }
                                    accessibilityRole={
                                        isCaregiver ? undefined : 'button'
                                    }
                                    accessibilityLabel="Edit kids tagged"
                                    style={({ pressed }) => [
                                        styles.childChipCard,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                        pressed && !isCaregiver && styles.pressed,
                                    ]}>
                                    {taggedChildren.map((c) => (
                                        <View
                                            key={c.id}
                                            style={[
                                                styles.childChip,
                                                {
                                                    backgroundColor: withAlpha(
                                                        c.color,
                                                        0.13,
                                                    ),
                                                    borderColor: withAlpha(
                                                        c.color,
                                                        0.33,
                                                    ),
                                                },
                                            ]}>
                                            <ChildBadge
                                                name={c.display_name}
                                                color={c.color}
                                                size="sm"
                                            />
                                            <ThemedText
                                                style={[
                                                    styles.childChipText,
                                                    { color: colors.text },
                                                ]}>
                                                {c.display_name}
                                            </ThemedText>
                                        </View>
                                    ))}
                                    {/* Empty-state affordance — uses the
                                        AddPersonChip ds primitive (dashed
                                        border, mono "+ Add") for visual
                                        parity with the Responsible rack's
                                        AddPersonChip. The outer Pressable
                                        already handles the tap, so we
                                        pass no onPress to the chip — it
                                        renders as a static visual cue.
                                        Caregivers don't reach this branch
                                        (outer conditional hides the section). */}
                                    {taggedChildren.length === 0 ? (
                                        <AddPersonChip />
                                    ) : null}
                                </Pressable>
                            </View>
                        </>
                    ) : null}

                    {/* LOCATION — affordance split (#426):
                          • Whole card tap → open in Maps (the default
                            useful action — what users actually want when
                            tapping a map preview).
                          • EDIT chip in the section header → opens the
                            EventLocationSheet for parents. Caregivers
                            don't see the chip, so the card is read-only +
                            tap-to-Maps for them.
                        Previously the card itself was the edit target
                        with a long-press fallback to Maps — discoverable
                        in muscle-memory only. The split mirrors how the
                        ATTACHED section uses its own header accessory
                        ("+ ATTACH ANOTHER") for the action chip pattern. */}
                    {location ? (
                        <>
                            <View style={styles.sectionHeaderRow}>
                                <ThemedText
                                    style={[
                                        styles.sectionHeaderLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily:
                                                FontFamily.sansSemiBold,
                                        },
                                    ]}>
                                    LOCATION
                                </ThemedText>
                                {!isCaregiver ? (
                                    <Pressable
                                        onPress={() => setLocationSheetOpen(true)}
                                        accessibilityRole="button"
                                        accessibilityLabel="Edit location"
                                        hitSlop={8}
                                        style={({ pressed }) => [
                                            pressed && styles.pressed,
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.sectionHeaderAccessory,
                                                {
                                                    color: colors.accent,
                                                    fontFamily:
                                                        FontFamily.monoMedium,
                                                },
                                            ]}>
                                            EDIT
                                        </ThemedText>
                                    </Pressable>
                                ) : null}
                            </View>
                            <View style={styles.sectionWrap}>
                                <Pressable
                                    onPress={() => openLocationInMaps(location)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Open ${location.name} in Maps`}
                                    style={({ pressed }) => [
                                        styles.locationCard,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                        pressed && styles.pressed,
                                    ]}>
                                    {/* Map preview — MapPreview takes
                                        placeId (preferred, populated when
                                        the user picked the location via
                                        Google Places) or a text query
                                        fallback (formatted address /
                                        name). When neither is set the web
                                        component renders a gradient
                                        placeholder; native renders null
                                        (#309 native MapPreview is its
                                        own follow-up). */}
                                    {location.google_place_id ||
                                    location.formatted_address ||
                                    location.name ? (
                                        <View
                                            style={[
                                                styles.locationMapWrap,
                                                {
                                                    borderBottomColor:
                                                        colors.hair,
                                                },
                                            ]}>
                                            <MapPreview
                                                placeId={
                                                    location.google_place_id
                                                }
                                                query={
                                                    location.formatted_address ??
                                                    location.name
                                                }
                                            />
                                        </View>
                                    ) : null}
                                    <View style={styles.locationBody}>
                                        <ThemedText
                                            style={[
                                                styles.locationName,
                                                { color: colors.text },
                                            ]}
                                            numberOfLines={1}>
                                            {location.name}
                                        </ThemedText>
                                        {location.formatted_address ? (
                                            <ThemedText
                                                style={[
                                                    styles.locationAddress,
                                                    {
                                                        color: colors.textSecondary,
                                                        fontFamily:
                                                            FontFamily.monoRegular,
                                                    },
                                                ]}
                                                numberOfLines={1}>
                                                {location.formatted_address}
                                            </ThemedText>
                                        ) : null}
                                    </View>
                                </Pressable>
                            </View>
                        </>
                    ) : null}

                    {/* ATTACHED — tasks bound to this event. Spec lines
                        187-248. The design also draws a "list header" row
                        (Piano · weekly prep · 2/5 progress) above the
                        task list, assuming one list per event. Our data
                        model treats lists as a many-to-many on Task,
                        not on Event, so the list header doesn't have a
                        clean source-of-truth and is omitted for now —
                        each task's own list membership shows in its
                        meta strip via the TaskRow primitive's cross-
                        list pills (see #411 followup notes).

                        Section now renders for parents whether or not
                        there are existing tasks (#467) — empty state
                        becomes an entry point. Caregivers only see the
                        section when tasks exist (they can complete but
                        not create). The "+ ATTACH ANOTHER" header chip
                        is gone; the inline quick-add row at the bottom
                        of the card serves the same purpose with real
                        behavior wired (createTask). The list-attach
                        flow lives separately under #468. */}
                    {(eventTasks ?? []).length > 0 || !isCaregiver ? (
                        <>
                            <View style={styles.sectionHeaderRow}>
                                <ThemedText
                                    style={[
                                        styles.sectionHeaderLabel,
                                        {
                                            color: colors.inkSec,
                                            fontFamily:
                                                FontFamily.sansSemiBold,
                                        },
                                    ]}>
                                    ATTACHED
                                </ThemedText>
                            </View>
                            <View style={styles.sectionWrap}>
                                <View
                                    style={[
                                        styles.attachedCard,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    {(eventTasks ?? []).map((t, i) => (
                                        <View key={t.id}>
                                            {i > 0 ? (
                                                <HairlineDivider />
                                            ) : null}
                                            <TaskRow
                                                task={t}
                                                members={members ?? []}
                                                colorMap={colorMap}
                                                allLists={allLists ?? []}
                                                onTap={() =>
                                                    router.push({
                                                        pathname: '/task/[id]',
                                                        params: { id: t.id },
                                                    })
                                                }
                                                onToggle={async () => {
                                                    try {
                                                        await setTaskCompleted(
                                                            t.id,
                                                            !t.completed_at,
                                                        );
                                                        await refetchEventTasks();
                                                    } catch {
                                                        // surfacing toast/alert here would be
                                                        // an over-design; the row reverts on
                                                        // next refetch if the write failed.
                                                    }
                                                }}
                                                isLast={
                                                    i ===
                                                    (eventTasks ?? []).length -
                                                        1
                                                }
                                            />
                                        </View>
                                    ))}
                                    {/* Inline quick-add row (#467). Sits
                                        at the bottom of the card with a
                                        leading + glyph; hairline
                                        separator above when there are
                                        existing tasks. Caregivers don't
                                        see this — `!isCaregiver` gates
                                        the whole row. Type + Enter
                                        (returnKeyType="done") triggers
                                        handleAddTask, which creates a
                                        task scoped to this event and
                                        refetches. */}
                                    {!isCaregiver ? (
                                        <>
                                            {(eventTasks ?? []).length >
                                            0 ? (
                                                <HairlineDivider />
                                            ) : null}
                                            <View
                                                style={
                                                    styles.addTaskRow
                                                }>
                                                <Feather
                                                    name="plus"
                                                    size={14}
                                                    color={
                                                        colors.textSecondary
                                                    }
                                                />
                                                <TextInput
                                                    value={addTaskText}
                                                    onChangeText={
                                                        setAddTaskText
                                                    }
                                                    onSubmitEditing={
                                                        handleAddTask
                                                    }
                                                    placeholder="Add a task to this event"
                                                    placeholderTextColor={
                                                        colors.inkFaint
                                                    }
                                                    returnKeyType="done"
                                                    editable={!addingTask}
                                                    style={[
                                                        styles.addTaskInput,
                                                        {
                                                            color: colors.text,
                                                            fontFamily:
                                                                FontFamily.monoRegular,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        </>
                                    ) : null}
                                </View>
                            </View>
                        </>
                    ) : null}

                    {/* NOTES — inline-editable text (#413). For parents
                        the section is always rendered so they have an
                        affordance to add notes to a previously-empty
                        event without going through the legacy /edit
                        modal. Caregivers see the original read-only
                        treatment and the section hides when empty.
                        Mirrors TaskDetail v2's notes block. */}
                    {isCaregiver ? (
                        event.description ? (
                            <>
                                <FormSectionLabel>Notes</FormSectionLabel>
                                <View style={styles.sectionWrap}>
                                    <View
                                        style={[
                                            styles.notesCard,
                                            {
                                                backgroundColor:
                                                    colors.backgroundElement,
                                                borderColor: colors.hair,
                                            },
                                        ]}>
                                        <ThemedText
                                            style={[
                                                styles.notesText,
                                                { color: colors.inkSec },
                                            ]}>
                                            {event.description}
                                        </ThemedText>
                                    </View>
                                </View>
                            </>
                        ) : null
                    ) : (
                        <>
                            <FormSectionLabel>Notes</FormSectionLabel>
                            <View style={styles.sectionWrap}>
                                <View
                                    style={[
                                        styles.notesCard,
                                        {
                                            backgroundColor:
                                                colors.backgroundElement,
                                            borderColor: colors.hair,
                                        },
                                    ]}>
                                    <TextInput
                                        value={
                                            notesDraft ??
                                            (event.description ?? '')
                                        }
                                        onChangeText={setNotesDraft}
                                        editable={!savingChanges}
                                        multiline
                                        placeholder="Add notes…"
                                        placeholderTextColor={colors.inkFaint}
                                        style={[
                                            styles.notesText,
                                            styles.notesInput,
                                            { color: colors.inkSec },
                                        ]}
                                        accessibilityLabel="Event notes"
                                    />
                                </View>
                            </View>
                        </>
                    )}

                    {/* HISTORY — stubbed until the activity_events table
                        lands (#310 + #393). Show just the created date
                        from event.created_at so the section isn't a
                        complete lie + a mono hint that full history is
                        on the way. Spec lines 263-273 (which renders
                        EDActivity rows once we have them). */}
                    <FormSectionLabel>History</FormSectionLabel>
                    <View style={styles.sectionWrap}>
                        <FormGroup gap={0}>
                            <DetailRow
                                label="Created"
                                last
                                right={
                                    <ThemedText
                                        style={[
                                            styles.historyValueText,
                                            {
                                                color: colors.text,
                                                fontFamily:
                                                    FontFamily.monoMedium,
                                            },
                                        ]}>
                                        {format(
                                            parseISO(event.created_at),
                                            'MMM d',
                                        )}
                                    </ThemedText>
                                }
                            />
                        </FormGroup>
                        <ThemedText
                            style={[
                                styles.historyHint,
                                {
                                    color: colors.inkFaint,
                                    fontFamily: FontFamily.monoRegular,
                                },
                            ]}>
                            Full history coming soon
                        </ThemedText>
                    </View>

                    <View style={{ height: 80 }} />
                </ScrollView>

                {/* Sticky action bar — Delete (left, alert) + Edit (right,
                    accent). Spec lines 277-306 — we rebind "Save changes"
                    to "Edit" since the body is read-only (see header
                    comment for the spec-inconsistency note). Hidden for
                    caregivers entirely. */}
                {!isCaregiver ? (
                    <View
                        style={[
                            styles.stickyBar,
                            {
                                backgroundColor: colors.background,
                                borderTopColor: colors.hair,
                            },
                        ]}>
                        <Pressable
                            onPress={confirmDelete}
                            accessibilityRole="button"
                            accessibilityLabel="Delete event"
                            style={({ pressed }) => [
                                styles.stickyBtn,
                                styles.stickyDeleteBtn,
                                {
                                    backgroundColor: colors.backgroundElement,
                                    borderColor: colors.hair,
                                },
                                pressed && styles.pressed,
                            ]}>
                            <Feather name="trash-2" size={12} color={colors.alert} />
                            <ThemedText
                                style={[
                                    styles.stickyBtnText,
                                    { color: colors.alert },
                                ]}>
                                Delete
                            </ThemedText>
                        </Pressable>
                        {/* "Save changes" rebind (#413). The button is
                            grayed out (opacity 0.4, no press handler)
                            until title or notes have unsaved drafts;
                            once dirty it lights up to accent and saves
                            via updateEvent. A long-press still opens
                            the legacy /edit modal so users have an
                            escape hatch into the field sheets that
                            haven't been ported yet (date/time, location,
                            children, recurrence). The long-press
                            affordance is a temporary bridge until the
                            inline-edit sheets land in #413 follow-ups. */}
                        <Pressable
                            onPress={isDirty ? handleSaveChanges : undefined}
                            onLongPress={goEdit}
                            disabled={!isDirty || savingChanges}
                            accessibilityRole="button"
                            accessibilityLabel={
                                isDirty
                                    ? 'Save changes'
                                    : 'Save changes (no pending changes — long-press to open full editor)'
                            }
                            accessibilityState={{ disabled: !isDirty }}
                            style={({ pressed }) => [
                                styles.stickyBtn,
                                styles.stickyEditBtn,
                                {
                                    backgroundColor: colors.accent,
                                },
                                !isDirty && { opacity: 0.4 },
                                pressed && isDirty && styles.pressed,
                            ]}>
                            <Feather
                                name={savingChanges ? 'loader' : 'check'}
                                size={12}
                                color={colors.onAccent}
                            />
                            <ThemedText
                                style={[
                                    styles.stickyBtnText,
                                    { color: colors.onAccent },
                                ]}>
                                {savingChanges
                                    ? 'Saving…'
                                    : 'Save changes'}
                            </ThemedText>
                        </Pressable>
                    </View>
                ) : null}
            </SafeAreaView>
            {/* Kebab → EventOverflowSheet. Mounted at the screen root
                so its Modal portal sits above the SafeAreaView + the
                sticky action bar. Caregivers don't see the kebab and
                never open this sheet (matches the destructive-action
                role gate elsewhere). */}
            {!isCaregiver ? (
                <EventOverflowSheet
                    open={overflowOpen}
                    onClose={() => setOverflowOpen(false)}
                    onDeleted={() => router.back()}
                    event={event}
                    occurrenceDate={occurrenceDate}
                    hasConflict={!!conflict}
                />
            ) : null}
            {/* EventResponsibleSheet — multi-select picker for the
                Responsible row. Caregivers don't see the picker (they
                can't change responsibility — same gate as kebab). */}
            {!isCaregiver ? (
                <EventResponsibleSheet
                    open={respSheetOpen}
                    onClose={() => setRespSheetOpen(false)}
                    members={members ?? []}
                    currentSelection={currentResponsibleProfileIds}
                    currentLeadProfileId={leadProfileId}
                    onSave={handleResponsibleSave}
                />
            ) : null}
            {/* Field-edit sheets (#422). Each opens via its corresponding
                tap target in the body; on save they call updateEvent and
                close themselves. useEvent's cache picks up the change on
                next focus / refetch. Caregivers don't reach these (the
                tap targets are gated on !isCaregiver). */}
            {!isCaregiver ? (
                <>
                    <EventWhenSheet
                        open={whenSheetOpen}
                        onClose={() => setWhenSheetOpen(false)}
                        onSaved={refetchEvent}
                        event={event}
                    />
                    <EventRecurrenceSheet
                        open={recurrenceSheetOpen}
                        onClose={() => setRecurrenceSheetOpen(false)}
                        onSaved={refetchEvent}
                        event={event}
                    />
                    <EventChildrenSheet
                        open={childrenSheetOpen}
                        onClose={() => setChildrenSheetOpen(false)}
                        // Sheet pushes the selection into the parent
                        // draft instead of writing to the DB itself.
                        // The sticky "Save changes" button is the
                        // canonical commit path — see the children-
                        // draft block at the top of the component.
                        onApply={(ids) => setChildIdsDraft(ids)}
                        initialIds={effectiveChildIds}
                        children={children ?? []}
                    />
                    {household ? (
                        <EventLocationSheet
                            open={locationSheetOpen}
                            onClose={() => setLocationSheetOpen(false)}
                            onSaved={refetchEvent}
                            event={event}
                            locations={locations ?? []}
                            householdId={household.id}
                        />
                    ) : null}
                </>
            ) : null}
        </ThemedView>
    );
}

/** Whole-minute duration label — `45m`, `1h 30m`, `2h`. Used in the hero
 *  meta row. Drops trailing 0m so `1h 0m` reads as `1h`. */
function formatDuration(ms: number): string {
    const totalMin = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/** Opens the location in the platform's preferred maps app. Prefers the
 *  saved Google Maps URL when present (the user picked the place via
 *  PlacesAutocomplete), then falls back to a text-query search by the
 *  formatted address or location name. Silently no-ops if none of
 *  those are available — the card stays a tap target either way. */
function openLocationInMaps(location: {
    name?: string | null;
    google_maps_url?: string | null;
    formatted_address?: string | null;
}): void {
    const url = (() => {
        if (location.google_maps_url) return location.google_maps_url;
        const query = location.formatted_address || location.name;
        if (query) {
            return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }
        return null;
    })();
    if (!url) return;
    Linking.openURL(url).catch(() => undefined);
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1 },
    scroll: {
        paddingTop: Spacing.two,
        paddingBottom: Spacing.six,
    },

    // Top bar — 12/16/4 padding per spec, space-between layout with two
    // 32×32 chip buttons flanking the centered EVENT pretitle.
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    topBarBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Same footprint as the chip buttons so the pretitle stays centered
    // when the right chip is hidden (caregiver view).
    topBarBtnSpacer: { width: 32, height: 32 },
    topBarPretitle: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },

    // Hero — 14/24/16 padding per spec, large 28/600 title.
    hero: {
        paddingHorizontal: 24,
        paddingTop: 14,
        paddingBottom: 16,
    },
    // Pretitle row — glyph (icon or dot) + mono text. The icon/dot sit
    // inline-baseline with the text via `alignItems: center`. The text
    // keeps its own marginBottom so the spacing to the hero title below
    // stays unchanged when no glyph is present.
    heroPretitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 6,
    },
    heroPretitleIcon: {
        // Slight vertical optical adjustment so the Feather glyph
        // anchors visually-center against the 11pt mono caps text.
        marginTop: -1,
    },
    heroPretitleChildDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    heroPretitle: {
        fontSize: 11,
        letterSpacing: -0.2,
        // marginBottom moved to heroPretitleRow above so the glyph + text
        // get the spacing as a unit. Keep at 0 here.
        marginBottom: 0,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: -0.9,
        lineHeight: 31,
        marginBottom: 10,
    },
    // TextInput-specific tweaks for the inline-editable hero title. RN's
    // TextInput inherits the font sizing from `heroTitle` but needs the
    // padding zeroed and `textAlignVertical: 'top'` so multi-line content
    // starts at the top edge (matches the static-text baseline).
    heroTitleInput: {
        padding: 0,
        textAlignVertical: 'top',
    },
    heroMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        // 8px gap per screens-event-edit.jsx:322 (multi-responsible hero
        // meta row). Tighter 6 was carried over from the single-
        // responsible spec; UX audit flagged the drift.
        gap: 8,
        flexWrap: 'wrap',
    },
    // Tap target around the time + duration text in the hero meta row.
    // Pressable wrap (opens EventWhenSheet) — flex-row inline so the
    // duration suffix stays glued to the time text.
    heroMetaTimeSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    heroTime: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: -0.4,
    },
    heroDuration: {
        fontSize: 11,
        letterSpacing: -0.2,
    },

    // Each section's wrap aligns with the design's 16px outer page
    // padding (FormGroup brings its own inner 12px). Margin-bottom
    // closes the spacing rhythm between sections.
    sectionWrap: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },

    // WHO — Responsible row "value" slot: 22px circular avatar + name.
    responsibleSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    responsibleAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    responsibleInitial: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    responsibleName: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    anyoneText: {
        fontSize: 12,
        letterSpacing: -0.2,
    },
    // Backup row "?" + "Anyone" slot — dashed circle + mono label.
    // Spec: screens-event-edit.jsx:380-393. The dashed 18×18 carries the
    // "no specific person yet" semantic; the "Anyone" text reads as
    // "anyone can pick this up" rather than the more abstract previous
    // "Coming soon" stub copy.
    backupSlot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    backupDashedAvatar: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backupDashedQ: {
        fontSize: 9,
        fontWeight: '600',
        // RN's center alignment lifts the glyph slightly; the design's "?" sits
        // visually-centered without optical adjustment, so we leave lineHeight
        // default and accept a 0.5px vertical optical bias.
    },

    // Multi-responsible variant — the Responsible row becomes a header
    // ("Responsible · N PEOPLE") + chip rack + inline explanation card.
    // Lives outside the DetailRow component because the layout differs
    // significantly. Design source: screens-event-edit.jsx:345-378.
    responsibleRackOuter: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        // borderBottomColor — applied inline via colors.hair.
    },
    responsibleRackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    responsibleRackLabel: {
        fontSize: 11,
        letterSpacing: -0.2,
    },
    responsibleRackCount: {
        fontSize: 10,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    responsibleRack: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    // Inline accent-tinted "Tagging = visibility" card. Padding 7/9,
    // radius 7, accent-faint background. Sits between the chip rack
    // and the next DetailRow (Backup). Spec lines 366-377.
    taggingCard: {
        marginTop: 10,
        paddingVertical: 7,
        paddingHorizontal: 9,
        borderRadius: 7,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 7,
    },
    taggingIcon: { marginTop: 1 },
    taggingText: {
        flex: 1,
        fontSize: 11,
        lineHeight: 15,
    },

    // SHARED · N HOMES chip in the hero meta row. Accent-faint
    // background, mono 10/600, padding 3/9, radius 999. Spec lines
    // 328-339.
    sharedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingTop: 3,
        paddingBottom: 3,
        paddingHorizontal: 9,
        borderRadius: 999,
    },
    // Two-overlapping-circles glyph, 10×10 total (matches design source
    // line 334's SVG dims). Each circle is 6×6 outlined; second circle
    // sits at +4/+4 so they overlap by 2px on the diagonal axis.
    sharedIcon: {
        width: 10,
        height: 10,
        position: 'relative',
    },
    sharedIconCircle: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        borderWidth: 1.2,
        backgroundColor: 'transparent',
    },
    sharedChipText: {
        fontSize: 10,
        fontWeight: '600',
    },

    // FOR — child chip card: wraps a tinted pill per kid. Padding +
    // gap match the design (12/14 outer, 6 between chips).
    childChipCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    childChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 5,
        paddingRight: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: StyleSheet.hairlineWidth,
    },
    childChipText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.1,
    },

    // LOCATION — single card with the MapPreview above and the
    // name+address rows below. Tap-target wraps the whole card so
    // any region opens maps.
    locationCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    locationMapWrap: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    locationBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 2,
    },
    locationName: {
        fontSize: 13.5,
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    locationAddress: {
        fontSize: 11,
        letterSpacing: -0.2,
    },

    // NOTES — flat read-only card with body text.
    notesCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    notesText: {
        fontSize: 13,
        lineHeight: 19.5,
    },
    // Inline notes TextInput (#413). Zero padding so the input aligns with
    // the read-state text. minHeight gives a tappable region even when
    // empty so users see "Add notes…" placeholder with enough breathing
    // room to know it's a multi-line input. textAlignVertical='top' so
    // typed lines anchor to the top edge.
    notesInput: {
        padding: 0,
        minHeight: 40,
        textAlignVertical: 'top',
    },

    // ATTACHED — section header takes a right-aligned accessory chip
    // (the "+ ATTACH ANOTHER" mono link), so it's its own row instead
    // of a plain FormSectionLabel. 24/12 horizontal/top padding mirrors
    // the design spec for headers with an accessory (vs the standard
    // FormSectionLabel's 12/12).
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 6,
    },
    sectionHeaderLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    sectionHeaderAccessory: {
        fontSize: 10,
        letterSpacing: -0.1,
    },
    // Attached card — TaskRows stacked with hairline dividers between
    // them. The shared TaskRow primitive handles its own checkbox, meta
    // row, and right-side assignee avatar; the card just frames them.
    attachedCard: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    // Inline "+ ADD TASK" quick-add row (#467) — sits at the bottom of
    // the attached card. Leading + glyph, single-line TextInput,
    // same 13/0.2 mono vocabulary as the Lists tab's Cmd-N row so the
    // affordance reads the same across surfaces.
    addTaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 14,
    },
    addTaskInput: {
        flex: 1,
        fontSize: 13,
        letterSpacing: -0.2,
        paddingVertical: 0,
    },

    // HISTORY — single Created row + small mono "coming soon" hint
    // below the card. Hint sits flush-left under the card to read as a
    // continuation of the section, not a new affordance.
    historyValueText: {
        fontSize: 12,
        letterSpacing: -0.2,
    },
    historyHint: {
        fontSize: 10,
        letterSpacing: -0.2,
        paddingLeft: 14,
        paddingTop: 6,
    },

    // CONFLICT pill in the hero meta row — warn-tinted compact mono
    // pill matching the spec's 3px 9px / 999 radius.
    conflictPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 999,
        // v3 spec: 0.5px warn-tinted border + trailing chevron signal
        // interactivity. Color is injected inline so the alpha stays in
        // sync with the background tint (which also tracks colors.warn).
        borderWidth: StyleSheet.hairlineWidth,
    },
    conflictPillText: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: -0.1,
    },
    // CONFLICT resolver ribbon — left-rail TintedCard pattern. Padded
    // 12/14 with icon + body laid out as flex-row.
    conflictCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: 3,
    },
    conflictIcon: {
        marginTop: 1,
        flexShrink: 0,
    },
    conflictBody: {
        flex: 1,
        gap: 4,
    },
    conflictTitle: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    conflictBodyText: {
        fontSize: 12,
        lineHeight: 18,
    },
    conflictActions: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 10,
    },
    conflictBtnPrimary: {
        flexShrink: 0,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    conflictBtnText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.2,
    },


    // Sticky action bar — Delete left, Edit right. Padding 12/16 + 30px
    // bottom for the iPhone home-bar safe area.
    stickyBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    stickyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    stickyDeleteBtn: {
        flexShrink: 0,
        borderWidth: StyleSheet.hairlineWidth,
    },
    stickyEditBtn: {
        flex: 1,
    },
    stickyBtnText: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },

    pressed: { opacity: 0.7 },
});
