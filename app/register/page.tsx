'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');

  const { signUp, signInWithOtp, verifyOtp } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!phoneNumber.trim()) {
      setError(localize('Veuillez saisir un numéro de téléphone valide.', 'Please provide a valid phone number.'));
      setLoading(false);
      return;
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

    const { error, message } = await signUp(email, password, fullName, phoneNumber.trim());

    if (error) {
      setError(error.message || message || localize("Impossible de créer le compte.", 'Unable to create account.'));
      setLoading(false);
      return;
    }

    const { error: otpErr } = await signInWithOtp(email);
    if (otpErr) {
      setError(otpErr.message || localize("Erreur lors de l'envoi du code.", 'Error while sending the code.'));
      setLoading(false);
      return;
    }

    setOtpSent(true);
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOtpLoading(true);

    const { error } = await verifyOtp(email, otp, fullName);
    if (error) {
      setError(error.message || localize('Code invalide', 'Invalid code'));
      setOtpLoading(false);
      return;
    }

    setOtpLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <Image
              src="/cyberscan-logo.png"
              alt="CyberScan Logo"
              width={150}
              height={150}
              className="rounded-lg"
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
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">{localize('Numéro de téléphone', 'Phone number')}</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
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
