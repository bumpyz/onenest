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
import { useMyRole } from '@/hooks/use-my-role';
import {
    createEvent,
    createList,
    createTask,
    setEventRemindersFor,
} from '@/lib/db';
import { resolveLocationId } from '@/lib/locations';
import { resolveDefaultTimezone } from '@/lib/timezones';
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
    const {
        lists,
        isLoading: listsLoading,
        refetch: refetchLists,
    } = useLists(household?.id);
    const { isCaregiver, isLoading: roleLoading } = useMyRole(household?.id);

    // Tracks the event id we created on a previous submit attempt that failed
    // during the subsequent task-attach loop. On retry we reuse this id so we
    // don't insert a second event row (QA-003). Cleared after a successful
    // navigation away.
    const createdEventIdRef = useRef<string | null>(null);

    const initialValues = useMemo<EventFormValues | null>(() => {
        if (!user) return null;
        const now = new Date();
        const fallbackStart = defaultStartTime(now);
        // Phase 6.6.1: resolve tz directly from the device (Intl) with a
        // California fallback on web when Intl is unavailable. The previous
        // profile.default_timezone read is dropped — there's no longer a
        // Settings picker to write to that column, so reading from it would
        // return null for all users. resolveDefaultTimezone() lives in
        // lib/timezones.ts; recurrence expansion still uses this tz to keep
        // wall-clock times stable across DST.
        const tz = resolveDefaultTimezone();
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
            // Multi-responsible — seed with the current user as the sole
            // tagged responsible + lead. Same default as the prior
            // single-select picker (creator is responsible by default),
            // expressed in the new model so EventForm picks it up
            // directly without back-compat fallback.
            responsibles: [{ profileId: user.id, isLead: true }],
            recurrenceRule: null,
            eventType: null,
            timezone: tz,
            childIds: [],
            alternation: null,
            // Privacy opt-in (#466) defaults to false on create — events
            // are visible to the whole household unless the user
            // explicitly toggles "Mark private" in the form.
            isPrivate: false,
            // "Also notify other parent" (#322) defaults to false; the
            // creator's notification scope applies unless the user
            // explicitly broadcasts.
            notifyOtherParent: false,
            // #308 — no caller reminder by default on create. User can
            // dial one in from the Notifications section before save.
            reminderOffsetMinutes: null,
        };
    }, [user, paramDate, paramStartTime, paramEndTime]);

    if (
        authLoading ||
        householdsLoading ||
        membersLoading ||
        locationsLoading ||
        childrenLoading ||
        custodyLoading ||
        listsLoading ||
        roleLoading
    ) {
        return <LoadingScreen />;
    }
    if (!session || !user) return <Redirect href="/sign-in" />;
    if (!household) return <Redirect href="/create-household" />;
    // Caregivers can't create events. RLS would reject the INSERT anyway, but
    // bouncing them at the route layer avoids a half-filled form + cryptic
    // postgres error. They land back on the Home tab where their read-only
    // view of assigned events / tasks lives.
    if (isCaregiver) return <Redirect href="/" />;
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
        // #308 — write the caller's reminder row before tasks. Empty
        // offset list = explicitly "no reminder for me", which clears
        // any prior row created by a retry. If the toggle "Also notify
        // other parent" is on AND the user picked an offset, fan the
        // same offset out to every OTHER tagged adult — schema migration
        // 0053's comment calls this out as the design intent. Other
        // recipients can later override their own row from their own
        // session if they want a different lead time; we don't try to
        // be clever about merging across sessions here.
        const myOffset = input.reminderOffsetMinutes;
        await setEventRemindersFor(
            eventId,
            user.id,
            myOffset !== null ? [myOffset] : [],
        );
        if (input.notifyOtherParent && myOffset !== null) {
            const otherAdults = (input.responsibles ?? [])
                .map((r) => r.profileId)
                .filter((pid) => pid !== user.id);
            for (const pid of otherAdults) {
                await setEventRemindersFor(eventId, pid, [myOffset]);
            }
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
            // #468 — inline-create handler for the To-do list picker.
            // Creates a household list with the typed name, refetches
            // so the picker's lists prop includes it on next render,
            // and returns the new row so EventForm can auto-select it.
            onCreateList={async (name) => {
                const created = await createList(household.id, { name });
                await refetchLists();
                return created;
            }}
        />
    );
}
