// Optional, user-selectable event types. The client owns the catalog; the DB just stores
// the id as text so new types can be added here without a migration. If an event's stored
// type isn't in this list (e.g. an old/removed id), iconForType returns '' and the title
// renders without an icon.

export type EventTypeId =
    | 'pickup'
    | 'dropoff'
    | 'sports'
    | 'school'
    | 'vacation'
    | 'birthday'
    | 'medical'
    | 'meal'
    | 'play'
    | 'chore'
    | 'party';

export type EventType = {
    id: EventTypeId;
    label: string;
    icon: string;
};

export const EVENT_TYPES: ReadonlyArray<EventType> = [
    { id: 'pickup', label: 'Pickup', icon: '🚗' },
    { id: 'dropoff', label: 'Drop-off', icon: '🚙' },
    { id: 'sports', label: 'Sports', icon: '⚽' },
    { id: 'school', label: 'School', icon: '🏫' },
    { id: 'vacation', label: 'Vacation', icon: '🌴' },
    { id: 'birthday', label: 'Birthday', icon: '🎂' },
    { id: 'medical', label: 'Medical', icon: '🏥' },
    { id: 'meal', label: 'Meal', icon: '🍽️' },
    { id: 'play', label: 'Playdate', icon: '🎨' },
    { id: 'chore', label: 'Chore', icon: '🧹' },
    { id: 'party', label: 'Party', icon: '🎉' },
];

const TYPE_MAP = new Map<string, EventType>(EVENT_TYPES.map((t) => [t.id, t]));

export function findEventType(id: string | null | undefined): EventType | null {
    if (!id) return null;
    return TYPE_MAP.get(id) ?? null;
}

export function iconForType(id: string | null | undefined): string {
    return findEventType(id)?.icon ?? '';
}

export function labelForType(id: string | null | undefined): string {
    return findEventType(id)?.label ?? '';
}
