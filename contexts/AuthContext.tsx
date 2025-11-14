'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthResponse = {
  error: any;
  message?: string;
};

type CreditsSummary = {
  total: number;
  used: number;
  remaining: number;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  credits: CreditsSummary | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signUp: (email: string, password: string, fullName: string, phoneNumber: string) => Promise<AuthResponse>;
  sendPasswordReset: (email: string) => Promise<AuthResponse>;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
};

const appUrlFromEnv =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  undefined;

const resolveAppUrl = () => {
  if (appUrlFromEnv) {
    return appUrlFromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return undefined;
};

const buildRedirectUrl = (path: string) => {
  const base = resolveAppUrl();
  return base ? `${base}${path}` : undefined;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<CreditsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadCredits = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('total_credits, used_credits, remaining_credits')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error loading credits:', error);
        setCredits(null);
      } else if (data) {
        setCredits({
          total: data.total_credits ?? 0,
          used: data.used_credits ?? 0,
          remaining: data.remaining_credits ?? 0,
        });
      } else {
        setCredits(null);
      }
    } catch (error) {
      console.error('Error loading credits:', error);
      setCredits(null);
    }
  };

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
        setCredits(null);
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
          setCredits(null);
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
            phone_number: session.user.user_metadata?.phone_number || null,
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
      await loadCredits(userId);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshCredits = async () => {
    if (user?.id) {
      await loadCredits(user.id);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error, message: error?.message };
  };

  const signInWithGoogle = async (): Promise<AuthResponse> => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    });
    return { error, message: error?.message };
  };

  const signUp = async (email: string, password: string, fullName: string, phoneNumber: string): Promise<AuthResponse> => {
    const emailRedirectTo = buildRedirectUrl('/login');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName,
          phone_number: phoneNumber
        },
        emailRedirectTo,
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
          phone_number: phoneNumber || null,
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

    return { error, message: error?.message };
  };

  const sendPasswordReset = async (email: string): Promise<AuthResponse> => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      return { error: true, message: "Backend non configuré pour l'envoi d'emails." };
    }

    const endpoint = `${backendUrl.replace(/\/$/, '')}/auth/send-password-reset`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          error: data || true,
          message:
            data?.detail ||
            data?.message ||
            "Impossible d'envoyer le lien de réinitialisation.",
        };
      }

      return {
        error: null,
        message: data?.message || 'Un email de réinitialisation a été envoyé.',
      };
    } catch (error) {
      console.error('sendPasswordReset error:', error);
      return {
        error,
        message: "Service de réinitialisation indisponible. Réessayez plus tard.",
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCredits(null);
    router.push('/login');
  };

  const value: AuthContextType = {
    user,
    profile,
    credits,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    sendPasswordReset,
    refreshCredits,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
