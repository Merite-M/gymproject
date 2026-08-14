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
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        // Fetch tenant_id from user metadata or profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
        } else {
          // For demo purposes, use a default tenant if none assigned
          console.warn('No tenant_id found for user, using default for demo');
          setTenantId('00000000-0000-0000-0000-000000000000');
        }
      }
      setLoading(false);
    };
    
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch tenant_id when auth state changes
        supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => {
            if (profile?.tenant_id) {
              setTenantId(profile.tenant_id);
            } else {
              // For demo purposes, use a default tenant if none assigned
              console.warn('No tenant_id found for user, using default for demo');
              setTenantId('00000000-0000-0000-0000-000000000000');
            }
          });
      } else {
        setUser(null);
        setTenantId(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
