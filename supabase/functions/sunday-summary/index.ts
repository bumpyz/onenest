// supabase/functions/sunday-summary/index.ts
// Sends a weekly "heads up" push notification to every user who's registered a push token,
// summarizing conflicts (responsible parent + their external busy block overlap) and
// unassigned events for the upcoming 7 days.
//
// Trigger: scheduled via pg_cron (see migration 0013) OR invoked manually via
// `supabase functions invoke sunday-summary` or HTTP POST.
//
// QA-002: this function previously SELECTed events with `.gte('starts_at', nowIso)` and
// did no recurrence expansion + ignored alternation. The Home / Calendar "Next 7 days"
// hooks use expandEventToOccurrences + resolveResponsibleProfileId to get the right
// counts — most households have weekly recurring events (soccer, drop-offs) whose master
// starts_at is far in the past, so the old query simply missed them and produced "0
// events" pushes that disagreed with the in-app view. Now we mirror the client logic via
// the shared _shared/recurrence-resolver Deno module.
//
// Deployment:
//   1. Install Supabase CLI (https://supabase.com/docs/guides/cli) and log in
//   2. From the project root:  supabase functions deploy sunday-summary --no-verify-jwt
//      (--no-verify-jwt because pg_cron calls it without a user JWT; the function uses the
//       service role key from the function's env to bypass RLS internally)
//   3. Set the SUPABASE_SERVICE_ROLE_KEY env var in the Supabase function dashboard
//      (it's auto-populated for newly-created functions on most projects, but verify)

import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
    buildCustodyOverrideMap,
    buildEventOccurrenceOverrideMap,
    expandEventToOccurrences,
    resolveResponsibleProfileId,
    type CustodyOverride,
    type CustodySchedule,
    type Event,
    type EventOccurrenceOverride,
} from '../_shared/recurrence-resolver.ts';

type PushToken = {
    profile_id: string;
    expo_token: string;
    platform: string | null;
};

type ExternalEventRow = {
    profile_id: string;
    starts_at: string;
    ends_at: string;
};

type Summary = {
    eventCount: number;
    conflicts: number;
    unassigned: number;
    /** Open tasks due in the upcoming week, scoped to the recipient profile (assigned
     *  to them OR unassigned/anyone). */
    openTasks: number;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

function buildNotificationBody(s: Summary): string {
    // Skip the push entirely when there's nothing the user could act on. Previously we
    // skipped on eventCount === 0; tasks count now as actionable too.
    if (s.eventCount === 0 && s.openTasks === 0) return '';
    const parts: string[] = [];
    if (s.conflicts > 0) {
        parts.push(`${s.conflicts} conflict${s.conflicts === 1 ? '' : 's'}`);
    }
    if (s.unassigned > 0) {
        parts.push(`${s.unassigned} unassigned event${s.unassigned === 1 ? '' : 's'}`);
    }
    if (s.openTasks > 0) {
        parts.push(`${s.openTasks} task${s.openTasks === 1 ? '' : 's'} to do`);
    }
    if (parts.length > 0) {
        return `Heads up — ${parts.join(', ')} this week. Tap to review.`;
    }
    return `${s.eventCount} event${s.eventCount === 1 ? '' : 's'} on deck. All clear so far.`;
}

Deno.serve(async () => {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
            'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in function env.',
            { status: 500 },
        );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    });

    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const horizonIso = horizon.toISOString();
    // QA-020: tasks are user-facing "due today" if their due_at falls anywhere
    // on today's calendar date, not strictly at-or-after the cron-fire instant.
    // The client digest uses startOfDay(now); a task with due_at = today 09:00
    // is visible in-app at any time today, but `gte('due_at', nowIso)` at a
    // 11:00 cron tick excluded it from the push. Lower the task-fetch bound
    // to today's UTC midnight so push and in-app agree. Events still use
    // nowIso (we don't want a push talking about an event that already ended).
    const todayStartIso = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ).toISOString();

    // 1. Grab every active push token + the owning profile.
    const { data: tokens, error: tokenErr } = await supabase
        .from('push_tokens')
        .select('profile_id, expo_token, platform');
    if (tokenErr) {
        return new Response(`Failed to read push_tokens: ${tokenErr.message}`, { status: 500 });
    }
    if (!tokens?.length) {
        return new Response(JSON.stringify({ sent: 0, note: 'no push tokens registered' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const profileIds = Array.from(new Set((tokens as PushToken[]).map((t) => t.profile_id)));

    // 2. For each profile, find their household memberships.
    const { data: memberships, error: memErr } = await supabase
        .from('household_members')
        .select('profile_id, household_id')
        .in('profile_id', profileIds);
    if (memErr) {
        return new Response(`Failed to read household_members: ${memErr.message}`, { status: 500 });
    }

    const householdIdsByProfile = new Map<string, Set<string>>();
    for (const m of memberships ?? []) {
        const set = householdIdsByProfile.get(m.profile_id) ?? new Set<string>();
        set.add(m.household_id);
        householdIdsByProfile.set(m.profile_id, set);
    }

    const allHouseholdIds = Array.from(
        new Set(Array.from(householdIdsByProfile.values()).flatMap((s) => Array.from(s))),
    );
    if (allHouseholdIds.length === 0) {
        return new Response(JSON.stringify({ sent: 0, note: 'no households' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 3. Pull events that could overlap the window. Two cases:
    //    - One-off events: starts_at < horizon AND ends_at > now (interval overlap)
    //    - Recurring masters: starts_at < horizon (might have an occurrence in window;
    //      the expander decides exactly which instances fall in [now, horizon))
    //    Combined into one query with an OR clause for fewer round-trips. Includes
    //    recurrence_rule, responsible_alternation, timezone, all_day — all needed by
    //    the shared expander + resolver.
    const { data: eventsRaw, error: eventsErr } = await supabase
        .from('events')
        .select(
            'id, household_id, starts_at, ends_at, responsible_profile_id, recurrence_rule, responsible_alternation, timezone, all_day',
        )
        .in('household_id', allHouseholdIds)
        .lt('starts_at', horizonIso)
        .or(`ends_at.gt.${nowIso},recurrence_rule.not.is.null`);
    if (eventsErr) {
        return new Response(`Failed to read events: ${eventsErr.message}`, { status: 500 });
    }
    const masterEvents: Event[] = (eventsRaw ?? []) as Event[];

    // 3b. Fetch custody schedules and overrides for the relevant households so the
    //     resolver can answer alternation events. Schedules are at most one per
    //     household; overrides we scope to the window plus one day buffer (an
    //     occurrence's previous_day alternation can reach 24h earlier).
    const bufferStartIso = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    const horizonDateIso = horizon.toISOString().slice(0, 10);

    const { data: schedulesRaw, error: schedulesErr } = await supabase
        .from('custody_schedules')
        .select('household_id, parent_a_profile_id, parent_b_profile_id, anchor_date, cycle_days')
        .in('household_id', allHouseholdIds);
    if (schedulesErr) {
        console.error('sunday-summary: custody_schedules query failed', schedulesErr);
    }
    const schedulesByHousehold = new Map<string, CustodySchedule>();
    for (const s of (schedulesRaw ?? []) as CustodySchedule[]) {
        schedulesByHousehold.set(s.household_id, s);
    }

    const { data: custodyOverridesRaw, error: custodyOverridesErr } = await supabase
        .from('custody_overrides')
        .select('household_id, override_date, custodian_profile_id')
        .in('household_id', allHouseholdIds)
        .gte('override_date', bufferStartIso)
        .lte('override_date', horizonDateIso);
    if (custodyOverridesErr) {
        console.error('sunday-summary: custody_overrides query failed', custodyOverridesErr);
    }
    const custodyOverrideMapByHousehold = new Map<string, Map<string, CustodyOverride>>();
    for (const o of (custodyOverridesRaw ?? []) as CustodyOverride[]) {
        const existing = custodyOverrideMapByHousehold.get(o.household_id);
        if (existing) {
            existing.set(o.override_date, o);
        } else {
            custodyOverrideMapByHousehold.set(
                o.household_id,
                buildCustodyOverrideMap([o]),
            );
        }
    }

    // Event occurrence overrides keyed by household, then by `eventId|date`. The
    // table itself has no household_id column (RLS joins through events), so we
    // pull household_id via an inner join — mirrors the client's
    // getEventOccurrenceOverridesForRange pattern in src/lib/db.ts. QA-013: prior
    // version selected a non-existent column and swallowed the error, which made
    // every override silently invisible to the resolver below.
    const { data: occOverridesRaw, error: occOverridesErr } = await supabase
        .from('event_occurrence_overrides')
        .select(
            'event_id, occurrence_date, responsible_profile_id, events!inner(household_id)',
        )
        .in('events.household_id', allHouseholdIds)
        .gte('occurrence_date', bufferStartIso)
        .lte('occurrence_date', horizonDateIso);
    if (occOverridesErr) {
        console.error(
            'sunday-summary: event_occurrence_overrides query failed',
            occOverridesErr,
        );
    }
    type OccOverrideRow = EventOccurrenceOverride & {
        events: { household_id: string } | { household_id: string }[] | null;
    };
    const occOverridesByHousehold = new Map<string, EventOccurrenceOverride[]>();
    for (const o of (occOverridesRaw ?? []) as OccOverrideRow[]) {
        // Embedded relation is sometimes a single object, sometimes an array
        // depending on the postgrest-js client version. Normalize both shapes.
        const householdId = Array.isArray(o.events)
            ? o.events[0]?.household_id
            : o.events?.household_id;
        if (!householdId) continue;
        const arr = occOverridesByHousehold.get(householdId) ?? [];
        arr.push({
            event_id: o.event_id,
            occurrence_date: o.occurrence_date,
            responsible_profile_id: o.responsible_profile_id,
        });
        occOverridesByHousehold.set(householdId, arr);
    }

    // 3c. Expand every master event into the occurrences that actually fall in
    //     [now, horizon), and resolve each occurrence's responsible parent via the
    //     same priority chain the client uses (override → alternation → static field).
    type ResolvedOccurrence = {
        household_id: string;
        starts_at: string;
        ends_at: string;
        responsible_profile_id: string | null;
    };
    const occurrences: ResolvedOccurrence[] = [];
    for (const master of masterEvents) {
        const expanded = expandEventToOccurrences(master, now, horizon);
        const schedule = schedulesByHousehold.get(master.household_id) ?? null;
        const custodyOverrides =
            custodyOverrideMapByHousehold.get(master.household_id) ??
            new Map<string, CustodyOverride>();
        const occOverrideMap = buildEventOccurrenceOverrideMap(
            occOverridesByHousehold.get(master.household_id) ?? [],
        );
        for (const occ of expanded) {
            const occDate = new Date(occ.starts_at);
            const resolved = resolveResponsibleProfileId({
                event: occ,
                occurrenceDate: occDate,
                custodySchedule: schedule,
                custodyOverrides,
                occurrenceOverrides: occOverrideMap,
            });
            occurrences.push({
                household_id: occ.household_id,
                starts_at: occ.starts_at,
                ends_at: occ.ends_at,
                responsible_profile_id: resolved,
            });
        }
    }

    // 4. Pull every relevant member's external (paired-calendar) events overlapping the window.
    //    We grab by profile_id (members of any of our target households) — RLS is bypassed
    //    by the service role so we get everything; we never expose titles here, only times.
    const memberProfileIds = Array.from(
        new Set((memberships ?? []).map((m) => m.profile_id)),
    );
    const { data: externalEventsRaw, error: externalEventsErr } = await supabase
        .from('external_events')
        .select('profile_id, starts_at, ends_at')
        .in('profile_id', memberProfileIds)
        .eq('is_busy', true)
        .lt('starts_at', horizonIso)
        .gt('ends_at', nowIso);
    if (externalEventsErr) {
        console.error('sunday-summary: external_events query failed', externalEventsErr);
    }
    const externalEvents: ExternalEventRow[] = (externalEventsRaw ?? []) as ExternalEventRow[];

    // 5a. Pull open tasks in the window for these households, plus their assignees.
    //     We count per-profile in the next loop: a task is "yours" if you're listed as
    //     an assignee OR no one is assigned (anyone bucket). Completed tasks excluded.
    const { data: openTasksRaw, error: openTasksErr } = await supabase
        .from('tasks')
        .select('id, household_id, due_at, task_assignees(profile_id)')
        .in('household_id', allHouseholdIds)
        .is('completed_at', null)
        // QA-020: today's-start boundary so tasks due earlier today (but
        // unfinished) still count, matching the in-app digest.
        .gte('due_at', todayStartIso)
        .lt('due_at', horizonIso);
    if (openTasksErr) {
        console.error('sunday-summary: tasks query failed', openTasksErr);
    }
    type TaskRow = {
        id: string;
        household_id: string;
        due_at: string;
        task_assignees?: Array<{ profile_id: string }>;
    };
    const openTasks: TaskRow[] = (openTasksRaw ?? []) as TaskRow[];

    // 5. For each profile, compute summary across their households.
    const summariesByProfile = new Map<string, Summary>();
    for (const profileId of profileIds) {
        const householdIds = householdIdsByProfile.get(profileId);
        if (!householdIds || householdIds.size === 0) continue;
        let eventCount = 0;
        let conflicts = 0;
        let unassigned = 0;
        let openTaskCount = 0;
        for (const occ of occurrences) {
            if (!householdIds.has(occ.household_id)) continue;
            eventCount += 1;
            if (!occ.responsible_profile_id) {
                unassigned += 1;
                continue;
            }
            const hasOverlap = externalEvents.some(
                (ext) =>
                    ext.profile_id === occ.responsible_profile_id &&
                    overlaps(occ.starts_at, occ.ends_at, ext.starts_at, ext.ends_at),
            );
            if (hasOverlap) conflicts += 1;
        }
        for (const t of openTasks) {
            if (!householdIds.has(t.household_id)) continue;
            const assignees = (t.task_assignees ?? []).map((a) => a.profile_id);
            // Count if the user is assigned OR the task is unassigned (anyone).
            if (assignees.length === 0 || assignees.includes(profileId)) {
                openTaskCount += 1;
            }
        }
        summariesByProfile.set(profileId, {
            eventCount,
            conflicts,
            unassigned,
            openTasks: openTaskCount,
        });
    }

    // 6. Build Expo push messages.
    const messages = [];
    for (const t of tokens as PushToken[]) {
        const summary = summariesByProfile.get(t.profile_id);
        if (!summary) continue;
        const body = buildNotificationBody(summary);
        if (!body) continue;
        messages.push({
            to: t.expo_token,
            sound: 'default',
            title: 'OneNest weekly check-in',
            body,
            data: {
                conflicts: summary.conflicts,
                unassigned: summary.unassigned,
                eventCount: summary.eventCount,
                openTasks: summary.openTasks,
            },
        });
    }

    if (messages.length === 0) {
        return new Response(JSON.stringify({ sent: 0, note: 'no eligible recipients' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 7. Send to Expo Push Service in batches of 100 (their documented limit).
    const results: unknown[] = [];
    for (let i = 0; i < messages.length; i += 100) {
        const batch = messages.slice(i, i + 100);
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
            },
            body: JSON.stringify(batch),
        });
        results.push(await res.json());
    }

    return new Response(
        JSON.stringify({
            sent: messages.length,
            results,
        }),
        { headers: { 'Content-Type': 'application/json' } },
    );
});
