// iOS and Android: keep the Supabase session in SQLite-backed localStorage (Supabase's Expo setup).
import 'expo-sqlite/localStorage/install';

export const authStorage = globalThis.localStorage;
