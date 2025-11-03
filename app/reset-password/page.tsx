'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
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
      setMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage('Impossible de mettre à jour le mot de passe.');
    } else {
      setMessage('Mot de passe mis à jour. Vous pouvez maintenant vous connecter.');
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
            <CardTitle className="text-2xl font-bold">Réinitialisation</CardTitle>
            <CardDescription>Définissez un nouveau mot de passe sécurisé</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!sessionChecked ? (
            <div className="text-center text-sm text-slate-600">Chargement...</div>
          ) : hasSession ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
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
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
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
                    Mise à jour...
                  </>
                ) : (
                  'Confirmer'
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center text-sm text-slate-600">
              <p>Le lien de réinitialisation est invalide ou expiré.</p>
              <Link href="/forgot-password" className="text-blue-600 hover:underline font-medium">
                Demander un nouveau lien
              </Link>
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              Retour à la connexion
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
