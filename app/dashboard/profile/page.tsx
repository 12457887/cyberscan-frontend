'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/lib/supabase';
import { PASSWORD_REQUIREMENTS_TEXT, validatePasswordStrength } from '@/lib/password';
import { Eye, EyeOff, Loader2, User } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email);
    }
  }, [profile]);

  const userEmail = user?.email || profile?.email || email;
  const isGoogleUser =
    user?.app_metadata?.provider === 'google' ||
    user?.identities?.some((id) => id.provider === 'google') ||
    false;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setProfileMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfileMessage({ type: 'success', text: localize('Profil mis à jour avec succès !', 'Profile updated successfully!') });
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileMessage({ type: 'error', text: localize('Erreur lors de la mise à jour du profil', 'Error updating profile') });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setPasswordMessage(null);

    if (!userEmail) {
      setPasswordMessage({
        type: 'error',
        text: localize('Email introuvable pour ce compte.', 'Unable to resolve your email address.'),
      });
      return;
    }

    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.valid) {
      const message = `Weak password. ${PASSWORD_REQUIREMENTS_TEXT}`;
      setPasswordMessage({
        type: 'error',
        text: localize(`Mot de passe faible. ${PASSWORD_REQUIREMENTS_TEXT}`, message),
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: 'error',
        text: localize('Les mots de passe ne correspondent pas.', 'Passwords do not match.'),
      });
      return;
    }

    if (!otpSent) {
      setPasswordLoading(true);
      try {
        // Utilisateur email/password : vérifier l'ancien mot de passe d'abord
        if (!isGoogleUser) {
          if (!oldPassword) {
            setPasswordMessage({
              type: 'error',
              text: localize('Ancien mot de passe requis.', 'Current password is required.'),
            });
            setPasswordLoading(false);
            return;
          }
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: oldPassword,
          });
          if (authError) {
            setPasswordMessage({
              type: 'error',
              text: localize('Ancien mot de passe incorrect.', 'Current password is incorrect.'),
            });
            setPasswordLoading(false);
            return;
          }
        }

        // Envoyer OTP de confirmation (pour les deux types)
        const response = await fetch('/service/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'password-change', email: userEmail }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          setPasswordMessage({
            type: 'error',
            text: payload?.error || localize("Impossible d'envoyer le code.", 'Unable to send the code.'),
          });
          return;
        }

        setOtpSent(true);
        setPasswordMessage({
          type: 'success',
          text:
            payload?.message ||
            localize(
              'Un code de confirmation a été envoyé à votre email.',
              'A confirmation code has been sent to your email.'
            ),
        });
      } catch (error) {
        console.error('Error sending password change code:', error);
        setPasswordMessage({
          type: 'error',
          text: localize("Impossible d'envoyer le code.", 'Unable to send the code.'),
        });
      } finally {
        setPasswordLoading(false);
      }
      return;
    }

    if (otp.length !== 6) {
      setPasswordMessage({
        type: 'error',
        text: localize('Code invalide ou incomplet.', 'Invalid or incomplete code.'),
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otp,
        type: 'recovery',
      });
      if (otpError) {
        setPasswordMessage({
          type: 'error',
          text: otpError.message || localize('Code invalide ou expiré.', 'Invalid or expired code.'),
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordMessage({
        type: 'success',
        text: localize('Mot de passe mis à jour avec succès.', 'Password updated successfully.'),
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setOtpSent(false);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordMessage({
        type: 'error',
        text: localize('Impossible de mettre à jour le mot de passe.', 'Unable to update password.'),
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{localize('Profil', 'Profile')}</h1>
          <p className="text-slate-600 mt-1">
            {localize('Gérez vos informations personnelles', 'Manage your personal information')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <CardTitle>{localize('Informations du compte', 'Account information')}</CardTitle>
                <CardDescription>
                  {localize('Mettez à jour vos informations personnelles', 'Update your personal details')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{localize('Nom complet', 'Full name')}</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={localize('Jean Dupont', 'John Doe')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-slate-50"
                />
                <p className="text-xs text-slate-500">{localize("L'email ne peut pas être modifié", 'Email cannot be changed')}</p>
              </div>

              {profileMessage && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    profileMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                  }`}
                >
                  {profileMessage.text}
                </div>
              )}

              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Enregistrement...', 'Saving...')}
                  </>
                ) : (
                  localize('Enregistrer les modifications', 'Save changes')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Mettre à jour le mot de passe', 'Update password')}</CardTitle>
            <CardDescription>
              {localize('Choisissez un nouveau mot de passe sécurisé', 'Choose a new secure password')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {isGoogleUser && (
                <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded-md">
                  {localize(
                    'Votre compte est connecté via Google. Vous pouvez définir un mot de passe pour vous connecter également par email.',
                    'Your account is linked to Google. You can set a password to also sign in with email.'
                  )}
                </div>
              )}

              {!isGoogleUser && (
              <div className="space-y-2">
                <Label htmlFor="oldPassword">{localize('Ancien mot de passe', 'Current password')}</Label>
                <div className="relative">
                  <Input
                    id="oldPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="********"
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPasswords
                      ? localize('Masquer le mot de passe', 'Hide password')
                      : localize('Afficher le mot de passe', 'Show password')}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword">{localize('Nouveau mot de passe', 'New password')}</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="********"
                    minLength={8}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPasswords
                      ? localize('Masquer le mot de passe', 'Hide password')
                      : localize('Afficher le mot de passe', 'Show password')}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{localize('Confirmer le mot de passe', 'Confirm password')}</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="********"
                    minLength={8}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPasswords
                      ? localize('Masquer le mot de passe', 'Hide password')
                      : localize('Afficher le mot de passe', 'Show password')}
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {otpSent && (
                <div className="space-y-2">
                  <Label>{localize('Code de confirmation', 'Confirmation code')}</Label>
                  <InputOTP maxLength={6} value={otp} onChange={setOtp} required>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((slot) => (
                        <InputOTPSlot key={slot} index={slot} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-xs text-slate-500">
                    {localize(
                      'Entrez le code envoyé par email pour confirmer le changement.',
                      'Enter the code sent by email to confirm the change.'
                    )}
                  </p>
                </div>
              )}

              {passwordMessage && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    passwordMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {localize('Mise à jour...', 'Updating...')}
                    </>
                  ) : otpSent ? (
                    localize('Confirmer le code', 'Confirm code')
                  ) : (
                    localize('Envoyer le code', 'Send confirmation code')
                  )}
                </Button>
                {otpSent && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={passwordLoading || !userEmail}
                    onClick={async () => {
                      setPasswordMessage(null);
                      if (!userEmail) {
                        setPasswordMessage({
                          type: 'error',
                          text: localize('Email introuvable pour ce compte.', 'Unable to resolve your email address.'),
                        });
                        return;
                      }
                      const response = await fetch('/service/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'password-change', email: userEmail }),
                      });
                      const payload = await response.json().catch(() => null);
                      if (!response.ok) {
                        setPasswordMessage({
                          type: 'error',
                          text: payload?.error || localize("Impossible d'envoyer le code.", 'Unable to send the code.'),
                        });
                        return;
                      }
                      setPasswordMessage({
                        type: 'success',
                        text:
                          payload?.message ||
                          localize(
                            'Un nouveau code de confirmation a été envoyé.',
                            'A new confirmation code has been sent.'
                          ),
                      });
                    }}
                  >
                    {localize('Renvoyer le code', 'Resend code')}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
