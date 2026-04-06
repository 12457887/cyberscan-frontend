'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      // Flux classique Supabase (magic link, etc.)
      supabase.auth.getSession().then(({ data: { session } }) => {
        router.replace(session ? '/dashboard' : '/login');
      });
      return;
    }

    // Flux Google OAuth direct
    const handleGoogleCallback = async () => {
      try {
        const returnedState = searchParams.get('state');
        const savedState = sessionStorage.getItem('google_oauth_state');
        sessionStorage.removeItem('google_oauth_state');

        if (!returnedState || returnedState !== savedState) {
          console.error('Invalid OAuth state — possible CSRF attack');
          router.replace('/login?error=invalid_state');
          return;
        }

        const nonce = sessionStorage.getItem('google_oauth_nonce');
        sessionStorage.removeItem('google_oauth_nonce');

        const res = await fetch('/service/auth/google-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || 'Échec échange Google');
        }

        const { idToken } = await res.json();

        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: nonce || undefined,
        });

        if (error) throw error;

        router.replace('/dashboard');
      } catch (err: any) {
        console.error('Google callback error:', err);
        router.replace('/login?error=google_auth_failed');
      }
    };

    handleGoogleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-3 text-white">
        <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <p className="text-sm text-slate-300">Connexion en cours...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
          <div className="flex flex-col items-center gap-3 text-white">
            <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-slate-300">Connexion en cours...</p>
          </div>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
