'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setStatus(null);
    setLoading(true);

    const { error, message: responseMessage } = await sendPasswordReset(email);
    setStatus(error ? 'error' : 'success');
    if (error) {
      setMessage(responseMessage || localize("Impossible d'envoyer le lien de réinitialisation.", 'Unable to send the reset link.'));
    } else {
      setMessage(
        responseMessage ||
          localize("Un email de réinitialisation vient d'être envoyé. Consultez votre boîte de réception.", 'A reset email has been sent. Check your inbox.')
      );
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
              {localize('Recevez un lien de réinitialisation par email', 'Receive a reset link via email')}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div
                className={`text-sm p-3 rounded-md ${
                  status === 'success'
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
                  {localize('Envoi en cours...', 'Sending...')}
                </>
              ) : (
                localize('Envoyer le lien', 'Send link')
              )}
            </Button>
          </form>

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
