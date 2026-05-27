import { format, parseISO } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventForm, type EventFormSubmitInput, type EventFormValues } from '@/components/event-form';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { LocalTask } from '@/components/event-task-section';
import { useChildren } from '@/hooks/use-children';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useEvent } from '@/hooks/use-event';
import { useEventOccurrenceOverrides } from '@/hooks/use-event-occurrence-overrides';
import { useEventTasks } from '@/hooks/use-event-tasks';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useLocations } from '@/hooks/use-locations';
import { useMyRole } from '@/hooks/use-my-role';
import {
    createList,
    createTask,
    deleteEvent,
    deleteEventOccurrenceOverride,
    deleteTask,
    setEventOccurrenceOverride,
    setTaskCompleted,
    updateEvent,
    updateTask,
} from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { useAuth } from '@/providers/auth-provider';

export default function EditEventScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        id?: string | string[];
        date?: string | string[];
    }>();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    // YYYY-MM-DD of the specific occurrence the user clicked, when navigating from
    // Calendar / Home. Used to gate the "Apply to this occurrence" toggle and to write
    // the override row keyed by date. Null on direct nav to /event/[id] without the
    // query param (the user lands in series-edit mode by default).
    const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
    const occurrenceDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { locations, isLoading: locationsLoading } = useLocations(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { schedule: custodySchedule, isLoading: custodyLoading } = useCustodySchedule(
        household?.id,
    );
    const {
        lists,
        isLoading: listsLoading,
        refetch: refetchLists,
    } = useLists(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);
    const { event, isLoading: eventLoading, refetch: refetchEvent } = useEvent(id);
    const { tasks: dbTasks, isLoading: tasksLoading, refetch: refetchTasks } =
        useEventTasks(id);

    // Snapshot the initial tasks at mount so the save handler can diff against them.
    // After save we refetch so subsequent edits start from the new ground truth.
    const initialTasks = useMemo<LocalTask[]>(
        () =>
            (dbTasks ?? []).map((t) => ({
                localId: t.id,
                dbId: t.id,
                title: t.title,
                notes: t.notes,
                dueAt: t.due_at,
                assigneeProfileIds: t.assignee_profile_ids,
                listIds: t.list_ids,
                childIds: t.child_ids,
                completedAt: t.completed_at,
                completedBy: t.completed_by,
            })),
        [dbTasks],
    );

    // Pull any existing override for THIS specific (event, date) pair. Range is just
    // the single occurrence date — we only need one row at most.
    const overrideRangeDate = useMemo(
        () => (occurrenceDate ? parseISO(occurrenceDate) : new Date()),
        [occurrenceDate],
    );
    const { overrideMap: occurrenceOverrideMap, refetch: refetchOccurrenceOverrides } =
        useEventOccurrenceOverrides(
            household?.id,
            overrideRangeDate,
            overrideRangeDate,
        );
    const existingOverride =
        id && occurrenceDate
            ? occurrenceOverrideMap.get(`${id}|${occurrenceDate}`) ?? null
            : null;

    const initialValues = useMemo<EventFormValues | null>(() => {
        if (!event) return null;
        const start = new Date(event.starts_at);
        const end = new Date(event.ends_at);
        // Prefer the linked location's name; fall back to legacy text.
        const linkedLocation =
            event.location_id && locations
                ? locations.find((l) => l.id === event.location_id)
                : null;
        const locationName = linkedLocation?.name ?? event.location ?? '';
        const locationMapsUrl = linkedLocation?.google_maps_url ?? '';
        // Preserve the event's existing tz on edits — rebinding to the editor's current
        // tz would silently shift the wall clock of every future recurring instance.
        // If the event predates per-event tz (legacy NULL), backfill with the editor's tz
        // so future expansions are DST-aware. This is a one-time, non-destructive upgrade
        // since the event's stored UTC instant is unchanged.
        const editorTz =
            typeof Intl !== 'undefined'
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : null;
        // For all-day events, ends_at is the exclusive start-of-day after the
        // last covered day (a single-day event has ends_at = starts_at + 1d). To
        // get the inclusive endDate for the form, subtract one day from ends_at.
        // Single-day events round-trip to endDate === date, which the form
        // treats as the no-op default.
        //
        // QA-005: All-day events are stored at UTC midnight (see event-form
        // handleSubmit). To round-trip the same calendar date for every viewer
        // we extract the UTC date prefix instead of formatting in local time —
        // otherwise a viewer west of the creator's tz would see the day shift
        // one back. Timed events still format in local time (their starts_at is
        // a real point in time and the user wants their own local wall clock).
        const allDayEndDate = new Date(end);
        allDayEndDate.setUTCDate(allDayEndDate.getUTCDate() - 1);
        const allDayStartIso = event.starts_at.slice(0, 10);
        const allDayEndIso = allDayEndDate.toISOString().slice(0, 10);
        return {
            title: event.title,
            date: event.all_day ? allDayStartIso : format(start, 'yyyy-MM-dd'),
            endDate: event.all_day
                ? allDayEndIso
                : format(start, 'yyyy-MM-dd'),
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            allDay: event.all_day,
            locationName,
            locationMapsUrl,
            notes: event.description ?? '',
            responsibleProfileId: event.responsible_profile_id,
            // Multi-responsible — seed the picker from the new join.
            // Empty when the event hasn't been touched by the new model
            // yet; EventForm then falls back to a single-row list from
            // responsibleProfileId for back-compat.
            responsibles: (event.responsibles ?? []).map((r) => ({
                profileId: r.profile_id,
                isLead: r.is_lead,
            })),
            recurrenceRule: event.recurrence_rule,
            eventType: event.event_type,
            timezone: event.timezone ?? editorTz,
            childIds: event.child_ids,
            alternation: event.responsible_alternation,
            // Privacy opt-in (#466) — load from the stored row so the
            // toggle reflects the existing setting on edit. Default to
            // false if the field is missing (e.g., a row read with a
            // select that didn't include `is_private`; normalizeEventRow
            // already coalesces but we double-up defensively).
            isPrivate: event.is_private ?? false,
            // "Also notify other parent" (#322) — same load/default
            // pattern as is_private.
            notifyOtherParent: event.notify_other_parent ?? false,
        };
    }, [event, locations]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        locationsLoading ||
        childrenLoading ||
        custodyLoading ||
        listsLoading ||
        eventLoading ||
        tasksLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;

    if (!event || !initialValues) {
        return (
            <ThemedView style={styles.container}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.centered}>
                        <ThemedText type="subtitle">Event not found</ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.center}>
                            It may have been deleted.
                        </ThemedText>
                        <Pressable onPress={() => router.replace('/')} style={styles.linkBtn}>
                            <ThemedText style={{ color: '#1F2940' }}>Go to calendar</ThemedText>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </ThemedView>
        );
    }

    const handleSubmit = async (input: EventFormSubmitInput) => {
        if (input.applyTo === 'occurrence' && occurrenceDate) {
            // Per-occurrence override path: only responsibleProfileId is meaningful.
            // The form locks every other field in this mode, so we don't touch the
            // master event at all.
            await setEventOccurrenceOverride(
                event.id,
                occurrenceDate,
                input.responsibleProfileId ?? null,
            );
            await refetchOccurrenceOverrides();
            router.back();
            return;
        }
        // Series path: full master update, including the new alternation field.
        const locationId = await resolveLocationId(
            household.id,
            locations ?? [],
            input.locationName,
            input.locationMapsUrl,
            { place: input.locationPlace },
        );
        await updateEvent(event.id, { ...input, locationId });

        // Diff tasks against the initial snapshot taken at mount. Three buckets:
        //   - In initial but not in final → DELETE
        //   - In final without a dbId → CREATE
        //   - In both (matching dbId) → UPDATE (cheap; we don't bother per-field diff)
        const finalIds = new Set(input.tasks.filter((t) => t.dbId).map((t) => t.dbId!));
        for (const original of initialTasks) {
            if (original.dbId && !finalIds.has(original.dbId)) {
                await deleteTask(original.dbId);
            }
        }
        for (const t of input.tasks) {
            if (!t.title.trim()) continue;
            if (t.dbId) {
                await updateTask(t.dbId, {
                    title: t.title,
                    notes: t.notes,
                    eventId: event.id,
                    dueAt: t.dueAt,
                    assigneeProfileIds: t.assigneeProfileIds,
                    // The inline task section now exposes list memberships, so we
                    // pass the full desired set. Empty array clears (orphans to
                    // Inbox in the UI); the multi-list refactor honors that.
                    listIds: t.listIds,
                    childIds: t.childIds,
                });
            } else {
                await createTask(household.id, {
                    title: t.title,
                    notes: t.notes,
                    eventId: event.id,
                    dueAt: t.dueAt,
                    assigneeProfileIds: t.assigneeProfileIds,
                    listIds: t.listIds,
                    childIds: t.childIds,
                });
            }
        }

        await refetchEvent();
        await refetchTasks();
        router.back();
    };

    /** Inline checkbox handler — flips a persisted task without saving the whole form. */
    const handleCompleteTaskImmediate = async (dbId: string, completed: boolean) => {
        await setTaskCompleted(dbId, completed);
        await refetchTasks();
    };

    const handleDelete = async () => {
        await deleteEvent(event.id);
        router.back();
    };

    const handleRemoveOccurrenceOverride = async () => {
        if (!occurrenceDate) return;
        await deleteEventOccurrenceOverride(event.id, occurrenceDate);
        await refetchOccurrenceOverrides();
        router.back();
    };

    // Alternation chips show only for separated households with a configured schedule —
    // anywhere else there's nothing to alternate against.
    const showAlternationChips =
        household.household_type === 'separated' && !!custodySchedule;
    // The Apply-To toggle and override semantics only apply to recurring events whose
    // specific occurrence was clicked from Calendar / Home. One-off events skip both.
    const isRecurringInstance = !!occurrenceDate && !!event.recurrence_rule;

    // Caregivers don't get the edit form. Bounce them back to the
    // read-only detail screen — `event/[id]/index.tsx` is the
    // canonical read view for everyone (#409 close-out). RLS in
    // migration 0031 enforces the same rule server-side; this guard
    // is just to prevent them landing on a form that won't save.
    //
    // We use Redirect (not router.replace) so the URL history doesn't
    // briefly point at /edit before bouncing — cleaner for back-stack
    // navigation.
    if (isCaregiver) {
        return (
            <Redirect
                href={
                    occurrenceDate
                        ? `/event/${id}?date=${occurrenceDate}`
                        : `/event/${id}`
                }
            />
        );
    }

    return (
        <EventForm
            headerTitle="Edit event"
            members={members ?? []}
            locations={locations ?? []}
            children={children ?? []}
            lists={lists ?? []}
            currentUserId={user.id}
            initialValues={initialValues}
            showAlternationChips={showAlternationChips}
            recurringInstanceDate={isRecurringInstance ? occurrenceDate : null}
            hasExistingOccurrenceOverride={!!existingOverride}
            occurrenceOverrideResponsibleId={existingOverride?.responsible_profile_id ?? null}
            onRemoveOccurrenceOverride={
                existingOverride ? handleRemoveOccurrenceOverride : undefined
            }
            initialTasks={initialTasks}
            onCompleteTaskImmediate={handleCompleteTaskImmediate}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            onCancel={() => router.back()}
            // #468 — inline-create handler for the To-do list picker.
            // Same shape as the /event/new caller; uses household.id
            // from the current edit context. refetchLists ensures the
            // EventForm's `lists` prop reflects the newly created row
            // on the next render so it shows up in the picker.
            onCreateList={async (name) => {
                const created = await createList(household.id, { name });
                await refetchLists();
                return created;
            }}
        />
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safe: { flex: 1, padding: Spacing.four, justifyContent: 'center' },
    centered: { alignItems: 'center', gap: Spacing.three },
    center: { textAlign: 'center' },
    linkBtn: { padding: Spacing.two },
});
