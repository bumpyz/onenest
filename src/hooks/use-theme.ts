import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Returns the resolved Color palette for the current effective scheme.
 * The underlying useColorScheme now reads from ThemePreferenceProvider, so this
 * automatically honors the user's saved light/dark/system preference.
 */
export function useTheme() {
    const scheme = useColorScheme();
    return Colors[scheme];
}
