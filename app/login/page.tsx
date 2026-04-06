'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import Link from 'next/link';
import Image from 'next/image';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { PASSWORD_REQUIREMENTS_TEXT, validatePasswordStrength } from '@/lib/password';

const OTP_COOLDOWN_MS = 60_000;

function LoginPageContent({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpType, setOtpType] = useState<'email' | 'signup'>('email');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const { signIn, signInWithGoogle, signInWithOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const { executeRecaptcha } = useGoogleReCaptcha();
  const requiresRecaptcha = Boolean(recaptchaSiteKey);

  useEffect(() => {
    if (!otpCooldownUntil) {
      setCooldownSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((otpCooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) setOtpCooldownUntil(null);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [otpCooldownUntil]);

  const isEmailNotConfirmed = (authError: any) => {
    const message = String(authError?.message || '').toLowerCase();
    return (
      authError?.code === 'email_not_confirmed' ||
      message.includes('email not confirmed') ||
      message.includes('confirm your email') ||
      message.includes('not confirmed')
    );
  };

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
      if (isEmailNotConfirmed(error)) {
        setLoading(false);
        const sent = await handleSendOtp('signup');
        if (sent) {
          setError(
            localize(
              'Compte en attente de vérification. Un nouveau code a été envoyé par email.',
              'Your account waiting verification, a code has been sent by email.'
            )
          );
        }
        return;
      }

      const message = String(error.message || '');
      if (message.toLowerCase().includes('invalid login credentials')) {
        // Vérifier si le compte existe
        const checkRes = await fetch('/service/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const { exists } = await checkRes.json().catch(() => ({ exists: true }));

        if (!exists) {
          setError(localize(
            'Aucun compte trouvé avec cet email. Veuillez vous inscrire.',
            'No account found with this email. Please sign up.'
          ));
        } else {
          setError(localize('Mot de passe incorrect.', 'Incorrect password.'));
        }
        setLoading(false);
        return;
      }

      setError(error.message || localize("Erreur lors de la connexion", 'Login error'));
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const sendOtp = async (
    mode: 'email' | 'signup',
    options: { silent?: boolean } = {}
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!options.silent) {
      setError('');
    }
    setResendSuccess(false);
    setOtp('');
    setOtpLoading(true);
    setOtpType(mode);

    if (!(await runRecaptcha('login_otp_request'))) {
      setOtpLoading(false);
      return { ok: false, error: 'recaptcha' };
    }

    const { error } = await signInWithOtp(email, mode === 'signup');

    if (error) {
      if (!options.silent) {
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
      }
      setOtpLoading(false);
      return { ok: false, error: error.message };
    }

    setOtpSent(true);
    setResendSuccess(true);
    setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
    setOtpLoading(false);
    return { ok: true };
  };

  /** ----------------------------------------
   * SEND OTP
   ---------------------------------------- */
  const handleSendOtp = async (mode: 'email' | 'signup' = otpType) => {
    const result = await sendOtp(mode);
    return result.ok;
  };

  /** ----------------------------------------
   * VERIFY OTP
   ---------------------------------------- */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (otpType === 'signup') {
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
        setError(localize(`Mot de passe faible. ${PASSWORD_REQUIREMENTS_TEXT}`, message));
        setLoading(false);
        return;
      }
    }

    const { error } = await verifyOtp(
      email,
      otp,
      undefined,
      otpType,
      otpType === 'signup' ? password : undefined
    );

    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('expiré')) {
        setError(
          localize(
            'Code expiré ou invalide. Cliquez sur "Renvoyer le code" pour en recevoir un nouveau.',
            'Code expired or invalid. Click "Resend code" to receive a new one.'
          )
        );
      } else {
        setError(error.message || localize('Code invalide', 'Invalid code'));
      }
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
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/cyberscan-logo.png"
              alt="CyberScan"
              width={200}
              height={200}
              className="object-contain"
              priority
            />
          </div>

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
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword
                      ? localize('Masquer le mot de passe', 'Hide password')
                      : localize('Afficher le mot de passe', 'Show password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* OTP */}
            {otpSent && (
              <div className="space-y-2">
                <Label>{localize('Code reçu par email', 'Code received by email')}</Label>

                <InputOTP maxLength={6} value={otp} onChange={(val) => { setOtp(val); setResendSuccess(false); }} containerClassName="justify-center">
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>

                {resendSuccess && (
                  <p className="text-xs text-green-600">
                    {localize(
                      'Un nouveau code a été envoyé. Entrez le nouveau code ci-dessus.',
                      'A new code has been sent. Enter the new code above.'
                    )}
                  </p>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {localize("Vous n'avez pas reçu le code ?", "Didn't receive the code?")}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSendOtp(otpType)}
                    disabled={otpLoading || cooldownSeconds > 0}
                  >
                    {cooldownSeconds > 0
                      ? localize(`Renvoyer (${cooldownSeconds}s)`, `Resend (${cooldownSeconds}s)`)
                      : localize('Renvoyer le code', 'Resend code')}
                  </Button>
                </div>
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

          {/* GOOGLE BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {oauthLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {localize('Continuer avec Google', 'Continue with Google')}
          </button>

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
