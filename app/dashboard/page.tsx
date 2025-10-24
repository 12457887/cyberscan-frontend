'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Credits, Scan, Alert, Vulnerability } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Activity, AlertTriangle, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<{ [key: string]: Vulnerability[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const [creditsRes, scansRes, alertsRes] = await Promise.all([
        supabase.from('credits').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('alerts').select('*').eq('user_id', user.id).eq('is_read', false).limit(5),
      ]);

      if (creditsRes.data) setCredits(creditsRes.data);
      if (scansRes.data) {
        setScans(scansRes.data);

        for (const scan of scansRes.data) {
          const { data: vulnData } = await supabase
            .from('vulnerabilities')
            .select('*')
            .eq('scan_id', scan.id);

          if (vulnData) {
            setVulnerabilities(prev => ({ ...prev, [scan.id]: vulnData }));
          }
        }
      }
      if (alertsRes.data) setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeScans = scans.filter(s => s.status === 'in_progress' || s.status === 'pending').length;
  const unreadAlerts = alerts.length;

  const getRiskColor = (risk: string | null) => {
    switch (risk) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-slate-500';
    }
  };

  const getRiskBadge = (risk: string | null) => {
    switch (risk) {
      case 'critical': return <Badge variant="destructive">Critique</Badge>;
      case 'high': return <Badge className="bg-orange-500">Élevé</Badge>;
      case 'medium': return <Badge className="bg-yellow-500 text-black">Moyen</Badge>;
      case 'low': return <Badge className="bg-green-500">Faible</Badge>;
      default: return <Badge variant="secondary">N/A</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-slate-600 mt-1">Bienvenue sur votre tableau de bord CyberScan</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crédits Restants</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{credits?.remaining_credits || 0}</div>
              <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{ width: `${credits ? (credits.remaining_credits / credits.total_credits) * 100 : 100}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-2">
                sur {credits?.total_credits || 50} crédits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scans en cours</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeScans}</div>
              <p className="text-xs text-slate-600 mt-2">
                scans actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{unreadAlerts}</div>
              <p className="text-xs text-slate-600 mt-2">
                non lues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{scans.length}</div>
              <p className="text-xs text-slate-600 mt-2">
                scans effectués
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Historique des scans</CardTitle>
              <CardDescription>Vos 5 derniers scans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scans.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">Aucun scan effectué</p>
                ) : (
                  scans.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{scan.site_name}</p>
                        <p className="text-xs text-slate-600">{new Date(scan.created_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                      <div className="text-right">
                        {getRiskBadge(scan.risk_level)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Répartition des vulnérabilités</CardTitle>
              <CardDescription>Derniers scans complétés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scans.filter(s => s.status === 'completed').length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">Aucune vulnérabilité à afficher</p>
                ) : (
                  scans.filter(s => s.status === 'completed').slice(0, 3).map((scan) => {
                    const vulns = vulnerabilities[scan.id] || [];
                    const critical = vulns.find(v => v.severity === 'critical')?.count || 0;
                    const high = vulns.find(v => v.severity === 'high')?.count || 0;
                    const medium = vulns.find(v => v.severity === 'medium')?.count || 0;
                    const low = vulns.find(v => v.severity === 'low')?.count || 0;

                    return (
                      <div key={scan.id} className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-medium text-sm mb-2">{scan.site_name}</p>
                        <div className="flex gap-2 text-xs">
                          {critical > 0 && <span className="text-red-600 font-medium">Critique: {critical}</span>}
                          {high > 0 && <span className="text-orange-600 font-medium">Élevé: {high}</span>}
                          {medium > 0 && <span className="text-yellow-600 font-medium">Moyen: {medium}</span>}
                          {low > 0 && <span className="text-green-600 font-medium">Faible: {low}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
