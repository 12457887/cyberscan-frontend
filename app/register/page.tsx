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
import Link from 'next/link';
import Image from 'next/image';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { USERNAME_REQUIREMENTS_TEXT, validateUsername } from '@/lib/username';
import { PHONE_REQUIREMENTS_TEXT, sanitizePhoneInput, validatePhoneNumber } from '@/lib/phone';
import { PASSWORD_REQUIREMENTS_TEXT, validatePasswordStrength } from '@/lib/password';

const OTP_COOLDOWN_MS = 60_000;

function RegisterPageContent({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);

  const { signUp, verifyOtp } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const { executeRecaptcha } = useGoogleReCaptcha();
  const requiresRecaptcha = Boolean(recaptchaSiteKey);

  useEffect(() => {
    if (!otpCooldownUntil) return;
    const delay = otpCooldownUntil - Date.now();
    if (delay <= 0) {
      setOtpCooldownUntil(null);
      return;
    }
    const timer = setTimeout(() => setOtpCooldownUntil(null), delay);
    return () => clearTimeout(timer);
  }, [otpCooldownUntil]);

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
    } catch (err: any) {
      setError(err?.message || localize('Erreur reCAPTCHA.', 'reCAPTCHA error.'));
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!(await runRecaptcha('register_create'))) {
      setLoading(false);
      return;
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
      setError(localize(message, message));
      setLoading(false);
      return;
    }

    const usernameCheck = validateUsername(fullName);
    if (!usernameCheck.valid) {
      setError(
        usernameCheck.reason === 'suspicious'
          ? localize(
              "Nom complet invalide : caractères ou mots-clés suspects détectés.",
              'Invalid full name: suspicious characters detected.'
            )
          : localize(
              `Nom complet invalide. ${USERNAME_REQUIREMENTS_TEXT}`,
              `Invalid full name. ${USERNAME_REQUIREMENTS_TEXT}`
            )
      );
      setLoading(false);
      return;
    }

    const safeFullName = usernameCheck.sanitized;
    if (safeFullName !== fullName) {
      setFullName(safeFullName);
    }

    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
      setError(
        localize(
          phoneCheck.reason === 'missing'
            ? 'Veuillez saisir un numéro de téléphone.'
            : `Numéro de téléphone invalide. ${PHONE_REQUIREMENTS_TEXT}`,
          phoneCheck.reason === 'missing'
            ? 'Please provide a phone number.'
            : `Invalid phone number. ${PHONE_REQUIREMENTS_TEXT}`
        )
      );
      setLoading(false);
      return;
    }
    const safePhone = phoneCheck.sanitized;
    if (safePhone !== phoneNumber) {
      setPhoneNumber(safePhone);
    }

    if (!acceptedTerms) {
      setError(
        localize(
          "Vous devez accepter les conditions générales d'utilisation avant de poursuivre.",
          'You must accept the terms and conditions before continuing.'
        )
      );
      setLoading(false);
      return;
    }

    const { error, message } = await signUp(email, password, safeFullName, safePhone);

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
        setError(message || error.message || localize("Impossible d'envoyer le code OTP.", 'Unable to send the OTP.'));
      }
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOtpLoading(true);

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
      setError(localize(message, message));
      setOtpLoading(false);
      return;
    }

    if (!(await runRecaptcha('register_verify_otp'))) {
      setOtpLoading(false);
      return;
    }

    const usernameCheck = validateUsername(fullName);
    const safeFullName = usernameCheck.valid ? usernameCheck.sanitized : '';
    if (!usernameCheck.valid) {
      setError(
        usernameCheck.reason === 'suspicious'
          ? localize(
              "Nom complet invalide : caractères ou mots-clés suspects détectés.",
              'Invalid full name: suspicious characters detected.'
            )
          : localize(
              `Nom complet invalide. ${USERNAME_REQUIREMENTS_TEXT}`,
              `Invalid full name. ${USERNAME_REQUIREMENTS_TEXT}`
            )
      );
      setOtpLoading(false);
      return;
    }

    const { error } = await verifyOtp(email, otp, safeFullName, 'signup', password);
    if (error) {
      setError(error.message || localize('Code invalide', 'Invalid code'));
      setOtpLoading(false);
      return;
    }

    setOtpLoading(false);
    router.push('/dashboard');
  };

  const handleResendOtp = async () => {
    if (otpCooldownUntil && Date.now() < otpCooldownUntil) {
      return;
    }
    setError('');
    setOtp('');
    setOtpLoading(true);

    if (!(await runRecaptcha('register_resend_otp'))) {
      setOtpLoading(false);
      return;
    }

    if (!acceptedTerms) {
      setError(
        localize(
          "Vous devez accepter les conditions générales d'utilisation avant de poursuivre.",
          'You must accept the terms and conditions before continuing.'
        )
      );
      setOtpLoading(false);
      return;
    }

    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
      setError(localize(message, message));
      setOtpLoading(false);
      return;
    }

    const usernameCheck = validateUsername(fullName);
    const safeFullName = usernameCheck.valid ? usernameCheck.sanitized : '';
    if (!usernameCheck.valid) {
      setError(
        usernameCheck.reason === 'suspicious'
          ? localize(
              "Nom complet invalide : caractères ou mots-clés suspects détectés.",
              'Invalid full name: suspicious characters detected.'
            )
          : localize(
              `Nom complet invalide. ${USERNAME_REQUIREMENTS_TEXT}`,
              `Invalid full name. ${USERNAME_REQUIREMENTS_TEXT}`
            )
      );
      setOtpLoading(false);
      return;
    }

    const phoneCheck = validatePhoneNumber(phoneNumber);
    if (!phoneCheck.valid) {
      setError(
        localize(
          phoneCheck.reason === 'missing'
            ? 'Veuillez saisir un numéro de téléphone.'
            : `Numéro de téléphone invalide. ${PHONE_REQUIREMENTS_TEXT}`,
          phoneCheck.reason === 'missing'
            ? 'Please provide a phone number.'
            : `Invalid phone number. ${PHONE_REQUIREMENTS_TEXT}`
        )
      );
      setOtpLoading(false);
      return;
    }
    const safePhone = phoneCheck.sanitized;

    const { error, message } = await signUp(email, password, safeFullName, safePhone);

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
        setError(message || error.message || localize("Impossible d'envoyer le code OTP.", 'Unable to send the OTP.'));
      }
      setOtpLoading(false);
      return;
    }

    setOtpSent(true);
    setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
    setOtpLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-5 text-center">
          <div className="flex justify-center">
            <Image
              src="/cyberscan-logo.png"
              alt="CyberScan Logo"
              width={200}
              height={200}
              className="object-contain"
              priority
            />
          </div>
          <CardDescription>{localize('Créez votre compte', 'Create your account')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={otpSent ? handleVerifyOtp : handleSubmit} className="space-y-4">
            
            {/* Full name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">{localize('Nom complet', 'Full name')}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jean Dupont"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={otpSent}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={otpSent}
              />
            </div>

            {/* First step fields */}
            {!otpSent && (
              <>
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
                    minLength={8}
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

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{localize('Numéro de téléphone', 'Phone number')}</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(sanitizePhoneInput(e.target.value))}
                    required
                  />
                </div>

                <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <input
                    id="terms"
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-blue-600"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <Label htmlFor="terms" className="text-sm text-slate-600 font-normal">
                    {localize(
                      "J'ai lu et j'accepte les conditions générales de vente et d'utilisation.",
                      'I have read and accept the terms and conditions.'
                    )}{' '}
                    <Link href="/conditions-generales" className="text-blue-600 hover:underline">
                      {localize('Consulter les conditions', 'View terms')}
                    </Link>
                  </Label>
                </div>
              </>
            )}

            {/* OTP step */}
            {otpSent && (
              <div className="space-y-2">
                <Label>{localize('Code OTP reçu par email', 'OTP code received by email')}</Label>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((slot) => (
                      <InputOTPSlot key={slot} index={slot} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {localize(
                      "Vous n'avez pas reçu le code ?",
                      "Didn't receive the code?"
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={otpLoading || (otpCooldownUntil !== null && Date.now() < otpCooldownUntil)}
                  >
                    {localize('Renvoyer le code', 'Resend code')}
                  </Button>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            {/* Buttons */}
            {!otpSent ? (
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Inscription...', 'Signing up...')}
                  </>
                ) : (
                  localize("S'inscrire", 'Sign up')
                )}
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={otpLoading || otp.length !== 6}>
                {otpLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Vérification...', 'Verifying...')}
                  </>
                ) : (
                  localize('Valider le code', 'Verify code')
                )}
              </Button>
            )}
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-600">
              {localize('Vous avez déjà un compte ?', 'Already have an account?')}
            </span>{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              {localize('Se connecter', 'Sign in')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey} scriptProps={{ async: true, defer: true }}>
        <RegisterPageContent recaptchaSiteKey={recaptchaSiteKey} />
      </GoogleReCaptchaProvider>
    );
  }
  return <RegisterPageContent />;
}
