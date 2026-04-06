'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  History as HistoryIcon,
  Loader2,
  UploadCloud,
} from 'lucide-react';

type PredictResult = {
  url: string;
  cms?: string;
  confiance?: number;
  error?: string;
  status: 'success' | 'error';
};

type HistoryEntry = {
  id: string;
  url: string;
  siteName: string;
  cms: string;
  createdAt: string;
};

const STORAGE_KEY = 'cyberscan-detection-history';
const MAX_HISTORY_ITEMS = 50;
const MAX_URLS = 10;
const UNKNOWN_CMS_FALLBACK = 'unknown';
const DISABLE_CREDIT_CHECK = process.env.NEXT_PUBLIC_DISABLE_CREDITS === 'true';

export default function DashboardDetectionPage() {
  const [input, setInput] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [results, setResults] = useState<PredictResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { plan, loading: planLoading } = useSubscriptionPlan();
  const { user, refreshCredits } = useAuth();
  const { t, language } = useLanguage();
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const planLabel = useMemo(() => {
    const key = plan ? `plans.${plan}` : 'plans.unknown';
    return t(key);
  }, [plan, t]);

  const ensureCreditsAvailable = async (count: number) => {
    if (DISABLE_CREDIT_CHECK || count <= 0) return true;
    if (!user?.id) {
      setError(language === 'fr' ? 'Vous devez être connecté pour utiliser vos crédits.' : 'You must be logged in to use credits.');
      return false;
    }

    const syncCredits = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return null;
        const response = await fetch('/service/credits/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) {
          return null;
        }
        const payload = await response.json().catch(() => null);
        return payload?.credits ?? null;
      } catch (syncErr) {
        console.error('Erreur sync crédits détection:', syncErr);
        return null;
      }
    };

    const { data, error } = await supabase
      .from('credits')
      .select('id, total_credits, used_credits, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erreur lecture crédits détection:', error);
      const synced = await syncCredits();
      if (!synced) {
        setError(language === 'fr' ? 'Impossible de vérifier vos crédits.' : 'Unable to verify your credits.');
        return false;
      }
    }

    let total = data?.total_credits ?? 0;
    let used = data?.used_credits ?? 0;
    let remaining = total - used;

    if (remaining < count) {
      const synced = await syncCredits();
      if (synced && Number.isFinite(synced.total) && Number.isFinite(synced.used)) {
        const { data: refreshed } = await supabase
          .from('credits')
          .select('id, total_credits, used_credits, updated_at, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        total = refreshed?.total_credits ?? synced.total ?? 0;
        used = refreshed?.used_credits ?? synced.used ?? 0;
        remaining = total - used;
        if (remaining >= count) {
          return true;
        }
      }

      setError(language === 'fr' ? 'Crédits insuffisants pour lancer ces détections.' : 'Not enough credits to start these detections.');
      return false;
    }

    return true;
  };

  const consumeCredits = async (count: number) => {
    if (DISABLE_CREDIT_CHECK || count <= 0 || !user?.id) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/service/credits/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ amount: count }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erreur consommation crédits détection:', text || response.statusText);
        return;
      }

      if (typeof refreshCredits === 'function') {
        refreshCredits().catch((err) => console.error('Erreur refresh credits detection:', err));
      }
    } catch (err) {
      console.error('Erreur consommation crédits détection:', err);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const urls = normalizeUrls(text);

      if (urls.length === 0) {
        setError(t('detection.fileErrors.noUrl'));
        setResults(null);
        setInput('');
      } else if (urls.length > MAX_URLS) {
        setError(t('detection.fileErrors.tooMany', undefined, { count: MAX_URLS }));
        setInput(urls.slice(0, MAX_URLS).join('\n'));
      } else {
        setError(null);
        setInput(urls.join('\n'));
      }
    } catch {
      setError(t('detection.fileErrors.read'));
    } finally {
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as HistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, MAX_HISTORY_ITEMS));
      }
    } catch (err) {
      console.warn("Impossible de charger l'historique des détections:", err);
    }
  }, []);

  const persistHistory = (updater: (prev: HistoryEntry[]) => HistoryEntry[]) => {
    setHistory((prev) => {
      const next = updater(prev);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (err) {
          console.warn("Impossible d'enregistrer l'historique des détections:", err);
        }
      }
      return next;
    });
  };

  const extractSiteName = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const normalizeUrls = (text: string) => {
    return text
      .split(/\r?\n|,|;/)
      .map(s => s.trim())
      .filter(Boolean)
      .map((u) => {
        if (!u.startsWith('http://') && !u.startsWith('https://')) {
          return 'http://' + u;
        }
        return u;
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResults(null);

    const urls = normalizeUrls(input);
    if (urls.length === 0) {
      setError(t('detection.manualErrors.noUrl'));
      return;
    }

    if (urls.length > MAX_URLS) {
      setError(t('detection.manualErrors.tooMany', undefined, { count: MAX_URLS }));
      return;
    }

    const plannedUsage = urls.length;
    const hasCredits = await ensureCreditsAvailable(plannedUsage);
    if (!hasCredits) {
      return;
    }

    setIsDetecting(true);
    try {
      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `${t('common.errorPrefix')} ${res.status}`);
      }

      const data = await res.json();
      const detectionResults: PredictResult[] = data.resultats || [];
      setResults(detectionResults);
      await consumeCredits(plannedUsage);

      const timestamp = Date.now();
      const successEntries = detectionResults
        .filter((r) => r.status === 'success')
        .map((r, index) => {
          const createdAt = new Date(timestamp + index).toISOString();
          return {
            id: `${timestamp + index}-${r.url}`,
            url: r.url,
            siteName: extractSiteName(r.url),
            cms: r.cms || UNKNOWN_CMS_FALLBACK,
            createdAt,
          } satisfies HistoryEntry;
        });

      if (successEntries.length > 0) {
        persistHistory((prev) => {
          const merged = [...successEntries, ...prev];
          if (merged.length > MAX_HISTORY_ITEMS) {
            return merged.slice(0, MAX_HISTORY_ITEMS);
          }
          return merged;
        });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setIsDetecting(false);
    }
  };

  const formatConfidence = (value?: number | null) => {
    if (value === undefined || value === null) return 'N/A';
    const percentage = value > 1 ? value : value * 100;
    return `${Math.round(percentage)}%`;
  };

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${formatDateDMY(date)} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`;
  };

  const successfulCount = results?.filter((r) => r.status === 'success').length ?? 0;
  const failureCount = results?.filter((r) => r.status === 'error').length ?? 0;
  const hasResults = !!results && results.length > 0;
  const latestHistory = history[0];
  const totalDetections = history.length;

  const renderStatusBadge = (status: 'success' | 'error') => (
    <Badge
      className={
        status === 'success'
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-red-100 text-red-700 border border-red-200'
      }
    >
      {status === 'success' ? t('detection.status.success') : t('detection.status.error')}
    </Badge>
  );

  const renderCmsBadge = (cms: string) => {
    const normalized = cms ? cms.toLowerCase() : UNKNOWN_CMS_FALLBACK;
    const isUnknown = normalized === 'inconnu' || normalized === 'unknown';
    const label = isUnknown
      ? t('detection.unknownCms')
      : normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return (
      <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
        {label}
      </Badge>
    );
  };

  if (planLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl">
          <p className="text-slate-600">{t('detection.subscriptionLoading')}</p>
        </div>
      </DashboardLayout>
    );
  }

  const hasDetectionAccess =
    plan === 'admin' || plan === 'basic' || plan === 'pro' || plan === 'enterprise';

  if (!hasDetectionAccess) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl space-y-4">
          <h1 className="text-2xl font-bold">{t('detection.accessDeniedTitle')}</h1>
          <p className="text-slate-600">{t('detection.accessDeniedDescription')}</p>
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t('detection.viewPlans')}
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const content = (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('detection.title')}</h1>
        <p className="mt-2 text-slate-600">{t('detection.description')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('detection.formTitle')}</CardTitle>
            <CardDescription>{t('detection.formDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('detection.placeholder')}
                className="min-h-[180px]"
              />

              <div className="flex flex-wrap items-center gap-3">
                <label className="relative inline-flex cursor-pointer">
                  <input
                    type="file"
                    accept=".txt,.csv"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    onChange={handleFileUpload}
                  />
                  <span className="inline-flex h-10 items-center gap-2 rounded-md border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 hover:border-slate-400 hover:text-slate-700">
                    <UploadCloud className="h-4 w-4" />
                    {t('detection.importLabel')}
                  </span>
                </label>
                <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
                  {t('detection.limitLabel', undefined, { count: MAX_URLS })}
                </Badge>
                <span className="text-xs text-slate-500">{t('detection.protocolHint')}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isDetecting}>
                  {isDetecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDetecting ? t('detection.loading') : t('detection.submit')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setInput('');
                    setResults(null);
                    setError(null);
                  }}
                >
                  {t('detection.reset')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('detection.overviewTitle')}
            </CardTitle>
            <CardDescription className="text-slate-200/80">
              {t('detection.overviewDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs uppercase text-slate-300 tracking-wide">{t('detection.currentPlan')}</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {planLabel}
                <Badge variant="secondary" className="border border-white/20 bg-white/10 text-white">
                  {t('detection.detectionIncluded')}
                </Badge>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase text-slate-300 tracking-wide">{t('detection.successes')}</p>
                <p className="mt-2 text-2xl font-semibold">{successfulCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase text-slate-300 tracking-wide">{t('detection.failures')}</p>
                <p className="mt-2 text-2xl font-semibold">{failureCount}</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-slate-300 tracking-wide">{t('detection.lastAnalyzed')}</p>
              {latestHistory ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">{latestHistory.siteName}</p>
                  <p className="text-xs text-slate-300">{formatDateTime(latestHistory.createdAt)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-200/80">{t('common.historyEmpty')}</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-200/80">
              <HistoryIcon className="h-4 w-4" />
              {totalDetections > 0
                ? t('detection.savedDetections', undefined, { count: totalDetections })
                : t('common.historySoon')}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-semibold">{t('detection.errorBanner')}:</span> {error}
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {t('detection.resultsTitle')}
          </CardTitle>
          <CardDescription>
            {hasResults
              ? t('detection.resultsDescription')
              : t('detection.resultsPlaceholder')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasResults ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results!.map((result) => (
                <div
                  key={result.url}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="break-all font-medium text-slate-900">{result.url}</p>
                    {renderStatusBadge(result.status)}
                  </div>
                    {result.status === 'success' ? (
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-slate-400">CMS</span>
                          {renderCmsBadge(result.cms || UNKNOWN_CMS_FALLBACK)}
                        </div>
                        <div>
                          <span className="text-xs font-semibold uppercase text-slate-400">
                            {t('detection.confidence')}
                          </span>
                          <p className="font-medium text-slate-900">{formatConfidence(result.confiance)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-600">
                        {t('common.errorPrefix')}: {result.error || t('detection.errorFallback')}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('common.resultsPlaceholder')}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-slate-600" />
            {t('detection.historyTitle')}
          </CardTitle>
          <CardDescription>{t('detection.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {t('detection.historyNotice')}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t('detection.historyTable.site')}</th>
                    <th className="px-4 py-3">{t('detection.historyTable.date')}</th>
                    <th className="px-4 py-3">{t('detection.historyTable.cms')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-slate-900">{entry.siteName}</div>
                        <div className="break-all text-xs text-slate-500">{entry.url}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {renderCmsBadge(entry.cms)}
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
  );

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
