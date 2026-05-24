import { addDays } from 'date-fns';

import {
    deleteOwnedExternalEventsInRange,
    getExternalCalendarTokens,
    touchExternalCalendarLastSynced,
    updateExternalCalendarTokens,
    upsertExternalEvents,
    type ExternalCalendar,
    type ExternalEvent,
} from './db';
import { supabase } from './supabase';

/**
 * Thrown when Google rejects credentials AND refreshing fails — the user must re-pair
 * the calendar by going through OAuth again (e.g. consent was revoked, or the refresh
 * token itself has expired after long inactivity). Mid-sync 401s that are recoverable
 * via refresh are handled internally and do NOT propagate.
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

export type GoogleTokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
};

const DEFAULT_SYNC_HORIZON_DAYS = 30;

/**
 * Calls our google-oauth-proxy edge function (which injects the client_secret server-side
 * before forwarding to https://oauth2.googleapis.com/token). Both code-exchange and
 * refresh go through the same proxy — only the action string + payload shape differ.
 */
async function invokeOAuthProxy(
    body: Record<string, unknown>,
): Promise<GoogleTokenResponse> {
    const { data, error } = await supabase.functions.invoke<GoogleTokenResponse>(
        'google-oauth-proxy',
        { body },
    );
    if (error) {
        // FunctionsHttpError exposes context.response with the body Google returned.
        throw new GoogleAuthError(`Google OAuth proxy failed: ${error.message}`);
    }
    if (!data || !data.access_token) {
        throw new GoogleAuthError('Google OAuth proxy returned no access token.');
    }
    return data;
}

/** Initial pairing: swap PKCE auth code → tokens via the edge function. */
export async function exchangeGoogleAuthCode(
    clientId: string,
    code: string,
    codeVerifier: string,
    redirectUri: string,
): Promise<GoogleTokenResponse> {
    return invokeOAuthProxy({
        action: 'exchange',
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
    });
}

/** Refresh: trade a refresh_token for a new access_token via the edge function. */
export async function refreshGoogleToken(
    clientId: string,
    refreshToken: string,
): Promise<GoogleTokenResponse> {
    return invokeOAuthProxy({
        action: 'refresh',
        client_id: clientId,
        refresh_token: refreshToken,
    });
}

/** Reads the connected Google account's primary email via the v3 userinfo endpoint. */
export async function fetchGoogleUserEmail(accessToken: string): Promise<string> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        throw new GoogleAuthError(
            `Google userinfo lookup failed (${res.status}).`,
        );
    }
    const data = (await res.json()) as { email?: string };
    if (!data.email) {
        throw new GoogleAuthError('Could not determine Google account email.');
    }
    return data.email;
}

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
            // Caller (syncGoogleCalendar) decides whether to refresh-and-retry or give up.
            throw new GoogleAuthError(
                `Google rejected the access token (${res.status}).`,
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
 * Pulls the next N days of events from Google Calendar, replaces any existing rows for
 * this calendar in that window, and stamps last_synced_at.
 *
 * Auto-refreshes on 401: if Google rejects the stored access token and we have a refresh
 * token, we call the proxy to mint a new access token, persist it, then retry the list.
 * Mirrors the Microsoft sync pattern. Only surfaces GoogleAuthError when even refresh
 * fails — at that point the user must re-pair from Settings.
 */
export async function syncGoogleCalendar(
    calendar: ExternalCalendar,
    horizonDays: number = DEFAULT_SYNC_HORIZON_DAYS,
): Promise<{ count: number }> {
    if (calendar.provider !== 'google') {
        throw new Error(`Cannot sync non-Google calendar with this helper.`);
    }
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID;
    if (!clientId) {
        throw new Error(
            'Missing EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID. Set it in .env.local and restart the dev server.',
        );
    }

    const tokens = await getExternalCalendarTokens(calendar.id);
    if (!tokens?.access_token) {
        throw new GoogleAuthError(
            'No access token on file for this calendar. Re-connect to grant access.',
        );
    }

    let accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const start = new Date();
    const end = addDays(start, horizonDays);

    let items: GoogleEvent[];
    try {
        items = await listEvents(accessToken, start, end);
    } catch (err) {
        // Recoverable case: token rejected AND we have a refresh token to swap. Anything
        // else propagates (network errors, permanent permission denials with no refresh
        // path, etc.).
        if (err instanceof GoogleAuthError && refreshToken) {
            const refreshed = await refreshGoogleToken(clientId, refreshToken);
            accessToken = refreshed.access_token;
            const expiresAt = new Date(
                Date.now() + refreshed.expires_in * 1000,
            ).toISOString();
            // Google rotates refresh tokens occasionally — pass through if it issued one,
            // otherwise null tells update_external_calendar_tokens to keep the existing one.
            await updateExternalCalendarTokens(
                calendar.id,
                refreshed.access_token,
                refreshed.refresh_token ?? null,
                expiresAt,
            );
            items = await listEvents(accessToken, start, end);
        } else {
            throw err;
        }
    }

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
