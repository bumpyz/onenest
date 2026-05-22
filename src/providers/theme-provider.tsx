import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeContextValue = {
    preference: ThemePreference;
    setPreference: (next: ThemePreference) => void;
    /** Resolved scheme — what components should actually render in. */
    scheme: 'light' | 'dark';
};

const STORAGE_KEY = 'onenest:theme-preference';

const defaultValue: ThemeContextValue = {
    preference: 'system',
    setPreference: () => undefined,
    scheme: 'light',
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

function isThemePreference(v: unknown): v is ThemePreference {
    return v === 'light' || v === 'dark' || v === 'system';
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
    const osScheme = useSystemColorScheme();
    const [preference, setPreferenceState] = useState<ThemePreference>('system');

    // Hydrate the saved preference once. Until it loads we render in light mode so the
    // initial paint is consistent across users.
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY)
            .then((value) => {
                if (isThemePreference(value)) setPreferenceState(value);
            })
            .catch(() => {
                // Ignore — fall back to default 'system'.
            });
    }, []);

    const setPreference = useCallback((next: ThemePreference) => {
        setPreferenceState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    }, []);

    const scheme: 'light' | 'dark' = useMemo(() => {
        if (preference === 'system') {
            return osScheme === 'dark' ? 'dark' : 'light';
        }
        return preference;
    }, [preference, osScheme]);

    const value = useMemo<ThemeContextValue>(
        () => ({ preference, setPreference, scheme }),
        [preference, setPreference, scheme],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
    return useContext(ThemeContext);
}

/**
 * Drop-in replacement for `useColorScheme` from react-native. Returns the user's chosen
 * scheme (or the system scheme if their preference is 'system'). Always returns 'light' or
 * 'dark' — never null.
 */
export function useAppColorScheme(): 'light' | 'dark' {
    return useContext(ThemeContext).scheme;
}
