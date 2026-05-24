// supabase/functions/task-reminders/index.ts
// Sends a push notification for every task whose reminder_at has passed but hasn't
// been sent yet. Marks reminded_at on success so we never re-send for the same
// reminder window. Recipients:
//   - Tasks with explicit assignees → only those assignees
//   - Tasks with no assignees ("Anyone") → every household member
// In both cases we look up registered push_tokens by profile_id and send via Expo
// Push. Members without a token are silently skipped (no email fallback).
//
// Trigger: pg_cron every few minutes (see migration 0028) OR manual via
// `supabase functions invoke task-reminders` for testing.
//
// Deployment:
//   1. supabase functions deploy task-reminders --no-verify-jwt
//   2. Verify SUPABASE_SERVICE_ROLE_KEY is present in the function's env
//   3. Enable the cron schedule in migration 0028

import { createClient } from 'jsr:@supabase/supabase-js@2';

type PendingTask = {
    id: string;
    household_id: string;
    title: string;
    due_at: string | null;
    task_assignees: Array<{ profile_id: string }> | null;
};

type PushMessage = {
    to: string;
    sound: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
};

function buildBody(task: PendingTask): string {
    if (!task.due_at) return task.title;
    const due = new Date(task.due_at);
    if (Number.isNaN(due.getTime())) return task.title;
    return `${task.title} — due ${due.toLocaleString()}`;
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

    const nowIso = new Date().toISOString();

    // 1. Find tasks whose reminder window has arrived. The partial index on
    //    (reminder_at) where reminded_at IS NULL and completed_at IS NULL makes this
    //    a small scan even as the tasks table grows.
    const { data: tasksRaw, error: tasksErr } = await supabase
        .from('tasks')
        .select(
            'id, household_id, title, due_at, task_assignees(profile_id)',
        )
        .lte('reminder_at', nowIso)
        .is('reminded_at', null)
        .is('completed_at', null);
    if (tasksErr) {
        return new Response(`Failed to read tasks: ${tasksErr.message}`, {
            status: 500,
        });
    }
    const tasks: PendingTask[] = (tasksRaw ?? []) as PendingTask[];
    if (tasks.length === 0) {
        return new Response(JSON.stringify({ sent: 0, note: 'nothing pending' }), {
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // 2. For "Anyone" tasks (no explicit assignees), expand recipients to every
    //    household member. We batch the household lookup once per unique household
    //    id rather than once per task to keep round-trips bounded.
    const anyoneHouseholdIds = Array.from(
        new Set(
            tasks
                .filter((t) => (t.task_assignees ?? []).length === 0)
                .map((t) => t.household_id),
        ),
    );
    const householdMembers = new Map<string, string[]>();
    if (anyoneHouseholdIds.length > 0) {
        // Anyone-task expansion only targets members who can actually act on the
        // task. Viewers are read-only and would only get pestered by a push for
        // work they can't complete (QA-004). parent + caregiver covers everyone
        // with task-write permission under the existing RLS policies.
        const { data: memberRows, error: memErr } = await supabase
            .from('household_members')
            .select('profile_id, household_id')
            .in('household_id', anyoneHouseholdIds)
            .in('role', ['parent', 'caregiver']);
        if (memErr) {
            return new Response(
                `Failed to read household_members: ${memErr.message}`,
                { status: 500 },
            );
        }
        for (const m of memberRows ?? []) {
            const list = householdMembers.get(m.household_id) ?? [];
            list.push(m.profile_id);
            householdMembers.set(m.household_id, list);
        }
    }

    // 3. Build the full recipient set across all pending tasks so we can fetch push
    //    tokens in a single round-trip.
    const recipientsByTaskId = new Map<string, string[]>();
    const allRecipientIds = new Set<string>();
    for (const t of tasks) {
        const assignees = (t.task_assignees ?? []).map((a) => a.profile_id);
        const recipients =
            assignees.length > 0
                ? assignees
                : householdMembers.get(t.household_id) ?? [];
        recipientsByTaskId.set(t.id, recipients);
        for (const r of recipients) allRecipientIds.add(r);
    }
    if (allRecipientIds.size === 0) {
        // Mark these tasks as reminded so we don't loop forever on a household with
        // no members and no assignees (edge case but worth handling).
        await supabase
            .from('tasks')
            .update({ reminded_at: nowIso })
            .in('id', tasks.map((t) => t.id));
        return new Response(
            JSON.stringify({ sent: 0, note: 'no recipients' }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    const { data: tokenRows, error: tokensErr } = await supabase
        .from('push_tokens')
        .select('profile_id, expo_token')
        .in('profile_id', Array.from(allRecipientIds));
    if (tokensErr) {
        return new Response(`Failed to read push_tokens: ${tokensErr.message}`, {
            status: 500,
        });
    }
    const tokensByProfileId = new Map<string, string[]>();
    for (const row of tokenRows ?? []) {
        const list = tokensByProfileId.get(row.profile_id) ?? [];
        list.push(row.expo_token);
        tokensByProfileId.set(row.profile_id, list);
    }

    // 4. Assemble Expo push messages — one per (task × recipient × token).
    const messages: PushMessage[] = [];
    for (const t of tasks) {
        const recipients = recipientsByTaskId.get(t.id) ?? [];
        for (const profileId of recipients) {
            const tokens = tokensByProfileId.get(profileId) ?? [];
            for (const tok of tokens) {
                messages.push({
                    to: tok,
                    sound: 'default',
                    title: 'Task reminder',
                    body: buildBody(t),
                    data: { taskId: t.id, householdId: t.household_id },
                });
            }
        }
    }

    // 5. Mark every reminder as sent BEFORE the Expo POST. If the POST partially
    //    fails we'd rather lose a reminder than re-send the whole batch on the next
    //    cron tick. "At-most-once" semantics — push notifications are best-effort
    //    by nature anyway.
    const { error: markErr } = await supabase
        .from('tasks')
        .update({ reminded_at: nowIso })
        .in('id', tasks.map((t) => t.id));
    if (markErr) {
        return new Response(
            `Failed to mark tasks as reminded: ${markErr.message}`,
            { status: 500 },
        );
    }

    if (messages.length === 0) {
        return new Response(
            JSON.stringify({
                sent: 0,
                tasksHandled: tasks.length,
                note: 'no push tokens for recipients',
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    // 6. Send to Expo in batches of 100 (their documented limit). Errors per batch
    //    bubble up in the response; the cron job will surface them in function logs.
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
            tasksHandled: tasks.length,
            results,
        }),
        { headers: { 'Content-Type': 'application/json' } },
    );
});
