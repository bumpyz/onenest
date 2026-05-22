import { addDays } from 'date-fns';

import {
    deleteOwnedExternalEventsInRange,
    touchExternalCalendarLastSynced,
    updateExternalCalendarTokens,
    upsertExternalEvents,
    type ExternalCalendar,
    type ExternalEvent,
} from './db';

export const MICROSOFT_AUTHORIZATION_ENDPOINT =
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
export const MICROSOFT_TOKEN_ENDPOINT =
    'https://login.microsoftonline.com/common/oauth2/v2.0/token';
export const MICROSOFT_SCOPES = ['offline_access', 'User.Read', 'Calendars.Read'];

export class MicrosoftAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MicrosoftAuthError';
    }
}

type GraphEvent = {
    id: string;
    subject?: string;
    start?: { dateTime?: string; timeZone?: string };
    end?: { dateTime?: string; timeZone?: string };
    isAllDay?: boolean;
    isCancelled?: boolean;
    /** "free" is the analog of Google's transparency=transparent — skip those. */
    showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
};

type CalendarViewResponse = {
    value?: GraphEvent[];
    '@odata.nextLink'?: string;
};

type TokenResponse = {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope?: string;
};

const DEFAULT_SYNC_HORIZON_DAYS = 30;

/**
 * Exchanges a refresh token for a new access token. Microsoft's PKCE-issued refresh tokens
 * are usable directly from the client (no secret needed), so we can recover from expired
 * access tokens without prompting the user to re-authorize.
 */
export async function refreshMicrosoftToken(
    clientId: string,
    refreshToken: string,
): Promise<TokenResponse> {
    const res = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: MICROSOFT_SCOPES.join(' '),
        }).toString(),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new MicrosoftAuthError(
            `Microsoft token refresh failed (${res.status}): ${body}`,
        );
    }
    return (await res.json()) as TokenResponse;
}

/** Exchanges an authorization code (PKCE) for tokens. */
export async function exchangeMicrosoftAuthCode(
    clientId: string,
    code: string,
    codeVerifier: string,
    redirectUri: string,
): Promise<TokenResponse> {
    const res = await fetch(MICROSOFT_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            scope: MICROSOFT_SCOPES.join(' '),
        }).toString(),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new MicrosoftAuthError(
            `Microsoft token exchange failed (${res.status}): ${body}`,
        );
    }
    return (await res.json()) as TokenResponse;
}

/** Calls /me to grab the signed-in user's primary email (mail or userPrincipalName). */
export async function fetchMicrosoftUserEmail(accessToken: string): Promise<string> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        throw new MicrosoftAuthError(`Microsoft /me failed (${res.status})`);
    }
    const data = (await res.json()) as { mail?: string; userPrincipalName?: string };
    const email = data.mail ?? data.userPrincipalName;
    if (!email) throw new MicrosoftAuthError('Could not determine Microsoft account email.');
    return email;
}

async function listCalendarView(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
): Promise<GraphEvent[]> {
    const items: GraphEvent[] = [];
    // calendarView expands recurrence into instances within the window — exactly what we want.
    let url: string | undefined = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${encodeURIComponent(
        timeMin.toISOString(),
    )}&endDateTime=${encodeURIComponent(timeMax.toISOString())}&$top=200`;

    while (url) {
        const res: Response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                // Forces start/end in UTC so we don't have to deal with each event's tz.
                Prefer: 'outlook.timezone="UTC"',
            },
        });
        if (res.status === 401 || res.status === 403) {
            throw new MicrosoftAuthError(
                `Microsoft Graph rejected the access token (${res.status}).`,
            );
        }
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Microsoft Graph fetch failed (${res.status}): ${body}`);
        }
        const data = (await res.json()) as CalendarViewResponse;
        for (const ev of data.value ?? []) {
            if (ev.isCancelled) continue;
            if (ev.showAs === 'free') continue;
            if (!ev.start?.dateTime || !ev.end?.dateTime) continue;
            items.push(ev);
        }
        url = data['@odata.nextLink'];
    }
    return items;
}

function toExternalEventRow(
    e: GraphEvent,
    calendar: ExternalCalendar,
): Omit<ExternalEvent, 'id'> | null {
    const startRaw = e.start?.dateTime;
    const endRaw = e.end?.dateTime;
    if (!startRaw || !endRaw) return null;
    // Outlook returns datetimes without a Z suffix even when we ask for UTC. Normalize.
    const startsAt = startRaw.endsWith('Z') ? startRaw : `${startRaw}Z`;
    const endsAt = endRaw.endsWith('Z') ? endRaw : `${endRaw}Z`;
    return {
        external_calendar_id: calendar.id,
        profile_id: calendar.profile_id,
        external_event_id: e.id,
        title: e.subject ?? null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_busy: true,
        is_all_day: !!e.isAllDay,
        synced_at: new Date().toISOString(),
    };
}

/**
 * Syncs the next N days of Microsoft Graph calendar events into external_events. Auto-tries
 * a refresh-token exchange if the access token is rejected; only surfaces MicrosoftAuthError
 * to the caller if even refresh fails (meaning the user must re-connect).
 */
export async function syncMicrosoftCalendar(
    calendar: ExternalCalendar,
    horizonDays: number = DEFAULT_SYNC_HORIZON_DAYS,
): Promise<{ count: number }> {
    if (calendar.provider !== 'microsoft') {
        throw new Error('Cannot sync non-Microsoft calendar with this helper.');
    }
    const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID;
    if (!clientId) {
        throw new Error(
            'Missing EXPO_PUBLIC_MICROSOFT_CLIENT_ID. Set it in .env.local and restart the dev server.',
        );
    }

    let accessToken = calendar.encrypted_access_token;
    const start = new Date();
    const end = addDays(start, horizonDays);

    let items: GraphEvent[];
    try {
        items = await listCalendarView(accessToken, start, end);
    } catch (err) {
        // On auth failure, try refreshing once before giving up.
        if (err instanceof MicrosoftAuthError && calendar.encrypted_refresh_token) {
            const refreshed = await refreshMicrosoftToken(
                clientId,
                calendar.encrypted_refresh_token,
            );
            accessToken = refreshed.access_token;
            const expiresAt = new Date(
                Date.now() + refreshed.expires_in * 1000,
            ).toISOString();
            await updateExternalCalendarTokens(
                calendar.id,
                refreshed.access_token,
                refreshed.refresh_token ?? calendar.encrypted_refresh_token,
                expiresAt,
            );
            items = await listCalendarView(accessToken, start, end);
        } else {
            throw err;
        }
    }

    const rows: Array<Omit<ExternalEvent, 'id'>> = [];
    for (const item of items) {
        const row = toExternalEventRow(item, calendar);
        if (row) rows.push(row);
    }

    await deleteOwnedExternalEventsInRange(calendar.id, start, end);
    await upsertExternalEvents(rows);
    await touchExternalCalendarLastSynced(calendar.id);

    return { count: rows.length };
}
