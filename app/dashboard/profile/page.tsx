'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { Loader2, User } from 'lucide-react';

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
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email);
    }
  }, [profile]);

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

    if (!newPassword || newPassword.length < 8) {
      setPasswordMessage({
        type: 'error',
        text: localize('Le mot de passe doit contenir au moins 8 caractères.', 'Password must be at least 8 characters long.'),
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

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordMessage({
        type: 'success',
        text: localize('Mot de passe mis à jour avec succès.', 'Password updated successfully.'),
      });
      setNewPassword('');
      setConfirmPassword('');
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
              <div className="space-y-2">
                <Label htmlFor="newPassword">{localize('Nouveau mot de passe', 'New password')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="********"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{localize('Confirmer le mot de passe', 'Confirm password')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="********"
                />
              </div>

              {passwordMessage && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    passwordMessage.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                  }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Mise à jour...', 'Updating...')}
                  </>
                ) : (
                  localize('Mettre à jour le mot de passe', 'Update password')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
