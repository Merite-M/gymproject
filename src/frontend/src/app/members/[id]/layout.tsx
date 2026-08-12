import { supabase } from '@/lib/supabase';

export async function generateStaticParams() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
     return [{ id: 'mock-id' }];
  }
  const { data: profiles, error } = await supabase.from('profiles').select('id');
  if (error || !profiles || profiles.length === 0) {
    console.error('Failed to fetch profiles for static generation', error);
    // Provide a fallback mock id so that Next.js export doesn't fail
    return [{ id: 'mock-id' }];
  }
  return profiles.map((profile) => ({
    id: profile.id,
  }));
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
