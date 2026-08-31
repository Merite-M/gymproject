'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: any | null;
  tenantId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  enableDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } = {}, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[AuthContext] Session retrieval error:', sessionError);
        }

        if (session?.user && isMounted) {
          setUser(session.user);
          
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('tenant_id')
              .eq('id', session.user.id)
              .single();
            
            if (isMounted) {
              if (profile?.tenant_id) {
                setTenantId(profile.tenant_id);
              } else {
                if (profileError && profileError.code !== 'PGRST116') {
                  console.warn('[AuthContext] Profile fetch error:', profileError);
                }
                console.warn('No tenant_id found for user, using default for demo');
                setTenantId('00000000-0000-0000-0000-000000000000');
              }
            }
          } catch (profileErr) {
            console.error('[AuthContext] Unexpected profile fetch exception:', profileErr);
            if (isMounted) {
              setTenantId('00000000-0000-0000-0000-000000000000');
            }
          }
        }
      } catch (err) {
        console.error('[AuthContext] checkSession error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        setUser(session.user);

        // Defer database query outside the auth event loop callback to avoid supabase auth lock deadlocks
        setTimeout(async () => {
          if (!isMounted) return;
          try {
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('tenant_id')
              .eq('id', session.user.id)
              .single();

            if (isMounted) {
              if (profile?.tenant_id) {
                setTenantId(profile.tenant_id);
              } else {
                if (profileError && profileError.code !== 'PGRST116') {
                  console.warn('[AuthContext] Profile fetch error on auth state change:', profileError);
                }
                setTenantId('00000000-0000-0000-0000-000000000000');
              }
            }
          } catch (profileErr) {
            console.error('[AuthContext] Auth state change profile fetch error:', profileErr);
            if (isMounted) {
              setTenantId('00000000-0000-0000-0000-000000000000');
            }
          } finally {
            if (isMounted) {
              setLoading(false);
            }
          }
        }, 0);
      } else {
        setUser(null);
        setTenantId(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTenantId(null);
    setIsDemoMode(false);
  };

  const enableDemoMode = () => {
    setUser({ id: 'demo-user', email: 'demo@example.com' });
    setTenantId('00000000-0000-0000-0000-000000000000');
    setIsDemoMode(true);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, tenantId, loading, signOut, isDemoMode, enableDemoMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useTenantId() {
  const { tenantId } = useAuth();
  return tenantId;
}
