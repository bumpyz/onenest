// Catalog of IANA timezones with their current UTC offsets, used to power the searchable
// picker in Settings. We compute offsets at module load — they'll be slightly stale across
// DST boundaries during a long-running session, but the alternative (recomputing on every
// keystroke) is wasteful and the visible drift is at most ±1 hour twice a year.

import { DateTime } from 'luxon';

export type TimezoneOption = {
    /** IANA name, e.g. "America/New_York". This is what we persist. */
    iana: string;
    /** Current offset from UTC in minutes. -300 for EST, +330 for IST, etc. */
    offsetMinutes: number;
    /** Pretty label, e.g. "GMT-05:00". Sign included, two-digit hours and minutes. */
    offsetLabel: string;
    /** Region prefix from the IANA name ("America", "Europe", "Pacific", ...). */
    region: string;
    /** City portion of the IANA name with underscores → spaces. "New York", "São Paulo". */
    city: string;
};

/**
 * Hardcoded fallback list used when Intl.supportedValuesOf('timeZone') isn't available
 * (very old Hermes, very old browsers). Covers the common zones North American and
 * European users are likely to pick — they can always type a full IANA name in the
 * search box if they need something exotic.
 */
const FALLBACK_ZONES: ReadonlyArray<string> = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Phoenix',
    'America/Los_Angeles',
    'America/Anchorage',
    'America/Halifax',
    'America/St_Johns',
    'America/Toronto',
    'America/Vancouver',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'America/Buenos_Aires',
    'Europe/London',
    'Europe/Dublin',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Madrid',
    'Europe/Rome',
    'Europe/Athens',
    'Europe/Helsinki',
    'Europe/Moscow',
    'Africa/Cairo',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Perth',
    'Australia/Sydney',
    'Pacific/Auckland',
    'Pacific/Honolulu',
];

function formatOffset(minutes: number): string {
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const h = Math.floor(abs / 60)
        .toString()
        .padStart(2, '0');
    const m = (abs % 60).toString().padStart(2, '0');
    return `GMT${sign}${h}:${m}`;
}

function listIanaZones(): readonly string[] {
    // Intl.supportedValuesOf is the standard API; it returns ~400 IANA names. If it's
    // missing (very old runtimes), fall back to a curated list of common zones.
    const supported = (
        Intl as unknown as { supportedValuesOf?: (k: 'timeZone') => string[] }
    ).supportedValuesOf;
    if (typeof supported === 'function') {
        try {
            return supported.call(Intl, 'timeZone');
        } catch {
            // fall through to fallback
        }
    }
    return FALLBACK_ZONES;
}

let cached: TimezoneOption[] | null = null;

/** Returns the full, sorted, decorated timezone catalog. Computed once per app load. */
export function listTimezones(): TimezoneOption[] {
    if (cached) return cached;
    const zones = listIanaZones();
    const now = DateTime.now();
    const result: TimezoneOption[] = [];
    for (const iana of zones) {
        const dt = now.setZone(iana);
        if (!dt.isValid) continue;
        const parts = iana.split('/');
        const region = parts[0] ?? iana;
        const city = (parts.slice(1).join('/') || iana).replace(/_/g, ' ');
        result.push({
            iana,
            offsetMinutes: dt.offset,
            offsetLabel: formatOffset(dt.offset),
            region,
            city,
        });
    }
    // Sort by current offset (most negative first, so users near the date line see
    // their zone near the bottom), then alphabetically within an offset.
    result.sort(
        (a, b) =>
            a.offsetMinutes - b.offsetMinutes || a.iana.localeCompare(b.iana),
    );
    cached = result;
    return result;
}

/** Looks up a single tz option (e.g. for showing the current selection's offset). */
export function lookupTimezone(iana: string): TimezoneOption | null {
    return listTimezones().find((o) => o.iana === iana) ?? null;
}

/**
 * Resolve the timezone to use for new events.
 *
 * Policy (Phase 6.6.1):
 *   1. Native: Intl.DateTimeFormat().resolvedOptions().timeZone gives the
 *      device's actual tz (e.g. "America/New_York"). React Native polyfills
 *      Intl, so this works on both iOS and Android.
 *   2. Web: same Intl call — every modern browser reports the host's tz.
 *   3. Fallback when Intl reports something nonsensical or undefined
 *      (extremely rare): "America/Los_Angeles" — California Pacific time
 *      per the product call. The fallback is a sane default for a US-based
 *      app's web build that loses tz detection.
 *
 * This replaces the previous flow where users picked + stored a default tz
 * in profiles.default_timezone via a Settings picker. The column is now
 * legacy — we ignore it on read. Existing events keep their stored tz, so
 * no migration is needed.
 */
export function resolveDefaultTimezone(): string {
    if (typeof Intl !== 'undefined') {
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz && tz.length > 0) return tz;
        } catch {
            // Fall through to the static default below.
        }
    }
    return 'America/Los_Angeles';
}
