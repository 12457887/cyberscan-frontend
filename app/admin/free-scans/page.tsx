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
import Link from 'next/link';
import { Download, Loader2, RefreshCcw } from 'lucide-react';

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
const severityLetter = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const lookup: Record<string, string> = {
    critical: 'C',
    high: 'H',
    medium: 'M',
    low: 'L',
  };
  return lookup[normalized] ?? normalized.slice(0, 1).toUpperCase();
};
const severityRank: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function FreeScansAdminPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const riskLabels = useMemo(
    () =>
      choose({
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
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      } else {
        void loadFreeScans();
      }
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (!authLoading && profile?.role === 'admin') {
      void loadFreeScans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const loadFreeScans = async () => {
    try {
      setLoading(true);
      setError(null);
      const { count: totalCount } = await supabase
        .from('free_scans')
        .select('id', { count: 'exact', head: true });
      setTotalFreeScans(totalCount ?? 0);
      let query = supabase
        .from('free_scans')
        .select('*')
        .order('created_at', { ascending: false });

      if (limit > 0) {
        query = query.limit(limit);
      }

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
    scans.forEach((scan) => {
      if (scan.cms_label) {
        values.add(scan.cms_label.toLowerCase());
      }
    });
    return Array.from(values).sort();
  }, [scans]);

  useEffect(() => {
    const candidateIps = Array.from(
      new Set(
        scans
          .map((scan) => (scan.ip_address || '').trim())
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
  }, [scans, ipLocations, ipLocationServiceDown]);

  const filteredScans = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return scans.filter((scan) => {
      const matchesTerm =
        !term ||
        [scan.url, scan.email, scan.analyzer_domain]
          .filter(Boolean)
          .some((value) => value && value.toLowerCase().includes(term));

      const normalizedRisk = (scan.risk_level || '').toLowerCase();
      const matchesRisk = riskFilter === 'all' || normalizedRisk === riskFilter;

      const normalizedCms = (scan.cms_label || '').toLowerCase();
      const matchesCms = cmsFilter === 'all' || normalizedCms === cmsFilter;

      const matchesEmail = !onlyWithEmail || Boolean(scan.email);
      return matchesTerm && matchesRisk && matchesCms && matchesEmail;
    });
  }, [scans, searchTerm, riskFilter, cmsFilter, onlyWithEmail]);

  const renderRiskBadge = (risk?: string | null) => {
    if (!risk) {
      return <Badge variant="outline">—</Badge>;
    }
    const normalized = risk.toLowerCase() as keyof typeof riskLabels;
    const fullLabel = riskLabels[normalized] || risk;
    const label = severityLetter(normalized);
    const color = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-amber-50 text-amber-700 border border-amber-200',
      low: 'bg-emerald-100 text-emerald-700',
    }[normalized];
    return (
      <Badge
        className={`min-w-[1.75rem] justify-center ${color ?? ''}`}
        title={fullLabel}
        aria-label={fullLabel}
      >
        {label}
      </Badge>
    );
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>{localize('Chargement des scans gratuits…', 'Loading collected free scans…')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (profile?.role !== 'admin') return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Scans gratuits collectés', 'Collected free scans')}
            </h1>
            <p className="text-slate-600 mt-1">
              {localize(
                'Historique complet des scans instantanés capturés via le formulaire public.',
                'Complete history of instant scans captured through the public form.'
              )}
            </p>
            {totalFreeScans !== null && (
              <p className="text-sm text-slate-500 mt-1">
                {localize('Total :', 'Total:')} <span className="font-semibold text-slate-700">{totalFreeScans}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 border border-slate-200 rounded-md px-3">
              <label htmlFor="free-scan-limit" className="text-xs text-slate-500 uppercase tracking-wide">
                {localize('Limite', 'Limit')}
              </label>
              <select
                id="free-scan-limit"
                value={String(limit)}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="bg-transparent text-sm text-slate-900 focus:outline-none"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
            <Button asChild variant="outline">
              <Link href="/admin">{localize('Retour administration', 'Back to admin')}</Link>
            </Button>
            <Button onClick={loadFreeScans} variant="secondary" className="flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">{localize('Erreur :', 'Error:')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader className="pb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{localize('Filtres', 'Filters')}</CardTitle>
              <CardDescription>
                {localize(
                  'Affinez la liste grâce à la recherche, aux niveaux de risque et aux CMS détectés.',
                  'Narrow the list with search, risk levels, and detected CMS.'
                )}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
              {localize('Résultats :', 'Results:')}{' '}
              <span className="ml-1 text-slate-900">{filteredScans.length}</span>
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4 border-t border-slate-100 bg-slate-50/60 pt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">
                  {localize('Rechercher URL ou email', 'Search URL or email')}
                </p>
                <Input
                  placeholder="example.com / you@company.com"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">
                  {localize('Filtrer par CMS', 'Filter by CMS')}
                </p>
                <Select value={cmsFilter} onValueChange={setCmsFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={localize('Tous les CMS', 'All CMS')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{localize('Tous', 'All')}</SelectItem>
                    {cmsOptions.map((cms) => (
                      <SelectItem key={cms} value={cms}>
                        {cms.charAt(0).toUpperCase() + cms.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500">
                  {localize('Filtrer par risque', 'Filter by risk')}
                </p>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder={localize('Tous les niveaux', 'All levels')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{localize('Tous', 'All')}</SelectItem>
                    <SelectItem value="critical">{riskLabels.critical}</SelectItem>
                    <SelectItem value="high">{riskLabels.high}</SelectItem>
                    <SelectItem value="medium">{riskLabels.medium}</SelectItem>
                    <SelectItem value="low">{riskLabels.low}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 border border-slate-200 rounded-lg px-3">
                <Checkbox
                  id="only-email"
                  checked={onlyWithEmail}
                  onCheckedChange={(checked) => setOnlyWithEmail(checked === true)}
                />
                <label htmlFor="only-email" className="text-sm text-slate-700">
                  {localize('Avec email uniquement', 'Only entries with email')}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Historique complet', 'Full history')}</CardTitle>
            <CardDescription>
              {localize(
                'Chaque entrée représente un formulaire soumis pour débloquer un rapport gratuit.',
                'Each entry represents a submitted form to unlock a free report.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredScans.length === 0 ? (
              <p className="text-sm text-slate-500 p-6">
                {localize('Aucune entrée ne correspond aux filtres.', 'No entries match the filters.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm border-separate border-spacing-0">
                  <colgroup>
                    <col className="w-[9%]" />
                    <col className="w-[21%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[6%]" />
                    <col className="w-[4%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="bg-gradient-to-r from-slate-50 via-white to-slate-50 text-slate-600 text-left sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">{localize('Date', 'Date')}</th>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">{localize('URL', 'URL')}</th>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">Email</th>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">IP</th>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">{localize('Localisation', 'Location')}</th>
                      <th className="px-3 py-3 text-xs font-semibold text-slate-600">CMS</th>
                      <th className="px-3 py-3 pr-6 text-xs font-semibold text-slate-600">{localize('Risque', 'Risk')}</th>
                      <th className="px-3 py-3 pr-8 text-xs font-semibold text-slate-600 text-center">{localize('Rapport', 'Report')}</th>
                      <th className="px-3 py-3 pl-8 text-xs font-semibold text-slate-600">{localize('Détails', 'Details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScans.map((scan) => (
                      <tr
                        key={scan.id}
                        className="border-b border-slate-100 odd:bg-white even:bg-slate-50/40 hover:bg-slate-100/60 transition-colors"
                      >
                        <td className="px-3 py-2.5 pr-6 text-slate-600 tabular-nums whitespace-nowrap">
                          {(() => {
                            const date = new Date(scan.created_at);
                            return (
                              <div className="flex flex-col leading-tight">
                                <span>{date.toLocaleDateString(locale)}</span>
                                <span className="text-xs text-slate-500">
                                  {date.toLocaleTimeString(locale, { timeStyle: 'short' })}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 whitespace-normal break-words text-slate-700">
                          <p className="font-semibold text-slate-900">
                            {normalizeDisplayUrl(scan.url)}
                          </p>
                          {scan.analyzer_domain && (
                            <p className="text-xs text-slate-500">{scan.analyzer_domain}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 truncate">
                          {scan.email || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-700 truncate">
                          {scan.ip_address || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-600 truncate">
                          {(() => {
                            const trimmedIp = (scan.ip_address || '').trim();
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
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 truncate">
                          {scan.cms_label ? scan.cms_label : localize('Inconnu', 'Unknown')}
                        </td>
                        <td className="px-3 py-2.5 pr-6">{renderRiskBadge(scan.risk_level)}</td>
                        <td className="px-3 py-2.5 pr-8 text-center">
                          {(() => {
                            const reportId = scan.mongo_report_id || scan.scan_id;
                            if (!reportId) {
                              return (
                                <span className="text-xs text-slate-400">-</span>
                              );
                            }
                            const label = localize('Télécharger le rapport', 'Download report');
                            return (
                              <a
                                href={`/service/generate-report/${reportId}?report_format=pdf`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={label}
                                title={label}
                                className="inline-flex items-center justify-center text-slate-600 hover:text-slate-900"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2.5 pl-8 text-xs text-slate-500">
                          {scan.severity_counts ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex gap-3">
                                {(['critical', 'high'] as const).map((severity) => (
                                  <span key={severity} className="inline-flex gap-1">
                                    <strong>{severityLetter(severity)}:</strong>
                                    <span>{scan.severity_counts?.[severity] ?? 0}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-3">
                                {(['medium', 'low'] as const).map((severity) => (
                                  <span key={severity} className="inline-flex gap-1">
                                    <strong>{severityLetter(severity)}:</strong>
                                    <span>{scan.severity_counts?.[severity] ?? 0}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            localize('Non renseigné', 'Not provided')
                          )}
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
