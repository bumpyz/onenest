import { expandEventToOccurrences } from './recurrence';
import { supabase } from './supabase';

export type HouseholdRole = 'parent' | 'caregiver' | 'viewer';

export type HouseholdType = 'single_parent' | 'couple' | 'separated';

export type Household = {
    id: string;
    name: string;
    household_type: HouseholdType;
    created_by: string;
    created_at: string;
};

export type Child = {
    id: string;
    household_id: string;
    display_name: string;
    birthdate: string | null;
    notes: string | null;
    created_at: string;
};

export type HouseholdMember = {
    household_id: string;
    profile_id: string;
    role: HouseholdRole;
    joined_at: string;
    display_name: string;
    /** Hex color (#RRGGBB) chosen by the member. Filled in by migration 0005's trigger. */
    color: string | null;
};

export type Invitation = {
    id: string;
    household_id: string;
    invited_email: string;
    token: string;
    role: HouseholdRole;
    created_by: string;
    created_at: string;
    expires_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
};

export type InvitationPreview = {
    household_id: string;
    household_name: string;
    inviter_name: string;
    invited_email: string;
    role: HouseholdRole;
    expires_at: string;
};

export type NewChildInput = {
    displayName: string;
    birthdate?: string | null;
};

export type Event = {
    id: string;
    household_id: string;
    title: string;
    description: string | null;
    location: string | null;
    location_id: string | null;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    created_by: string;
    responsible_profile_id: string | null;
    /** iCal RRULE string. Null for one-off events. DTSTART is the event's starts_at. */
    recurrence_rule: string | null;
    /** Optional event type id (from EVENT_TYPES); drives the icon on Calendar/Home. */
    event_type: string | null;
    created_at: string;
    updated_at: string;
};

export type NewEventInput = {
    title: string;
    startsAt: Date;
    endsAt: Date;
    allDay?: boolean;
    description?: string | null;
    /** Legacy free-text location. Kept for back-compat — prefer locationId for new entries. */
    location?: string | null;
    locationId?: string | null;
    responsibleProfileId?: string | null;
    recurrenceRule?: string | null;
    eventType?: string | null;
};

export type Location = {
    id: string;
    household_id: string;
    name: string;
    google_maps_url: string | null;
    created_by: string;
    created_at: string;
};

export type CustodySchedule = {
    id: string;
    household_id: string;
    pattern_id: string;
    cycle_days: string[];
    parent_a_profile_id: string;
    parent_b_profile_id: string;
    anchor_date: string; // YYYY-MM-DD
    created_by: string;
    created_at: string;
    updated_at: string;
};

export type CustodyScheduleInput = {
    patternId: string;
    cycleDays: string[];
    parentAProfileId: string;
    parentBProfileId: string;
    anchorDate: string;
};

export type CustodyOverride = {
    id: string;
    household_id: string;
    override_date: string; // YYYY-MM-DD
    custodian_profile_id: string;
    note: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
};

async function currentUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Not signed in.');
    return data.user.id;
}

export async function getMyHouseholds(): Promise<Household[]> {
    const { data, error } = await supabase
        .from('households')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Household[];
}

// Creates a household, makes the caller its first parent member, and (optionally) adds
// children — all from the client. The household INSERT's RETURNING is unblocked by the
// migration 0003 policy that lets a creator read their just-inserted row; the membership
// INSERT skips .select() so no RETURNING policy check is needed for that row.
export async function createHousehold(
    name: string,
    householdType: HouseholdType,
    children: NewChildInput[] = [],
): Promise<Household> {
    const userId = await currentUserId();

    const { data: household, error: hhError } = await supabase
        .from('households')
        .insert({ name, household_type: householdType, created_by: userId })
        .select()
        .single();
    if (hhError) throw hhError;
    if (!household) throw new Error('Household insert returned no row.');

    const { error: memberError } = await supabase
        .from('household_members')
        .insert({ household_id: household.id, profile_id: userId, role: 'parent' });
    if (memberError) throw memberError;

    if (children.length > 0) {
        const { error: childError } = await supabase.from('children').insert(
            children.map((c) => ({
                household_id: household.id,
                display_name: c.displayName,
                birthdate: c.birthdate ?? null,
            })),
        );
        if (childError) throw childError;
    }

    return household as Household;
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    const { data, error } = await supabase
        .from('household_members')
        .select('household_id, profile_id, role, joined_at, color, profiles!inner(display_name)')
        .eq('household_id', householdId)
        .order('joined_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
        const profile = row.profiles as { display_name: string } | { display_name: string }[];
        const display_name = Array.isArray(profile) ? profile[0]?.display_name : profile.display_name;
        return {
            household_id: row.household_id as string,
            profile_id: row.profile_id as string,
            role: row.role as HouseholdRole,
            joined_at: row.joined_at as string,
            display_name: display_name ?? '',
            color: (row.color as string | null) ?? null,
        };
    });
}

export async function updateMyColor(householdId: string, color: string): Promise<void> {
    const { error } = await supabase.rpc('update_my_color', {
        p_household_id: householdId,
        p_color: color,
    });
    if (error) throw error;
}

export async function updateMyDisplayName(displayName: string): Promise<void> {
    const userId = await currentUserId();
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('Display name cannot be empty.');
    const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', userId);
    if (error) throw error;
}

export async function updateHouseholdType(
    householdId: string,
    householdType: HouseholdType,
): Promise<void> {
    const { error } = await supabase
        .from('households')
        .update({ household_type: householdType })
        .eq('id', householdId);
    if (error) throw error;
}

export async function addChild(
    householdId: string,
    displayName: string,
    birthdate: string | null = null,
): Promise<Child> {
    const { data, error } = await supabase
        .from('children')
        .insert({
            household_id: householdId,
            display_name: displayName,
            birthdate,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Child;
}

// Returns events (including expanded recurrence instances) whose start time falls in
// [rangeStart, rangeEnd). Two parallel queries: one-offs in range, and recurring masters that
// started before the end of range (those *might* have instances in the range — we let the
// client-side RRULE expander decide).
//
// Multi-day one-off events that start before the range but extend into it are not included
// — same limitation as before. Could fix later by also fetching events whose ends_at > rangeStart.
export async function getEventsForRange(
    householdId: string,
    rangeStart: Date,
    rangeEnd: Date,
): Promise<Event[]> {
    const [oneOffsRes, recurringRes] = await Promise.all([
        supabase
            .from('events')
            .select('*')
            .eq('household_id', householdId)
            .is('recurrence_rule', null)
            .gte('starts_at', rangeStart.toISOString())
            .lt('starts_at', rangeEnd.toISOString())
            .order('starts_at', { ascending: true }),
        supabase
            .from('events')
            .select('*')
            .eq('household_id', householdId)
            .not('recurrence_rule', 'is', null)
            .lt('starts_at', rangeEnd.toISOString())
            .order('starts_at', { ascending: true }),
    ]);
    if (oneOffsRes.error) throw oneOffsRes.error;
    if (recurringRes.error) throw recurringRes.error;

    const oneOffs = (oneOffsRes.data ?? []) as Event[];
    const recurring = (recurringRes.data ?? []) as Event[];

    const expanded: Event[] = [...oneOffs];
    for (const master of recurring) {
        expanded.push(...expandEventToOccurrences(master, rangeStart, rangeEnd));
    }
    expanded.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return expanded;
}

// Co-parent / caregiver invitations.

export async function createInvitation(
    householdId: string,
    invitedEmail: string,
    role: HouseholdRole = 'parent',
): Promise<Invitation> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('household_invitations')
        .insert({
            household_id: householdId,
            invited_email: invitedEmail.trim().toLowerCase(),
            role,
            created_by: userId,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Invitation;
}

export async function getPendingInvitations(householdId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
        .from('household_invitations')
        .select('*')
        .eq('household_id', householdId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Invitation[];
}

export async function revokeInvitation(invitationId: string): Promise<void> {
    const { error } = await supabase
        .from('household_invitations')
        .delete()
        .eq('id', invitationId);
    if (error) throw error;
}

export async function getInvitationPreview(token: string): Promise<InvitationPreview | null> {
    const { data, error } = await supabase.rpc('get_invitation_preview', { p_token: token });
    if (error) throw error;
    const rows = (data ?? []) as InvitationPreview[];
    return rows[0] ?? null;
}

export async function acceptInvitation(token: string): Promise<string> {
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
    if (error) throw error;
    return data as string; // returns household_id
}

export async function createEvent(
    householdId: string,
    input: NewEventInput,
): Promise<Event> {
    const userId = await currentUserId();

    const { data, error } = await supabase
        .from('events')
        .insert({
            household_id: householdId,
            title: input.title,
            description: input.description ?? null,
            location: input.location ?? null,
            location_id: input.locationId ?? null,
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            all_day: input.allDay ?? false,
            created_by: userId,
            responsible_profile_id: input.responsibleProfileId ?? null,
            recurrence_rule: input.recurrenceRule ?? null,
            event_type: input.eventType ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Event;
}

export async function getEvent(id: string): Promise<Event | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return (data as Event | null) ?? null;
}

export async function updateEvent(id: string, input: NewEventInput): Promise<Event> {
    const { data, error } = await supabase
        .from('events')
        .update({
            title: input.title,
            description: input.description ?? null,
            location: input.location ?? null,
            location_id: input.locationId ?? null,
            starts_at: input.startsAt.toISOString(),
            ends_at: input.endsAt.toISOString(),
            all_day: input.allDay ?? false,
            responsible_profile_id: input.responsibleProfileId ?? null,
            recurrence_rule: input.recurrenceRule ?? null,
            event_type: input.eventType ?? null,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Event;
}

// Locations.

export async function getHouseholdLocations(householdId: string): Promise<Location[]> {
    const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('household_id', householdId)
        .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Location[];
}

export async function createLocation(
    householdId: string,
    name: string,
    googleMapsUrl: string | null,
): Promise<Location> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('locations')
        .insert({
            household_id: householdId,
            name: name.trim(),
            google_maps_url: googleMapsUrl?.trim() || null,
            created_by: userId,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Location;
}

export async function updateLocation(
    id: string,
    name: string,
    googleMapsUrl: string | null,
): Promise<Location> {
    const { data, error } = await supabase
        .from('locations')
        .update({
            name: name.trim(),
            google_maps_url: googleMapsUrl?.trim() || null,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Location;
}

export async function deleteLocation(id: string): Promise<void> {
    const { error } = await supabase.from('locations').delete().eq('id', id);
    if (error) throw error;
}

// Custody schedule.

export async function getCustodySchedule(
    householdId: string,
): Promise<CustodySchedule | null> {
    const { data, error } = await supabase
        .from('custody_schedules')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle();
    if (error) throw error;
    return (data as CustodySchedule | null) ?? null;
}

export async function upsertCustodySchedule(
    householdId: string,
    input: CustodyScheduleInput,
): Promise<CustodySchedule> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('custody_schedules')
        .upsert(
            {
                household_id: householdId,
                pattern_id: input.patternId,
                cycle_days: input.cycleDays,
                parent_a_profile_id: input.parentAProfileId,
                parent_b_profile_id: input.parentBProfileId,
                anchor_date: input.anchorDate,
                created_by: userId,
            },
            { onConflict: 'household_id' },
        )
        .select()
        .single();
    if (error) throw error;
    return data as CustodySchedule;
}

export async function deleteCustodySchedule(id: string): Promise<void> {
    const { error } = await supabase.from('custody_schedules').delete().eq('id', id);
    if (error) throw error;
}

// External calendar pairings (Google, Microsoft).

export type CalendarProvider = 'google' | 'microsoft';

export type ExternalCalendar = {
    id: string;
    profile_id: string;
    provider: CalendarProvider;
    external_account_email: string;
    /** Stored as plain text for MVP. TODO: encrypt with pgsodium / Supabase Vault. */
    encrypted_access_token: string;
    encrypted_refresh_token: string | null;
    token_expires_at: string | null;
    label: string | null;
    is_active: boolean;
    last_synced_at: string | null;
    created_at: string;
};

export type ExternalEvent = {
    id: string;
    external_calendar_id: string;
    profile_id: string;
    external_event_id: string;
    title: string | null;
    starts_at: string;
    ends_at: string;
    is_busy: boolean;
    is_all_day: boolean;
    synced_at: string;
};

export async function getMyExternalCalendars(): Promise<ExternalCalendar[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('external_calendars')
        .select('*')
        .eq('profile_id', userId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ExternalCalendar[];
}

export type SaveGoogleCalendarInput = {
    email: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
};

export async function saveGoogleCalendarPairing(
    input: SaveGoogleCalendarInput,
): Promise<ExternalCalendar> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('external_calendars')
        .upsert(
            {
                profile_id: userId,
                provider: 'google',
                external_account_email: input.email,
                encrypted_access_token: input.accessToken,
                encrypted_refresh_token: input.refreshToken,
                token_expires_at: input.expiresAt,
                is_active: true,
            },
            { onConflict: 'profile_id,provider,external_account_email' },
        )
        .select()
        .single();
    if (error) throw error;
    return data as ExternalCalendar;
}

export type SaveMicrosoftCalendarInput = {
    email: string;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
};

export async function saveMicrosoftCalendarPairing(
    input: SaveMicrosoftCalendarInput,
): Promise<ExternalCalendar> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('external_calendars')
        .upsert(
            {
                profile_id: userId,
                provider: 'microsoft',
                external_account_email: input.email,
                encrypted_access_token: input.accessToken,
                encrypted_refresh_token: input.refreshToken,
                token_expires_at: input.expiresAt,
                is_active: true,
            },
            { onConflict: 'profile_id,provider,external_account_email' },
        )
        .select()
        .single();
    if (error) throw error;
    return data as ExternalCalendar;
}

export async function updateExternalCalendarTokens(
    id: string,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
): Promise<void> {
    const { error } = await supabase
        .from('external_calendars')
        .update({
            encrypted_access_token: accessToken,
            encrypted_refresh_token: refreshToken,
            token_expires_at: expiresAt,
        })
        .eq('id', id);
    if (error) throw error;
}

export async function disconnectExternalCalendar(id: string): Promise<void> {
    const { error } = await supabase.from('external_calendars').delete().eq('id', id);
    if (error) throw error;
}

export async function getMyExternalEventsForRange(
    rangeStart: Date,
    rangeEnd: Date,
): Promise<ExternalEvent[]> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('external_events')
        .select('*')
        .eq('profile_id', userId)
        // Overlap: event ends after range start AND starts before range end
        .lt('starts_at', rangeEnd.toISOString())
        .gt('ends_at', rangeStart.toISOString())
        .order('starts_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ExternalEvent[];
}

export async function touchExternalCalendarLastSynced(id: string): Promise<void> {
    const { error } = await supabase
        .from('external_calendars')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', id);
    if (error) throw error;
}

export async function upsertExternalEvents(
    rows: Array<Omit<ExternalEvent, 'id'>>,
): Promise<void> {
    if (rows.length === 0) return;
    const { error } = await supabase
        .from('external_events')
        .upsert(rows, { onConflict: 'external_calendar_id,external_event_id' });
    if (error) throw error;
}

// Privileged projection of every household member's busy windows. Each row is opaque —
// just (profile_id, starts_at, ends_at, is_all_day). Titles, descriptions, and attendees of
// the underlying external_events are never returned. Backed by the
// household_busy_blocks(uuid, timestamptz, timestamptz) SECURITY DEFINER function from
// migration 0002.

export type HouseholdBusyBlock = {
    profile_id: string;
    starts_at: string;
    ends_at: string;
    is_all_day: boolean;
};

export async function getHouseholdBusyBlocks(
    householdId: string,
    from: Date,
    to: Date,
): Promise<HouseholdBusyBlock[]> {
    const { data, error } = await supabase.rpc('household_busy_blocks', {
        p_household_id: householdId,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
    });
    if (error) throw error;
    return (data ?? []) as HouseholdBusyBlock[];
}

export async function deleteOwnedExternalEventsInRange(
    externalCalendarId: string,
    rangeStart: Date,
    rangeEnd: Date,
): Promise<void> {
    // Clears out stale events in the visible range before we upsert fresh data, so events
    // deleted on Google's side don't linger forever.
    const { error } = await supabase
        .from('external_events')
        .delete()
        .eq('external_calendar_id', externalCalendarId)
        .gte('starts_at', rangeStart.toISOString())
        .lt('starts_at', rangeEnd.toISOString());
    if (error) throw error;
}

// Custody overrides (per-day exceptions to the schedule).

export async function getCustodyOverridesForRange(
    householdId: string,
    rangeStartDate: string, // YYYY-MM-DD inclusive
    rangeEndDate: string, // YYYY-MM-DD inclusive
): Promise<CustodyOverride[]> {
    const { data, error } = await supabase
        .from('custody_overrides')
        .select('*')
        .eq('household_id', householdId)
        .gte('override_date', rangeStartDate)
        .lte('override_date', rangeEndDate);
    if (error) throw error;
    return (data ?? []) as CustodyOverride[];
}

export async function upsertCustodyOverride(
    householdId: string,
    overrideDate: string,
    custodianProfileId: string,
    note: string | null,
): Promise<CustodyOverride> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('custody_overrides')
        .upsert(
            {
                household_id: householdId,
                override_date: overrideDate,
                custodian_profile_id: custodianProfileId,
                note: note?.trim() || null,
                created_by: userId,
            },
            { onConflict: 'household_id,override_date' },
        )
        .select()
        .single();
    if (error) throw error;
    return data as CustodyOverride;
}

export async function deleteCustodyOverride(
    householdId: string,
    overrideDate: string,
): Promise<void> {
    const { error } = await supabase
        .from('custody_overrides')
        .delete()
        .eq('household_id', householdId)
        .eq('override_date', overrideDate);
    if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
}
