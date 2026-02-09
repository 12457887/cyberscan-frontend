'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';

type MedianetUsagePoint = {
  date?: string | null;
  count?: number | null;
  in_plan?: number | null;
  over_limit?: number | null;
  inPlan?: number | null;
  overLimit?: number | null;
  day?: string | null;
  _id?: string | null;
};

type DehashedUsagePoint = MedianetUsagePoint;

type MedianetSite = {
  url: string;
  scannedAt?: string | null;
  mode?: string | null;
  riskLevel?: string | null;
};

const MEDIANET_RANGES = [7, 30, 90] as const;
type MedianetRange = (typeof MEDIANET_RANGES)[number];

export default function AdminApiUsageStatisticsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });

  const usageChartConfig = useMemo(
    () =>
      choose({
        fr: {
          inPlan: { label: ' Requêtes dans le forfait', color: 'hsl(215, 84%, 60%)' },
          overLimit: { label: ' Dépassements', color: 'hsl(0, 78%, 60%)' },
        },
        en: {
          inPlan: { label: ' In plan requests', color: 'hsl(215, 84%, 60%)' },
          overLimit: { label: ' Overlimit requests', color: 'hsl(0, 78%, 60%)' },
        },
      }),
    [choose]
  );
  const medianetErrorLabels = useMemo(
    () =>
      choose({
        fr: { load: 'Erreur de chargement', generic: 'Erreur inattendue' },
        en: { load: 'Unable to load', generic: 'Unexpected error' },
      }),
    [choose]
  );

  const [medianetRange, setMedianetRange] = useState<MedianetRange>(30);
  const [medianetUsage, setMedianetUsage] = useState<MedianetUsagePoint[]>([]);
  const [medianetLimit, setMedianetLimit] = useState<number | null>(null);
  const [medianetTotal, setMedianetTotal] = useState(0);
  const [medianetLoading, setMedianetLoading] = useState(false);
  const [medianetError, setMedianetError] = useState<string | null>(null);
  const [medianetSites, setMedianetSites] = useState<MedianetSite[]>([]);
  const [medianetSitesLoading, setMedianetSitesLoading] = useState(false);
  const [medianetSitesError, setMedianetSitesError] = useState<string | null>(null);
  const [dehashedUsage, setDehashedUsage] = useState<DehashedUsagePoint[]>([]);
  const [dehashedLimit, setDehashedLimit] = useState<number | null>(null);
  const [dehashedTotal, setDehashedTotal] = useState(0);
  const [dehashedLoading, setDehashedLoading] = useState(false);
  const [dehashedError, setDehashedError] = useState<string | null>(null);

  const buildUsageChartData = (usage: MedianetUsagePoint[]) =>
    (usage || []).map((entry) => {
      const count = Number(entry.count ?? 0);
      const rawInPlan = entry.in_plan ?? entry.inPlan;
      const rawOverLimit = entry.over_limit ?? entry.overLimit;
      const inPlan = Number(
        rawInPlan ?? (rawOverLimit == null ? count : Math.max(count - Number(rawOverLimit), 0))
      );
      const overLimit = Number(
        rawOverLimit ?? (rawInPlan == null ? 0 : Math.max(count - Number(rawInPlan), 0))
      );
      return {
        date: entry.date ?? entry.day ?? entry._id ?? '',
        total: inPlan + overLimit,
        inPlan,
        overLimit,
      };
    });

  const medianetChartData = useMemo(() => buildUsageChartData(medianetUsage), [medianetUsage]);
  const dehashedChartData = useMemo(() => buildUsageChartData(dehashedUsage), [dehashedUsage]);

  const formatChartDate = (dateString: string) => {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  };

  const formatScanTimestamp = (value?: string | null) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getSiteDisplay = (value: string) => {
    try {
      const parsed = new URL(value);
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return {
        label: parsed.host,
        path: path && path !== '/' ? path : '',
      };
    } catch {
      return { label: value, path: '' };
    }
  };

  const formatModeLabel = (value?: string | null) => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    if (normalized === 'light') return localize('Léger', 'Light');
    if (normalized === 'complete') return localize('Complet', 'Complete');
    return value;
  };

  const formatRiskLabel = (value?: string | null) => {
    if (!value) return localize('Inconnu', 'Unknown');
    const normalized = value.toLowerCase();
    if (normalized === 'critical') return localize('Critique', 'Critical');
    if (normalized === 'high') return localize('Élevé', 'High');
    if (normalized === 'medium') return localize('Moyen', 'Medium');
    if (normalized === 'low') return localize('Faible', 'Low');
    return value;
  };

  const getRiskBadgeClass = (value?: string | null) => {
    const normalized = (value || '').toLowerCase();
    if (normalized === 'critical') {
      return 'border-red-200 bg-red-50 text-red-700';
    }
    if (normalized === 'high') {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }
    if (normalized === 'medium') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }
    if (normalized === 'low') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    return 'border-slate-200 bg-slate-100 text-slate-600';
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [authLoading, user, profile?.role, router]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'admin') {
      return;
    }

    let cancelled = false;

    const loadMedianetUsage = async () => {
      try {
        setMedianetError(null);
        setMedianetLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/service/admin/medianet-usage?days=${medianetRange}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.detail || payload.error || medianetErrorLabels.load);
        }

        const payload = await res.json();
        if (cancelled) return;

        const series = Array.isArray(payload.series) ? payload.series : [];
        setMedianetUsage(series);
        setMedianetLimit(typeof payload.limit === 'number' ? payload.limit : null);
        if (typeof payload.total === 'number') {
          setMedianetTotal(payload.total);
        } else {
          const fallbackTotal = series.reduce(
            (sum: number, entry: MedianetUsagePoint) => sum + Number(entry.count ?? 0),
            0
          );
          setMedianetTotal(fallbackTotal);
        }
      } catch (err: any) {
        if (cancelled) return;
        setMedianetError(err.message || medianetErrorLabels.generic);
      } finally {
        if (!cancelled) {
          setMedianetLoading(false);
        }
      }
    };

    loadMedianetUsage();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, medianetRange, medianetErrorLabels]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'admin') {
      return;
    }

    let cancelled = false;

    const loadDehashedUsage = async () => {
      try {
        setDehashedError(null);
        setDehashedLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/service/admin/medianet-dehashed-usage?days=${medianetRange}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.detail || payload.error || medianetErrorLabels.load);
        }

        const payload = await res.json();
        if (cancelled) return;

        const series = Array.isArray(payload.series) ? payload.series : [];
        setDehashedUsage(series);
        setDehashedLimit(typeof payload.limit === 'number' ? payload.limit : null);
        if (typeof payload.total === 'number') {
          setDehashedTotal(payload.total);
        } else {
          const fallbackTotal = series.reduce(
            (sum: number, entry: DehashedUsagePoint) => sum + Number(entry.count ?? 0),
            0
          );
          setDehashedTotal(fallbackTotal);
        }
      } catch (err: any) {
        if (cancelled) return;
        setDehashedError(err.message || medianetErrorLabels.generic);
      } finally {
        if (!cancelled) {
          setDehashedLoading(false);
        }
      }
    };

    loadDehashedUsage();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, medianetRange, medianetErrorLabels]);

  useEffect(() => {
    if (authLoading || !user || profile?.role !== 'admin') {
      return;
    }

    let cancelled = false;

    const loadMedianetSites = async () => {
      try {
        setMedianetSitesError(null);
        setMedianetSitesLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const res = await fetch(`/service/admin/medianet-sites?days=${medianetRange}&limit=20`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.detail || payload.error || medianetErrorLabels.load);
        }

        const payload = await res.json();
        if (cancelled) return;

        const rawSites = Array.isArray(payload.sites) ? payload.sites : [];
        const normalized = rawSites
          .map((entry: any) => {
            const url = entry?.url || entry?.target_url || entry?.site_url;
            if (!url) return null;
            return {
              url: String(url),
              scannedAt: entry?.scanned_at || entry?.created_at || null,
              mode: entry?.mode || null,
              riskLevel: entry?.risk_level || entry?.riskLevel || null,
            } as MedianetSite;
          })
          .filter((entry: MedianetSite | null): entry is MedianetSite => Boolean(entry));

        setMedianetSites(normalized);
      } catch (err: any) {
        if (cancelled) return;
        setMedianetSitesError(err.message || medianetErrorLabels.generic);
      } finally {
        if (!cancelled) {
          setMedianetSitesLoading(false);
        }
      }
    };

    loadMedianetSites();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, medianetRange, medianetErrorLabels]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement...', 'Loading...')}</p>
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
          <h1 className="text-3xl font-bold text-slate-900">
            {localize("Statistiques d'utilisation API", 'API Usage Statistics')}
          </h1>
          <p className="text-slate-600 mt-1">
            {localize('Suivi des requêtes Medianet sur la période sélectionnée.', 'Track Medianet requests over time.')}
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold uppercase tracking-wide text-slate-900">
                {localize("Statistiques d'utilisation API", 'API Usage Statistics')}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {MEDIANET_RANGES.map((range) => (
                  <Button
                    key={range}
                    size="sm"
                    variant="ghost"
                    className={`h-7 px-2 ${
                      medianetRange === range
                        ? 'text-blue-600 font-semibold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setMedianetRange(range)}
                  >
                    {localize(`${range} jours`, `${range} days`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {localize('Total sur la période', 'Total over period')}
              </div>
              <div className="text-lg font-semibold text-slate-900">{medianetTotal}</div>
            </div>
            {medianetLimit !== null && (
              <p className="mt-1 text-xs text-slate-500">
                {localize(`Limite journalière : ${medianetLimit}`, `Daily limit: ${medianetLimit}`)}
              </p>
            )}
            <div className="mt-4">
              {medianetLoading ? (
                <p className="text-sm text-slate-600">
                  {localize('Chargement des statistiques...', 'Loading statistics...')}
                </p>
              ) : medianetError ? (
                <p className="text-sm text-red-600">{medianetError}</p>
              ) : medianetChartData.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {localize('Aucune requête Medianet sur la période.', 'No Medianet requests for this period.')}
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-8 rounded-sm border border-blue-600 bg-blue-200/70" />
                      <span>{localize('Requêtes dans le forfait', 'In plan requests')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-8 rounded-sm border border-orange-500 bg-orange-200/70" />
                      <span>{localize('Dépassements', 'Overlimit requests')}</span>
                    </div>
                  </div>

                  <ChartContainer
                    config={usageChartConfig}
                    className="w-full"
                    style={{ width: '100%', height: 360 }}
                  >
                    <BarChart
                      data={medianetChartData.slice().reverse()}
                      margin={{ top: 16, right: 16, left: 0, bottom: 32 }}
                      barSize={32}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartDate}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => [
                              value,
                              name === 'inPlan'
                                ? localize('Dans le forfait', 'In plan')
                                : localize('Dépassement', 'Over limit'),
                            ]}
                          />
                        }
                      />
                      <Bar
                        dataKey="inPlan"
                        stackId="a"
                        fill="#9db7f5"
                        stroke="#3b5be0"
                        strokeWidth={1.5}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="overLimit"
                        stackId="a"
                        fill="#f6b36a"
                        stroke="#f97316"
                        strokeWidth={1.5}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-700">
                        {localize('Sites scannés', 'Scanned sites')}
                      </h3>
                      <span className="text-xs text-slate-400">
                        {localize('Derniers', 'Latest')} {medianetSites.length}
                      </span>
                    </div>
                    {medianetSitesLoading ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {localize('Chargement des sites...', 'Loading sites...')}
                      </p>
                    ) : medianetSitesError ? (
                      <p className="mt-2 text-sm text-red-600">{medianetSitesError}</p>
                    ) : medianetSites.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        {localize(
                          'Aucun site scanné sur la période.',
                          'No scanned sites for this period.'
                        )}
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white text-sm shadow-sm">
                        {medianetSites.map((site, index) => {
                          const scannedAt = formatScanTimestamp(site.scannedAt);
                          const modeLabel = formatModeLabel(site.mode);
                          const riskLabel = formatRiskLabel(site.riskLevel);
                          const riskBadgeClass = getRiskBadgeClass(site.riskLevel);
                          const display = getSiteDisplay(site.url);
                          return (
                            <li
                              key={`${site.url}-${index}`}
                              className="group flex flex-col gap-3 px-3 py-3 transition-colors hover:bg-slate-50 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4"
                            >
                              <a
                                href={site.url}
                                target="_blank"
                                rel="noreferrer"
                                title={site.url}
                                className="min-w-0 flex-1"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-blue-500/80" />
                                  <span className="truncate font-medium text-slate-900">
                                    {display.label}
                                  </span>
                                </div>
                                {display.path ? (
                                  <div className="pl-4 text-xs text-slate-500 break-all">
                                    {display.path}
                                  </div>
                                ) : null}
                              </a>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:justify-center">
                                {modeLabel ? (
                                  <span className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                    {modeLabel}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                                <span
                                  className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${riskBadgeClass}`}
                                >
                                  {riskLabel}
                                </span>
                              </div>
                              {scannedAt ? (
                                <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                  {scannedAt}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 sm:text-right">—</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-semibold uppercase tracking-wide text-slate-900">
                {localize("Consommation DeHashed (Medianet)", 'DeHashed usage (Medianet)')}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {MEDIANET_RANGES.map((range) => (
                  <Button
                    key={`dehashed-${range}`}
                    size="sm"
                    variant="ghost"
                    className={`h-7 px-2 ${
                      medianetRange === range
                        ? 'text-blue-600 font-semibold'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setMedianetRange(range)}
                  >
                    {localize(`${range} jours`, `${range} days`)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-px w-full bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {localize('Total sur la période', 'Total over period')}
              </div>
              <div className="text-lg font-semibold text-slate-900">{dehashedTotal}</div>
            </div>
            {dehashedLimit !== null && (
              <p className="mt-1 text-xs text-slate-500">
                {localize(`Limite journalière : ${dehashedLimit}`, `Daily limit: ${dehashedLimit}`)}
              </p>
            )}
            <div className="mt-4">
              {dehashedLoading ? (
                <p className="text-sm text-slate-600">
                  {localize('Chargement des statistiques...', 'Loading statistics...')}
                </p>
              ) : dehashedError ? (
                <p className="text-sm text-red-600">{dehashedError}</p>
              ) : dehashedChartData.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {localize(
                    'Aucune requête DeHashed sur la période.',
                    'No DeHashed requests for this period.'
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-8 rounded-sm border border-blue-600 bg-blue-200/70" />
                      <span>{localize('Requêtes dans le forfait', 'In plan requests')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-8 rounded-sm border border-orange-500 bg-orange-200/70" />
                      <span>{localize('Dépassements', 'Overlimit requests')}</span>
                    </div>
                  </div>

                  <ChartContainer
                    config={usageChartConfig}
                    className="w-full"
                    style={{ width: '100%', height: 320 }}
                  >
                    <BarChart
                      data={dehashedChartData.slice().reverse()}
                      margin={{ top: 16, right: 16, left: 0, bottom: 32 }}
                      barSize={30}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartDate}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.15)' }}
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => [
                              value,
                              name === 'inPlan'
                                ? localize('Dans le forfait', 'In plan')
                                : localize('Dépassement', 'Over limit'),
                            ]}
                          />
                        }
                      />
                      <Bar
                        dataKey="inPlan"
                        stackId="a"
                        fill="#9db7f5"
                        stroke="#3b5be0"
                        strokeWidth={1.5}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="overLimit"
                        stackId="a"
                        fill="#f6b36a"
                        stroke="#f97316"
                        strokeWidth={1.5}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
