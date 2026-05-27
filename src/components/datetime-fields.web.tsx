import { useRef } from 'react';

import { Colors, Spacing } from '@/constants/theme';
import { useAppColorScheme } from '@/providers/theme-provider';

// Web variant: raw HTML <input type="date"> / <input type="time">. These have native
// platform pickers in every modern browser, so we get a real calendar / clock UI for free.

/** Render-prop API exposed by `renderTrigger`. Mirrors the native
 *  variant so callers stay platform-agnostic. */
export type DateFieldTriggerProps = {
    open: () => void;
    value: string;
    display: string;
};

type DateProps = {
    value: string; // YYYY-MM-DD
    onChange: (value: string) => void;
    /** Optional render-prop override. When provided, the caller renders
     *  its own trigger chrome (e.g. a FormRow with chevron) and
     *  invokes the picker via the supplied `open()`. We mount a
     *  visually-hidden <input type="date"> and trigger its native
     *  picker via `showPicker()` (or `click()` fallback). */
    renderTrigger?: (api: DateFieldTriggerProps) => React.ReactNode;
};

function formatDisplayYmd(ymd: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

export function DateField({ value, onChange, renderTrigger }: DateProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    const inputRef = useRef<HTMLInputElement | null>(null);

    if (renderTrigger) {
        // Hidden input + custom trigger chrome. `showPicker()` opens the
        // browser-native calendar UI; older browsers fall back to focus
        // + click which still surfaces the picker on most platforms.
        const open = () => {
            const el = inputRef.current;
            if (!el) return;
            // `showPicker` is the modern API (Chrome 99+, Safari 16+,
            // Firefox 101+); fall back to `click()` for older builds.
            const anyEl = el as unknown as { showPicker?: () => void };
            if (typeof anyEl.showPicker === 'function') {
                try {
                    anyEl.showPicker();
                    return;
                } catch {
                    // Fall through to click()
                }
            }
            el.focus();
            el.click();
        };
        return (
            <>
                {renderTrigger({
                    open,
                    value,
                    display: formatDisplayYmd(value),
                })}
                <input
                    ref={inputRef}
                    type="date"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    // Visually hidden but still focusable so showPicker()
                    // / click() works. opacity:0 + pointer-events:none +
                    // 1px box keeps it out of the layout flow.
                    style={{
                        position: 'absolute',
                        width: 1,
                        height: 1,
                        opacity: 0,
                        pointerEvents: 'none',
                        border: 0,
                        padding: 0,
                    }}
                    aria-hidden
                    tabIndex={-1}
                />
            </>
        );
    }

    return (
        <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                color: colors.text,
                background: 'transparent',
                border: `1px solid ${colors.backgroundSelected}`,
                borderRadius: Spacing.two,
                padding: `0 ${Spacing.three}px`,
                fontSize: 16,
                height: 44,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                width: '100%',
            }}
        />
    );
}

type TimeProps = {
    value: string; // HH:mm
    onChange: (value: string) => void;
};

export function TimeField({ value, onChange }: TimeProps) {
    const scheme = useAppColorScheme();
    const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
    return (
        <input
            type="time"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
                color: colors.text,
                background: 'transparent',
                border: `1px solid ${colors.backgroundSelected}`,
                borderRadius: Spacing.two,
                padding: `0 ${Spacing.three}px`,
                fontSize: 16,
                height: 44,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                width: '100%',
            }}
        />
    );
}
