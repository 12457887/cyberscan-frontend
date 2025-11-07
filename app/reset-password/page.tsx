'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
      setSessionChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!newPassword || newPassword.length < 8) {
      setMessage(
        localize('Le mot de passe doit contenir au moins 8 caractères.', 'Password must be at least 8 characters.')
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(localize('Les mots de passe ne correspondent pas.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(localize('Impossible de mettre à jour le mot de passe.', 'Unable to update the password.'));
    } else {
      setMessage(
        localize('Mot de passe mis à jour. Vous pouvez maintenant vous connecter.', 'Password updated. You can now sign in.')
      );
      setNewPassword('');
      setConfirmPassword('');
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
            <CardTitle className="text-2xl font-bold">{localize('Réinitialisation', 'Reset password')}</CardTitle>
            <CardDescription>
              {localize('Définissez un nouveau mot de passe sécurisé', 'Set a new secure password')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!sessionChecked ? (
            <div className="text-center text-sm text-slate-600">{localize('Chargement...', 'Loading...')}</div>
          ) : hasSession ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{localize('Nouveau mot de passe', 'New password')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="********"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
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
                />
              </div>

              {message && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    message.includes('mis à jour')
                      ? 'text-green-700 bg-green-50'
                      : 'text-red-700 bg-red-50'
                  }`}
                >
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
                  localize('Confirmer', 'Confirm')
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center text-sm text-slate-600">
              <p>{localize('Le lien de réinitialisation est invalide ou expiré.', 'The reset link is invalid or expired.')}</p>
              <Link href="/forgot-password" className="text-blue-600 hover:underline font-medium">
                {localize('Demander un nouveau lien', 'Request a new link')}
              </Link>
            </div>
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
