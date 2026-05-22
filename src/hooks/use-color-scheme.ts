// Re-exports the theme-provider-aware color scheme so existing imports
// (e.g. via @/hooks/use-theme) automatically respect the user's saved preference.
export { useAppColorScheme as useColorScheme } from '@/providers/theme-provider';
