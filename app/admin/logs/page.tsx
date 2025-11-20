'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw } from 'lucide-react';

type ScanLog = {
  id?: string;
  user_id: string;
  user_name?: string | null;
  target_url: string;
  scan_mode: string;
  ip_address?: string | null;
  triggered_at: string;
  scan_id?: string | null;
};

export default function AdminLogsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });

  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      } else {
        loadLogs();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, profile?.role, limit]);

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (userFilter.trim()) {
      params.set('user_id', userFilter.trim());
    }
    if (search.trim()) {
      params.set('search', search.trim());
    }
    return params.toString();
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const query = buildQuery();
      const res = await fetch(`/api/admin/scan-logs${query ? `?${query}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || 'Erreur de récupération des logs');
      }

      const payload = await res.json();
      setLogs(payload.logs || []);
    } catch (err: any) {
      console.error('Erreur chargement logs:', err);
      setError(err.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadLogs();
  };

  const handleLimitChange = (value: string) => {
    const intValue = parseInt(value, 10);
    if (!Number.isNaN(intValue) && intValue > 0 && intValue <= 200) {
      setLimit(intValue);
    }
  };

  if (authLoading || (loading && logs.length === 0)) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement des logs...', 'Loading logs...')}</p>
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
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Logs des scans', 'Scan activity logs')}
            </h1>
            <p className="text-slate-600 mt-1">
              {localize('Visualisez chaque lancement de scan par utilisateur.', 'Review every scan launch per user.')}
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              className="w-24"
              placeholder="Limit"
            />
            <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Filtres', 'Filters')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium text-slate-600">{localize('Utilisateur', 'User')}</label>
              <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder="user_id" className="mt-2" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">{localize('URL contient', 'URL contains')}</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="https://example.com" className="mt-2" />
            </div>
            <div className="flex items-end">
              <Button onClick={loadLogs} className="w-full">
                {localize('Appliquer', 'Apply')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">{localize('Erreur :', 'Error:')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle>
              {localize('Historique des scans', 'Scan history')} ({logs.length})
            </CardTitle>
            {loading && <span className="text-sm text-slate-500">{localize('Mise à jour...', 'Refreshing...')}</span>}
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">{localize('Aucun log disponible.', 'No log available.')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{localize('Date', 'Date')}</TableHead>
                    <TableHead>{localize('Utilisateur', 'User')}</TableHead>
                    <TableHead>{localize('URL', 'URL')}</TableHead>
                    <TableHead>{localize('Mode', 'Mode')}</TableHead>
                    <TableHead>{localize('IP', 'IP')}</TableHead>
                    <TableHead>{localize('Scan ID', 'Scan ID')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={`${log.scan_id}-${log.triggered_at}-${log.user_id}`}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.triggered_at).toLocaleString(locale, {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {log.user_name || localize('Nom inconnu', 'Unknown name')}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{log.user_id}</div>
                      </TableCell>
                      <TableCell className="text-blue-600 underline break-words max-w-[280px]">
                        <a href={log.target_url} target="_blank" rel="noreferrer">
                          {log.target_url}
                        </a>
                      </TableCell>
                      <TableCell className="uppercase text-xs tracking-wide">{log.scan_mode}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ip_address || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{log.scan_id || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
