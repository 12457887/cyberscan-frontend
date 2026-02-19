"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { USERNAME_REQUIREMENTS_TEXT, validateUsername } from "@/lib/username";
import { PHONE_REQUIREMENTS_TEXT, validatePhoneNumber } from "@/lib/phone";
import { PASSWORD_REQUIREMENTS_TEXT, validatePasswordStrength } from "@/lib/password";

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
      const syncCreditsFromServer = async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          const response = await fetch("/service/credits/sync", {
            method: "POST",
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          if (!response.ok) {
            return null;
          }
          const payload = await response.json().catch(() => null);
          const summary = payload?.credits;
          if (!summary) {
            return null;
          }
          const total = Number(summary.total ?? 0);
          const used = Number(summary.used ?? 0);
          const remaining = Number(summary.remaining ?? 0);
          return {
            total: Number.isFinite(total) ? total : 0,
            used: Number.isFinite(used) ? used : 0,
            remaining: Number.isFinite(remaining) ? remaining : 0,
          };
        } catch (error) {
          console.error("Error syncing credits:", error);
          return null;
        }
      };

      const { data } = await supabase
        .from("credits")
        .select("total_credits, used_credits, remaining_credits, updated_at, created_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const total = Number(data.total_credits ?? 0);
        const used = Number(data.used_credits ?? 0);
        const normalizedTotal = Number.isFinite(total) ? total : 0;
        const normalizedUsed = Number.isFinite(used) ? used : 0;
        if (normalizedTotal <= 0 && normalizedUsed <= 0) {
          const synced = await syncCreditsFromServer();
          if (synced) {
            setCredits(synced);
            return;
          }
        }
        const remaining = Math.max(normalizedTotal - normalizedUsed, 0);
        setCredits({
          total: normalizedTotal,
          used: normalizedUsed,
          remaining,
        });
      } else {
        const synced = await syncCreditsFromServer();
        if (synced) {
          setCredits(synced);
          return;
        }
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
    password: string,
    fullName: string,
    phoneNumber: string
  ): Promise<AuthResponse> => {
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      const error = new Error(`Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`);
      return { error, message: error.message };
    }
    const usernameCheck = validateUsername(fullName);
    if (!usernameCheck.valid) {
      const error = new Error(`Invalid full name. ${USERNAME_REQUIREMENTS_TEXT}`);
      return { error, message: error.message };
    }
    const sanitizedFullName = usernameCheck.sanitized;

    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
      const error = new Error(
        phoneCheck.reason === "missing"
          ? "Phone number is required."
          : `Invalid phone number. ${PHONE_REQUIREMENTS_TEXT}`
      );
      return { error, message: error.message };
    }
    const sanitizedPhone = phoneCheck.sanitized;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: {
          name: sanitizedFullName,
          full_name: sanitizedFullName,
          phone_number: sanitizedPhone,
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
      const passwordCheck = validatePasswordStrength(passwordToSet);
      if (!passwordCheck.valid) {
        const error = new Error(`Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`);
        return { error, message: error.message };
      }
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
    const sanitizedProvidedName = providedFullName ? validateUsername(providedFullName) : null;
    const resolvedFullName =
      (sanitizedProvidedName?.valid ? sanitizedProvidedName.sanitized : undefined) ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      undefined;
    const resolvedFullNameCheck = resolvedFullName ? validateUsername(resolvedFullName) : null;
    const safeResolvedFullName = resolvedFullNameCheck?.valid ? resolvedFullNameCheck.sanitized : undefined;

    const safePhoneFromMetadata = user.user_metadata?.phone_number
      ? validatePhoneNumber(user.user_metadata.phone_number)
      : null;
    const sanitizedPhoneNumber =
      safePhoneFromMetadata && safePhoneFromMetadata.valid ? safePhoneFromMetadata.sanitized : undefined;

    const bootstrapResponse = await fetch("/service/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        email: user.email,
        fullName: safeResolvedFullName ?? resolvedFullName,
        phoneNumber: sanitizedPhoneNumber,
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
