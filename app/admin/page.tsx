'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import {
  Users,
  Activity,
  CreditCard,
  TrendingUp,
  ShieldAlert,
  Trash2,
  Plus,
  Inbox,
  ScrollText,
  Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  remaining_credits?: number;
  plan_type?: string;
  status?: string;
  expires_at?: string;
  created_at?: string;
}

interface OnlineUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  plan_type?: string;
  last_seen_at?: string;
}

interface ContactMessage {
  id: string;
  full_name: string | null;
  email: string;
  message: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${formatDateDMY(date)} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`;
  };
  const statusLabels = useMemo(
    () =>
      choose({
        fr: { admin: 'Admin', client: 'Client' },
        en: { admin: 'Admin', client: 'Client' },
      }),
    [choose]
  );
  const loadingText = localize('Chargement...', 'Loading...');
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineLastRefresh, setOnlineLastRefresh] = useState<Date | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalScans: 0,
    totalFreeScans: 0,
    totalScanLogs: 0,
    totalVulnerabilities: 0,
    activeSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditUserId, setCreditUserId] = useState('');
  const [creditAmount, setCreditAmount] = useState('10');
  const [creditFeedback, setCreditFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  // Créer un utilisateur
  const [newUserForm, setNewUserForm] = useState({ email: '', password: '', full_name: '', plan: 'free', credits: '' });
  const [newUserFeedback, setNewUserFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newUserLoading, setNewUserLoading] = useState(false);
  // 🔐 Vérification du rôle admin
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      } else {
        loadAdminData();
      }
    }
  }, [user, profile, authLoading, router]);

  const fetchOnlineUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    try {
      const res = await fetch('/service/admin/online-users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineUsers(Array.isArray(data) ? data : []);
      }
    } catch {}
    setOnlineLastRefresh(new Date());
  };

  useEffect(() => {
    if (profile?.role !== 'admin') return;
    const interval = setInterval(fetchOnlineUsers, 30 * 1000);
    return () => clearInterval(interval);
  }, [profile]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10 * 1000);
    return () => clearInterval(tick);
  }, []);

  // 🚀 Chargement des données
  const loadAdminData = async () => {
    try {
      setError(null);
      setLoading(true);

      // Récupération session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session non trouvée. Veuillez vous reconnecter.');
        return;
      }

      console.log('Chargement des données admin pour :', session.user.email);

      // 1️⃣ Charger les infos depuis la vue SQL admin_user_view
      const { data: usersData, error: usersError } = await supabase
        .from('admin_user_view')
        .select('*');

      if (usersError) throw usersError;

      setUsers(usersData || []);

      await fetchOnlineUsers();

      // 2️⃣ Calcul des stats globales
      const totalUsers = usersData?.length || 0;

      const { count: totalScansCount, error: scansCountError } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true });
      if (scansCountError) throw scansCountError;

      const { count: totalFreeScansCount, error: freeScansCountError } = await supabase
        .from('free_scans')
        .select('id', { count: 'exact', head: true });
      if (freeScansCountError) throw freeScansCountError;

      let totalScanLogsCount = 0;
      try {
        const logsRes = await fetch('/service/admin/scan-logs?limit=1&include_total=true', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        });
        if (logsRes.ok) {
          const logsPayload = await logsRes.json().catch(() => null);
          if (typeof logsPayload?.total === 'number') {
            totalScanLogsCount = logsPayload.total;
          } else if (typeof logsPayload?.count === 'number') {
            totalScanLogsCount = logsPayload.count;
          }
        }
      } catch {
        totalScanLogsCount = 0;
      }

      const { data: vulnerabilitiesData, error: vulnerabilitiesError } = await supabase
        .from('vulnerabilities')
        .select('count');
      if (vulnerabilitiesError) throw vulnerabilitiesError;
      const totalVulnerabilities =
        vulnerabilitiesData?.reduce((sum, entry) => sum + (entry?.count || 0), 0) || 0;

      const activeSubscriptions = usersData?.filter(u => u.status === 'active').length || 0;

      setStats({
        totalUsers,
        totalScans: totalScansCount || 0,
        totalFreeScans: totalFreeScansCount || 0,
        totalScanLogs: totalScanLogsCount || 0,
        totalVulnerabilities,
        activeSubscriptions,
      });

      const { data: contactData, error: contactError } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (contactError) throw contactError;
      setContactMessages(contactData ?? []);

    } catch (err: any) {
      console.error('Erreur chargement données admin:', err);
      setError(err.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ Suppression utilisateur
const handleDeleteUser = async (userId: string) => {
  if (!confirm(localize('Voulez-vous vraiment supprimer cet utilisateur ?', 'Are you sure you want to delete this user?'))) return;

  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const res = await fetch("/service/admin/delete-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert('❌ ' + localize('Erreur : ', 'Error: ') + (data.detail || data.error || localize('échec', 'failed')));
    return;
  }
  alert('✅ ' + localize('Utilisateur supprimé !', 'User deleted!'));
  setUsers(prev => prev.filter(u => u.id !== userId));
  loadAdminData();
};

  const handleCreateUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setNewUserFeedback(null);
    if (!newUserForm.email || !newUserForm.password) {
      setNewUserFeedback({ type: 'error', message: localize('Email et mot de passe requis.', 'Email and password are required.') });
      return;
    }
    try {
      setNewUserLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/service/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          email: newUserForm.email,
          password: newUserForm.password,
          full_name: newUserForm.full_name,
          plan: newUserForm.plan,
          credits: newUserForm.credits ? Number(newUserForm.credits) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || localize('Erreur serveur', 'Server error'));
      setNewUserFeedback({ type: 'success', message: localize(`Compte créé : ${data.email} (plan ${data.plan}, ${data.credits} crédits)`, `Account created: ${data.email} (plan ${data.plan}, ${data.credits} credits)`) });
      setNewUserForm({ email: '', password: '', full_name: '', plan: 'free', credits: '' });
      loadAdminData();
    } catch (err: unknown) {
      setNewUserFeedback({ type: 'error', message: err instanceof Error ? err.message : localize('Erreur inconnue', 'Unknown error') });
    } finally {
      setNewUserLoading(false);
    }
  };

  const handleCreditSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreditFeedback(null);
    const amountValue = Number(creditAmount);
    if (!creditUserId || !Number.isFinite(amountValue) || amountValue <= 0) {
      setCreditFeedback({
        type: 'error',
        message: localize('Sélectionnez un utilisateur et un montant valide.', 'Select a user and a valid amount.'),
      });
      return;
    }

    try {
      setCreditLoading(true);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error(localize('Session expirée, reconnectez-vous.', 'Session expired, please log in again.'));
      }

      const res = await fetch('/service/admin/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: creditUserId, amount: amountValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || localize('Impossible de mettre à jour les crédits.', 'Unable to update credits.'));
      }

      setCreditFeedback({
        type: 'success',
        message: localize('Crédits ajoutés avec succès.', 'Credits added successfully.'),
      });
      setCreditAmount('10');
      setCreditUserId('');
      loadAdminData();
    } catch (err: any) {
      console.error('Erreur ajout crédits:', err);
      setCreditFeedback({
        type: 'error',
        message: err?.message || localize('Une erreur est survenue.', 'An error occurred.'),
      });
    } finally {
      setCreditLoading(false);
    }
  };

  // 🌀 État de chargement
  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{loadingText}</p>
        </div>
      </DashboardLayout>
    );
  }

  // 🔒 Si pas admin
  if (profile?.role !== 'admin') return null;

  // ✅ Interface admin
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{localize('Administration', 'Administration')}</h1>
            <p className="text-slate-600 mt-1">{localize("Vue d'ensemble de la plateforme", 'Platform overview')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild variant="outline">
              <Link href="/admin/logs">{localize('Voir les logs de scans', 'View scan logs')}</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/free-scans">
                {localize('Gérer les scans gratuits', 'Manage free scans')}
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">{localize('Erreur :', 'Error:')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* 📊 Statistiques principales */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize('Utilisateurs', 'Users')}</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-slate-600 mt-2">{localize('total inscrits', 'total registered')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize('Scans Total', 'Total scans')}</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScans}</div>
              <p className="text-xs text-slate-600 mt-2">{localize('scans effectués', 'scans run')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize('Scans gratuits', 'Free scans')}</CardTitle>
              <Inbox className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFreeScans}</div>
              <p className="text-xs text-slate-600 mt-2">{localize('formulaires soumis', 'forms submitted')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize('Logs de scans', 'Scan logs')}</CardTitle>
              <ScrollText className="h-4 w-4 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScanLogs}</div>
              <p className="text-xs text-slate-600 mt-2">{localize('entrées journalisées', 'log entries')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {localize('Vulnérabilités détectées', 'Vulnerabilities detected')}
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalVulnerabilities}</div>
              <p className="text-xs text-slate-600 mt-2">
                {localize('vulnérabilités cumulées', 'total vulnerabilities logged')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize('Abonnements Actifs', 'Active subscriptions')}</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-slate-600 mt-2">{localize('abonnements actifs', 'active plans')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{localize("Taux d'activité", 'Activity rate')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUsers > 0
                  ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-slate-600 mt-2">{localize('utilisateurs actifs', 'active users')}</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-800">{localize('En ligne', 'Online now')}</CardTitle>
              <Wifi className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{onlineUsers.length}</div>
              <p className="text-xs text-green-600 mt-2">{localize('actifs (5 min)', 'active (5 min)')}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />{localize('Créer un compte utilisateur', 'Create user account')}</CardTitle>
            <CardDescription>{localize('Créez un compte manuellement et assignez un plan et des crédits.', 'Manually create an account and assign a plan and credits.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-slate-600">{localize('Email *', 'Email *')}</label>
                <Input type="email" className="mt-1" value={newUserForm.email} onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">{localize('Mot de passe *', 'Password *')}</label>
                <Input type="password" className="mt-1" value={newUserForm.password} onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))} required />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">{localize('Nom complet', 'Full name')}</label>
                <Input type="text" className="mt-1" value={newUserForm.full_name} onChange={(e) => setNewUserForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">{localize('Plan', 'Plan')}</label>
                <select className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" value={newUserForm.plan} onChange={(e) => setNewUserForm((f) => ({ ...f, plan: e.target.value }))}>
                  {['free', 'basic', 'pro', 'enterprise'].map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-600">{localize('Crédits (optionnel)', 'Credits (optional)')}</label>
                <Input type="number" min={1} className="mt-1" placeholder={localize('Par défaut selon le plan', 'Default by plan')} value={newUserForm.credits} onChange={(e) => setNewUserForm((f) => ({ ...f, credits: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={newUserLoading} className="w-full bg-green-600 hover:bg-green-700">
                  {newUserLoading ? localize('Création...', 'Creating...') : localize('Créer le compte', 'Create account')}
                </Button>
              </div>
            </form>
            {newUserFeedback && (
              <p className={`mt-3 text-sm ${newUserFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {newUserFeedback.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Ajouter des crédits', 'Add credits')}</CardTitle>
            <CardDescription>
              {localize(
                'Sélectionnez un utilisateur pour lui attribuer des crédits supplémentaires.',
                'Select a user to grant additional credits.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreditSubmit} className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="text-sm font-medium text-slate-600">{localize('Utilisateur', 'User')}</label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={creditUserId}
                  onChange={(event) => setCreditUserId(event.target.value)}
                >
                  <option value="">{localize('Choisir...', 'Select...')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="text-sm font-medium text-slate-600">{localize('Montant', 'Amount')}</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={creditAmount}
                  onChange={(event) => setCreditAmount(event.target.value)}
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button type="submit" disabled={creditLoading} className="w-full">
                  {creditLoading ? localize('En cours...', 'Processing...') : localize('Ajouter les crédits', 'Add credits')}
                </Button>
              </div>
            </form>
            {creditFeedback && (
              <p
                className={`mt-3 text-sm ${
                  creditFeedback.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {creditFeedback.message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Messages de contact', 'Contact messages')}</CardTitle>
            <CardDescription>
              {localize('Derniers messages envoyés via le formulaire public', 'Latest messages from the public form')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contactMessages.length === 0 ? (
              <p className="text-sm text-slate-500">
                {localize('Aucun message reçu pour le moment.', 'No contact messages yet.')}
              </p>
            ) : (
              <div className="space-y-4">
                {contactMessages.map((message) => (
                  <div key={message.id} className="border border-slate-200 rounded-lg p-3 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between text-xs text-slate-500">
                      <span>{message.full_name || message.email}</span>
                      <span>
                        {formatDateTime(message.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-900 mt-2 whitespace-pre-line">{message.message}</p>
                    <p className="text-xs text-slate-500 mt-1">{message.email}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 🟢 Utilisateurs en ligne */}
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Wifi className="w-4 h-4 text-green-600" />
              {localize('Utilisateurs en ligne', 'Online users')}
              <span className="ml-1 text-sm font-normal text-green-600">
                ({localize('actifs dans les 5 dernières minutes', 'active in the last 5 minutes')})
              </span>
              {onlineLastRefresh && (
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {localize('Mis à jour', 'Updated')} {onlineLastRefresh.toLocaleTimeString()}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-slate-500">{localize('Aucun utilisateur actif en ce moment.', 'No users active right now.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-green-100 rounded-lg">
                  <thead className="bg-green-50 text-green-800">
                    <tr>
                      <th className="p-2 text-left">{localize('Nom', 'Name')}</th>
                      <th className="p-2 text-left">Email</th>
                      <th className="p-2 text-left">{localize('Rôle', 'Role')}</th>
                      <th className="p-2 text-left">{localize('Dernière activité', 'Last seen')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineUsers.map((u) => {
                      const raw = u.last_seen_at ?? '';
                      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
                      const utc = normalized && !normalized.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(normalized) ? normalized + 'Z' : normalized;
                      const lastSeen = utc ? new Date(utc) : null;
                      const secondsAgo = lastSeen ? Math.floor((now - lastSeen.getTime()) / 1000) : null;
                      const lastSeenLabel = secondsAgo === null
                        ? '—'
                        : secondsAgo < 60
                        ? localize(`Il y a ${secondsAgo}s`, `${secondsAgo}s ago`)
                        : localize(`Il y a ${Math.floor(secondsAgo / 60)}min`, `${Math.floor(secondsAgo / 60)}min ago`);
                      return (
                        <tr key={u.id} className="border-t hover:bg-green-50">
                          <td className="p-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
                            {u.full_name || '—'}
                          </td>
                          <td className="p-2">{u.email}</td>
                          <td className="p-2">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role || 'client'}
                            </Badge>
                          </td>
                          <td className="p-2 text-green-700 font-medium">{lastSeenLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 👥 Liste des utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle>{localize('Utilisateurs', 'Users')}</CardTitle>
            <CardDescription>
              {localize('Liste complète avec crédits et abonnements', 'Full list with credits and subscriptions')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">{localize('Nom', 'Name')}</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">{localize('Rôle', 'Role')}</th>
                    <th className="p-2 text-left">{localize('Crédits restants', 'Remaining credits')}</th>
                    <th className="p-2 text-left">{localize('Abonnement', 'Plan')}</th>
                    <th className="p-2 text-left">{localize('Expiration', 'Expiration')}</th>
                    <th className="p-2 text-left">{localize('Action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length > 0 ? (
                    users.map((u) => (
                      <tr key={u.id} className="border-t hover:bg-slate-50">
                        <td className="p-2">{u.full_name || '—'}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                            {u.role ? statusLabels[u.role as keyof typeof statusLabels] ?? u.role : 'user'}
                          </Badge>
                        </td>
                        <td className="p-2">{u.remaining_credits ?? 0}</td>
                        <td className="p-2 capitalize">{u.plan_type || '—'}</td>
                        <td className="p-2">
                          {u.expires_at
                            ? formatDateDMY(u.expires_at)
                            : '—'}
                        </td>
                        <td className="p-2 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCreditUserId(u.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(u.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="text-center text-slate-500 p-4">
                        Aucun utilisateur trouvé
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
