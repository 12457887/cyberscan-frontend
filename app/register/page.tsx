'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signUp } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!phoneNumber.trim()) {
      setError(
        localize(
          'Veuillez saisir un numéro de téléphone valide.',
          'Please provide a valid phone number.'
        )
      );
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

    const { error } = await signUp(email, password, fullName, phoneNumber.trim());

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">CyberScan</CardTitle>
            <CardDescription>{localize('Créez votre compte', 'Create your account')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{localize('Nom complet', 'Full name')}</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jean Dupont"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
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
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
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
