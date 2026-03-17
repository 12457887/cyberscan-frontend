'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateDMY } from '@/lib/date';
import Link from 'next/link';
import { Download, Loader2, RefreshCcw, Search, Zap, Mail, ShieldAlert, Globe } from 'lucide-react';

interface FreeScanEntry {
  id: string;
  url: string;
  email: string | null;
  ip_address?: string | null;
  scan_id?: string | null;
  mongo_report_id?: string | null;
  cms_label: string | null;
  risk_level: string | null;
  analyzer_domain?: string | null;
  severity_counts?: Record<string, number> | null;
  created_at: string;
}

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
    trimmed.startsWith('fc') || trimmed.startsWith('fd') || trimmed.startsWith('fe80::') ||
    trimmed.startsWith('::ffff:10.') || trimmed.startsWith('::ffff:192.168.') || trimmed.startsWith('::ffff:172.')
  );
};
const severityLetter = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const lookup: Record<string, string> = { critical: 'C', high: 'H', medium: 'M', low: 'L' };
  return lookup[normalized] ?? normalized.slice(0, 1).toUpperCase();
};

export default function FreeScansAdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const riskLabels = useMemo(
    () => choose({
      fr: { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' },
      en: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
    }),
    [choose]
  );

  const [scans, setScans] = useState<FreeScanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [cmsFilter, setCmsFilter] = useState('all');
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [limit, setLimit] = useState(100);
  const [totalFreeScans, setTotalFreeScans] = useState<number | null>(null);
  const [ipLocations, setIpLocations] = useState<Record<string, string | null>>({});
  const [ipLocationServiceDown, setIpLocationServiceDown] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push('/login');
      else if (profile?.role !== 'admin') router.push('/dashboard');
      else void loadFreeScans();
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') void loadFreeScans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const loadFreeScans = async () => {
    try {
      setLoading(true);
      setError(null);
      const { count: totalCount } = await supabase.from('free_scans').select('id', { count: 'exact', head: true });
      setTotalFreeScans(totalCount ?? 0);
      let query = supabase.from('free_scans').select('*').order('created_at', { ascending: false });
      if (limit > 0) query = query.limit(limit);
      const { data, error: supabaseError } = await query;
      if (supabaseError) throw supabaseError;
      setScans(data ?? []);
    } catch (err: any) {
      console.error('Free scans load error:', err);
      setError(err?.message || localize('Impossible de charger les scans.', 'Unable to load the scans.'));
    } finally {
      setLoading(false);
    }
  };

  const cmsOptions = useMemo(() => {
    const values = new Set<string>();
    scans.forEach((scan) => { if (scan.cms_label) values.add(scan.cms_label.toLowerCase()); });
    return Array.from(values).sort();
  }, [scans]);

  useEffect(() => {
    const candidateIps = Array.from(
      new Set(scans.map((scan) => (scan.ip_address || '').trim()).filter((ip): ip is string => Boolean(ip)))
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
            headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
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
  }, [scans, ipLocations, ipLocationServiceDown]);

  const filteredScans = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return scans.filter((scan) => {
      const matchesTerm = !term || [scan.url, scan.email, scan.analyzer_domain].filter(Boolean).some((value) => value && value.toLowerCase().includes(term));
      const normalizedRisk = (scan.risk_level || '').toLowerCase();
      const matchesRisk = riskFilter === 'all' || normalizedRisk === riskFilter;
      const normalizedCms = (scan.cms_label || '').toLowerCase();
      const matchesCms = cmsFilter === 'all' || normalizedCms === cmsFilter;
      const matchesEmail = !onlyWithEmail || Boolean(scan.email);
      return matchesTerm && matchesRisk && matchesCms && matchesEmail;
    });
  }, [scans, searchTerm, riskFilter, cmsFilter, onlyWithEmail]);

  const renderRiskBadge = (risk?: string | null) => {
    if (!risk) return <span className="text-slate-300 text-sm">—</span>;
    const normalized = risk.toLowerCase() as keyof typeof riskLabels;
    const fullLabel = riskLabels[normalized] || risk;
    const configs: Record<string, string> = {
      critical: 'bg-red-100 text-red-700 border-red-200',
      high: 'bg-orange-100 text-orange-700 border-orange-200',
      medium: 'bg-amber-50 text-amber-700 border-amber-200',
      low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    return (
      <Badge variant="outline" className={`text-xs font-bold px-2 ${configs[normalized] ?? 'bg-slate-100 text-slate-600'}`} title={fullLabel}>
        {severityLetter(normalized)}
      </Badge>
    );
  };

  const renderSeverityCounts = (counts: Record<string, number> | null | undefined) => {
    if (!counts) return <span className="text-slate-300 text-sm">—</span>;
    const order = ['critical', 'high', 'medium', 'low'] as const;
    const colors: Record<string, string> = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-amber-600',
      low: 'text-emerald-600',
    };
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {order.map((sev) => {
          const val = counts[sev] ?? 0;
          if (val === 0) return null;
          return (
            <span key={sev} className={`text-xs font-semibold ${colors[sev]}`}>
              {severityLetter(sev)}<span className="text-slate-500 font-normal">:{val}</span>
            </span>
          );
        })}
      </div>
    );
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="w-7 h-7 animate-spin" />
          <p className="text-sm">{localize('Chargement des scans gratuits…', 'Loading free scans…')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (profile?.role !== 'admin') return null;

  const withEmail = filteredScans.filter(s => s.email).length;
  const criticalCount = filteredScans.filter(s => (s.risk_level || '').toLowerCase() === 'critical').length;
  const highCount = filteredScans.filter(s => (s.risk_level || '').toLowerCase() === 'high').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 rounded-xl shadow-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {localize('Scans gratuits collectés', 'Collected free scans')}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {localize('Scans instantanés soumis via le formulaire public.', 'Instant scans submitted through the public form.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <label htmlFor="free-scan-limit" className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                {localize('Afficher', 'Show')}
              </label>
              <select
                id="free-scan-limit"
                value={String(limit)}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="bg-transparent text-sm text-slate-800 font-medium focus:outline-none cursor-pointer"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            <Button asChild variant="outline" size="sm" className="shadow-sm">
              <Link href="/admin">{localize('← Admin', '← Admin')}</Link>
            </Button>
            <Button onClick={loadFreeScans} variant="outline" size="sm" className="gap-2 shadow-sm">
              <RefreshCcw className="w-3.5 h-3.5" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: localize('Total base', 'Total in DB'), value: totalFreeScans ?? '—', icon: Globe, color: 'text-blue-600 bg-blue-50' },
            { label: localize('Avec email', 'With email'), value: withEmail, icon: Mail, color: 'text-purple-600 bg-purple-50' },
            { label: localize('Critique', 'Critical'), value: criticalCount, icon: ShieldAlert, color: 'text-red-600 bg-red-50' },
            { label: localize('Élevé', 'High'), value: highCount, icon: ShieldAlert, color: 'text-orange-600 bg-orange-50' },
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

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl flex items-start gap-3">
            <span className="text-red-500 mt-0.5">⚠</span>
            <div>
              <p className="font-semibold text-sm">{localize('Erreur', 'Error')}</p>
              <p className="text-sm mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">{localize('Filtres', 'Filters')}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {localize('Affinez les résultats', 'Narrow down results')}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-100 font-semibold">
              {filteredScans.length} {localize('résultats', 'results')}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder={localize('URL ou email…', 'URL or email…')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>
              <Select value={cmsFilter} onValueChange={setCmsFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder={localize('Tous les CMS', 'All CMS')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{localize('Tous les CMS', 'All CMS')}</SelectItem>
                  {cmsOptions.map((cms) => (
                    <SelectItem key={cms} value={cms}>{cms.charAt(0).toUpperCase() + cms.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder={localize('Tous les risques', 'All risks')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{localize('Tous les risques', 'All risks')}</SelectItem>
                  <SelectItem value="critical"><span className="text-red-600 font-semibold">● </span>{riskLabels.critical}</SelectItem>
                  <SelectItem value="high"><span className="text-orange-500 font-semibold">● </span>{riskLabels.high}</SelectItem>
                  <SelectItem value="medium"><span className="text-amber-500 font-semibold">● </span>{riskLabels.medium}</SelectItem>
                  <SelectItem value="low"><span className="text-emerald-500 font-semibold">● </span>{riskLabels.low}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 h-10">
                <Checkbox
                  id="only-email"
                  checked={onlyWithEmail}
                  onCheckedChange={(checked) => setOnlyWithEmail(checked === true)}
                />
                <label htmlFor="only-email" className="text-sm text-slate-600 cursor-pointer select-none">
                  {localize('Avec email', 'With email only')}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="py-4 px-6 border-b border-slate-100 bg-white">
            <CardTitle className="text-base font-semibold text-slate-800">
              {localize('Historique complet', 'Full history')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Zap className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">{localize('Aucune entrée ne correspond.', 'No entries match.')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm border-separate border-spacing-0">
                  <colgroup>
                    <col className="w-[9%]" />
                    <col className="w-[20%]" />
                    <col className="w-[14%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[5%]" />
                    <col className="w-[4%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50">
                      {[
                        localize('Date', 'Date'),
                        'URL',
                        'Email',
                        'IP',
                        localize('Localisation', 'Location'),
                        'CMS',
                        localize('Risque', 'Risk'),
                        localize('PDF', 'PDF'),
                        localize('Vulnérabilités', 'Vulnerabilities'),
                      ].map((h, i) => (
                        <th key={i} className={`px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 text-left ${i === 7 ? 'text-center' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScans.map((scan) => (
                      <tr
                        key={scan.id}
                        className="border-b border-slate-100 odd:bg-white even:bg-slate-50/30 hover:bg-emerald-50/20 transition-colors"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                          {(() => {
                            const date = new Date(scan.created_at);
                            return (
                              <div className="flex flex-col leading-tight">
                                <span className="text-sm font-semibold text-slate-800">{formatDateDMY(date)}</span>
                                <span className="text-xs text-slate-500">{date.toLocaleTimeString(locale, { timeStyle: 'short' })}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5">
                          <a href={normalizeDisplayUrl(scan.url)} target="_blank" rel="noreferrer" title={scan.url} className="text-sm font-semibold text-blue-600 hover:underline truncate block">
                            {normalizeDisplayUrl(scan.url)}
                          </a>
                          {scan.analyzer_domain && <p className="text-xs text-slate-400 truncate">{scan.analyzer_domain}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 truncate">
                          {scan.email
                            ? <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-purple-400 shrink-0" /><span className="truncate">{scan.email}</span></span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-600 truncate">{scan.ip_address || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 truncate">
                          {(() => {
                            const trimmedIp = (scan.ip_address || '').trim();
                            if (!trimmedIp) return '—';
                            if (ipLocationServiceDown) return localize('N/A', 'N/A');
                            const location = ipLocations[trimmedIp];
                            if (location === undefined) return <span className="text-slate-300">…</span>;
                            if (location === LOCAL_IP_PLACEHOLDER) return <span className="text-slate-400">{localize('Local', 'Local')}</span>;
                            return location || '—';
                          })()}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-slate-600 truncate">
                          {scan.cms_label
                            ? <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200 font-medium">{scan.cms_label}</Badge>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5">{renderRiskBadge(scan.risk_level)}</td>
                        <td className="px-3 py-2.5 text-center">
                          {(() => {
                            const reportId = scan.mongo_report_id || scan.scan_id;
                            if (!reportId) return <span className="text-slate-300 text-sm">—</span>;
                            return (
                              <a
                                href={`/service/generate-report/${reportId}?report_format=pdf`}
                                target="_blank"
                                rel="noreferrer"
                                title={localize('Télécharger', 'Download')}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5">
                          {renderSeverityCounts(scan.severity_counts)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
