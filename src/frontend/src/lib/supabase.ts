import { createClient } from '@supabase/supabase-js';

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  // Provide dummy values during build to prevent crash
  supabaseUrl = supabaseUrl || 'https://dummy.supabase.co';
  supabaseAnonKey = supabaseAnonKey || 'dummy_key';
}

export const supabase = createClient(supabaseUrl || 'https://mock.supabase.co', supabaseAnonKey || 'mock-key');
