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
    /** Hand-off brief items — what the caregiver should communicate to
     *  the next parent. Auto-generates caregiver brief tasks on hand-off
     *  days (#397). Migration 0050. Shape: `[{ label: string }, ...]`. */
    default_brief_items: BriefItem[];
};

/** Item in households.default_brief_items. Loose shape for now — the
 *  full editor (Settings → Household) lands with Phase G (#489). */
export type BriefItem = {
    label: string;
};

/** Per-kid external co-parent link from migration 0050's
 *  `child_external_coparents` table. Profile linked to a child as the
 *  child's external parent (NOT a household member; relationship is
 *  per-kid). Drives the #398 per-kid POV strip variant. */
export type ChildExternalCoparent = {
    child_id: string;
    profile_id: string;
    /** Identity color the external parent renders with on this kid's
     *  strip. Null falls back to a stable palette pick client-side. */
    color: string | null;
    created_at: string;
    /** Resolved at fetch time when the caller wants name + avatar
     *  context for the row (the existing `cMembers`-equivalent). */
    display_name?: string;
};

/** Severity of an allergy entry. Maps 1:1 to the Postgres
 *  `allergy_severity` enum from migration 0043. */
export type AllergySeverity = 'mild' | 'moderate' | 'severe';

/** Caregiver-visibility scope from migration 0043's
 *  `child_caregiver_visibility` enum. Drives what caregivers in this
 *  household see for the child. */
export type ChildCaregiverVisibility =
    | 'assigned_only'
    | 'everything'
    | 'custom';

export type Child = {
    id: string;
    household_id: string;
    display_name: string;
    birthdate: string | null;
    notes: string | null;
    /** Hex color (#RRGGBB) used in the child's badge across events. Auto-assigned on
     * insert by migration 0020's trigger; parents can change it from Settings. */
    color: string;
    /** Free-text pronouns (e.g. "he/him"). Null = unset. Migration 0043. */
    pronouns: string | null;
    /** Free-text nickname surfaced in compact UIs. Migration 0043. */
    nickname: string | null;
    /** School name. Migration 0043. */
    school: string | null;
    /** Grade level — free text so "K", "3rd", "Year 6" all work. */
    grade: string | null;
    /** Teacher name. Migration 0043. */
    teacher: string | null;
    /** When true, child inherits the household's custody pattern.
     *  When false, the child has its own pattern (per-child override
     *  UI is a separate surface; this flag just toggles inheritance). */
    follows_main_pattern: boolean;
    /** Soft FK to contacts.id when the user has picked a pediatrician
     *  from the household contacts. Null = no pediatrician set. */
    pediatrician_contact_id: string | null;
    /** Caregiver visibility scope. Defaults to 'assigned_only' so
     *  caregivers only see tasks/events they were assigned to. */
    caregiver_visibility: ChildCaregiverVisibility;
    created_at: string;
};

/** Allergy row attached to a child via migration 0043's
 *  `children_allergies` junction. */
export type ChildAllergy = {
    id: string;
    child_id: string;
    label: string;
    severity: AllergySeverity | null;
    notes: string | null;
    created_at: string;
};

/** Medication row attached to a child via migration 0043's
 *  `children_medications` junction. */
export type ChildMedication = {
    id: string;
    child_id: string;
    label: string;
    dose: string | null;
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
    /**
     * Multi-responsible model (migration 0039). Each row tags one adult on this event;
     * the row with is_lead=true is the primary responsible (gets the LEAD chip + primary
     * push). Tagging IS the sharing primitive — anyone tagged sees the full event across
     * households; anyone NOT tagged sees only "Busy" in that time slot.
     *
     * Reads: populated from the events_responsible join in getEvent / getEventsForRange.
     * Empty array means the event has no assigned responsible (Anyone / unassigned).
     *
     * Optional in the type because not every read path is guaranteed to select the
     * join — `normalizeEventRow` defaults to `[]` and every consumer uses `?? []`
     * defensively. Marking required would lie about the runtime contract; QA-found drift.
     * Back-compat: the legacy `responsible_profile_id` column still mirrors the current
     * lead (writers update both during the transition window). Code that needs the
     * "primary responsible" should prefer this list and consult responsible_profile_id
     * only as a fallback for unmigrated rows.
     */
    responsibles: EventResponsible[];  // see note above re. optionality — keep required at the type level so call sites have to think about the join; normalizeEventRow guarantees []
    /**
     * Privacy opt-in for personal events (migration 0044, #466). When true,
     * viewers who are NOT in the `responsibles` list see this event as a
     * generic Busy block — no title, no location, no detail screen, same
     * vocabulary as the external paired-calendar busy blocks. Responsibles
     * still see the full event. Defaults to false (visible to the
     * household). Decouples "who owns this" (responsibles) from "who can
     * see the title" (is_private).
     */
    is_private: boolean;
    /**
     * Per-event "Also notify other parent" flag (migration 0046, #322).
     * When true the event reminder dispatch path (#308) pings every
     * tagged adult on the event in addition to the creator's default
     * notification scope. Defaults to false. The dispatch path itself
     * lands with #308; until then this stores intent.
     */
    notify_other_parent: boolean;
    created_at: string;
    updated_at: string;
};

/**
 * One row in events_responsible (migration 0039). Each row tags one adult as
 * responsible for an event; is_lead marks the primary (exactly one per event
 * when responsibles exist, enforced by a partial unique index).
 */
export type EventResponsible = {
    event_id: string;
    profile_id: string;
    is_lead: boolean;
    created_at: string;
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
    /**
     * Multi-responsible list (migration 0039). Each entry tags one adult on the event;
     * `isLead` marks the primary (exactly one entry should have isLead=true when the
     * list is non-empty — the create/update path enforces this client-side and the
     * server enforces it via partial unique index).
     *
     * When omitted, the writer falls back to building a single-row list from
     * `responsibleProfileId` for back-compat (so callers that haven't migrated to
     * multi-responsible keep working). Pass an empty array to deliberately create an
     * event with no assigned responsible (Anyone / unassigned). Pass an explicit list
     * to set multi-responsible.
     *
     * The writer also mirrors the lead's profile_id into the legacy
     * `events.responsible_profile_id` column during the transition window — readers
     * that haven't migrated to the join table still see the lead.
     */
    responsibles?: NewEventResponsibleInput[];
    /**
     * Privacy opt-in (#466). When true, non-responsibles see this event
     * as a generic Busy block. Defaults to false at the DB layer if
     * omitted from the input, so existing callers that pre-date the flag
     * keep their previous behavior. Toggled from EventForm's "Mark
     * private" Switch.
     */
    isPrivate?: boolean;
    /**
     * "Also notify other parent" flag (#322). When true, the reminder
     * dispatch path (#308 follow-up) pings every tagged adult, not just
     * the creator's default targets. Defaults to false at the DB layer
     * when omitted so callers that pre-date the flag keep their
     * previous behavior.
     */
    notifyOtherParent?: boolean;
};

/**
 * One entry in a NewEventInput.responsibles list. Lead semantics: at most one entry
 * with isLead=true; if none are flagged the writer promotes the first entry to lead.
 */
export type NewEventResponsibleInput = {
    profileId: string;
    isLead: boolean;
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

/**
 * Contacts — household-scoped quick-dial list (caregiver, handyman, gardener,
 * pediatrician, etc.). Tap a row in the Contacts tab → confirm → dial. Read by
 * any household member (caregivers included — they need to be able to call the
 * plumber); write is parent-only (migration 0034). Phone stored as free-form
 * string — the `tel:` URI handler strips non-digits at dial time, so format
 * validation at this layer would be busywork.
 */
// Closed-set categories backed by the contacts_category_check constraint
// in migration 0036. Adding a new category here ALSO requires a follow-up
// migration to update the CHECK; keep them in sync.
export type ContactCategory =
    | 'medical'
    | 'school'
    | 'activities'
    | 'family'
    | 'emergency'
    | 'other';

export const CONTACT_CATEGORIES: ReadonlyArray<ContactCategory> = [
    'medical',
    'school',
    'activities',
    'family',
    'emergency',
    'other',
];

export type Contact = {
    id: string;
    household_id: string;
    name: string;
    phone: string;
    /** Optional — e.g. "ABC Plumbing" for a business contact. */
    company: string | null;
    /** Optional short label users scan for ("babysitter", "doctor", "plumber"). */
    descriptor: string | null;
    /** Storage path within the contact-avatars bucket — `{household_id}/{contact_id}.{ext}`.
     *  Null when no photo set; the UI falls back to an initials avatar. The bucket is
     *  private; getContactAvatarUrl mints a signed URL for display. */
    avatar_url: string | null;
    sort_order: number;
    // Phase 7 fields (migration 0036). Closed-set category + two booleans for
    // the redesign's Emergency / Favorites strips + four optional text fields
    // and one optional FK for the new detail-screen SGroups. Defaults are
    // benign so legacy rows pre-0036 deserialize cleanly: category 'other',
    // both booleans false, every text field null.
    category: ContactCategory;
    is_favorite: boolean;
    is_emergency: boolean;
    email: string | null;
    /** Free-form human hint ("After 4 PM", "Weekends only") — no parsing. */
    best_time: string | null;
    /** Free-form address. Phase 7 keeps contacts lightweight; events use the
     *  richer `locations` table with place_id linkage instead. */
    address: string | null;
    notes: string | null;
    /** Optional FK to events. ON DELETE SET NULL — the contact survives if
     *  the linked event is deleted. */
    linked_event_id: string | null;
    created_at: string;
    updated_at: string;
};

export type ContactInput = {
    name: string;
    phone: string;
    company?: string | null;
    descriptor?: string | null;
    /** Pass null to clear an existing avatar; omit to leave it untouched on
     *  update; pass a storage path to set/replace it. */
    avatarUrl?: string | null;
    // Phase 7 inputs. All optional — undefined leaves the existing value
    // alone on update (same convention as avatarUrl). createContact treats
    // undefined as the default for the inserting row.
    category?: ContactCategory;
    isFavorite?: boolean;
    isEmergency?: boolean;
    email?: string | null;
    bestTime?: string | null;
    address?: string | null;
    notes?: string | null;
    linkedEventId?: string | null;
};

export type CustodySchedule = {
    id: string;
    household_id: string;
    pattern_id: string;
    cycle_days: string[];
    parent_a_profile_id: string;
    parent_b_profile_id: string;
    anchor_date: string; // YYYY-MM-DD
    // Phase 2 columns (migration 0048). Older rows that pre-date the
    // column adds get default values from the migration, so these are
    // always non-null in practice — but typed as required so consumers
    // are forced to think about them.
    handoff_time: string; // HH:MM:SS (Postgres `time` literal)
    /** 0–6, Monday-first per the editor's day-labels convention
     *  (`['M','T','W','T','F','S','S']`). Migration 0049 normalized the
     *  default to 6 (Sunday) to match the design source. */
    handoff_day_index: number;
    handoff_location_id: string | null;
    auto_assign: boolean;
    handoff_reminders: boolean;
    notify_externals: boolean;
    /** ISO timestamp; non-null = "Stop using a custody pattern" soft-stop
     *  (#376). Resolvers should treat this as no-active-schedule. */
    disabled_at: string | null;
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
    // Phase 2 fields (#374, #375). All optional on the input — caller
    // omits keys to keep the column's default / existing value.
    handoffTime?: string; // 'HH:MM' or 'HH:MM:SS'
    handoffDayIndex?: number;
    handoffLocationId?: string | null;
    autoAssign?: boolean;
    handoffReminders?: boolean;
    notifyExternals?: boolean;
};

export type CustodyOverride = {
    id: string;
    household_id: string;
    override_date: string; // YYYY-MM-DD
    custodian_profile_id: string;
    note: string | null;
    /** Null = whole-household override. Non-null scopes the override to
     *  one child (e.g. "Mei stays with Casey on Friday"). */
    child_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
};

// Swap requests (#372). Read-only banner on Family Hub for now; the
// full accept/decline flow lives in #399. Caregivers can read (banner
// visibility) but only parents can request / decide.
export type SwapRequestStatus =
    | 'pending'
    | 'accepted'
    | 'declined'
    | 'cancelled';

export type SwapRequest = {
    id: string;
    household_id: string;
    requested_by_profile_id: string;
    /** Null = whole-household swap; non-null scopes to one child. */
    affected_child_id: string | null;
    from_date: string; // YYYY-MM-DD inclusive
    to_date: string; // YYYY-MM-DD inclusive
    note: string | null;
    status: SwapRequestStatus;
    decided_by_profile_id: string | null;
    decided_at: string | null;
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

// Phase 13 RemoveCaregiverSheet: remove a member from a household. RLS in
// migration 0002 (`household_members delete parents or self`) gates this to
// parents-of-the-household OR the row's own profile_id, so this helper does
// not need its own role guard — Supabase will reject the row-level write if
// the caller isn't authorized. Callers should still avoid pointing the
// affordance at self (the UI also disallows it via the kebab visibility).
//
// Side effects to be aware of:
//   - household_members row is deleted; the user loses access via RLS
//     immediately on subsequent queries.
//   - Tasks assigned to this user via task_assignees remain in place but
//     the join no longer resolves them — they effectively unassign back to
//     "Anyone" via the resolver's fallback. That matches the design's
//     "Her upcoming task assignments unassign back to 'Anyone'" copy.
//   - Pending push notifications scheduled against this user's expo token
//     still send unless explicitly cancelled — that's a follow-up the
//     push token RPC will need (TODO when the inbox lands).
export async function removeHouseholdMember(
    householdId: string,
    profileId: string,
): Promise<void> {
    const { error } = await supabase
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('profile_id', profileId);
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

/**
 * Full-fields update for AddChild v2 (spec 07.2). Patches every column
 * a parent can edit on the child profile — including the columns added
 * by migration 0043. Pass `undefined` for any field you want to leave
 * alone; explicit `null` clears the column.
 *
 * Junction tables (lives_with, allergies, medications) are handled
 * separately via setChildLivingWith / addChildAllergy / addChildMedication
 * helpers below — partial updates on those need their own affordances.
 */
export type ChildBasicsPatch = {
    displayName?: string;
    birthdate?: string | null;
    notes?: string | null;
    color?: string;
    pronouns?: string | null;
    nickname?: string | null;
    school?: string | null;
    grade?: string | null;
    teacher?: string | null;
    followsMainPattern?: boolean;
    pediatricianContactId?: string | null;
    caregiverVisibility?: ChildCaregiverVisibility;
};

export async function updateChildBasics(
    id: string,
    patch: ChildBasicsPatch,
): Promise<Child> {
    const update: Record<string, unknown> = {};
    if (patch.displayName !== undefined) {
        update.display_name = patch.displayName.trim();
    }
    if (patch.birthdate !== undefined) update.birthdate = patch.birthdate;
    if (patch.notes !== undefined) {
        update.notes = patch.notes?.trim() || null;
    }
    if (patch.color !== undefined) update.color = patch.color;
    if (patch.pronouns !== undefined) {
        update.pronouns = patch.pronouns?.trim() || null;
    }
    if (patch.nickname !== undefined) {
        update.nickname = patch.nickname?.trim() || null;
    }
    if (patch.school !== undefined) {
        update.school = patch.school?.trim() || null;
    }
    if (patch.grade !== undefined) {
        update.grade = patch.grade?.trim() || null;
    }
    if (patch.teacher !== undefined) {
        update.teacher = patch.teacher?.trim() || null;
    }
    if (patch.followsMainPattern !== undefined) {
        update.follows_main_pattern = patch.followsMainPattern;
    }
    if (patch.pediatricianContactId !== undefined) {
        update.pediatrician_contact_id = patch.pediatricianContactId;
    }
    if (patch.caregiverVisibility !== undefined) {
        update.caregiver_visibility = patch.caregiverVisibility;
    }
    const { data, error } = await supabase
        .from('children')
        .update(update)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Child;
}

/**
 * Returns a single child row by id, or null when not found. Used by
 * the /child/[id] edit screen to seed the form.
 */
export async function getChildById(id: string): Promise<Child | null> {
    const { data, error } = await supabase
        .from('children')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return (data as Child | null) ?? null;
}

// ─── children_living_with junction (migration 0043) ────────────────────

export async function listChildLivingWith(childId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('children_living_with')
        .select('profile_id')
        .eq('child_id', childId);
    if (error) throw error;
    return (data ?? []).map(
        (r) => (r as { profile_id: string }).profile_id,
    );
}

/**
 * Bulk-replace the set of profile ids the child "lives with". Diffs
 * against the current set so we don't churn rows that didn't change
 * (lighter on RLS and on audit logs).
 */
export async function setChildLivingWith(
    childId: string,
    profileIds: ReadonlyArray<string>,
): Promise<void> {
    const desired = new Set(profileIds);
    const current = new Set(await listChildLivingWith(childId));
    const toAdd = [...desired].filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !desired.has(id));
    if (toAdd.length > 0) {
        const { error } = await supabase
            .from('children_living_with')
            .insert(
                toAdd.map((profile_id) => ({ child_id: childId, profile_id })),
            );
        if (error) throw error;
    }
    if (toRemove.length > 0) {
        const { error } = await supabase
            .from('children_living_with')
            .delete()
            .eq('child_id', childId)
            .in('profile_id', toRemove);
        if (error) throw error;
    }
}

// ─── children_allergies (migration 0043) ────────────────────────────

export async function listChildAllergies(
    childId: string,
): Promise<ChildAllergy[]> {
    const { data, error } = await supabase
        .from('children_allergies')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ChildAllergy[];
}

export async function addChildAllergy(input: {
    childId: string;
    label: string;
    severity: AllergySeverity | null;
    notes?: string | null;
}): Promise<ChildAllergy> {
    const { data, error } = await supabase
        .from('children_allergies')
        .insert({
            child_id: input.childId,
            label: input.label.trim(),
            severity: input.severity,
            notes: input.notes?.trim() || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data as ChildAllergy;
}

export async function deleteChildAllergy(id: string): Promise<void> {
    const { error } = await supabase
        .from('children_allergies')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

// ─── children_medications (migration 0043) ──────────────────────────

export async function listChildMedications(
    childId: string,
): Promise<ChildMedication[]> {
    const { data, error } = await supabase
        .from('children_medications')
        .select('*')
        .eq('child_id', childId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ChildMedication[];
}

export async function addChildMedication(input: {
    childId: string;
    label: string;
    dose?: string | null;
    notes?: string | null;
}): Promise<ChildMedication> {
    const { data, error } = await supabase
        .from('children_medications')
        .insert({
            child_id: input.childId,
            label: input.label.trim(),
            dose: input.dose?.trim() || null,
            notes: input.notes?.trim() || null,
        })
        .select()
        .single();
    if (error) throw error;
    return data as ChildMedication;
}

export async function deleteChildMedication(id: string): Promise<void> {
    const { error } = await supabase
        .from('children_medications')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function deleteChild(id: string): Promise<void> {
    // event_children rows cascade-delete via the FK on child_id (see migration 0001).
    // children_living_with / children_allergies / children_medications rows
    // also cascade-delete via migration 0043 FKs.
    const { error } = await supabase.from('children').delete().eq('id', id);
    if (error) throw error;
}

// ─── child_external_coparents (migration 0050, #398) ────────────────────
//
// Per-kid junction linking a profile to a child as the kid's external
// co-parent. Drives the #398 per-kid POV strip variant. The external
// profile is NOT a household_member — the relationship is per-kid.
// RLS keeps the external parent's view scoped to just the kids they're
// linked to (the new carve-outs in 0050 on children + custody tables
// make that visibility work).

/** Returns external co-parents linked to a single child. Includes the
 *  display name via a profiles join so the per-kid strip can render
 *  the avatar + identity color row directly. */
export async function getExternalCoparentsByChild(
    childId: string,
): Promise<ChildExternalCoparent[]> {
    const { data, error } = await supabase
        .from('child_external_coparents')
        .select(
            'child_id, profile_id, color, created_at, profiles!inner(display_name)',
        )
        .eq('child_id', childId)
        .order('created_at', { ascending: true });
    if (error) {
        // Same PGRST205 carve-out as getMyExternalCoparentLinks — see
        // there for rationale. Returning [] keeps caller logic simple.
        if (error.code === 'PGRST205') return [];
        throw error;
    }
    return (data ?? []).map((row: any) => ({
        child_id: row.child_id,
        profile_id: row.profile_id,
        color: row.color,
        created_at: row.created_at,
        display_name: row.profiles?.display_name ?? undefined,
    }));
}

/** Returns every (child_id, household_id) tuple the viewer is external
 *  to. Powers the #398 entry point: Today / Family Hub query this to
 *  decide whether to render the external strip + which kids to stack.
 *  Joins children to surface the household_id so the parent component
 *  can group by household before stacking strips. */
export async function getMyExternalCoparentLinks(): Promise<
    Array<{
        child_id: string;
        household_id: string;
        color: string | null;
        // Resolved child fields for convenience — the caller would query
        // children separately otherwise.
        child_display_name: string;
        child_color: string;
    }>
> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData.user?.id;
    if (!userId) return [];
    const { data, error } = await supabase
        .from('child_external_coparents')
        .select(
            'child_id, color, children!inner(household_id, display_name, color)',
        )
        .eq('profile_id', userId)
        .order('created_at', { ascending: true });
    if (error) {
        // Treat "table not found" as "no external links" instead of
        // throwing. Happens during the window between deploying client
        // code that references the strip-variants schema and applying
        // migration 0050 to Supabase. PostgREST surfaces this as
        // PGRST205 ("Could not find the table") with HTTP 404. Other
        // errors still throw — RLS denials, network failures, etc.
        // need to surface so the section's catch handler kicks in.
        if (error.code === 'PGRST205') return [];
        throw error;
    }
    return (data ?? []).map((row: any) => ({
        child_id: row.child_id,
        household_id: row.children.household_id,
        color: row.color,
        child_display_name: row.children.display_name,
        child_color: row.children.color,
    }));
}

/** Add a profile as an external co-parent for a kid. Household parents
 *  only (RLS-enforced). No-op safe via the unique PK on (child_id,
 *  profile_id) — duplicate inserts surface as a 409. */
export async function addExternalCoparent(
    childId: string,
    profileId: string,
    color: string | null = null,
): Promise<void> {
    const { error } = await supabase
        .from('child_external_coparents')
        .insert({ child_id: childId, profile_id: profileId, color });
    if (error) throw error;
}

/** Remove an external co-parent link. The profile itself is untouched
 *  — only the per-kid link is dropped. */
export async function removeExternalCoparent(
    childId: string,
    profileId: string,
): Promise<void> {
    const { error } = await supabase
        .from('child_external_coparents')
        .delete()
        .eq('child_id', childId)
        .eq('profile_id', profileId);
    if (error) throw error;
}

// ─── households.default_brief_items (migration 0050, #397) ───────────────
//
// Read/write helpers for the caregiver brief-items list. Auto-task
// generation lands with Phase G (#489); these helpers cover the
// Settings editor + the strip's "does this household even use brief
// items?" check.

export async function getHouseholdBriefItems(
    householdId: string,
): Promise<BriefItem[]> {
    const { data, error } = await supabase
        .from('households')
        .select('default_brief_items')
        .eq('id', householdId)
        .single();
    if (error) throw error;
    return ((data?.default_brief_items as BriefItem[] | null) ?? []) as BriefItem[];
}

export async function updateHouseholdBriefItems(
    householdId: string,
    items: BriefItem[],
): Promise<void> {
    const { error } = await supabase
        .from('households')
        .update({ default_brief_items: items })
        .eq('id', householdId);
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
 * Normalizes a Supabase row with embedded `event_children` and `events_responsible`
 * joins into a flat Event. We do this projection in JS rather than via a Postgres
 * view because nested selects in supabase-js already give us the embedded arrays
 * shaped roughly right — we just need to flatten them to the Event type's shape.
 *
 * Both joins are optional in the source select: callers that don't need responsibles
 * (e.g. the recurring-master fetch that gets re-fetched per occurrence via the
 * resolver) can omit the join and we'll default to an empty list. Callers that
 * need the multi-responsible UI (EventDetail, EventForm load) must select
 * `events_responsible(profile_id, is_lead, created_at, event_id)` explicitly.
 */
function normalizeEventRow(row: Record<string, unknown>): Event {
    const eventChildren =
        (row.event_children as Array<{ child_id: string }> | null | undefined) ?? [];
    const child_ids = eventChildren.map((ec) => ec.child_id);
    const eventResponsiblesRaw =
        (row.events_responsible as
            | Array<{
                  event_id?: string;
                  profile_id: string;
                  is_lead: boolean;
                  created_at?: string;
              }>
            | null
            | undefined) ?? [];
    const eventId = (row.id as string) ?? '';
    const responsibles: EventResponsible[] = eventResponsiblesRaw.map((r) => ({
        event_id: r.event_id ?? eventId,
        profile_id: r.profile_id,
        is_lead: r.is_lead,
        // created_at on the join row isn't always selected; default to the
        // event's created_at so the field is never undefined.
        created_at: r.created_at ?? (row.created_at as string) ?? '',
    }));
    // Strip nested arrays from the row before casting; Event carries the flat shapes.
    const { event_children: _omitChildren, events_responsible: _omitResp, ...rest } =
        row;
    void _omitChildren;
    void _omitResp;
    return {
        ...(rest as Omit<
            Event,
            'child_ids' | 'responsibles' | 'is_private' | 'notify_other_parent'
        >),
        child_ids,
        responsibles,
        // is_private was added in migration 0044 (#466). The column is NOT NULL
        // DEFAULT false at the DB layer, but some select clauses don't request
        // it explicitly — coalesce here so the Event type's `is_private: boolean`
        // contract holds even on those reads. Treating omitted-or-null as `false`
        // matches the DB default: a missing flag means "not private."
        is_private: (rest as { is_private?: boolean | null }).is_private ?? false,
        // notify_other_parent was added in migration 0046 (#322). Same coalesce
        // pattern as is_private — missing means "creator default scope only,"
        // which matches the DB default.
        notify_other_parent:
            (rest as { notify_other_parent?: boolean | null })
                .notify_other_parent ?? false,
    };
}

/**
 * @deprecated Renamed to {@link normalizeEventRow} now that the function also
 * projects events_responsible. Kept as an alias to avoid a sweeping rename in
 * one commit; new code should call normalizeEventRow.
 */
const attachChildIds = normalizeEventRow;

export async function getEventsForRange(
    householdId: string,
    rangeStart: Date,
    rangeEnd: Date,
): Promise<Event[]> {
    const [oneOffsRes, recurringRes] = await Promise.all([
        supabase
            .from('events')
            .select('*, event_children(child_id), events_responsible(profile_id, is_lead, created_at)')
            .eq('household_id', householdId)
            .is('recurrence_rule', null)
            .lt('starts_at', rangeEnd.toISOString())
            .gt('ends_at', rangeStart.toISOString())
            .order('starts_at', { ascending: true }),
        supabase
            .from('events')
            .select('*, event_children(child_id), events_responsible(profile_id, is_lead, created_at)')
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
 * Builds the responsibles list a writer should persist, applying back-compat
 * fallback for callers that haven't migrated to the multi-responsible model.
 *
 *   - If `input.responsibles` is explicitly provided, use it as-is (including
 *     empty array, which means "deliberately Anyone").
 *   - Otherwise, derive from the legacy `responsibleProfileId`:
 *       non-null → single-row list with isLead=true
 *       null     → empty list (Anyone)
 *
 * Old client-side sequential writers (`setEventChildren`, `setEventResponsibles`,
 * `leadProfileIdFromList`) were retired in migration 0041 — the atomic
 * RPCs `create_event_with_relations` and `update_event_with_relations` handle
 * lead derivation, normalization, and the DELETE-then-INSERT dance in a single
 * transaction. We still need this helper to map from the back-compat
 * `responsibleProfileId` input shape to the RPC's expected responsibles array.
 */
function resolveResponsiblesForWrite(
    input: NewEventInput,
): NewEventResponsibleInput[] {
    if (input.responsibles !== undefined) return input.responsibles;
    if (input.responsibleProfileId) {
        return [{ profileId: input.responsibleProfileId, isLead: true }];
    }
    return [];
}

export async function createEvent(
    householdId: string,
    input: NewEventInput,
): Promise<Event> {
    // Atomic single-round-trip via RPC (migration 0041). Replaces the
    // previous three-step events.insert → setEventChildren →
    // setEventResponsibles dance, which had a partial-write race when the
    // second or third step failed (QA-found). The RPC wraps all three in
    // a single transaction and mirrors the lead into the legacy
    // responsible_profile_id column server-side, so we don't have to
    // recompute it client-side and trust the order of operations.
    const responsibles = resolveResponsiblesForWrite(input);
    const childIds = input.childIds ?? [];
    const { data, error } = await supabase.rpc('create_event_with_relations', {
        p_household_id: householdId,
        p_title: input.title,
        p_starts_at: input.startsAt.toISOString(),
        p_ends_at: input.endsAt.toISOString(),
        p_all_day: input.allDay ?? false,
        p_description: input.description ?? null,
        p_location: input.location ?? null,
        p_location_id: input.locationId ?? null,
        p_recurrence_rule: input.recurrenceRule ?? null,
        p_event_type: input.eventType ?? null,
        p_timezone: input.timezone ?? null,
        p_responsible_alternation: input.responsibleAlternation ?? null,
        p_child_ids: childIds,
        p_responsibles: responsibles.map((r) => ({
            profile_id: r.profileId,
            is_lead: r.isLead,
        })),
        // Privacy opt-in (#466 / migration 0044+0045). Defaults to false
        // so callers that pre-date the flag get the previous behavior.
        p_is_private: input.isPrivate ?? false,
        // "Also notify other parent" flag (#322 / migration 0046+0047).
        // Same default-to-false rule.
        p_notify_other_parent: input.notifyOtherParent ?? false,
    });
    if (error) throw error;
    if (!data) throw new Error('create_event_with_relations returned no row');
    // The RPC returns the bare events row (no embedded joins). Re-shape
    // it to the normalized Event the client expects — we know the
    // child_ids and responsibles we just persisted, no need to refetch.
    return normalizeEventRow({
        ...(data as Record<string, unknown>),
        event_children: childIds.map((id) => ({ child_id: id })),
        events_responsible: responsibles.map((r, i) => ({
            profile_id: r.profileId,
            // Mirror the RPC's lead-promotion: if no isLead flagged in
            // input, the RPC marks the first entry as lead. Match here
            // so the returned object is consistent with persisted state.
            is_lead: responsibles.some((x) => x.isLead) ? r.isLead : i === 0,
        })),
    });
}

export async function getEvent(id: string): Promise<Event | null> {
    const { data, error } = await supabase
        .from('events')
        .select('*, event_children(child_id), events_responsible(profile_id, is_lead, created_at)')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return attachChildIds(data as Record<string, unknown>);
}

export async function updateEvent(id: string, input: NewEventInput): Promise<Event> {
    // Atomic single-round-trip via RPC (migration 0041) — same rationale
    // as createEvent. The old sequential events.update →
    // setEventChildren → setEventResponsibles path had a partial-write
    // race: if step 3 failed after step 1 mirrored the new lead into the
    // legacy column, the join table stayed empty/stale and downstream
    // consumers (in-app multi-responsible UI, sunday-summary) diverged
    // from what the user just saved.
    const responsibles = resolveResponsiblesForWrite(input);
    const childIds = input.childIds ?? [];
    const { data, error } = await supabase.rpc('update_event_with_relations', {
        p_event_id: id,
        p_title: input.title,
        p_starts_at: input.startsAt.toISOString(),
        p_ends_at: input.endsAt.toISOString(),
        p_all_day: input.allDay ?? false,
        p_description: input.description ?? null,
        p_location: input.location ?? null,
        p_location_id: input.locationId ?? null,
        p_recurrence_rule: input.recurrenceRule ?? null,
        p_event_type: input.eventType ?? null,
        p_timezone: input.timezone ?? null,
        p_responsible_alternation: input.responsibleAlternation ?? null,
        p_child_ids: childIds,
        p_responsibles: responsibles.map((r) => ({
            profile_id: r.profileId,
            is_lead: r.isLead,
        })),
        // Privacy opt-in (#466 / migration 0044+0045). Same default
        // semantics as createEvent.
        p_is_private: input.isPrivate ?? false,
        // "Also notify other parent" flag (#322 / migration 0046+0047).
        p_notify_other_parent: input.notifyOtherParent ?? false,
    });
    if (error) throw error;
    if (!data) throw new Error('update_event_with_relations returned no row');
    return normalizeEventRow({
        ...(data as Record<string, unknown>),
        event_children: childIds.map((cid) => ({ child_id: cid })),
        events_responsible: responsibles.map((r, i) => ({
            profile_id: r.profileId,
            is_lead: responsibles.some((x) => x.isLead) ? r.isLead : i === 0,
        })),
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

// Contacts — household-scoped quick-dial directory (migration 0034). Read by
// any household member; write parent-only (RLS enforces both). Sort is hand-
// ordered via `sort_order`; new rows append with max + 1 so the user's
// existing order doesn't shift when they add someone.

export async function getContacts(householdId: string): Promise<Contact[]> {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Contact[];
}

export async function createContact(
    householdId: string,
    input: ContactInput,
): Promise<Contact> {
    // Append: peek at the current max sort_order and add 1. Cheaper than
    // running a trigger for what's a low-write surface (handful of contacts
    // per household, lifetime).
    const { data: maxRow } = await supabase
        .from('contacts')
        .select('sort_order')
        .eq('household_id', householdId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextOrder = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

    const { data, error } = await supabase
        .from('contacts')
        .insert({
            household_id: householdId,
            name: input.name.trim(),
            phone: input.phone.trim(),
            company: input.company?.trim() || null,
            descriptor: input.descriptor?.trim() || null,
            // avatarUrl undefined on insert just stores null. Callers that
            // want to attach a photo upload first, then pass the storage
            // path in `avatarUrl`.
            avatar_url: input.avatarUrl ?? null,
            sort_order: nextOrder,
            // Phase 7 fields. Defaults match the migration so undefined here
            // produces the same row a pre-Phase-7 insert would have.
            category: input.category ?? 'other',
            is_favorite: input.isFavorite ?? false,
            is_emergency: input.isEmergency ?? false,
            email: input.email?.trim() || null,
            best_time: input.bestTime?.trim() || null,
            address: input.address?.trim() || null,
            notes: input.notes?.trim() || null,
            linked_event_id: input.linkedEventId ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return data as Contact;
}

export async function updateContact(
    id: string,
    input: ContactInput,
): Promise<Contact> {
    // avatar_url has three states on update:
    //   undefined → leave existing value alone
    //   null      → clear the avatar (delete the file separately via
    //               deleteContactAvatar if you want to free storage)
    //   string    → replace with the new storage path
    // Branching here so we don't accidentally null out an existing avatar
    // when callers only meant to update name/phone.
    const patch: Record<string, unknown> = {
        name: input.name.trim(),
        phone: input.phone.trim(),
        company: input.company?.trim() || null,
        descriptor: input.descriptor?.trim() || null,
    };
    if (input.avatarUrl !== undefined) {
        patch.avatar_url = input.avatarUrl;
    }
    // Phase 7 fields. Every field follows the "undefined leaves it alone,
    // explicit value overwrites" convention so callers can patch just one
    // attribute (e.g. toggling favorite from a list row) without re-sending
    // the rest. null is meaningful for the nullable text/FK fields — pass
    // it explicitly to clear an existing value.
    if (input.category !== undefined) patch.category = input.category;
    if (input.isFavorite !== undefined) patch.is_favorite = input.isFavorite;
    if (input.isEmergency !== undefined) patch.is_emergency = input.isEmergency;
    if (input.email !== undefined) {
        patch.email = input.email === null ? null : input.email.trim() || null;
    }
    if (input.bestTime !== undefined) {
        patch.best_time = input.bestTime === null ? null : input.bestTime.trim() || null;
    }
    if (input.address !== undefined) {
        patch.address = input.address === null ? null : input.address.trim() || null;
    }
    if (input.notes !== undefined) {
        patch.notes = input.notes === null ? null : input.notes.trim() || null;
    }
    if (input.linkedEventId !== undefined) patch.linked_event_id = input.linkedEventId;
    const { data, error } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Contact;
}

/**
 * Upload a contact avatar to the contact-avatars Storage bucket. Returns
 * the storage path (suitable for storing in contacts.avatar_url) on success.
 * Path layout is `{household_id}/{contact_id_or_temp}.{ext}` — household_id
 * being the first path segment is what the bucket's RLS policies look at.
 *
 * For NEW contacts (no id yet), pass a placeholder id and rename after the
 * insert returns its real id — OR just upload after the insert so you have
 * a real contact_id. The latter is simpler and what the form does today.
 */
export async function uploadContactAvatar(
    householdId: string,
    contactId: string,
    file: Blob | File | ArrayBuffer,
    ext: string,
): Promise<string> {
    // Path includes a cache-busting query bit via the contact_id only — we
    // overwrite the same path on re-upload so old image bytes drop out of
    // the CDN. The `upsert: true` flag below makes that explicit.
    const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${householdId}/${contactId}.${cleanExt}`;
    const { error } = await supabase.storage
        .from('contact-avatars')
        .upload(path, file as Blob, {
            upsert: true,
            // contentType is sniffed by Supabase Storage for File / Blob inputs;
            // setting it here keeps the metadata correct for ArrayBuffer paths.
            contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
        });
    if (error) throw error;
    return path;
}

/**
 * Mints a signed URL for an avatar storage path. URLs are time-limited so
 * we don't have to mark the bucket public. Default expiry is one hour, which
 * is long enough for a session of browsing the Contacts tab without burning
 * URLs constantly.
 */
export async function getContactAvatarSignedUrl(
    path: string,
    expiresInSec = 3600,
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from('contact-avatars')
        .createSignedUrl(path, expiresInSec);
    if (error) {
        console.error('getContactAvatarSignedUrl failed', error);
        return null;
    }
    return data?.signedUrl ?? null;
}

/**
 * Removes an avatar file from Storage. Caller is responsible for also
 * clearing contacts.avatar_url via updateContact({ avatarUrl: null }).
 * Errors are logged but not thrown — leaving an orphan file in storage
 * is harmless and shouldn't block the user-facing delete flow.
 */
export async function deleteContactAvatar(path: string): Promise<void> {
    const { error } = await supabase.storage
        .from('contact-avatars')
        .remove([path]);
    if (error) console.error('deleteContactAvatar failed', error);
}

export async function deleteContact(id: string): Promise<void> {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
}

export async function getContact(id: string): Promise<Contact | null> {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return (data as Contact) ?? null;
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
    // Build the row payload incrementally so that omitted optional fields
    // (handoff_time, anchor parent, behavior toggles) don't accidentally
    // overwrite existing column values back to defaults. Postgres
    // .upsert() will only write keys present in the object — but to be
    // explicit + safe-by-default for the existing call sites, we only
    // include the new columns when the caller passes them.
    const row: Record<string, unknown> = {
        household_id: householdId,
        pattern_id: input.patternId,
        cycle_days: input.cycleDays,
        parent_a_profile_id: input.parentAProfileId,
        parent_b_profile_id: input.parentBProfileId,
        anchor_date: input.anchorDate,
        created_by: userId,
        // Re-enable any prior soft-stop on save (#376). If the user is
        // pressing Save in the editor, they want this pattern active.
        // The Stop flow uses a dedicated `disableCustodySchedule` helper
        // that doesn't go through here.
        disabled_at: null,
    };
    if (input.handoffTime !== undefined) row.handoff_time = input.handoffTime;
    if (input.handoffDayIndex !== undefined)
        row.handoff_day_index = input.handoffDayIndex;
    if (input.handoffLocationId !== undefined)
        row.handoff_location_id = input.handoffLocationId;
    if (input.autoAssign !== undefined) row.auto_assign = input.autoAssign;
    if (input.handoffReminders !== undefined)
        row.handoff_reminders = input.handoffReminders;
    if (input.notifyExternals !== undefined)
        row.notify_externals = input.notifyExternals;
    const { data, error } = await supabase
        .from('custody_schedules')
        .upsert(row, { onConflict: 'household_id' })
        .select()
        .single();
    if (error) throw error;
    return data as CustodySchedule;
}

export async function deleteCustodySchedule(id: string): Promise<void> {
    const { error } = await supabase.from('custody_schedules').delete().eq('id', id);
    if (error) throw error;
}

/**
 * "Stop using a custody pattern" soft-stop (#376). Sets disabled_at so
 * resolvers + UI treat the household as having no active pattern, while
 * preserving the row + its historical assignments. Re-enabled by saving
 * the pattern again via upsertCustodySchedule (which clears disabled_at).
 */
export async function disableCustodySchedule(
    householdId: string,
): Promise<void> {
    const { error } = await supabase
        .from('custody_schedules')
        .update({ disabled_at: new Date().toISOString() })
        .eq('household_id', householdId);
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
    // Whole-household overrides only (child_id IS NULL). Migration
    // 0048 added the column to enable per-child overrides as a future
    // feature, but the per-child editor + resolver work is still
    // deferred (#373). Until then, returning both shapes from this
    // fetch breaks buildOverrideMap (date-only key → last-write-wins
    // collision between household-wide + per-child rows on the same
    // date). Filter at fetch time so callers don't have to know.
    //
    // When the per-child editor lands, this filter goes away and the
    // resolver layer learns to thread `childId` through its lookups.
    const { data, error } = await supabase
        .from('custody_overrides')
        .select('*')
        .eq('household_id', householdId)
        .is('child_id', null)
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
    childId: string | null = null,
): Promise<CustodyOverride> {
    const userId = await currentUserId();
    // The 0048 migration splits the unique constraint into two partial
    // indexes: one for whole-household overrides (child_id IS NULL) and
    // one per-child. Supabase's onConflict expects a single matching
    // unique target, so we route to the right one based on whether
    // child_id is provided.
    const conflictTarget =
        childId === null
            ? 'household_id,override_date'
            : 'household_id,override_date,child_id';
    const { data, error } = await supabase
        .from('custody_overrides')
        .upsert(
            {
                household_id: householdId,
                override_date: overrideDate,
                custodian_profile_id: custodianProfileId,
                note: note?.trim() || null,
                child_id: childId,
                created_by: userId,
            },
            { onConflict: conflictTarget },
        )
        .select()
        .single();
    if (error) throw error;
    return data as CustodyOverride;
}

export async function deleteCustodyOverride(
    householdId: string,
    overrideDate: string,
    childId: string | null = null,
): Promise<void> {
    let query = supabase
        .from('custody_overrides')
        .delete()
        .eq('household_id', householdId)
        .eq('override_date', overrideDate);
    // Match the same scope as upsert — whole-household vs. per-child.
    // .eq doesn't accept null; use .is() for the NULL match.
    query = childId === null ? query.is('child_id', null) : query.eq('child_id', childId);
    const { error } = await query;
    if (error) throw error;
}

// ─── Swap requests (#372) ──────────────────────────────────────────────

/**
 * List swap requests for a household, filtered by status. Default is
 * 'pending' — the Family Hub banner uses this to drive its visibility.
 * Sorted newest first so the banner always shows the most recent ask.
 */
export async function getSwapRequests(
    householdId: string,
    status: SwapRequestStatus | 'all' = 'pending',
): Promise<SwapRequest[]> {
    let query = supabase
        .from('swap_requests')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SwapRequest[];
}

/**
 * Create a pending swap request. Used by the future #399 review screen
 * — exposed now so the table has a write path for tests + a manual
 * smoke check before the UI lands.
 */
export async function createSwapRequest(input: {
    householdId: string;
    affectedChildId?: string | null;
    fromDate: string;
    toDate: string;
    note?: string | null;
}): Promise<SwapRequest> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('swap_requests')
        .insert({
            household_id: input.householdId,
            requested_by_profile_id: userId,
            affected_child_id: input.affectedChildId ?? null,
            from_date: input.fromDate,
            to_date: input.toDate,
            note: input.note?.trim() || null,
            // Status defaults to 'pending' at the column level.
        })
        .select()
        .single();
    if (error) throw error;
    return data as SwapRequest;
}

/**
 * Mark a swap request as accepted or declined. Wired by #399; exposed
 * now for completeness. The migration's check constraint enforces that
 * decided_by + decided_at are both set on accept/decline.
 */
export async function decideSwapRequest(
    id: string,
    decision: 'accepted' | 'declined',
): Promise<SwapRequest> {
    const userId = await currentUserId();
    const { data, error } = await supabase
        .from('swap_requests')
        .update({
            status: decision,
            decided_by_profile_id: userId,
            decided_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as SwapRequest;
}

/**
 * Withdraw a still-pending swap request. The requester can call this
 * before the other parent decides; RLS allows any parent to update,
 * but the UI should gate it to the requester to keep semantics clean.
 */
export async function cancelSwapRequest(id: string): Promise<SwapRequest> {
    const { data, error } = await supabase
        .from('swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as SwapRequest;
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

/**
 * Per-task urgency. Five levels matching the v2 TaskDetail design's
 * PrioritySheet (screens-task-edit.jsx). Stored as a Postgres enum
 * (`task_priority`, migrations 0037 + 0038) so the schema constrains
 * legal values at the DB layer:
 *   * 'none'   — no priority indicator
 *   * 'low'    — nice to have (quiet)
 *   * 'normal' — default (quiet)
 *   * 'high'   — surfaces above Normal; HIGH PRIORITY pill in hero
 *   * 'urgent' — surfaces above everything; URGENT pill in hero
 */
export type TaskPriority = 'none' | 'low' | 'normal' | 'high' | 'urgent';

/** Task kind enum from migration 0051. Most tasks are 'standard' —
 *  user-created todo items. 'caregiver_brief' is reserved for the
 *  auto-generated hand-off brief tasks the caregiver completes when
 *  handing the kids back. Pairs with `households.default_brief_items`. */
export type TaskKind = 'standard' | 'caregiver_brief';

export type Task = {
    id: string;
    household_id: string;
    event_id: string | null;
    title: string;
    notes: string | null;
    due_at: string | null;
    /** See TaskPriority. Defaults to 'normal' for every row at the DB level. */
    priority: TaskPriority;
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
    /**
     * Task kind from migration 0051. 'standard' for user-created tasks (the
     * vast majority), 'caregiver_brief' for the auto-generated hand-off
     * brief items the caregiver checks off at hand-off time. Existing
     * task surfaces (Today / Lists) hide caregiver_brief rows from the
     * default views — they only render inside the strip's brief section
     * (Phase G follow-up).
     */
    kind: TaskKind;
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
    /**
     * Task urgency. Undefined on update means "don't touch"; on create the DB
     * default ('normal') takes over. Explicit values flow through to the
     * `priority` column.
     */
    priority?: TaskPriority;
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
 * All tasks (open AND completed) attached to ANY of the given event IDs.
 * Used by the Home timeline so each event row can show a `done/total`
 * completion counter and (when expanded) the full inline task list with
 * completed tasks visible-but-ticked rather than filtered out. Single
 * `IN ()` query — one round-trip for N events rather than N per-event
 * fetches. Ordering matches getEventTasks (oldest first), grouping is
 * the caller's job (Map<event_id, Task[]>).
 */
export async function getTasksForEvents(eventIds: string[]): Promise<Task[]> {
    if (eventIds.length === 0) return [];
    const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)')
        .in('event_id', eventIds)
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
            // Omit when undefined so the DB default ('normal') applies.
            // Explicit values pass through.
            ...(input.priority !== undefined
                ? { priority: input.priority }
                : {}),
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
    // Priority: same "undefined skips, explicit value patches" semantics so
    // the contract matches reminderAt / listIds / childIds. The Lists swipe
    // snooze handler and the detail screen's snooze button both pass
    // undefined here and rely on this to preserve priority across edits.
    if (input.priority !== undefined) {
        patch.priority = input.priority;
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

// ─── Caregiver brief tasks (migration 0051, Phase G #489) ───────────────
//
// Auto-generated tasks paired with households.default_brief_items. The
// caregiver-on-duty checks them off at the handoff (medication notes,
// pickup changes, etc.). The strip's countdown chip flips alert-tinted
// while any remain open within ~2h of the handoff.
//
// Generator runs client-side from the strip when:
//   • viewer is the caregiver-on-duty for the next handoff window
//   • household has at least one brief item configured
//   • handoff is within HANDOFF_PREP_WINDOW_MS (default ~24h)
//
// PGRST205 carve-out matches the strip-variants helpers (see
// getMyExternalCoparentLinks) — if the migration hasn't been applied
// yet, the helpers return [] / no-op so the strip degrades gracefully.

/** Returns open caregiver brief tasks for a given handoff time. The
 *  strip uses the count + open-state to drive the alert chip. */
export async function getOpenCaregiverBriefTasksAt(
    householdId: string,
    handoffAt: Date,
): Promise<Task[]> {
    const { data, error } = await supabase
        .from('tasks')
        .select(
            '*, task_assignees(profile_id), task_lists(list_id), task_children(child_id)',
        )
        .eq('household_id', householdId)
        .eq('kind', 'caregiver_brief')
        .eq('due_at', handoffAt.toISOString())
        .is('completed_at', null);
    if (error) {
        if (error.code === 'PGRST205') return [];
        // Old DB without the `kind` column will surface as 'PGRST204'
        // (column not found) — treat the same way.
        if (error.code === 'PGRST204') return [];
        throw error;
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map(
        attachTaskRelations,
    );
}

/** Idempotently inserts brief tasks for a (household, handoffAt) tuple
 *  from the household's default_brief_items. Returns the freshly-
 *  generated rows. The migration's unique partial index guarantees
 *  duplicate inserts surface as a 409 conflict — we swallow those so
 *  concurrent generator calls converge to the same row set. */
export async function generateCaregiverBriefTasksForHandoff(
    householdId: string,
    handoffAt: Date,
    caregiverProfileId: string,
): Promise<void> {
    const items = await getHouseholdBriefItems(householdId);
    if (items.length === 0) return;
    // Check what already exists to avoid 409 spam in the common case.
    const existing = await getOpenCaregiverBriefTasksAt(
        householdId,
        handoffAt,
    );
    const existingTitles = new Set(existing.map((t) => t.title));
    const missing = items.filter(
        (it) => !existingTitles.has(it.label),
    );
    if (missing.length === 0) return;

    // Insert one row per missing brief item. Each gets due_at =
    // handoff time so the unique partial index keys correctly. We
    // assign to the caregiver_profile_id passed in — that's the
    // current viewer when the strip triggers generation.
    const rows = missing.map((it) => ({
        household_id: householdId,
        title: it.label,
        due_at: handoffAt.toISOString(),
        kind: 'caregiver_brief' as const,
    }));
    const { data: insertedRaw, error: insertError } = await supabase
        .from('tasks')
        .insert(rows)
        .select('id');
    // 23505 = unique_violation. Happens when two clients (or two app
    // mounts) race the generator — accept the loser's silence.
    if (insertError && insertError.code !== '23505') {
        if (insertError.code === 'PGRST205') return;
        if (insertError.code === 'PGRST204') return;
        throw insertError;
    }
    const inserted = insertedRaw ?? [];
    if (inserted.length === 0) return;
    // Attach the caregiver as assignee on each new row so the task
    // surfaces in their Today / Lists views.
    const assigneeRows = inserted.map((r: { id: string }) => ({
        task_id: r.id,
        profile_id: caregiverProfileId,
    }));
    const { error: assignError } = await supabase
        .from('task_assignees')
        .insert(assigneeRows);
    if (assignError && assignError.code !== '23505') {
        throw assignError;
    }
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
 * Toggles or sets a task's completed state. Routes through the
 * mark_task_complete RPC (migration 0031) so that both parents and caregivers
 * hit the same write path — caregivers cannot UPDATE tasks directly under the
 * new RLS, and the RPC also stamps reminded_at = now() to keep the cron from
 * firing a "still pending" push between completion and the next edit (QA-001).
 *
 * The RPC returns void, so we refetch the row to give the caller the updated
 * task (the existing callers — Lists, Home, task/[id] — all expect a Task back
 * for their optimistic-state refresh).
 */
export async function setTaskCompleted(
    id: string,
    completed: boolean,
): Promise<Task> {
    const { error } = await supabase.rpc('mark_task_complete', {
        p_task_id: id,
        p_completed: completed,
    });
    if (error) throw error;
    const fresh = await getTask(id);
    if (!fresh) {
        // Caregiver may have lost read access after completion (unlikely — visibility
        // gate doesn't toggle on completed_at — but be defensive).
        throw new Error('Task not visible after update');
    }
    return fresh;
}
