import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diisi di file .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper: Dapatkan base URL untuk Edge Functions
export const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
