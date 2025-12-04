'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield } from 'lucide-react';

export default function ResetPasswordPage() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{localize('Réinitialisation', 'Reset password')}</CardTitle>
            <CardDescription>
              {localize(
                'La réinitialisation par lien est désactivée. Utilisez désormais le code OTP envoyé par email.',
                'Link-based reset has been disabled. Use the OTP code sent to your email instead.'
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-sm text-slate-600">
            {localize(
              'Rendez-vous sur la nouvelle page « Mot de passe oublié » pour recevoir un code et choisir votre nouveau mot de passe.',
              'Go to the updated “Forgot password” page to receive a code and choose your new password.'
            )}
          </p>

          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href="/forgot-password">{localize('Aller à Mot de passe oublié', 'Go to Forgot password')}</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login" className="text-blue-600">
                {localize('Retour à la connexion', 'Back to sign in')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
