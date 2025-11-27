'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

const OTP_COOLDOWN_MS = 60_000;

function LoginPageContent({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);

  const { signIn, signInWithGoogle, signInWithOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const { executeRecaptcha } = useGoogleReCaptcha();
  const requiresRecaptcha = Boolean(recaptchaSiteKey);

  const runRecaptcha = async (action: string) => {
    if (!requiresRecaptcha) return true;
    if (!executeRecaptcha) {
      setError(localize('reCAPTCHA indisponible, réessayez.', 'reCAPTCHA not ready, please try again.'));
      return false;
    }
    try {
      const token = await executeRecaptcha(action);
      if (!token) {
        setError(localize('Impossible de valider reCAPTCHA.', 'Unable to validate reCAPTCHA.'));
        return false;
      }
      const response = await fetch('/service/recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || localize('reCAPTCHA refusé.', 'reCAPTCHA rejected.'));
        return false;
      }
      return true;
    } catch (recaptchaError: any) {
      setError(recaptchaError?.message || localize('Erreur reCAPTCHA.', 'reCAPTCHA error.'));
      return false;
    }
  };

  /** ----------------------------------------
   * LOGIN PASSWORD HANDLER
   ---------------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

     if (!(await runRecaptcha('login_password'))) {
       setLoading(false);
       return;
     }

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  /** ----------------------------------------
   * SEND OTP
   ---------------------------------------- */
  const handleSendOtp = async () => {
    setError('');
    setOtp('');
    setOtpLoading(true);

    if (!(await runRecaptcha('login_otp_request'))) {
      setOtpLoading(false);
      return;
    }

    const { error } = await signInWithOtp(email);

    if (error) {
      if ((error as any)?.code === 'over_email_send_rate_limit' || /rate limit/i.test(error?.message || '')) {
        setError(
          localize(
            'Vous venez de demander un code. Merci de patienter environ 1 minute avant de recommencer.',
            'You just requested a code. Please wait about a minute before trying again.'
          )
        );
        setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
      } else {
        setError(error.message || localize("Erreur lors de l'envoi du code", 'Error while sending code'));
      }
    } else {
      setOtpSent(true);
      setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
    }

    setOtpLoading(false);
  };

  /** ----------------------------------------
   * VERIFY OTP
   ---------------------------------------- */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await verifyOtp(email, otp);

    if (error) {
      setError(error.message || localize('Code invalide', 'Invalid code'));
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  /** ----------------------------------------
   * GOOGLE SIGN-IN
   ---------------------------------------- */
  const handleGoogleSignIn = async () => {
    setError('');
    setOauthLoading(true);

    if (!(await runRecaptcha('login_google'))) {
      setOauthLoading(false);
      return;
    }

    const { error } = await signInWithGoogle();

    if (error) {
      const message =
        error.message && error.message.includes('provider is not enabled')
          ? localize("La connexion Google n'est pas encore activée.", 'Google sign-in not enabled.')
          : error.message || localize('Erreur lors de la connexion Google', 'Google login error');

      setError(message);
      setOauthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md shadow-xl">
        
        {/* ---------------------------- */}
        {/* HEADER */}
        {/* ---------------------------- */}
        <CardHeader className="text-center space-y-3">
          <Logo width={150} height={150} />

          <CardDescription className="text-muted-foreground">
            {localize('Connexion à votre compte', 'Sign in to your account')}
          </CardDescription>
        </CardHeader>

        {/* ---------------------------- */}
        {/* CONTENT */}
        {/* ---------------------------- */}
        <CardContent>
          <form onSubmit={otpSent ? handleVerifyOtp : handleSubmit} className="space-y-4">
            
            {/* EMAIL */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={otpSent || loading || otpLoading}
              />
            </div>

            {/* PASSWORD */}
            {!otpSent && (
              <div className="space-y-2">
                <Label htmlFor="password">{localize('Mot de passe', 'Password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            {/* OTP */}
            {otpSent && (
              <div className="space-y-2">
                <Label>{localize('Code reçu par email', 'Code received by email')}</Label>

                <InputOTP maxLength={6} value={otp} onChange={setOtp} containerClassName="justify-center">
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
            )}

            {/* FORGOT PASSWORD */}
            <div className="text-right text-sm">
              <Link href="/forgot-password" className="text-blue-600 hover:underline font-medium">
                {localize('Mot de passe oublié ?', 'Forgot password?')}
              </Link>
            </div>

            {/* ERROR */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            {/* BUTTON */}
            {!otpSent ? (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Connexion...', 'Signing in...')}
                  </>
                ) : (
                  localize('Se connecter', 'Sign in')
                )}
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Vérification...', 'Verifying...')}
                  </>
                ) : (
                  localize('Valider le code', 'Confirm code')
                )}
              </Button>
            )}

            {/* DIVIDER */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">{localize('ou', 'or')}</span>
              </div>
            </div>

          </form>

          {/* SIGN UP LINK */}
          <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">{localize('Pas encore de compte ?', 'No account yet?')}</span>{' '}
            <Link href="/register" className="text-blue-600 hover:underline font-medium">
              {localize("S'inscrire", 'Sign up')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey} scriptProps={{ async: true, defer: true }}>
        <LoginPageContent recaptchaSiteKey={recaptchaSiteKey} />
      </GoogleReCaptchaProvider>
    );
  }
  return <LoginPageContent />;
}
