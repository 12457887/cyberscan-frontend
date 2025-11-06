'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Loader2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
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
      setMessage(responseMessage || "Impossible d'envoyer le lien de réinitialisation.");
    } else {
      setMessage(responseMessage || "Un email de réinitialisation vient d'être envoyé. Consultez votre boîte de réception.");
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
            <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
            <CardDescription>Recevez un lien de réinitialisation par email</CardDescription>
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
                  Envoi en cours...
                </>
              ) : (
                'Envoyer le lien'
              )}
            </Button>
          </form>

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
