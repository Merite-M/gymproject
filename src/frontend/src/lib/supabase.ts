import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dummy";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  // In static export, NEXT_PUBLIC env vars are embedded at build time.
  // We provide a safe local fallback during build to allow static generation to succeed.
  // However, during actual browser runtime, we must throw an error to avoid silently failing
  // or leaking data to unintended endpoints.
  if (typeof window !== 'undefined') {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  } else {
    console.warn('Missing required environment variables during build: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
