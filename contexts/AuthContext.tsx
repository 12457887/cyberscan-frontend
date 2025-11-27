"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type AuthResponse = {
  error: any;
  message?: string;
};

type CreditsSummary = {
  total: number;
  used: number;
  remaining: number;
};

type VerifyOtpType = 'email' | 'signup';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  credits: CreditsSummary | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInWithOtp: (email: string, shouldCreateUser?: boolean) => Promise<AuthResponse>;
  verifyOtp: (
    email: string,
    token: string,
    fullName?: string,
    type?: VerifyOtpType,
    passwordToSet?: string
  ) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<AuthResponse>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber: string
  ) => Promise<AuthResponse>;
  sendPasswordReset: (email: string) => Promise<AuthResponse>;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credits, setCredits] = useState<CreditsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  /** -------------------------
   * LOAD CREDITS
   --------------------------*/
  const loadCredits = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("credits")
        .select("total_credits, used_credits, remaining_credits")
        .eq("user_id", userId)
        .maybeSingle();

      if (data) {
        setCredits({
          total: data.total_credits ?? 0,
          used: data.used_credits ?? 0,
          remaining: data.remaining_credits ?? 0,
        });
      } else {
        setCredits(null);
      }
    } catch (err) {
      console.error("Error loading credits:", err);
      setCredits(null);
    }
  };

  const refreshCredits = async () => {
    if (!user?.id) return;
    await loadCredits(user.id);
  };

  /** -------------------------
   * INIT SESSION
   --------------------------*/
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) loadProfile(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) loadProfile(session.user.id);
      else {
        setProfile(null);
        setCredits(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  /** -------------------------
   * LOAD PROFILE
   --------------------------*/
  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (data) setProfile(data);

      await loadCredits(userId);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  /** -------------------------
   * LOGIN PASSWORD
   --------------------------*/
  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, message: error?.message };
  };

  /** -------------------------
   * LOGIN OTP
   --------------------------*/
  const signInWithOtp = async (email: string, shouldCreateUser = false): Promise<AuthResponse> => {
    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser,
        emailRedirectTo,
      },
    });

    return { error, message: error?.message };
  };

  /** -------------------------
   * REGISTER + SEND OTP
   --------------------------*/
  const signUp = async (
    email: string,
    _password: string,
    fullName: string,
    phoneNumber: string
  ): Promise<AuthResponse> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          name: fullName,
          full_name: fullName,
          phone_number: phoneNumber,
        },
      },
    });

    return {
      error,
      message: error?.message,
    };
  };

  /** -------------------------
   * VERIFY OTP + CREATE PROFILE
   --------------------------*/
  const verifyOtp = async (
    email: string,
    token: string,
    providedFullName?: string,
    type: VerifyOtpType = 'email',
    passwordToSet?: string
  ): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });

    if (error) return { error, message: error.message };

    const user = data.user;
    if (!user) return { error: true, message: "User not found after OTP." };

    if (type === 'signup' && passwordToSet) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordToSet,
      });
      if (passwordError) {
        console.error("Erreur update mot de passe:", passwordError);
        return { error: passwordError, message: passwordError.message };
      }
    }

    const now = new Date().toISOString();

    // 1️⃣ Create or update profile safely
    const resolvedFullName =
      providedFullName?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      undefined;

    const bootstrapResponse = await fetch("/service/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        fullName: resolvedFullName,
        phoneNumber: user.user_metadata?.phone_number ?? undefined,
      }),
    });

    if (!bootstrapResponse.ok) {
      const payload = await bootstrapResponse.json().catch(() => null);
      const message = payload?.error || "Impossible de finaliser l'inscription.";
      return { error: true, message };
    }

    const bootstrapData = await bootstrapResponse.json();

    if (bootstrapData.profile) {
      setProfile({
        id: bootstrapData.profile.id,
        email: bootstrapData.profile.email,
        full_name: bootstrapData.profile.full_name,
        phone_number: bootstrapData.profile.phone_number,
        role: bootstrapData.profile.role ?? "client",
        created_at: bootstrapData.profile.created_at ?? now,
        updated_at: bootstrapData.profile.updated_at ?? now,
      });
    }

    if (bootstrapData.credits) {
      setCredits({
        total: bootstrapData.credits.total ?? 0,
        used: bootstrapData.credits.used ?? 0,
        remaining: bootstrapData.credits.remaining ?? 0,
      });
    }

    setUser(user);

    // 4️⃣ Redirect user
    router.push("/dashboard");

    return { error: null, message: "Compte vérifié." };
  };

  /** -------------------------
   * GOOGLE LOGIN
   --------------------------*/
  const signInWithGoogle = async (): Promise<AuthResponse> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/dashboard`
            : undefined,
      },
    });

    return { error, message: error?.message };
  };

  /** -------------------------
   * RESET PASSWORD
   --------------------------*/
  const sendPasswordReset = async (
    email: string
  ): Promise<AuthResponse> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error, message: error?.message };
  };

  /** -------------------------
   * LOGOUT
   --------------------------*/
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setCredits(null);
    router.push("/dashboard");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        credits,
        loading,
        signIn,
        signInWithOtp,
        verifyOtp,
        signInWithGoogle,
        signUp,
        sendPasswordReset,
        refreshCredits,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used in AuthProvider");
  return ctx;
}
