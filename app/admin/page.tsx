'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { Users, Activity, CreditCard, TrendingUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalScans: 0,
    activeSubscriptions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      // 2️⃣ Calcul des stats globales
      const totalUsers = usersData?.length || 0;
      const totalScans = (await supabase.from('scans').select('id')).data?.length || 0;
      const activeSubscriptions = usersData?.filter(u => u.status === 'active').length || 0;

      setStats({ totalUsers, totalScans, activeSubscriptions });

    } catch (err: any) {
      console.error('Erreur chargement données admin:', err);
      setError(err.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  // 🗑️ Suppression utilisateur
const handleDeleteUser = async (userId: string) => {
  if (!confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) return;

  const token = (await supabase.auth.getSession()).data.session?.access_token;

  const res = await fetch("/api/admin/delete-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert("❌ Erreur : " + (data.detail || data.error || "échec"));
    return;
  }
  alert("✅ Utilisateur supprimé !");
  loadAdminData();
};



  // 🌀 État de chargement
  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Chargement...</p>
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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-600 mt-1">Vue d'ensemble de la plateforme</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Erreur :</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* 📊 Statistiques principales */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-slate-600 mt-2">total inscrits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Scans Total</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScans}</div>
              <p className="text-xs text-slate-600 mt-2">scans effectués</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Abonnements Actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-slate-600 mt-2">abonnements actifs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Taux d'activité</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUsers > 0
                  ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-slate-600 mt-2">utilisateurs actifs</p>
            </CardContent>
          </Card>
        </div>

        {/* 👥 Liste des utilisateurs */}
        <Card>
          <CardHeader>
            <CardTitle>Utilisateurs</CardTitle>
            <CardDescription>Liste complète avec crédits et abonnements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Rôle</th>
                    <th className="p-2 text-left">Crédits restants</th>
                    <th className="p-2 text-left">Abonnement</th>
                    <th className="p-2 text-left">Expiration</th>
                    <th className="p-2 text-left">Action</th>
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
                            {u.role || 'user'}
                          </Badge>
                        </td>
                        <td className="p-2">{u.remaining_credits ?? 0}</td>
                        <td className="p-2 capitalize">{u.plan_type || '—'}</td>
                        <td className="p-2">
                          {u.expires_at
                            ? new Date(u.expires_at).toLocaleDateString('fr-FR')
                            : '—'}
                        </td>
                        <td className="p-2">
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
