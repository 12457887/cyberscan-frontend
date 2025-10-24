'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase, Profile, Scan, Subscription } from '@/lib/supabase';
import { Users, Activity, CreditCard, TrendingUp } from 'lucide-react';

export default function AdminDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalScans: 0,
    activeSubscriptions: 0,
    recentScans: [] as Scan[],
    recentUsers: [] as Profile[],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadAdminData = async () => {
    try {
      setError(null);

      // Vérifier que l'utilisateur est bien authentifié
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session non trouvée. Veuillez vous reconnecter.');
        return;
      }

      console.log('Loading admin data for user:', session.user.id);
      console.log('User app_metadata:', session.user.app_metadata);
      console.log('User role from metadata:', session.user.app_metadata?.role);

      // Utiliser la fonction RPC pour obtenir les stats admin
      const { data: statsData, error: rpcError } = await supabase.rpc('get_admin_stats');

      if (rpcError) {
        console.error('RPC Error:', rpcError);
        setError(`Erreur lors du chargement des statistiques: ${rpcError.message}. Assurez-vous d'être connecté en tant qu'administrateur.`);
        return;
      }

      if (!statsData) {
        setError('Aucune donnée reçue de la base de données.');
        return;
      }

      console.log('Stats loaded successfully:', statsData);

      setStats({
        totalUsers: statsData.totalUsers || 0,
        totalScans: statsData.totalScans || 0,
        activeSubscriptions: statsData.activeSubscriptions || 0,
        recentScans: statsData.recentScans || [],
        recentUsers: statsData.recentUsers || [],
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError(`Erreur inattendue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Chargement...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Administration</h1>
          <p className="text-slate-600 mt-1">Vue d'ensemble de la plateforme</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">Erreur de chargement des données:</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs Total</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-slate-600 mt-2">utilisateurs inscrits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scans Total</CardTitle>
              <Activity className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalScans}</div>
              <p className="text-xs text-slate-600 mt-2">scans effectués</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnements Actifs</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
              <p className="text-xs text-slate-600 mt-2">abonnements actifs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux d'activité</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalUsers > 0 ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100) : 0}%
              </div>
              <p className="text-xs text-slate-600 mt-2">utilisateurs actifs</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs récents</CardTitle>
              <CardDescription>Les 5 dernières inscriptions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{user.full_name || 'Sans nom'}</p>
                      <p className="text-xs text-slate-600">{user.email}</p>
                    </div>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scans récents</CardTitle>
              <CardDescription>Les 10 derniers scans effectués</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{scan.site_name}</p>
                      <p className="text-xs text-slate-600">
                        {new Date(scan.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={
                        scan.status === 'completed' ? 'default' :
                        scan.status === 'failed' ? 'destructive' :
                        'secondary'
                      }>
                        {scan.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
