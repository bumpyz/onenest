import { addDays } from 'date-fns';

import {
    deleteOwnedExternalEventsInRange,
    touchExternalCalendarLastSynced,
    upsertExternalEvents,
    type ExternalCalendar,
    type ExternalEvent,
} from './db';

/**
 * Thrown when Google rejects the access token (typically 401). Callers should surface a
 * "reconnect required" message so the user can re-grant access. We don't auto-refresh tokens
 * in MVP because the refresh exchange needs the Supabase Google client_secret, which we
 * don't hold on the client.
 */
export class GoogleAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GoogleAuthError';
    }
}

type GoogleEventTime = {
    dateTime?: string; // RFC3339 with offset
    date?: string;     // all-day, YYYY-MM-DD
    timeZone?: string;
};

type GoogleEvent = {
    id: string;
    summary?: string;
    start?: GoogleEventTime;
    end?: GoogleEventTime;
    transparency?: 'opaque' | 'transparent'; // "transparent" = free time
    status?: 'confirmed' | 'tentative' | 'cancelled';
};

type ListEventsResponse = {
    items?: GoogleEvent[];
    nextPageToken?: string;
};

const DEFAULT_SYNC_HORIZON_DAYS = 30;

async function listEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
): Promise<GoogleEvent[]> {
    const all: GoogleEvent[] = [];
    let pageToken: string | undefined = undefined;

    do {
        const params = new URLSearchParams({
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            singleEvents: 'true', // expand recurring rules into individual instances
            orderBy: 'startTime',
            maxResults: '250',
        });
        if (pageToken) params.set('pageToken', pageToken);

        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (res.status === 401 || res.status === 403) {
            throw new GoogleAuthError(
                `Google rejected the access token (${res.status}). Re-connect to refresh access.`,
            );
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Google Calendar fetch failed (${res.status}): ${body}`);
        }

        const data = (await res.json()) as ListEventsResponse;
        for (const item of data.items ?? []) {
            // Skip cancelled events — they're just tombstones, no times.
            if (item.status === 'cancelled') continue;
            // Skip "free" events — we only want busy blocks.
            if (item.transparency === 'transparent') continue;
            if (!item.start || !item.end) continue;
            all.push(item);
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return all;
}

function toExternalEventRow(
    e: GoogleEvent,
    calendar: ExternalCalendar,
): Omit<ExternalEvent, 'id'> | null {
    const startsAt = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00.000Z` : null);
    const endsAt = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00.000Z` : null);
    if (!startsAt || !endsAt) return null;
    return {
        external_calendar_id: calendar.id,
        profile_id: calendar.profile_id,
        external_event_id: e.id,
        // We DO store the title for the owner's own view. Other household members never see
        // these rows directly (RLS gates that); they only see opaque busy windows via the
        // household_busy_blocks() function.
        title: e.summary ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_busy: true,
        is_all_day: !e.start?.dateTime,
        synced_at: new Date().toISOString(),
    };
}

/**
 * Pulls the next N days of events from Google Calendar, replaces any existing rows for this
 * calendar in that window, and stamps last_synced_at. Throws GoogleAuthError if the access
 * token has expired so the UI can prompt re-connect.
 */
export async function syncGoogleCalendar(
    calendar: ExternalCalendar,
    horizonDays: number = DEFAULT_SYNC_HORIZON_DAYS,
): Promise<{ count: number }> {
    if (calendar.provider !== 'google') {
        throw new Error(`Cannot sync non-Google calendar with this helper.`);
    }
    const accessToken = calendar.encrypted_access_token;
    const start = new Date();
    const end = addDays(start, horizonDays);

    const items = await listEvents(accessToken, start, end);
    const rows: Array<Omit<ExternalEvent, 'id'>> = [];
    for (const item of items) {
        const row = toExternalEventRow(item, calendar);
        if (row) rows.push(row);
    }

    // Clear stale rows in the window so deletions on Google's side propagate, then upsert.
    await deleteOwnedExternalEventsInRange(calendar.id, start, end);
    await upsertExternalEvents(rows);
    await touchExternalCalendarLastSynced(calendar.id);

    return { count: rows.length };
}
