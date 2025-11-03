'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';
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

export default function DashboardDetectionPage() {
  const [input, setInput] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [results, setResults] = useState<PredictResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const { plan, loading: planLoading } = useSubscriptionPlan();
  const planLabel = useMemo(() => {
    switch (plan) {
      case 'free':
        return 'Gratuit';
      case 'basic':
        return 'Basic';
      case 'pro':
        return 'Pro';
      case 'enterprise':
        return 'Enterprise';
      case 'admin':
        return 'Admin';
      default:
        return 'Indéfini';
    }
  }, [plan]);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const urls = normalizeUrls(text);

      if (urls.length === 0) {
        setError("Le fichier ne contient pas d'URL valide.");
        setResults(null);
        setInput('');
      } else if (urls.length > 10) {
        setError('Maximum 10 URLs autorisées. Les 10 premières ont été conservées.');
        setInput(urls.slice(0, 10).join('\n'));
      } else {
        setError(null);
        setInput(urls.join('\n'));
      }
    } catch {
      setError('Impossible de lire le fichier sélectionné.');
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
      setError('Veuillez saisir au moins une URL.');
      return;
    }

    if (urls.length > 10) {
      setError('Maximum 10 URLs autorisées.');
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
        throw new Error(txt || `Erreur ${res.status}`);
      }

      const data = await res.json();
      const detectionResults: PredictResult[] = data.resultats || [];
      setResults(detectionResults);

      const timestamp = Date.now();
      const successEntries = detectionResults
        .filter((r) => r.status === 'success')
        .map((r, index) => {
          const createdAt = new Date(timestamp + index).toISOString();
          return {
            id: `${timestamp + index}-${r.url}`,
            url: r.url,
            siteName: extractSiteName(r.url),
            cms: r.cms || 'Inconnu',
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

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

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
      {status === 'success' ? 'Succès' : 'Échec'}
    </Badge>
  );

  const renderCmsBadge = (cms: string) => {
    const normalized = cms ? cms.toLowerCase() : 'inconnu';
    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
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
          <p className="text-slate-600">Chargement de vos informations d&apos;abonnement...</p>
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
          <h1 className="text-2xl font-bold">Détection indisponible</h1>
          <p className="text-slate-600">
            La détection de CMS est disponible à partir du plan Basic. Passez à un plan supérieur
            pour profiter de cette fonctionnalité avancée.
          </p>
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Voir les abonnements
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const content = (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Détection de CMS</h1>
        <p className="mt-2 text-slate-600">
          Identifiez rapidement les technologies utilisées par vos cibles. Analysez jusqu&apos;à 10 URLs à la fois
          ou importez un fichier pour accélérer vos investigations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nouvelle détection</CardTitle>
            <CardDescription>
              Collez vos URLs (une par ligne) ou importez un fichier pour lancer l&apos;analyse. Nous normalisons
              automatiquement les liens.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://example.com&#10;https://exemple.fr"
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
                    Importer une liste (.txt, .csv)
                  </span>
                </label>
                <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
                  Limite : 10 URLs
                </Badge>
                <span className="text-xs text-slate-500">
                  Les URLs sans protocole seront automatiquement converties en https://
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isDetecting}>
                  {isDetecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isDetecting ? 'Analyse en cours...' : 'Détecter le CMS'}
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
                  Réinitialiser
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Vue d&apos;ensemble
            </CardTitle>
            <CardDescription className="text-slate-200/80">
              Surveillez votre plan et l&apos;activité récente de vos analyses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs uppercase text-slate-300 tracking-wide">Plan actuel</p>
              <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
                {planLabel}
                <Badge variant="secondary" className="border border-white/20 bg-white/10 text-white">
                  Détection incluse
                </Badge>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase text-slate-300 tracking-wide">Succès</p>
                <p className="mt-2 text-2xl font-semibold">{successfulCount}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs uppercase text-slate-300 tracking-wide">Échecs</p>
                <p className="mt-2 text-2xl font-semibold">{failureCount}</p>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase text-slate-300 tracking-wide">Dernier site analysé</p>
              {latestHistory ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium">{latestHistory.siteName}</p>
                  <p className="text-xs text-slate-300">{formatDateTime(latestHistory.createdAt)}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-200/80">Aucune analyse enregistrée.</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-200/80">
              <HistoryIcon className="h-4 w-4" />
              {totalDetections > 0
                ? `${totalDetections} détections sauvegardées`
                : "L'historique se remplira après vos analyses."}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Résultats de la détection
          </CardTitle>
          <CardDescription>
            {hasResults
              ? 'Analyse des URLs soumises et CMS détectés.'
              : 'Soumettez une analyse pour afficher les résultats ici.'}
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
                        {renderCmsBadge(result.cms || 'Inconnu')}
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase text-slate-400">Confiance</span>
                        <p className="font-medium text-slate-900">{formatConfidence(result.confiance)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-600">
                      Erreur : {result.error || 'Impossible de détecter le CMS.'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Lancez une détection pour visualiser les résultats.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-slate-600" />
            Historique des détections
          </CardTitle>
          <CardDescription>
            Suivez vos précédentes analyses et retrouvez rapidement les CMS détectés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              L'historique se remplira automatiquement après vos analyses.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">CMS</th>
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
