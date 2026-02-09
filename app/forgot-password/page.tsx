'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/lib/supabase';
import { PASSWORD_REQUIREMENTS_TEXT, validatePasswordStrength } from '@/lib/password';

type Step = 'request' | 'verify' | 'reset';
const OTP_COOLDOWN_MS = 60_000;

export default function ForgotPasswordPage() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<Step>('request');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [otpCooldownUntil, setOtpCooldownUntil] = useState<number | null>(null);
  const redirectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
    }
  }, []);

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

  const resetMessages = () => {
    setMessage(null);
    setStatus(null);
  };

  const sendOtp = async () => {
    resetMessages();
    setLoading(true);

    try {
      const response = await fetch('/service/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password-reset', email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatus('error');
        setMessage(data?.error || localize("Impossible d'envoyer le code.", 'Unable to send the code.'));
      } else {
        setStatus('success');
        setMessage(
          data?.message ||
            localize(
              'Nous avons envoyé un code de sécurité à votre adresse email. Entrez-le ci-dessous pour continuer.',
              'We sent a security code to your email. Enter it below to continue.'
            )
        );
        setStep('verify');
        setOtpCooldownUntil(Date.now() + OTP_COOLDOWN_MS);
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err?.message || localize("Impossible d'envoyer le code.", 'Unable to send the code.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendOtp();
  };

  const resetToRequest = () => {
    resetMessages();
    setOtp('');
    setStep('request');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'recovery',
    });

    if (error) {
      setStatus('error');
      setMessage(error.message || localize('Code invalide ou expiré.', 'Invalid or expired code.'));
    } else {
      setStatus('success');
      setMessage(
        localize('Code validé. Choisissez maintenant un nouveau mot de passe.', 'Code verified. You can now set a new password.')
      );
      setStep('reset');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
      setStatus('error');
      setMessage(localize(`Mot de passe faible. ${PASSWORD_REQUIREMENTS_TEXT}`, message));
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage(localize('Les mots de passe ne correspondent pas.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setStatus('error');
      setMessage(error.message || localize('Impossible de mettre à jour votre mot de passe.', 'Unable to update your password.'));
    } else {
      setStatus('success');
      setMessage(
        localize(
          'Mot de passe mis à jour. Redirection vers la page de connexion...',
          'Password updated. Redirecting to the sign-in page...'
        )
      );
      setNewPassword('');
      setConfirmPassword('');
      redirectTimer.current = setTimeout(() => {
        router.replace('/login?reset=success=true');
      }, 1500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{localize('Mot de passe oublié', 'Forgot password')}</CardTitle>
            <CardDescription>
              {localize('Recevez un code OTP et réinitialisez votre mot de passe ici.', 'Get a one-time code and reset your password here.')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {step === 'request' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md ${status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                  {message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Envoi en cours...', 'Sending...')}
                  </>
                ) : (
                  localize('Envoyer le code', 'Send code')
                )}
              </Button>
            </form>
          )}

          {step === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-sm text-slate-600">
                {localize('Entrez le code à 6 chiffres reçu par email.', 'Enter the 6-digit code you received by email.')}
              </div>
              <InputOTP maxLength={6} value={otp} onChange={setOtp} required>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((slot) => (
                    <InputOTPSlot key={slot} index={slot} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  {localize("Vous n'avez pas reçu le code ?", "Didn't receive the code?")}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={sendOtp}
                  disabled={loading || (otpCooldownUntil !== null && Date.now() < otpCooldownUntil)}
                >
                  {localize('Renvoyer le code', 'Resend code')}
                </Button>
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md ${status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                  {message}
                </div>
              )}

              <div>
                <Button type="submit" disabled={loading || otp.length !== 6} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {localize('Vérification...', 'Verifying...')}
                    </>
                  ) : (
                    localize('Valider le code', 'Confirm code')
                  )}
                </Button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{localize('Nouveau mot de passe', 'New password')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="********"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{localize('Confirmer le mot de passe', 'Confirm password')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="********"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {message && (
                <div className={`text-sm p-3 rounded-md ${status === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                  {message}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Mise à jour...', 'Updating...')}
                  </>
                ) : (
                  localize('Mettre à jour le mot de passe', 'Update password')
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              {localize('Retour à la connexion', 'Back to sign in')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
