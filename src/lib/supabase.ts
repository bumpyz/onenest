import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase env vars. Copy .env.example to .env.local and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    );
}

// TODO: generate proper Database types via `npx supabase gen types typescript --project-id <ref>`
// and pass <Database> to createClient. Until then we let queries be loosely typed at the SDK
// boundary; db.ts wraps inserts/selects with explicit return types.
//
// On web Supabase reads the session from the URL hash after an OAuth redirect and persists
// it to localStorage by default — no custom storage needed. On native we hand it AsyncStorage.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});
