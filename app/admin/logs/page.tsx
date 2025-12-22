'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, RefreshCw } from 'lucide-react';

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

const LOCAL_IP_PLACEHOLDER = '__LOCAL_IP__';
const normalizeDisplayUrl = (value: string): string => {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return value;
  }
};
const isPrivateOrLocalIp = (ip: string): boolean => {
  const trimmed = ip.trim().toLowerCase();
  if (!trimmed) return true;

  if (
    trimmed === '::1' ||
    trimmed === '0:0:0:0:0:0:0:1' ||
    trimmed === '127.0.0.1' ||
    trimmed.startsWith('::ffff:127.0.0.1')
  ) {
    return true;
  }

  if (!trimmed.includes(':')) {
    if (trimmed.startsWith('10.')) return true;
    if (trimmed.startsWith('192.168.')) return true;
    if (trimmed.startsWith('169.254.')) return true;
    if (trimmed.startsWith('127.')) return true;
    if (trimmed.startsWith('172.')) {
      const parts = trimmed.split('.');
      const second = Number(parts[1] || 0);
      if (second >= 16 && second <= 31) return true;
    }
    return false;
  }

  return (
    trimmed.startsWith('fc') ||
    trimmed.startsWith('fd') ||
    trimmed.startsWith('fe80::') ||
    trimmed.startsWith('::ffff:10.') ||
    trimmed.startsWith('::ffff:192.168.') ||
    trimmed.startsWith('::ffff:172.')
  );
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
  const [limit, setLimit] = useState<number | 'all'>(50);
  const [totalScanLogs, setTotalScanLogs] = useState<number | null>(null);
  const [ipLocations, setIpLocations] = useState<Record<string, string | null>>({});
  const [ipLocationServiceDown, setIpLocationServiceDown] = useState(false);

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
    params.set('limit', limit === 'all' ? 'all' : String(limit));
    params.set('include_total', 'true');
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
      const res = await fetch(`/service/admin/scan-logs${query ? `?${query}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || payload.error || 'Erreur de récupération des logs');
      }

      const payload = await res.json();
      if (typeof payload.total === 'number') {
        setTotalScanLogs(payload.total);
      } else if (typeof payload.count === 'number') {
        setTotalScanLogs(payload.count);
      } else if (Array.isArray(payload.logs)) {
        setTotalScanLogs(payload.logs.length);
      }
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
    if (value === 'all') {
      setLimit('all');
      return;
    }
    const intValue = parseInt(value, 10);
    if (!Number.isNaN(intValue) && intValue > 0) {
      setLimit(intValue);
    }
  };

  useEffect(() => {
    const candidateIps = Array.from(
      new Set(
        logs
          .map((log) => (log.ip_address || '').trim())
          .filter((ip): ip is string => Boolean(ip))
      )
    ).filter((ip) => ipLocations[ip] === undefined);

    if (!candidateIps.length) {
      return;
    }

    let cancelled = false;

    (async () => {
      const localUpdates: Record<string, string | null> = {};
      const publicIps: string[] = [];

      for (const ip of candidateIps) {
        if (isPrivateOrLocalIp(ip)) {
          localUpdates[ip] = LOCAL_IP_PLACEHOLDER;
        } else {
          publicIps.push(ip);
        }
      }

      if (!cancelled && Object.keys(localUpdates).length) {
        setIpLocations((prev) => ({ ...prev, ...localUpdates }));
      }

      if (ipLocationServiceDown || !publicIps.length) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setIpLocationServiceDown(true);
        return;
      }

      const updates: Record<string, string | null> = {};
      for (const ip of publicIps) {
        try {
          const res = await fetch(
            `/service/admin?resource=ip-location&ip=${encodeURIComponent(ip)}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            }
          );

          if (res.status === 503) {
            setIpLocationServiceDown(true);
            return;
          }

          if (!res.ok) {
            updates[ip] = null;
            continue;
          }

          const data = await res.json().catch(() => null);
          if (data?.code === 'local_ip') {
            updates[ip] = LOCAL_IP_PLACEHOLDER;
            continue;
          }
          updates[ip] =
            data?.country_name || data?.region_name || data?.city_name || null;
        } catch {
          updates[ip] = null;
        }
      }

      if (!cancelled && Object.keys(updates).length) {
        setIpLocations((prev) => ({ ...prev, ...updates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [logs, ipLocations, ipLocationServiceDown]);

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
            <div className="flex items-center gap-2 border border-slate-200 rounded-md px-3">
              <label htmlFor="log-limit" className="text-xs text-slate-500 uppercase tracking-wide">
                {localize('Limite', 'Limit')}
              </label>
              <select
                id="log-limit"
                value={limit === 'all' ? 'all' : String(limit)}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="bg-transparent text-sm text-slate-900 focus:outline-none"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="all">{localize('Tout', 'All')}</option>
              </select>
            </div>
            <Button onClick={handleRefresh} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{localize('Filtres', 'Filters')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3 pt-2">
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
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {totalScanLogs !== null && (
                <span>
                  {localize('Total :', 'Total:')}{' '}
                  <span className="font-semibold text-slate-700">{totalScanLogs}</span>
                </span>
              )}
              {loading && <span>{localize('Mise à jour...', 'Refreshing...')}</span>}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">{localize('Aucun log disponible.', 'No log available.')}</p>
            ) : (
              <Table className="border-separate border-spacing-0">
                <TableHeader className="bg-gradient-to-r from-slate-50 via-white to-slate-50 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>{localize('Date', 'Date')}</TableHead>
                    <TableHead>{localize('Utilisateur', 'User')}</TableHead>
                    <TableHead>{localize('URL', 'URL')}</TableHead>
                    <TableHead>{localize('Mode', 'Mode')}</TableHead>
                    <TableHead>{localize('IP', 'IP')}</TableHead>
                    <TableHead>{localize('Localisation', 'Location')}</TableHead>
                    <TableHead>{localize('Scan ID', 'Scan ID')}</TableHead>
                    <TableHead>{localize('Rapport', 'Report')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                    <TableRow
                      key={`${log.scan_id}-${log.triggered_at}-${log.user_id}`}
                      className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 hover:bg-slate-100/60 transition-colors"
                    >
                      <TableCell className="whitespace-nowrap tabular-nums text-slate-600">
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
                        {(() => {
                          const displayUrl = normalizeDisplayUrl(log.target_url);
                          return (
                            <a href={displayUrl} target="_blank" rel="noreferrer">
                              {displayUrl}
                            </a>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="uppercase text-xs tracking-wide text-slate-700">{log.scan_mode}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-700">{log.ip_address || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {(() => {
                          const trimmedIp = (log.ip_address || '').trim();
                          if (!trimmedIp) {
                            return '—';
                          }
                          if (ipLocationServiceDown) {
                            return localize('Indisponible', 'Unavailable');
                          }
                          const location = ipLocations[trimmedIp];
                          if (location === undefined) {
                            return localize('Recherche...', 'Fetching...');
                          }
                          if (location === LOCAL_IP_PLACEHOLDER) {
                            return localize('Réseau local', 'Local network');
                          }
                          return location || localize('Inconnue', 'Unknown');
                        })()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.scan_id || '—'}</TableCell>
                      <TableCell>
                        {log.scan_id ? (
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/service/generate-report/${log.scan_id}?report_format=pdf`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              {localize('Télécharger', 'Download')}
                            </a>
                          </Button>
                        ) : (
                          '—'
                        )}
                      </TableCell>
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
