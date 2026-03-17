'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, RefreshCw, Trash2, Search, ScrollText, Activity, Globe } from 'lucide-react';

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
  if (trimmed === '::1' || trimmed === '0:0:0:0:0:0:0:1' || trimmed === '127.0.0.1' || trimmed.startsWith('::ffff:127.0.0.1')) return true;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const renderModeBadge = (mode: string) => {
    const normalized = (mode || '').toLowerCase();
    const label = normalized ? normalized.toUpperCase() : '—';
    const color = {
      complete: 'bg-blue-100 text-blue-700 border-blue-200',
      light: 'bg-slate-100 text-slate-600 border-slate-200',
    }[normalized];
    return <Badge variant="outline" className={`text-xs font-semibold tracking-wide ${color ?? 'bg-slate-100 text-slate-600'}`}>{label}</Badge>;
  };

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
    if (userFilter.trim()) params.set('user_id', userFilter.trim());
    if (search.trim()) params.set('search', search.trim());
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
      if (typeof payload.total === 'number') setTotalScanLogs(payload.total);
      else if (typeof payload.count === 'number') setTotalScanLogs(payload.count);
      else if (Array.isArray(payload.logs)) setTotalScanLogs(payload.logs.length);
      setLogs(payload.logs || []);
    } catch (err: any) {
      console.error('Erreur chargement logs:', err);
      setError(err.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => { loadLogs(); };

  const handleLimitChange = (value: string) => {
    if (value === 'all') { setLimit('all'); return; }
    const intValue = parseInt(value, 10);
    if (!Number.isNaN(intValue) && intValue > 0) setLimit(intValue);
  };

  const handleDelete = async (log: ScanLog) => {
    const id = log.id;
    if (!id) return;
    if (!confirm(localize('Supprimer ce log ?', 'Delete this log?'))) return;
    setDeletingId(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch(`/service/admin/scan-logs/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== id));
        setTotalScanLogs(prev => (prev !== null ? prev - 1 : null));
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    const candidateIps = Array.from(
      new Set(logs.map((log) => (log.ip_address || '').trim()).filter((ip): ip is string => Boolean(ip)))
    ).filter((ip) => ipLocations[ip] === undefined);
    if (!candidateIps.length) return;
    let cancelled = false;
    (async () => {
      const localUpdates: Record<string, string | null> = {};
      const publicIps: string[] = [];
      for (const ip of candidateIps) {
        if (isPrivateOrLocalIp(ip)) localUpdates[ip] = LOCAL_IP_PLACEHOLDER;
        else publicIps.push(ip);
      }
      if (!cancelled && Object.keys(localUpdates).length) setIpLocations((prev) => ({ ...prev, ...localUpdates }));
      if (ipLocationServiceDown || !publicIps.length) return;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setIpLocationServiceDown(true); return; }
      const updates: Record<string, string | null> = {};
      for (const ip of publicIps) {
        try {
          const res = await fetch(`/service/admin?resource=ip-location&ip=${encodeURIComponent(ip)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (res.status === 503) { setIpLocationServiceDown(true); return; }
          if (!res.ok) { updates[ip] = null; continue; }
          const data = await res.json().catch(() => null);
          if (data?.code === 'local_ip') { updates[ip] = LOCAL_IP_PLACEHOLDER; continue; }
          updates[ip] = data?.country_name || data?.region_name || data?.city_name || null;
        } catch { updates[ip] = null; }
      }
      if (!cancelled && Object.keys(updates).length) setIpLocations((prev) => ({ ...prev, ...updates }));
    })();
    return () => { cancelled = true; };
  }, [logs, ipLocations, ipLocationServiceDown]);

  if (authLoading || (loading && logs.length === 0)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm">{localize('Chargement des logs…', 'Loading logs…')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (profile?.role !== 'admin') return null;

  const completeScanCount = logs.filter(l => (l.scan_mode || '').toLowerCase() === 'complete').length;
  const lightScanCount = logs.filter(l => (l.scan_mode || '').toLowerCase() === 'light').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm">
              <ScrollText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {localize('Logs des scans', 'Scan activity logs')}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {localize('Historique de chaque lancement de scan par utilisateur.', 'History of every scan launch per user.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <label htmlFor="log-limit" className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                {localize('Afficher', 'Show')}
              </label>
              <select
                id="log-limit"
                value={limit === 'all' ? 'all' : String(limit)}
                onChange={(e) => handleLimitChange(e.target.value)}
                className="bg-transparent text-sm text-slate-800 font-medium focus:outline-none cursor-pointer"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="all">{localize('Tout', 'All')}</option>
              </select>
            </div>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2 shadow-sm" disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: localize('Total logs', 'Total logs'), value: totalScanLogs ?? '—', icon: Activity, color: 'text-blue-600 bg-blue-50' },
            { label: localize('Affichés', 'Shown'), value: logs.length, icon: ScrollText, color: 'text-slate-600 bg-slate-100' },
            { label: localize('Scans complets', 'Complete scans'), value: completeScanCount, icon: Globe, color: 'text-indigo-600 bg-indigo-50' },
            { label: localize('Scans rapides', 'Light scans'), value: lightScanCount, icon: Activity, color: 'text-emerald-600 bg-emerald-50' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">{label}</span>
                <div className={`p-1.5 rounded-lg ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  placeholder={localize('Rechercher URL…', 'Search URL…')}
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                  placeholder={localize('Filtrer par user_id…', 'Filter by user_id…')}
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>
              <Button onClick={loadLogs} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                <Search className="w-4 h-4" />
                {localize('Appliquer', 'Apply')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-sm">{localize('Erreur', 'Error')}</p>
              <p className="text-sm mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Table */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-slate-100 bg-white">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800">
                {localize('Historique des scans', 'Scan history')}
              </CardTitle>
              <div className="flex items-center gap-2">
                {loading && (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <div className="w-3 h-3 border border-slate-300 border-t-blue-400 rounded-full animate-spin" />
                    {localize('Mise à jour…', 'Refreshing…')}
                  </span>
                )}
                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium">
                  {logs.length} {localize('entrées', 'entries')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ScrollText className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">{localize('Aucun log disponible.', 'No log available.')}</p>
              </div>
            ) : (
              <Table className="border-separate border-spacing-0 table-fixed">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[17%]" />
                  <col className="w-[20%]" />
                  <col className="w-[8%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    {[
                      localize('Date', 'Date'),
                      localize('Utilisateur', 'User'),
                      'URL',
                      localize('Mode', 'Mode'),
                      'IP',
                      localize('Localisation', 'Location'),
                      'Scan ID',
                      localize('Rapport', 'Report'),
                      '',
                    ].map((h, i) => (
                      <TableHead key={i} className={`px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 ${i >= 7 ? 'text-center' : ''}`}>
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={`${log.scan_id}-${log.triggered_at}-${log.user_id}`}
                      className="border-b border-slate-100 odd:bg-white even:bg-slate-50/30 hover:bg-blue-50/30 transition-colors group"
                    >
                      <TableCell className="px-3 py-3 whitespace-nowrap tabular-nums">
                        {(() => {
                          const date = new Date(log.triggered_at);
                          return (
                            <div className="flex flex-col leading-tight">
                              <span className="text-sm font-semibold text-slate-800">{formatDateDMY(date)}</span>
                              <span className="text-xs text-slate-500">
                                {date.toLocaleTimeString(locale, { timeStyle: 'short' })}
                              </span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-3 py-3">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {log.user_name || <span className="text-slate-400 italic">{localize('Inconnu', 'Unknown')}</span>}
                        </div>
                        <div className="text-xs text-slate-400 font-mono truncate mt-0.5">{log.user_id}</div>
                      </TableCell>
                      <TableCell className="px-3 py-3 truncate">
                        <a
                          href={normalizeDisplayUrl(log.target_url)}
                          target="_blank"
                          rel="noreferrer"
                          title={log.target_url}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline underline-offset-2 truncate block"
                        >
                          {normalizeDisplayUrl(log.target_url)}
                        </a>
                      </TableCell>
                      <TableCell className="px-3 py-3">{renderModeBadge(log.scan_mode)}</TableCell>
                      <TableCell className="px-3 py-3 font-mono text-xs text-slate-600 truncate">{log.ip_address || '—'}</TableCell>
                      <TableCell className="px-3 py-3 text-xs text-slate-600 truncate">
                        {(() => {
                          const trimmedIp = (log.ip_address || '').trim();
                          if (!trimmedIp) return '—';
                          if (ipLocationServiceDown) return localize('Indisponible', 'Unavailable');
                          const location = ipLocations[trimmedIp];
                          if (location === undefined) return <span className="text-slate-300">{localize('…', '…')}</span>;
                          if (location === LOCAL_IP_PLACEHOLDER) return <span className="text-slate-400">{localize('Local', 'Local')}</span>;
                          return location || '—';
                        })()}
                      </TableCell>
                      <TableCell className="px-3 py-3 font-mono text-xs text-slate-500 truncate" title={log.scan_id || '—'}>
                        {log.scan_id || '—'}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-center">
                        {log.scan_id ? (
                          <a
                            href={`/service/generate-report/${log.scan_id}?report_format=pdf`}
                            target="_blank"
                            rel="noreferrer"
                            title={localize('Télécharger le rapport', 'Download report')}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-center">
                        {log.id ? (
                          <button
                            onClick={() => handleDelete(log)}
                            disabled={deletingId === log.id}
                            title={localize('Supprimer ce log', 'Delete this log')}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : '—'}
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
