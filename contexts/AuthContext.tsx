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

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  credits: CreditsSummary | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signInWithOtp: (email: string) => Promise<AuthResponse>;
  verifyOtp: (email: string, token: string, fullName?: string) => Promise<AuthResponse>;
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
  const signInWithOtp = async (email: string): Promise<AuthResponse> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    return { error, message: error?.message };
  };

  /** -------------------------
   * REGISTER + SEND OTP
   --------------------------*/
  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phoneNumber: string
  ): Promise<AuthResponse> => {
    // 1️⃣ Create user WITHOUT sending magic link
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined,
        data: {
          name: fullName,
          full_name: fullName,
          phone_number: phoneNumber,
        },
      },
    });

    if (error) return { error, message: error.message };

    // 2️⃣ Send OTP manually
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    if (!otpError) setUser(data.user!);

    return {
      error: otpError,
      message: otpError
        ? otpError.message
        : "Un code OTP vous a été envoyé par email.",
    };
  };

  /** -------------------------
   * VERIFY OTP + CREATE PROFILE
   --------------------------*/
  const verifyOtp = async (
    email: string,
    token: string,
    providedFullName?: string
  ): Promise<AuthResponse> => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) return { error, message: error.message };

    const user = data.user;
    if (!user) return { error: true, message: "User not found after OTP." };

    const now = new Date().toISOString();

    // 1️⃣ Create or update profile safely
    const resolvedFullName =
      providedFullName?.trim() ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      undefined;

    const profilePayload = {
      id: user.id,
      email: user.email!,
      full_name: resolvedFullName,
      phone_number: user.user_metadata?.phone_number ?? undefined,
      role: "client",
      created_at: now,
      updated_at: now,
    };
    const { error: profileError } = await supabase.from("profiles").upsert(profilePayload);
    if (profileError) {
      console.error("Erreur upsert profile:", profileError);
      return { error: profileError, message: profileError.message };
    }
    setProfile({
      id: user.id,
      email: user.email!,
      full_name: profilePayload.full_name ?? null,
      phone_number: profilePayload.phone_number,
      role: "client",
      created_at: profilePayload.created_at,
      updated_at: profilePayload.updated_at,
    });

    // 2️⃣ Credits
    const creditsPayload = {
      user_id: user.id,
      total_credits: 3,
      used_credits: 0,
      last_reset_at: now,
      created_at: now,
      updated_at: now,
    };
    const { error: creditsError } = await supabase.from("credits").upsert(creditsPayload);
    if (creditsError) {
      console.error("Erreur upsert crédits:", creditsError);
      return { error: creditsError, message: creditsError.message };
    }
    setCredits({
      total: creditsPayload.total_credits,
      used: creditsPayload.used_credits,
      remaining: creditsPayload.total_credits - creditsPayload.used_credits,
    });

    // 3️⃣ Free subscription
    const subscriptionPayload = {
      user_id: user.id,
      plan_type: "free",
      status: "active",
      credits_limit: 3,
      started_at: now,
      created_at: now,
      updated_at: now,
    };
    const { error: subscriptionError } = await supabase.from("subscriptions").upsert(subscriptionPayload);
    if (subscriptionError) {
      console.error("Erreur upsert abonnement:", subscriptionError);
      return { error: subscriptionError, message: subscriptionError.message };
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
    router.push("/login");
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
        refreshCredits: async () => {},
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
