import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[Supabase] Missing environment variables. ' +
        'Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
        'Multiplayer features will be disabled.'
    );
}

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
        realtime: {
            params: { eventsPerSecond: 10 }
        }
    }
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey &&
    !supabaseUrl.includes('placeholder'));
