import { expandEventToOccurrences } from './recurrence';
import { supabase } from './supabase';

export type Profile = {
    id: string;
    display_name: string;
    /**
     * IANA timezone the user wants applied by default to events they create. Null when
     * the user hasn't picked one — the client falls back to the device's current tz.
     */
    default_timezone: string | null;
    created_at: string;
};

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
    /** Hex color (#RRGGBB) used in the child's badge across events. Auto-assigned on
     * insert by migration 0020's trigger; parents can change it from Settings. */
    color: string;
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
    /**
     * IANA timezone (e.g. "America/New_York") the event's wall clock is anchored to.
     * Critical for recurring events: without a tz, the recurrence expander generates
     * occurrences at the same UTC instant each cycle, which shifts the local wall clock
     * by 1 hour at every DST boundary. Null for legacy rows created before per-event tz
     * was added; those fall back to UTC-instant expansion.
     */
    timezone: string | null;
    /**
     * IDs of children this event applies to (many-to-many via event_children). Empty
     * array means "household-wide" — visible to everyone but not tagged to any kid.
     * Populated by getEvent / getEventsForRange via nested select; getEventsForRange
     * propagates the master's child_ids to every expanded recurrence instance.
     */
    child_ids: string[];
    /**
     * Alternation mode for recurring events whose responsible parent follows the custody
     * schedule. Null = no alternation (use responsible_profile_id directly). The resolver
     * applies the lookup per-occurrence; the master row stores only the mode.
     *
     *   same_day     → custodian on the occurrence date (after-school pickup etc.)
     *   previous_day → custodian on the date before (morning drop-off carries overnight)
     */
    responsible_alternation: 'same_day' | 'previous_day' | null;
    created_at: string;
    updated_at: string;
};

/** Per-event, per-date responsible-parent override (event_occurrence_overrides). */
export type EventOccurrenceOverride = {
    event_id: string;
    occurrence_date: string; // YYYY-MM-DD
    responsible_profile_id: string | null;
    notes: string | null;
    created_at: string;
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
    /**
     * IANA tz anchoring the event's wall clock. Pass the user's current tz on new events
     * (typically Intl.DateTimeFormat().resolvedOptions().timeZone). Omit / pass null only
     * if intentionally creating a tz-less event.
     */
    timezone?: string | null;
    /** Children this event applies to. Empty array (or omit) = household-wide. */
    childIds?: string[];
    /**
     * Alternation mode for recurring events. When set, responsibleProfileId should be
     * null (the responsible parent is computed from the custody schedule per occurrence).
     */
    responsibleAlternation?: 'same_day' | 'previous_day' | null;
};

export type Location = {
    id: string;
    household_id: string;
    name: string;
    google_maps_url: string | null;
    /** Set when this location came from a Google Places pick. Null for hand-typed entries. */
    google_place_id: string | null;
    /** Formatted postal address from Google Places (e.g. "200 Main St, Springfield, IL"). */
    formatted_address: string | null;
    created_by: string;
    created_at: string;
};

/** Extra Places data captured when a user picks a suggestion in the autocomplete dropdown. */
export type LocationPlaceInput = {
    placeId: string;
    formattedAddress: string;
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

export async function registerPushToken(
    expoToken: string,
    platform: string | null,
): Promise<void> {
    const { error } = await supabase.rpc('register_push_token', {
        p_expo_token: expoToken,
        p_platform: platform,
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

export async function getMyProfile(): Promise<Profile | null> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, default_timezone, created_at')
        .eq('id', userId)
        .maybeSingle();
    if (error) throw error;
    return (data as Profile | null) ?? null;
}

/** Pass null to clear the default and revert to device-tz fallback. */
export async function updateMyDefaultTimezone(tz: string | null): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
        .from('profiles')
        .update({ default_timezone: tz })
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
    notes: string | null = null,
    // When null, migration 0020's trigger picks the next palette slot. Pass a real hex
    // only if the user explicitly chose one in the form.
    color: string | null = null,
): Promise<Child> {
    const { data, error } = await supabase
        .from('children')
        .insert({
            household_id: householdId,
            display_name: displayName,
            birthdate,
            notes,
            color,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Child;
}

export async function getHouseholdChildren(householdId: string): Promise<Child[]> {
    const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('household_id', householdId)
        // Oldest first feels right: the first child added is usually the oldest in the
        // household, and stable ordering matters more than alphabetical here.
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Child[];
}

export async function updateChild(
    id: string,
    displayName: string,
    birthdate: string | null,
    notes: string | null,
    color: string,
): Promise<Child> {
    const { data, error } = await supabase
        .from('children')
        .update({
            display_name: displayName.trim(),
            birthdate,
            notes: notes?.trim() || null,
            color,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Child;
}

export async function deleteChild(id: string): Promise<void> {
    // event_children rows cascade-delete via the FK on child_id (see migration 0001).
    const { error } = await supabase.from('children').delete().eq('id', id);
    if (error) throw error;
}

// Returns events (including expanded recurrence instances) that overlap
// [rangeStart, rangeEnd). Two parallel queries: one-offs that overlap, and recurring masters
// that started before the end of range (those *might* have instances in the range — we let
// the client-side RRULE expander decide).
//
// QA-011: the one-off filter uses the standard interval-overlap predicate
// `starts_at < rangeEnd AND ends_at > rangeStart` so multi-day events that
// start before the range but extend into it (e.g. a Fri 6pm → Sat 2am event
// viewed on a week starting Saturday) are included. Previously this branch
// filtered on `starts_at >= rangeStart` alone and dropped such events.
/**
 * Normalizes a Supabase row with an embedded `event_children` join into a flat Event
 * with a `child_ids: string[]` array. We do this in JS rather than in a Postgres view
 * because nested selects in supabase-js already give us the embedded array — we just
 * need to project it to the shape the client uses.
 */
function attachChildIds(row: Record<string, unknown>): Event {
    const eventChildren =
        (row.event_children as Array<{ child_id: string }> | null | undefined) ?? [];
    const child_ids = eventChildren.map((ec) => ec.child_id);
    // Strip the nested array from the row before casting; the Event type doesn't carry it.
    const { event_children: _omit, ...rest } = row;
    void _omit;
    return { ...(rest as Omit<Event, 'child_ids'>), child_ids };
}

export async function getEventsForRange(
    householdId: string,
    rangeStart: Date,
    rangeEnd: Date,
): Promise<Event[]> {
    const [oneOffsRes, recurringRes] = await Promise.all([
        supabase
            .from('events')
            .select('*, event_children(child_id)')
            .eq('household_id', householdId)
            .is('recurrence_rule', null)
            .lt('starts_at', rangeEnd.toISOString())
            .gt('ends_at', rangeStart.toISOString())
            .order('starts_at', { ascending: true }),
        supabase
            .from('events')
            .select('*, event_children(child_id)')
            .eq('household_id', householdId)
            .not('recurrence_rule', 'is', null)
            .lt('starts_at', rangeEnd.toISOString())
            .order('starts_at', { ascending: true }),
    ]);
    if (oneOffsRes.error) throw oneOffsRes.error;
    if (recurringRes.error) throw recurringRes.error;

    const oneOffs = ((oneOffsRes.data ?? []) as Array<Record<string, unknown>>).map(
        attachChildIds,
    );
    const recurring = ((recurringRes.data ?? []) as Array<Record<string, unknown>>).map(
        attachChildIds,
    );

    // Recurring expansion propagates the master's child_ids to every occurrence via the
    // {...event} spread inside expandEventToOccurrences. No additional work needed here.
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

/**
 * Replaces the event_children rows for one event. DELETE-then-INSERT is simpler than
 * a diff/upsert here and the table is tiny per event (1-5 rows typically). RLS on the
 * join table mirrors event access, so this is gated by the caller's parenthood of the
 * household.
 *
 * NOT atomic with the parent event upsert — if the second step fails the event exists
 * without its child links. We'd wrap both in a SECURITY DEFINER RPC for true atomicity
 * if this ever became a real problem (it won't at MVP scale).
 */
async function setEventChildren(eventId: string, childIds: string[]): Promise<void> {
    const { error: delError } = await supabase
        .from('event_children')
        .delete()
        .eq('event_id', eventId);
    if (delError) throw delError;
    if (childIds.length === 0) return;
    const rows = childIds.map((child_id) => ({ event_id: eventId, child_id }));
    const { error: insError } = await supabase.from('event_children').insert(rows);
    if (insError) throw insError;
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
            timezone: input.timezone ?? null,
            responsible_alternation: input.responsibleAlternation ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    const event = data as Record<string, unknown>;
    const childIds = input.childIds ?? [];
    if (childIds.length > 0) {
        await setEventChildren(event.id as string, childIds);
    }
    return attachChildIds({ ...event, event_children: childIds.map((id) => ({ child_id: id })) });
}

export async function getEvent(id: string): Promise<Event | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*, event_children(child_id)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return attachChildIds(data as Record<string, unknown>);
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
            timezone: input.timezone ?? null,
            responsible_alternation: input.responsibleAlternation ?? null,
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    await setEventChildren(id, input.childIds ?? []);
    return attachChildIds({
        ...(data as Record<string, unknown>),
        event_children: (input.childIds ?? []).map((cid) => ({ child_id: cid })),
    });
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
    place: LocationPlaceInput | null = null,
): Promise<Location> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('locations')
        .insert({
            household_id: householdId,
            name: name.trim(),
            google_maps_url: googleMapsUrl?.trim() || null,
            google_place_id: place?.placeId ?? null,
            formatted_address: place?.formattedAddress?.trim() || null,
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
    place: LocationPlaceInput | null = null,
): Promise<Location> {
    const { data, error } = await supabase
        .from('locations')
        .update({
            name: name.trim(),
            google_maps_url: googleMapsUrl?.trim() || null,
            // Only overwrite place fields when a fresh pick was made; otherwise leave
            // whatever was previously stored alone. Callers pass null to mean "no change".
            ...(place
                ? {
                      google_place_id: place.placeId,
                      formatted_address: place.formattedAddress?.trim() || null,
                  }
                : {}),
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
    /**
     * UUID reference into vault.secrets. The actual OAuth tokens live in Supabase Vault
     * (migration 0017); use getExternalCalendarTokens(id) to read decrypted values.
     * The id itself is harmless to clients — vault.secrets is not readable by the
     * authenticated role.
     */
    access_token_secret_id: string;
    refresh_token_secret_id: string | null;
    token_expires_at: string | null;
    label: string | null;
    is_active: boolean;
    last_synced_at: string | null;
    created_at: string;
};

/** Decrypted token bundle returned by get_external_calendar_tokens. */
export type ExternalCalendarTokens = {
    access_token: string;
    refresh_token: string | null;
    token_expires_at: string | null;
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

/**
 * Both Save* helpers delegate to the SECURITY DEFINER save_external_calendar_pairing
 * RPC, which is the only entry point that can write into Vault. The RPC handles the
 * insert-or-update branching (idempotent reconnects) and the "no new refresh_token →
 * keep the existing one" nuance internally.
 */
async function savePairing(
    provider: CalendarProvider,
    email: string,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
): Promise<ExternalCalendar> {
    const { data: calendarId, error } = await supabase.rpc(
        'save_external_calendar_pairing',
        {
            p_provider: provider,
            p_email: email,
            p_access_token: accessToken,
            p_refresh_token: refreshToken,
            p_expires_at: expiresAt,
        },
    );
    if (error) throw error;
    if (!calendarId) throw new Error('save_external_calendar_pairing returned no id');

    // The RPC returns just the row id; fetch the (token-free) row to keep the existing
    // return contract intact for callers that want last_synced_at etc.
    const { data: row, error: fetchError } = await supabase
        .from('external_calendars')
        .select('*')
        .eq('id', calendarId)
        .single();
    if (fetchError) throw fetchError;
    return row as ExternalCalendar;
}

export async function saveGoogleCalendarPairing(
    input: SaveGoogleCalendarInput,
): Promise<ExternalCalendar> {
    return savePairing(
        'google',
        input.email,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
    );
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
    return savePairing(
        'microsoft',
        input.email,
        input.accessToken,
        input.refreshToken,
        input.expiresAt,
    );
}

export async function updateExternalCalendarTokens(
    id: string,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
): Promise<void> {
    const { error } = await supabase.rpc('update_external_calendar_tokens', {
        p_calendar_id: id,
        p_access_token: accessToken,
        p_refresh_token: refreshToken,
        p_expires_at: expiresAt,
    });
    if (error) throw error;
}

/**
 * Returns decrypted OAuth tokens for one of the caller's own calendars. Used by the
 * sync helpers (google-calendar.ts, microsoft-calendar.ts) just before they hit the
 * provider's API. The RPC is SECURITY DEFINER and enforces ownership via auth.uid().
 */
export async function getExternalCalendarTokens(
    calendarId: string,
): Promise<ExternalCalendarTokens | null> {
    const { data, error } = await supabase.rpc('get_external_calendar_tokens', {
        p_calendar_id: calendarId,
    });
    if (error) throw error;
    const rows = (data ?? []) as ExternalCalendarTokens[];
    return rows[0] ?? null;
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

// Event occurrence overrides: per-(event_id, date) responsible-parent override that
// takes precedence over the master's alternation rule. Used when a specific date breaks
// the usual pattern (parent swap, one-off arrangement, etc.).

/**
 * Returns the override rows for any of the household's events whose occurrence_date
 * falls in [rangeStartDate, rangeEndDate]. RLS confines this to the caller's household
 * via the join on events.
 */
export async function getEventOccurrenceOverridesForRange(
    householdId: string,
    rangeStartDate: string, // YYYY-MM-DD inclusive
    rangeEndDate: string, // YYYY-MM-DD inclusive
): Promise<EventOccurrenceOverride[]> {
    const { data, error } = await supabase
        .from('event_occurrence_overrides')
        .select(
            'event_id, occurrence_date, responsible_profile_id, notes, created_at, events!inner(household_id)',
        )
        .eq('events.household_id', householdId)
        .gte('occurrence_date', rangeStartDate)
        .lte('occurrence_date', rangeEndDate);
    if (error) throw error;
    // Strip the embedded events.household_id before returning — callers only need the
    // override fields. The cast preserves the surface type.
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        event_id: row.event_id as string,
        occurrence_date: row.occurrence_date as string,
        responsible_profile_id: (row.responsible_profile_id as string | null) ?? null,
        notes: (row.notes as string | null) ?? null,
        created_at: row.created_at as string,
    }));
}

/**
 * Upserts a per-occurrence override. Pass responsibleProfileId = null to override "no
 * responsible parent" for that date (e.g. an unstaffed event); pass a string to pin a
 * specific parent. Use deleteEventOccurrenceOverride to revert to the series rule.
 */
export async function setEventOccurrenceOverride(
    eventId: string,
    occurrenceDate: string, // YYYY-MM-DD
    responsibleProfileId: string | null,
    notes: string | null = null,
): Promise<EventOccurrenceOverride> {
    const { data, error } = await supabase
        .from('event_occurrence_overrides')
        .upsert(
            {
                event_id: eventId,
                occurrence_date: occurrenceDate,
                responsible_profile_id: responsibleProfileId,
                notes: notes?.trim() || null,
            },
            { onConflict: 'event_id,occurrence_date' },
        )
        .select()
        .single();
    if (error) throw error;
    return data as EventOccurrenceOverride;
}

export async function deleteEventOccurrenceOverride(
    eventId: string,
    occurrenceDate: string,
): Promise<void> {
    const { error } = await supabase
        .from('event_occurrence_overrides')
        .delete()
        .eq('event_id', eventId)
        .eq('occurrence_date', occurrenceDate);
    if (error) throw error;
}

// Lists — household-scoped buckets for grouping tasks. Each household auto-gets an
// "Inbox" list (is_default = true) at creation; tasks default into Inbox unless the
// user picks another list.

export type List = {
    id: string;
    household_id: string;
    name: string;
    color: string;
    sort_order: number;
    is_default: boolean;
    created_at: string;
};

/**
 * Returns all lists for a household, ordered by sort_order then created_at so the Inbox
 * (sort_order=0) lands first and user-created lists follow in creation order.
 */
export async function getLists(householdId: string): Promise<List[]> {
    const { data, error } = await supabase
        .from('lists')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as List[];
}

export async function createList(
    householdId: string,
    input: { name: string; color?: string | null; sortOrder?: number },
): Promise<List> {
    const { data, error } = await supabase
        .from('lists')
        .insert({
            household_id: householdId,
            name: input.name.trim(),
            color: input.color ?? null,
            // 100 mirrors the SQL default — keeps user-created lists below Inbox unless
            // they're reordered explicitly later.
            sort_order: input.sortOrder ?? 100,
        })
        .select()
        .single();
    if (error) throw error;
    return data as List;
}

export async function updateList(
    id: string,
    patch: { name?: string; color?: string; sortOrder?: number },
): Promise<List> {
    const next: Record<string, unknown> = {};
    if (patch.name !== undefined) next.name = patch.name.trim();
    if (patch.color !== undefined) next.color = patch.color;
    if (patch.sortOrder !== undefined) next.sort_order = patch.sortOrder;
    const { data, error } = await supabase
        .from('lists')
        .update(next)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as List;
}

/**
 * Deletes a list. Cascades to task_lists rows via that table's ON DELETE CASCADE FK
 * (migration 0025), so the task rows themselves survive — they just lose this list
 * from their list_ids set. Tasks whose list_ids array becomes empty after the cascade
 * are folded into Inbox by the Lists tab's filter logic (the orphan path).
 *
 * Pre-multi-list (migration 0023, now superseded) this used tasks.list_id with ON
 * DELETE SET NULL. The end-user behavior is the same — orphaned tasks land in Inbox
 * — but the column is gone and the mechanism is now junction-cascade + UI fallback.
 */
export async function deleteList(id: string): Promise<void> {
    const { error } = await supabase.from('lists').delete().eq('id', id);
    if (error) throw error;
}

/**
 * Replaces the full list-membership for a task. Mirrors setTaskAssignees — DELETE the
 * existing task_lists rows, INSERT the new ones. Use this for any list-membership
 * change (add, remove, move, multi-select reassign).
 *
 * If listIds is empty, the task ends up with zero list rows, which the UI folds into
 * Inbox (same as a list-deletion orphan). createTask defaults to the household's Inbox
 * to avoid landing tasks in that orphan state by accident.
 */
export async function setTaskLists(taskId: string, listIds: string[]): Promise<void> {
    const { error: delError } = await supabase
        .from('task_lists')
        .delete()
        .eq('task_id', taskId);
    if (delError) throw delError;
    if (listIds.length === 0) return;
    const rows = listIds.map((list_id) => ({ task_id: taskId, list_id }));
    const { error: insError } = await supabase.from('task_lists').insert(rows);
    if (insError) throw insError;
}

/** Replaces the full child association for a task. Same DELETE-then-INSERT pattern as
 *  setTaskLists / setTaskAssignees — the table stays tiny (≤ household-kid-count rows
 *  per task) so a diff isn't worth the complexity. Empty array clears all child
 *  associations, which the by-child view treats as "household-wide." */
export async function setTaskChildren(taskId: string, childIds: string[]): Promise<void> {
    const { error: delError } = await supabase
        .from('task_children')
        .delete()
        .eq('task_id', taskId);
    if (delError) throw delError;
    if (childIds.length === 0) return;
    const rows = childIds.map((child_id) => ({ task_id: taskId, child_id }));
    const { error: insError } = await supabase.from('task_children').insert(rows);
    if (insError) throw insError;
}

// Tasks — household-scoped todo items, optionally tied to an event. Multi-assign via
// the task_assignees junction (zero rows = "anyone").

export type Task = {
    id: string;
    household_id: string;
    event_id: string | null;
    title: string;
    notes: string | null;
    due_at: string | null;
    /**
     * Absolute timestamp when a push reminder should fire. Null = no reminder. The
     * client computes this from a preset offset against due_at on save; edits to
     * due_at don't auto-recompute reminder_at (user re-picks the preset to adjust).
     */
    reminder_at: string | null;
    /** When the reminder was actually pushed. Null until the edge function fires. */
    reminded_at: string | null;
    completed_at: string | null;
    completed_by: string | null;
    created_by: string | null;
    created_at: string;
    /** Profile ids of people assigned to this task. Empty array = anyone (unassigned). */
    assignee_profile_ids: string[];
    /**
     * List ids this task lives in. Multi-list per task — "Buy cake" can be in both
     * "Urgent" and "Groceries". Empty array means no list, which the UI folds into
     * Inbox (same as a list-deletion orphan).
     */
    list_ids: string[];
    /**
     * Child ids this task is associated with. Powers the Lists tab's by-child view
     * and gives event-linked tasks ("buy Anna's ballet shoes") a way to outlive the
     * event in child-centric rollups. Empty array means household-wide / not tied
     * to a particular kid.
     */
    child_ids: string[];
};

export type NewTaskInput = {
    title: string;
    notes?: string | null;
    eventId?: string | null;
    /**
     * List memberships for the task. If omitted or empty on createTask, defaults to
     * the household's Inbox so every task has at least one bucket. On updateTask the
     * caller MUST pass the full desired set — we replace, not merge.
     */
    listIds?: string[];
    /**
     * Children associated with the task. Like listIds, this is destructive on
     * update — the caller passes the full desired set. Undefined means "don't
     * touch the relation" (event form's task save uses this when it doesn't
     * surface a child picker per task).
     */
    childIds?: string[];
    dueAt?: string | null;
    /**
     * Absolute reminder timestamp. Set to a Date.toISOString() to schedule, null to
     * clear, undefined to leave the existing value alone on update.
     */
    reminderAt?: string | null;
    assigneeProfileIds?: string[];
};

/**
 * Normalizes the nested-select shape of `task_assignees(profile_id),
 * task_lists(list_id), task_children(child_id)` into flat string[] arrays on Task.
 * Every read path that wants any of those relations needs to pull all three joins and
 * run the row through this helper — joins are cheap server-side and the data is
 * already memo'd client-side.
 */
function attachTaskRelations(row: Record<string, unknown>): Task {
    const assignees =
        (row.task_assignees as Array<{ profile_id: string }> | null | undefined) ?? [];
    const lists =
        (row.task_lists as Array<{ list_id: string }> | null | undefined) ?? [];
    const childRows =
        (row.task_children as Array<{ child_id: string }> | null | undefined) ?? [];
    const {
        task_assignees: _omitA,
        task_lists: _omitL,
        task_children: _omitC,
        ...rest
    } = row;
    void _omitA;
    void _omitL;
    void _omitC;
    return {
        ...(rest as Omit<Task, 'assignee_profile_ids' | 'list_ids' | 'child_ids'>),
        assignee_profile_ids: assignees.map((a) => a.profile_id),
        list_ids: lists.map((l) => l.list_id),
        child_ids: childRows.map((c) => c.child_id),
    };
}

/**
 * Replaces the assignee rows for a task. DELETE-then-INSERT mirrors setEventChildren —
 * the table is tiny (≤household-size rows per task) and we don't need a diff.
 */
async function setTaskAssignees(taskId: string, profileIds: string[]): Promise<void> {
    const { error: delError } = await supabase
        .from('task_assignees')
        .delete()
        .eq('task_id', taskId);
    if (delError) throw delError;
    if (profileIds.length === 0) return;
    const rows = profileIds.map((profile_id) => ({ task_id: taskId, profile_id }));
    const { error: insError } = await supabase.from('task_assignees').insert(rows);
    if (insError) throw insError;
}

/** All tasks attached to one event, oldest first. */
export async function getEventTasks(eventId: string): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(attachTaskRelations);
}

/**
 * Incomplete tasks due in [rangeStart, rangeEnd]. Used by the Home digest (today /
 * this-week sections) and the Sunday-summary edge function. We also include tasks with
 * no due_at when `includeUndated` is true — that's the Home "no due date but assigned
 * to me" pile.
 */
export async function getUpcomingTasks(
    householdId: string,
    rangeStart: Date,
    rangeEnd: Date,
    options: { includeUndated?: boolean } = {},
): Promise<Task[]> {
    let q = supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .eq('household_id', householdId)
        .is('completed_at', null);
    if (options.includeUndated) {
        // Include both "due in range" and "no due date" — let the client decide grouping.
        q = q.or(
            `and(due_at.gte.${rangeStart.toISOString()},due_at.lte.${rangeEnd.toISOString()}),due_at.is.null`,
        );
    } else {
        q = q
            .gte('due_at', rangeStart.toISOString())
            .lte('due_at', rangeEnd.toISOString());
    }
    const { data, error } = await q.order('due_at', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(attachTaskRelations);
}

/**
 * Returns every task in a household. Used by the Lists tab, which wants the full
 * household picture (open + completed, all lists, all due states) so it can group by
 * list and the user can scroll back through what's been knocked out. By default we
 * include completed tasks; pass { openOnly: true } for a leaner pull.
 *
 * Ordered with open tasks first (completed_at nulls first), then by due date, then by
 * created_at as the stable tiebreaker. The Lists tab can re-group; this just sets a
 * sane default render order.
 */
export async function getHouseholdTasks(
    householdId: string,
    options: { openOnly?: boolean } = {},
): Promise<Task[]> {
    let q = supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .eq('household_id', householdId);
    if (options.openOnly) q = q.is('completed_at', null);
    const { data, error } = await q
        .order('completed_at', { ascending: true, nullsFirst: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as Array<Record<string, unknown>>).map(attachTaskRelations);
}

export async function createTask(
    householdId: string,
    input: NewTaskInput,
): Promise<Task> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('tasks')
        .insert({
            household_id: householdId,
            event_id: input.eventId ?? null,
            title: input.title.trim(),
            notes: input.notes?.trim() || null,
            due_at: input.dueAt ?? null,
            // Insert with reminded_at=null so the cron job picks this up at
            // reminder_at. Inserts never carry a "remembered" state.
            reminder_at: input.reminderAt ?? null,
            created_by: userId,
        })
        .select()
        .single();
    if (error) throw error;
    const row = data as Record<string, unknown>;
    const taskId = row.id as string;

    // Resolve the list memberships. Callers can pass listIds explicitly, or leave it
    // empty/undefined to fall through to the household's Inbox — the old DB trigger
    // did this before migration 0025, and we keep the same semantic here so every
    // newly created task lands in at least one list.
    let listIds = input.listIds ?? [];
    if (listIds.length === 0) {
        const { data: inbox } = await supabase
            .from('lists')
            .select('id')
            .eq('household_id', householdId)
            .eq('is_default', true)
            .maybeSingle();
        if (inbox) listIds = [(inbox as { id: string }).id];
    }
    if (listIds.length > 0) await setTaskLists(taskId, listIds);

    const assignees = input.assigneeProfileIds ?? [];
    if (assignees.length > 0) await setTaskAssignees(taskId, assignees);

    const childIds = input.childIds ?? [];
    if (childIds.length > 0) await setTaskChildren(taskId, childIds);

    return attachTaskRelations({
        ...row,
        task_assignees: assignees.map((profile_id) => ({ profile_id })),
        task_lists: listIds.map((list_id) => ({ list_id })),
        task_children: childIds.map((child_id) => ({ child_id })),
    });
}

export async function updateTask(id: string, input: NewTaskInput): Promise<Task> {
    // Build the patch dynamically so undefined fields don't clobber stored values.
    // reminder_at is the only field with non-trivial side effects: changing it
    // clears reminded_at so the cron job re-fires when the new time arrives. We
    // skip that reset when reminderAt is undefined (caller didn't touch it).
    const patch: Record<string, unknown> = {
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        event_id: input.eventId ?? null,
        due_at: input.dueAt ?? null,
    };
    if (input.reminderAt !== undefined) {
        patch.reminder_at = input.reminderAt;
        patch.reminded_at = null;
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) throw error;
    await setTaskAssignees(id, input.assigneeProfileIds ?? []);
    // listIds is destructive on the junction: the caller passes the full desired set
    // and we replace what's there. Undefined listIds (the caller didn't include the
    // field) is intentionally a different signal from [] — undefined means "don't
    // touch the list memberships", [] means "clear them" (which the UI folds into
    // Inbox via the orphan path). The event form's task update doesn't have a list
    // picker yet (task #220), so it passes undefined and preserves whatever Inbox
    // assignment createTask set up.
    if (input.listIds !== undefined) {
        await setTaskLists(id, input.listIds);
    }
    if (input.childIds !== undefined) {
        await setTaskChildren(id, input.childIds);
    }
    // Re-fetch with joins so the returned Task reflects the post-update state of
    // every relation (including the untouched listIds / childIds cases). Extra
    // round-trip but it's the only way to be honest about the unchanged relations
    // when the caller passed undefined.
    const task = await getTask(id);
    if (!task) throw new Error('Task disappeared after update');
    return task;
}

export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
}

/**
 * Fetches a single task by id (with assignees attached). Used by /task/[id] edit
 * modal. Returns null when the row is missing — RLS hides rows from non-members so
 * a 404 here is normal for unauthorized access too.
 */
export async function getTask(id: string): Promise<Task | null> {
    const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return attachTaskRelations(data as Record<string, unknown>);
}

/**
 * Toggles or sets a task's completed state. Sets completed_at to now and stamps
 * completed_by with the current user when checking; clears both when unchecking.
 */
export async function setTaskCompleted(
    id: string,
    completed: boolean,
): Promise<Task> {
    const userId = completed ? await currentUserId() : null;
    const { data, error } = await supabase
        .from('tasks')
        .update({
            completed_at: completed ? new Date().toISOString() : null,
            completed_by: userId,
        })
        .eq('id', id)
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .single();
    if (error) throw error;
    return attachTaskRelations(data as Record<string, unknown>);
}
