'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const syncSession = async (event: string, session: Session | null) => {
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, session }),
        });
      } catch (error) {
        console.error('Failed to sync auth session cookie:', error);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession('INITIAL_SESSION', session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      syncSession(event, session);
      (() => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      // Récupérer la session pour accéder aux métadonnées JWT
      const { data: { session } } = await supabase.auth.getSession();

      // Essayer de charger le profil depuis la base de données
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading profile:', error);

        // Si le profil n'existe pas mais qu'on a une session avec rôle admin dans JWT
        if (session?.user.app_metadata?.role === 'admin') {
          // Créer un profil temporaire à partir des métadonnées
          setProfile({
            id: userId,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.name || 'Administrateur',
            role: 'admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      } else if (data) {
        // Si le profil existe, l'utiliser mais priorité au rôle du JWT si admin
        setProfile({
          ...data,
          role: session?.user.app_metadata?.role === 'admin' ? 'admin' : data.role,
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName
        }
      }
    });

    if (!error && data.user) {
      const now = new Date().toISOString();
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          full_name: fullName,
          role: 'client'
        });

      if (!profileError) {
        await supabase.from('credits').insert({
          user_id: data.user.id,
          total_credits: 10,
          used_credits: 0,
          last_reset_at: now,
          updated_at: now,
        });

        await supabase.from('subscriptions').insert({
          user_id: data.user.id,
          plan_type: 'free',
          status: 'active',
          credits_limit: 10
        });
      }
    }

    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signInWithGoogle, signUp, sendPasswordReset, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
