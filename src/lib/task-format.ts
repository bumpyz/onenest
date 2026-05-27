// Task-format helpers — pure functions for formatting due dates and choosing
// urgency pill colors. Lifted out of `src/app/task/[id]/index.tsx` so the
// Lists row, Home digest, Notifications inbox, and any future task-rendering
// surface can reuse the exact same labels and color rules.
//
// Pure module: no React, no theme provider — callers pass in the palette
// they're using. Keeps this importable from edge functions / SSR if we ever
// need to render emails or push payloads from a single source of truth.

import { format, parseISO } from 'date-fns';

import type { TaskPriority } from '@/lib/db';

/**
 * Subset of the theme palette this module needs. We accept any shape that has
 * the color keys we use rather than a hard import of the Colors object, so
 * callers can pass either `Colors.light` or `Colors.dark` and get the right
 * tints automatically.
 *
 * Extra keys (`warn`, `inkFaint`, `inkSec`) are referenced by `priorityPill`
 * and `priorityColor` for the v2 PrioritySheet mapping.
 */
export type TaskFormatPalette = {
    accent: string;
    alert: string;
    text: string;
    warn: string;
    inkFaint: string;
    inkSec: string;
};

/**
 * Formats a due-at instant into the design's compact mono label:
 *   - Same day:        "Today · 21:00"
 *   - Tomorrow:        "Tomorrow · 09:00"
 *   - 2-6 days out:    "Thu · 14:30"
 *   - >6 days out:     "May 28 · 14:30"
 *   - Past (overdue):  "-2d · 14:30"
 *
 * Day names use the locale's short form via `format(due, 'EEE')`. Time is
 * always 24-hour to match the mono typography pattern in the design.
 */
export function formatDueLabel(dueAtIso: string): string {
    const due = parseISO(dueAtIso);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
        (dueDay.getTime() - today.getTime()) / 86400000,
    );
    const timePart = format(due, 'HH:mm');
    if (diffDays === 0) return `Today · ${timePart}`;
    if (diffDays === 1) return `Tomorrow · ${timePart}`;
    if (diffDays > 1 && diffDays <= 6) {
        return `${format(due, 'EEE')} · ${timePart}`;
    }
    if (diffDays < 0) return `${diffDays}d · ${timePart}`;
    return `${format(due, 'MMM d')} · ${timePart}`;
}

/**
 * Picks the hero status pill color + label based on the task's state.
 * Returns null when no pill should render (no due date AND not completed).
 *
 * Design source: direction-c-pro.jsx ~1216-1232. The Overdue Lists bucket
 * (screens-extra-3.jsx ~993-998) uses by-DAY overdue detection — tasks
 * due "-1d" or older land there; a task due today is in the Today bucket
 * regardless of whether the time of day has passed (design sample "Pack
 * Oliver's bag for Casey · due='by 17:00'" sits in Today, not Overdue,
 * even after 17:00).
 *
 * We mirror that here so the hero pill and the Lists section agree on a
 * single definition of overdue: due_DAY < today. Otherwise we'd label a
 * task "OVERDUE" on its detail screen while Lists still buckets it as
 * "Today" — the bug the user reported.
 *
 * Mapping:
 *   • completed       → accent "DONE"
 *   • due day < today → alert "OVERDUE · -Nd" (or "OVERDUE · TODAY" never; -Nd only)
 *   • due day = today → alert "DUE TODAY · HH:MM" (red urgency, today is alert)
 *   • due day = +1    → accent "DUE TOMORROW · HH:MM"
 *   • due day 2-6     → accent "DUE <DAY> · HH:MM"
 *   • due day >6      → accent "DUE <MMM D> · HH:MM"
 */
export function dueStatusPill(
    task: { due_at: string | null; completed_at: string | null },
    palette: TaskFormatPalette,
): { color: string; label: string } | null {
    if (task.completed_at) {
        return { color: palette.accent, label: 'DONE' };
    }
    if (!task.due_at) return null;
    const due = parseISO(task.due_at);
    const now = new Date();
    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
    );
    const dueDay = new Date(
        due.getFullYear(),
        due.getMonth(),
        due.getDate(),
    );
    const diffDays = Math.round(
        (dueDay.getTime() - startOfToday.getTime()) / 86400000,
    );
    const timePart = format(due, 'HH:mm');
    // By-day overdue: only past days, never "today past time-of-day" — matches
    // the Lists bucketing in app/(app)/lists.tsx so the two surfaces agree.
    if (diffDays < 0) {
        const overdueDays = Math.abs(diffDays);
        return {
            color: palette.alert,
            label: `OVERDUE · ${overdueDays}D`,
        };
    }
    if (diffDays === 0) {
        return { color: palette.alert, label: `DUE TODAY · ${timePart}` };
    }
    if (diffDays === 1) {
        return { color: palette.accent, label: `DUE TOMORROW · ${timePart}` };
    }
    if (diffDays <= 6) {
        return {
            color: palette.accent,
            label: `DUE ${format(due, 'EEE').toUpperCase()} · ${timePart}`,
        };
    }
    return {
        color: palette.accent,
        label: `DUE ${format(due, 'MMM d').toUpperCase()} · ${timePart}`,
    };
}

/**
 * Picks the hero status pill color + label for a task's priority, or null
 * when the priority should render quietly. Design source:
 *   - screens-task-edit.jsx PrioritySheet (~839-910)
 *   - screens-task-edit.jsx TaskDetailV2 hero (~179-184) — HIGH PRIORITY pill
 *
 * Only 'high' and 'urgent' surface a pill in the hero (per the v2 design,
 * which uses the Priority row as the canonical edit affordance and reserves
 * the pill for genuine urgency signal). 'low' / 'normal' / 'none' render
 * quietly via no pill.
 */
export function priorityPill(
    priority: TaskPriority,
    palette: TaskFormatPalette,
): { color: string; label: string } | null {
    if (priority === 'urgent') {
        return { color: palette.alert, label: 'URGENT' };
    }
    if (priority === 'high') {
        return { color: palette.accent, label: 'HIGH PRIORITY' };
    }
    return null;
}

/**
 * Per-level color used by the Details `Priority` row right-value AND by the
 * PrioritySheet's left tile. Mirrors the design source mapping verbatim
 * (screens-task-edit.jsx PrioritySheet:842-848):
 *   * none   → inkFaint
 *   * low    → warn (matches `C.devon` slot in design — closest theme key
 *              that survives both light and dark modes)
 *   * normal → inkSec (matches `C.alex` slot)
 *   * high   → accent
 *   * urgent → alert
 *
 * The design uses member palette slots (`C.devon`, `C.alex`) for the Low /
 * Normal levels. Those are per-household identity colors stored in the DB,
 * not theme tokens — they'd recolor across users in unintuitive ways. We
 * substitute neutral theme tokens (`warn` / `inkSec`) that carry similar
 * visual weight without binding to a specific household member's color.
 */
export function priorityColor(
    priority: TaskPriority,
    palette: TaskFormatPalette,
): string {
    switch (priority) {
        case 'urgent':
            return palette.alert;
        case 'high':
            return palette.accent;
        case 'normal':
            return palette.inkSec;
        case 'low':
            return palette.warn;
        case 'none':
        default:
            return palette.inkFaint;
    }
}

/**
 * Human-readable label for a priority value. Used by the Details row right-
 * value, the PrioritySheet rows, and any future log / digest surfaces.
 */
export function priorityLabel(priority: TaskPriority): string {
    switch (priority) {
        case 'urgent':
            return 'Urgent';
        case 'high':
            return 'High';
        case 'normal':
            return 'Normal';
        case 'low':
            return 'Low';
        case 'none':
            return 'None';
        default:
            return 'Normal';
    }
}

/**
 * Short description rendered as the sub-text for each row in PrioritySheet.
 * Copy taken verbatim from the design source (screens-task-edit.jsx:843-847).
 */
export function prioritySubLabel(priority: TaskPriority): string {
    switch (priority) {
        case 'urgent':
            return 'Surfaces above everything';
        case 'high':
            return 'Surfaces above Normal';
        case 'normal':
            return 'Default';
        case 'low':
            return 'Nice to have';
        case 'none':
            return 'No priority indicator';
        default:
            return 'Default';
    }
}

/**
 * All priority values in design-canonical render order (none → low → normal
 * → high → urgent). Used by PrioritySheet to render its rows.
 */
export const TASK_PRIORITIES: readonly TaskPriority[] = [
    'none',
    'low',
    'normal',
    'high',
    'urgent',
] as const;
