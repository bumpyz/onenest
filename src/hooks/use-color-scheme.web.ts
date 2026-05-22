// Web variant — same source of truth as the native build now that ThemePreferenceProvider
// reads from AsyncStorage on both platforms.
export { useAppColorScheme as useColorScheme } from '@/providers/theme-provider';
