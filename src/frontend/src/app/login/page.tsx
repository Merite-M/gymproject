"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ScanLine } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { enableDemoMode } = useAuth();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || 'Invalid password');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Reset form on success
      setEmail('');
      setPassword('');

      // Redirect to reception on success
      router.push('/reception');
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || 'Invalid password');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // For demo purposes, auto-assign to a default tenant
      // In production, this would be handled by an admin approval process
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: email,
            tenant_id: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || '2c604504-41c3-406b-82a0-a43700057af8',
            first_name: 'New',
            last_name: 'User',
          });

        if (profileError) {
          console.error('Failed to create profile:', profileError);
          setError('Account created but profile setup failed. Please contact support.');
          setLoading(false);
          return;
        }
      }

      // Reset form on success
      setEmail('');
      setPassword('');

      router.push('/reception');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-lg border border-border p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <ScanLine className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-headline-md font-bold text-foreground mb-2">GymPartner</h1>
          <p className="text-muted-foreground">Operations Console</p>
        </div>

        {error && (
          <div className="bg-status-blocked/10 border border-status-blocked/20 text-status-blocked px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-foreground placeholder:text-muted-foreground"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={handleSignUp}
              disabled={loading}
              className="flex-1 bg-muted border border-border text-foreground py-3 rounded-lg font-semibold hover:bg-muted/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              enableDemoMode();
              router.push('/reception');
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue without authentication (Demo Mode)
          </button>
        </div>
      </div>
    </div>
  );
}