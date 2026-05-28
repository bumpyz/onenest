// supabase/functions/event-reminders/index.ts
//
// Fires push notifications for event_reminders rows whose computed
// fire time (events.starts_at + offset_minutes) falls inside the
// last poll window. Marks fired_at so we never re-send for the same
// reminder.
//
// Recipients are one-to-one with the row's profile_id — unlike the
// task-reminders fan-out logic, every event_reminder is already
// per-recipient (see migration 0053).
//
// Each fired reminder also writes a `notifications` row via the
// enqueue_notification RPC so the in-app Inbox sees the reminder
// even if the user missed the push (silenced phone, etc.).
//
// Trigger: pg_cron every 5 min (migration 0053). Manual invoke for
// testing: `supabase functions invoke event-reminders`.
//
// Deployment:
//   1. supabase functions deploy event-reminders --no-verify-jwt
//   2. Verify SUPABASE_SERVICE_ROLE_KEY in the function's env
//   3. Apply migration 0053 (sets up Vault secret + cron schedule)

import { createClient } from 'jsr:@supabase/supabase-js@2';

type ReminderRow = {
    id: string;
    event_id: string;
    profile_id: string;
    offset_minutes: number;
    events: {
        household_id: string;
        title: string;
        starts_at: string;
    } | null;
};

type PushMessage = {
    to: string;
    sound: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
};

function formatBody(r: ReminderRow): string {
    if (!r.events) return 'Event reminder';
    const start = new Date(r.events.starts_at);
    if (Number.isNaN(start.getTime())) return r.events.title;
    // Minutes-before label. Caller's offset is signed; negative =
    // before. We show absolute minutes in the message and let the
    // user infer "in X" from context.
    const absMin = Math.abs(r.offset_minutes);
    if (absMin === 0) return `${r.events.title} starting now`;
    if (absMin < 60) {
        return `${r.events.title} in ${absMin} min`;
    }
    if (absMin < 1440) {
        const hours = Math.round(absMin / 60);
        return `${r.events.title} in ${hours}h`;
    }
    const days = Math.round(absMin / 1440);
    return `${r.events.title} ${days === 1 ? 'tomorrow' : `in ${days}d`}`;
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

    // Cron tick. We want every reminder whose fire time
    // (starts_at + offset_minutes) is ≤ now AND > now - 10 minutes
    // (so a missed run doesn't catch up on stale reminders by spamming).
    // PostgREST can't compute starts_at + offset_minutes in the filter,
    // so we pull all unfired rows ahead in the next 24h, then filter in
    // memory. The pending partial index makes this read cheap.
    const now = Date.now();
    const recentWindowMs = 10 * 60 * 1000; // 10 minutes

    const { data: rowsRaw, error: rowsErr } = await supabase
        .from('event_reminders')
        .select(
            'id, event_id, profile_id, offset_minutes, events:event_id(household_id, title, starts_at)',
        )
        .is('fired_at', null);
    if (rowsErr) {
        return new Response(
            `Failed to read event_reminders: ${rowsErr.message}`,
            { status: 500 },
        );
    }
    const rows = (rowsRaw ?? []) as unknown as ReminderRow[];

    // Filter to rows whose fire time landed inside the recent window.
    // Rows whose event has been deleted (events: null via the join)
    // are skipped — the FK cascade should have removed them, but
    // belt-and-braces.
    const pending: ReminderRow[] = [];
    for (const r of rows) {
        if (!r.events) continue;
        const startsMs = new Date(r.events.starts_at).getTime();
        if (Number.isNaN(startsMs)) continue;
        const fireMs = startsMs + r.offset_minutes * 60 * 1000;
        if (fireMs <= now && fireMs > now - recentWindowMs) {
            pending.push(r);
        }
    }

    if (pending.length === 0) {
        return new Response(
            JSON.stringify({ sent: 0, scanned: rows.length, note: 'nothing in window' }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    // Push tokens for all pending recipients in one round-trip.
    const recipientIds = Array.from(
        new Set(pending.map((r) => r.profile_id)),
    );
    const { data: tokenRows, error: tokensErr } = await supabase
        .from('push_tokens')
        .select('profile_id, expo_token')
        .in('profile_id', recipientIds);
    if (tokensErr) {
        return new Response(
            `Failed to read push_tokens: ${tokensErr.message}`,
            { status: 500 },
        );
    }
    const tokensByProfileId = new Map<string, string[]>();
    for (const row of tokenRows ?? []) {
        const list = tokensByProfileId.get(row.profile_id) ?? [];
        list.push(row.expo_token);
        tokensByProfileId.set(row.profile_id, list);
    }

    // Build push messages — one per (reminder × token). A profile
    // can have multiple devices.
    const messages: PushMessage[] = [];
    for (const r of pending) {
        const tokens = tokensByProfileId.get(r.profile_id) ?? [];
        for (const tok of tokens) {
            messages.push({
                to: tok,
                sound: 'default',
                title: 'Event reminder',
                body: formatBody(r),
                data: {
                    eventId: r.event_id,
                    householdId: r.events?.household_id,
                    reminderId: r.id,
                },
            });
        }
    }

    // Mark fired BEFORE the push send. At-most-once semantics — losing
    // a reminder on a partial-failure beats double-pinging users on
    // the next cron tick.
    const nowIso = new Date(now).toISOString();
    const { error: markErr } = await supabase
        .from('event_reminders')
        .update({ fired_at: nowIso })
        .in('id', pending.map((r) => r.id));
    if (markErr) {
        return new Response(
            `Failed to mark reminders fired: ${markErr.message}`,
            { status: 500 },
        );
    }

    // Write an Inbox notification row per reminder so users see the
    // event in /notifications even if the push was missed. Each
    // insert needs caller + recipient to share a household; we're
    // running as service role so the SECURITY DEFINER RPC's check
    // passes (auth.uid() is null, and we use direct insert here
    // instead since service role bypasses RLS).
    const inboxRows = pending.map((r) => ({
        profile_id: r.profile_id,
        household_id: r.events?.household_id ?? null,
        kind: 'event_reminder',
        title: 'Event reminder',
        body: formatBody(r),
        payload: {
            event_id: r.event_id,
            offset_minutes: r.offset_minutes,
            reminder_id: r.id,
        },
        href: `/event/${r.event_id}`,
    }));
    if (inboxRows.length > 0) {
        // Service role bypasses RLS so direct insert is allowed.
        const { error: inboxErr } = await supabase
            .from('notifications')
            .insert(inboxRows);
        if (inboxErr) {
            // Log but don't fail the function — the push went out
            // (or will), and missing the Inbox row is recoverable.
            console.error(
                'event-reminders: notifications insert failed',
                inboxErr,
            );
        }
    }

    if (messages.length === 0) {
        return new Response(
            JSON.stringify({
                sent: 0,
                fired: pending.length,
                note: 'no push tokens for recipients (Inbox rows still written)',
            }),
            { headers: { 'Content-Type': 'application/json' } },
        );
    }

    // Expo push API: max 100 per request.
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
            fired: pending.length,
            results,
        }),
        { headers: { 'Content-Type': 'application/json' } },
    );
});
