import { createClient } from '@supabase/supabase-js';

const normalizeEnvValue = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const isUnsetEnvValue = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return normalized.length === 0 || normalized === 'undefined' || normalized === 'null';
};

const toValidHttpUrl = (value: string): string | null => {
    if (isUnsetEnvValue(value)) return null;
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.toString();
    } catch {
        return null;
    }
};

const rawSupabaseUrl = normalizeEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseUrl = toValidHttpUrl(rawSupabaseUrl);
const supabaseAnonKey = normalizeEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);
const hasSupabaseAnonKey = !isUnsetEnvValue(supabaseAnonKey);

export const isSupabaseEnabled = Boolean(supabaseUrl && hasSupabaseAnonKey);

if (rawSupabaseUrl && !supabaseUrl && import.meta.env.DEV) {
    console.warn('Ignoring invalid VITE_SUPABASE_URL. Database-backed features are disabled.');
}

export const supabase = supabaseUrl && hasSupabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })
    : null;
