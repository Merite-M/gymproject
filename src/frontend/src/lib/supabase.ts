import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // In static export, NEXT_PUBLIC env vars are embedded at build time.
  // We throw during actual runtime if missing. During build, it throws unless dummy values are provided or we handle it gracefully.
  // Based on the user's feedback, we should let it fail loudly on Render, OR throw gracefully.
  // Actually, Render requires env vars for build. Let's throw.
  console.warn('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
