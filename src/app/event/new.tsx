import { format } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';

import { EventForm, type EventFormSubmitInput, type EventFormValues } from '@/components/event-form';
import { LoadingScreen } from '@/components/loading-screen';
import { useChildren } from '@/hooks/use-children';
import { useCustodySchedule } from '@/hooks/use-custody-schedule';
import { useHouseholdMembers } from '@/hooks/use-household-members';
import { useHouseholds } from '@/hooks/use-households';
import { useLists } from '@/hooks/use-lists';
import { useLocations } from '@/hooks/use-locations';
import { useMyProfile } from '@/hooks/use-my-profile';
import { createEvent, createTask } from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { useAuth } from '@/providers/auth-provider';

function defaultStartTime(now: Date): string {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return format(next, 'HH:mm');
}

function addHours(time: string, hours: number): string {
    const [h, m] = time.split(':').map((s) => parseInt(s, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const total = h * 60 + m + hours * 60;
    const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const hh = Math.floor(wrapped / 60).toString().padStart(2, '0');
    const mm = (wrapped % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
}

/** YYYY-MM-DD validator — keeps stray params from creating an Invalid Date. */
function isIsoDate(s: string | undefined): s is string {
    return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
/** HH:mm validator — used for the drag-to-create handoff. */
function isHHmm(s: string | undefined): s is string {
    return !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export default function NewEventScreen() {
    const router = useRouter();
    // Optional pre-fill params from the calendar's click-and-drag handler. When present,
    // we seed the form with the dragged time range instead of "now + 1 hour".
    const params = useLocalSearchParams<{
        date?: string | string[];
        startTime?: string | string[];
        endTime?: string | string[];
    }>();
    const paramDate = Array.isArray(params.date) ? params.date[0] : params.date;
    const paramStartTime = Array.isArray(params.startTime)
        ? params.startTime[0]
        : params.startTime;
    const paramEndTime = Array.isArray(params.endTime)
        ? params.endTime[0]
        : params.endTime;

    const { session, user, isLoading: authLoading } = useAuth();
    const { households, isLoading: householdsLoading } = useHouseholds();
    const household = households?.[0];
    const { members, isLoading: membersLoading } = useHouseholdMembers(household?.id);
    const { locations, isLoading: locationsLoading } = useLocations(household?.id);
    const { children, isLoading: childrenLoading } = useChildren(household?.id);
    const { schedule: custodySchedule, isLoading: custodyLoading } = useCustodySchedule(
        household?.id,
    );
    const { lists, isLoading: listsLoading } = useLists(household?.id);
    const { profile, isLoading: profileLoading } = useMyProfile();

    // Tracks the event id we created on a previous submit attempt that failed
    // during the subsequent task-attach loop. On retry we reuse this id so we
    // don't insert a second event row (QA-003). Cleared after a successful
    // navigation away.
    const createdEventIdRef = useRef<string | null>(null);

    const initialValues = useMemo<EventFormValues | null>(() => {
        if (!user) return null;
        const now = new Date();
        const fallbackStart = defaultStartTime(now);
        // Prefer the user's configured default tz (Settings → Default timezone). If
        // unset, fall back to the device's current tz. Either way, recurrence expansion
        // uses this to keep wall-clock times stable across DST boundaries.
        const deviceTz =
            typeof Intl !== 'undefined'
                ? Intl.DateTimeFormat().resolvedOptions().timeZone
                : null;
        const tz = profile?.default_timezone ?? deviceTz;
        // Pre-fill from drag-to-create params when valid; otherwise default to today
        // and the next round hour. Bad params silently fall through so a typo'd URL
        // can't crash the form.
        const seedDate = isIsoDate(paramDate) ? paramDate : format(now, 'yyyy-MM-dd');
        const seedStart = isHHmm(paramStartTime) ? paramStartTime : fallbackStart;
        const seedEnd = isHHmm(paramEndTime)
            ? paramEndTime
            : addHours(seedStart, 1);
        return {
            title: '',
            date: seedDate,
            // Default end date = start date (single-day all-day event). User can
            // extend it via the form when allDay is on.
            endDate: seedDate,
            startTime: seedStart,
            endTime: seedEnd,
            allDay: false,
            locationName: '',
            locationMapsUrl: '',
            notes: '',
            responsibleProfileId: user.id,
            recurrenceRule: null,
            eventType: null,
            timezone: tz,
            childIds: [],
            alternation: null,
        };
    }, [user, profile, paramDate, paramStartTime, paramEndTime]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        locationsLoading ||
        childrenLoading ||
        custodyLoading ||
        listsLoading ||
        profileLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    if (!initialValues) return <LoadingScreen />;

    const handleSubmit = async (input: EventFormSubmitInput) => {
        const locationId = await resolveLocationId(
            household.id,
            locations ?? [],
            input.locationName,
            input.locationMapsUrl,
            { place: input.locationPlace },
        );
        // First attempt: insert the event. Subsequent attempts (after a task-write
        // failure on the previous try): reuse the event row we already created
        // and only retry the task writes. We don't bother updating the event on
        // retry — if the user changed event fields in between, the new state
        // hasn't been saved, but they can always edit afterward. The bigger sin
        // is silently creating a duplicate.
        let eventId = createdEventIdRef.current;
        if (eventId === null) {
            const created = await createEvent(household.id, { ...input, locationId });
            eventId = created.id;
            createdEventIdRef.current = eventId;
        }
        // Attach any tasks the user added inline. We do this AFTER createEvent because
        // event_id is the FK target and we need a real id. Failures here are surfaced
        // to the form via the throw — the event already saved, but the user sees the
        // task error and can retry without creating a second event.
        for (const t of input.tasks) {
            if (!t.title.trim()) continue;
            await createTask(household.id, {
                title: t.title,
                notes: t.notes,
                eventId,
                dueAt: t.dueAt,
                assigneeProfileIds: t.assigneeProfileIds,
                // Empty listIds → createTask defaults to Inbox. Non-empty → exactly
                // those lists. Mirrors the LocalTask shape from event-task-section.
                listIds: t.listIds,
                childIds: t.childIds,
            });
        }
        // Success: clear the in-flight event id before navigating away so a
        // subsequent navigation back to this screen starts fresh.
        createdEventIdRef.current = null;
        router.back();
    };

    // Alternation chips are only meaningful when there's a custody schedule to derive
    // responsibility from. Single-parent / couple households (or separated households
    // without a configured schedule) don't see them.
    const showAlternationChips =
        household.household_type === 'separated' && !!custodySchedule;

    return (
        <EventForm
            headerTitle="New event"
            members={members ?? []}
            locations={locations ?? []}
            children={children ?? []}
            lists={lists ?? []}
            currentUserId={user.id}
            initialValues={initialValues}
            showAlternationChips={showAlternationChips}
            onSubmit={handleSubmit}
            onCancel={() => router.back()}
        />
    );
}
