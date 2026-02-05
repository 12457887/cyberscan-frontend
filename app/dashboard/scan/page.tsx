'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, Loader2, ShieldCheck, Lock, Network, Scan } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DISABLE_CREDIT_CHECK = process.env.NEXT_PUBLIC_DISABLE_CREDITS === 'true'; // permet de désactiver la vérif en dev

const PLAN_CONCURRENCY: Record<string, number> = {
  free: 1,
  basic: 5,
  pro: 10,
  enterprise: 10,
  admin: 10,
};
const LIGHT_SCAN_CREDIT_COST = 1;
const FULL_SCAN_CREDIT_COST = 3;
const FULL_SCAN_PLANS = new Set(['pro', 'enterprise', 'admin']);

const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);
const FINISHED_STATUSES = new Set(['completed', 'failed']);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForScanCompletion(scanIds: Array<string | number>, maxAttempts = 60, intervalMs = 5000) {
  if (!scanIds.length) return 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('scans')
      .select('id, status')
      .in('id', scanIds);

    if (error) {
      console.error('Erreur vérification statut des scans:', error);
      return 0;
    }

    const rows = (data as Array<{ id: string | number; status: string | null }>) || [];
    if (!rows.length) {
      return 0;
    }

    const hasActive = rows.some((row) => !row.status || ACTIVE_STATUSES.has(row.status));
    if (!hasActive) {
      return rows.filter((row) => row.status && FINISHED_STATUSES.has(row.status)).length;
    }

    await sleep(intervalMs);
  }

  console.warn('Temps dépassé en attendant la fin des scans:', scanIds);
  return 0;
}

export default function ScanPage() {
  const { user, profile, refreshCredits } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState('');
  const [scanType, setScanType] = useState<'light' | 'complete'>('light');
  const [toolScanMode, setToolScanMode] = useState<'light' | 'full'>('light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [planType, setPlanType] = useState<string>('free');
  const canUseFullScan = FULL_SCAN_PLANS.has(planType);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const websiteConfigRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<'website' | 'ssl' | 'network'>('website');
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState('');
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [networkDialogMode, setNetworkDialogMode] = useState<'ssl' | 'network' | null>(null);
  const [networkDialogResult, setNetworkDialogResult] = useState<any | null>(null);
  const [networkDialogTarget, setNetworkDialogTarget] = useState('');
  const trackCreditConsumption = (scanIds: Array<string | number>) => {
    if (!user?.id || scanIds.length === 0) {
      return;
    }

    (async () => {
      await waitForScanCompletion(scanIds);
      if (typeof refreshCredits === 'function') {
        refreshCredits().catch((err) => console.error('Erreur refresh credits:', err));
      }
    })().catch((err) => {
      console.error('Erreur suivi des crédits:', err);
    });
  };

  const startProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setScanProgress(1);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) return prev;
        const next = prev + Math.random() * 7;
        return next >= 95 ? 95 : next;
      });
    }, 600);

    progressIntervalRef.current = interval;
  };

  const stopProgress = (completed: boolean) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setScanProgress(completed ? 100 : 0);
  };

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const normalizeSingleUrl = (rawValue: string) => {
    const entries = rawValue
      .split(/\r?\n|,|;/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (entries.length === 0) {
      throw new Error(localize('Veuillez saisir au moins une URL.', 'Please enter at least one URL.'));
    }

    if (entries.length > 1) {
      throw new Error(
        localize(
          'Veuillez saisir une seule URL pour ce scan.',
          'Please enter a single URL for this scan.'
        )
      );
    }

    let candidate = entries[0];
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    const url = new URL(candidate);
    return `${url.protocol}//${url.host}`;
  };


  const runNetworkScan = async (
    mode: 'ssl' | 'network',
    scanMode: 'light' | 'full' = 'full'
  ) => {
    setNetworkError('');
    setNetworkLoading(true);
    setNetworkDialogMode(mode);
    setActiveTool(mode === 'network' ? 'network' : 'ssl');
    setNetworkDialogResult(null);
    try {
      const normalizedUrl = normalizeSingleUrl(siteUrl);
      const networkMode = scanMode === 'light' ? 'quick' : 'full';
      const endpoint =
        mode === 'ssl'
          ? '/api/scan-network-ssl'
          : '/api/scan-network';
      const payload =
        mode === 'ssl'
          ? { url: normalizedUrl, full_ssl: scanMode === 'full' }
          : { url: normalizedUrl, mode: networkMode };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || localize('Échec du scan réseau.', 'Network scan failed.'));
      }

      const data = await response.json();
      setNetworkDialogMode(mode);
      setNetworkDialogResult(data);
      setNetworkDialogTarget(normalizedUrl);
      setNetworkDialogOpen(true);
    } catch (err) {
      setNetworkError(
        err instanceof Error
          ? err.message
          : localize('Échec du scan réseau.', 'Network scan failed.')
      );
    } finally {
      setNetworkLoading(false);
    }
  };


  useEffect(() => {
    if (!user) return;

    if (profile?.role === 'admin') {
      setPlanType('enterprise');
      return;
    }

    supabase
      .from('subscriptions')
      .select('plan_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Impossible de récupérer le plan:', error);
          return;
        }
        if (data?.plan_type) {
          setPlanType(data.plan_type);
        }
      });
  }, [user, profile?.role]);

  useEffect(() => {
    if (scanType === 'complete' && !canUseFullScan) {
      setScanType('light');
    }
  }, [canUseFullScan, scanType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);
    startProgress();

    try {
      const concurrencyLimit = PLAN_CONCURRENCY[planType] ?? 1;

      if (scanType === 'complete' && !canUseFullScan) {
        setError(
          localize(
            'Le scan complet est disponible pour les plans Pro, Enterprise et Admin.',
            'Full scans are available on Pro, Enterprise, and Admin plans.'
          )
        );
        setLoading(false);
        stopProgress(false);
        return;
      }

      const rawEntries = siteUrl
        .split(/\r?\n|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (rawEntries.length === 0) {
        throw new Error(localize('Veuillez saisir au moins une URL.', 'Please enter at least one URL.'));
      }

      if (concurrencyLimit <= 1 && rawEntries.length > 1) {
        setError(localize('Votre abonnement permet un seul scan à la fois.', 'Your plan allows only one scan at a time.'));
        setLoading(false);
        stopProgress(false);
        return;
      }

      if (rawEntries.length > concurrencyLimit) {
        setError(
          localize(
            `Votre plan autorise au maximum ${concurrencyLimit} scans simultanés. Réduisez la liste ou passez à un plan supérieur.`,
            `Your plan allows a maximum of ${concurrencyLimit} concurrent scans. Reduce the list or upgrade your plan.`
          )
        );
        setLoading(false);
        stopProgress(false);
        return;
      }

      const normalizedUrls: string[] = [];
      for (const entry of rawEntries) {
        let candidate = entry;
        if (!/^https?:\/\//i.test(candidate)) {
          candidate = `https://${candidate}`;
        }
        try {
          const url = new URL(candidate);
          normalizedUrls.push(`${url.protocol}//${url.host}`);
        } catch (err) {
          setError(localize(`URL invalide: ${entry}`, `Invalid URL: ${entry}`));
          setLoading(false);
          stopProgress(false);
          return;
        }
      }

      const perScanCost = scanType === 'complete' ? FULL_SCAN_CREDIT_COST : LIGHT_SCAN_CREDIT_COST;
      const totalCost = normalizedUrls.length * perScanCost;
      let creditsData = { remaining_credits: 0, used_credits: 0, total_credits: 0 };

      if (!DISABLE_CREDIT_CHECK) {
        const { data } = await supabase
          .from('credits')
          .select('used_credits, total_credits')
          .eq('user_id', user.id)
          .maybeSingle();

        creditsData = data
          ? {
              remaining_credits: (data.total_credits ?? 0) - (data.used_credits ?? 0),
              used_credits: data.used_credits ?? 0,
              total_credits: data.total_credits ?? 0,
            }
          : { remaining_credits: 0, used_credits: 0, total_credits: 0 };

        if (!creditsData || (creditsData.remaining_credits || 0) < totalCost) {
          setError(
            localize(
              `Crédits insuffisants pour lancer cette série de scans. ${totalCost} crédits requis.`,
              `Not enough credits to launch this batch of scans. ${totalCost} credits required.`
            )
          );
          setLoading(false);
          stopProgress(false);
          return;
        }

        const newUsed = (creditsData.used_credits ?? 0) + totalCost;
        const { error: reserveError } = await supabase
          .from('credits')
          .update({
            used_credits: newUsed,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        if (reserveError) {
          console.error('Erreur réservation crédits:', reserveError);
          setError(localize('Impossible de réserver vos crédits.', 'Unable to reserve your credits.'));
          setLoading(false);
          stopProgress(false);
          return;
        }

        creditsData.used_credits = newUsed;
        creditsData.remaining_credits = (creditsData.total_credits ?? 0) - newUsed;
        if (typeof refreshCredits === 'function') {
          refreshCredits().catch((err) => console.error('Erreur refresh credits:', err));
        }
      }

      const displayNames = normalizedUrls.map((url) => new URL(url).hostname);
      const scanInserts = normalizedUrls.map((url, index) => ({
        user_id: user.id,
        site_name: displayNames[index],
        site_url: url,
        scan_type: scanType,
        status: 'pending',
      }));

      const { data: scanRows, error: scanError } = await supabase
        .from('scans')
        .insert(scanInserts)
        .select();

      if (scanError || !scanRows || scanRows.length === 0) {
        throw scanError || new Error(localize('Impossible de créer les enregistrements de scan.', 'Unable to create scan records.'));
      }

      await supabase.from('alerts').insert(
        scanRows.map((row, index) => ({
          user_id: user.id,
          scan_id: row.id,
          title: localize('Scan lancé', 'Scan started'),
          message: localize(
            `Le scan de ${displayNames[index]} (${row.site_url}) a été lancé avec succès.`,
            `Scan for ${displayNames[index]} (${row.site_url}) started successfully.`
          ),
          type: 'system',
          severity: 'info',
        }))
      );

      const API_BASE = window.location.origin + '/api';

      const basePayload = scanRows.map((row) => ({
        url: row.site_url,
        mode: scanType,
        scan_id: row.id,
        frontend_scan_id: row.id,
        user_id: user.id,
      }));

      const response = await fetch(`${API_BASE}/scan-auto-detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Max-Concurrent-Scans': concurrencyLimit.toString(),
        },
        body: JSON.stringify(basePayload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erreur API FastAPI:', text);
        throw new Error(localize('Échec du lancement du scan.', 'Scan launch failed.'));
      }

      const result = await response.json();

      if (Array.isArray(result?.scan_ids) && result.scan_ids.length > 0) {
        const uniqueIds = (result.scan_ids as string[]).filter(
          (id, index, arr) => arr.indexOf(id) === index
        );
        await Promise.all(
          uniqueIds.map((scanId) =>
            supabase
              .from('scans')
              .update({ backend_scan_id: scanId })
              .eq('id', scanId)
          )
        );
      }

      if (!DISABLE_CREDIT_CHECK) {
        const scanIds = scanRows.map((row) => row.id).filter(Boolean);
        trackCreditConsumption(scanIds);
      }

      if (scanType === 'complete') {
        try {
          const storageKey = 'pending_full_scan_ids';
          const existingRaw = window.sessionStorage.getItem(storageKey);
          const existing = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];
          const next = Array.from(
            new Set([
              ...existing.filter(Boolean),
              ...scanRows.map((row) => String(row.id)).filter(Boolean),
            ])
          );
          window.sessionStorage.setItem(storageKey, JSON.stringify(next));
        } catch (storageError) {
          console.warn('Impossible de mémoriser les scans complets en attente:', storageError);
        }
      }

      stopProgress(true);
      // ✅ Redirection vers la page des rapports
      router.push('/dashboard/reports');
    } catch (err) {
      console.error('Error starting scan:', err);
      setError(localize('Une erreur est survenue lors du lancement du scan.', 'An error occurred while starting the scan.'));
      stopProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const networkScanPayload = networkDialogResult?.network_scan ?? null;
  const sslPayload = networkScanPayload?.ssl ?? null;
  const sslMode = networkScanPayload?.ssl_mode as string | undefined;
  const sslFallback = Boolean(networkScanPayload?.ssl_fallback);
  const isSslLoading = networkLoading && networkDialogMode === 'ssl';
  const isNetworkLoading = networkLoading && networkDialogMode === 'network';
  const isAnyQuickLoading = loading || networkLoading;
  const quickToolCopy: Record<
    'ssl' | 'network',
    {
      label: string;
      light: { title: string; description: string; meta: string };
      full: { title: string; description: string; meta: string };
      buttonLabel: string;
    }
  > = {
    ssl: {
      label: localize('Scanner SSL/TLS', 'SSL/TLS scanner'),
      light: {
        title: localize('Scan léger', 'Light scan'),
        description: localize(
          'Vérifie le certificat (validité, expiration, émetteur).',
          'Checks certificate validity, expiration, and issuer.'
        ),
        meta: localize('Couverture: certificat uniquement', 'Coverage: certificate only'),
      },
      full: {
        title: localize('Scan complet', 'Full scan'),
        description: localize(
          'Analyse TLS avancée et vulnérabilités connues.',
          'Advanced TLS analysis and known vulnerabilities.'
        ),
        meta: localize('Couverture: protocoles + failles', 'Coverage: protocols + vulns'),
      },
      buttonLabel: localize('Lancer le scan SSL/TLS', 'Start SSL/TLS scan'),
    },
    network: {
      label: localize('Scanner réseau', 'Network scanner'),
      light: {
        title: localize('Scan léger', 'Light scan'),
        description: localize(
          'Scan rapide des services réseau essentiels.',
          'Quick scan of essential network services.'
        ),
        meta: localize('Couverture: services essentiels', 'Coverage: essential services'),
      },
      full: {
        title: localize('Scan complet', 'Full scan'),
        description: localize(
          'Analyse complète des services réseau et SSL.',
          'Full analysis of network services and SSL.'
        ),
        meta: localize('Couverture: services étendus', 'Coverage: extended services'),
      },
      buttonLabel: localize('Lancer le scan réseau', 'Start network scan'),
    },
  };
  const activeToolCopy = activeTool === 'website' ? null : quickToolCopy[activeTool];
  const activeToolLoading =
    activeTool === 'ssl'
      ? isSslLoading
      : activeTool === 'network'
        ? isNetworkLoading
        : false;
  const allowMultipleUrls = PLAN_CONCURRENCY[planType] > 1;

  const startQuickToolScan = async () => {
    if (activeTool === 'ssl') {
      await runNetworkScan('ssl', toolScanMode);
      return;
    }
    if (activeTool === 'network') {
      await runNetworkScan('network', toolScanMode);
      return;
    }
  };

  const renderSslSection = () => {
    if (!sslPayload) {
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {localize(
            'Aucun résultat SSL/TLS disponible. Vérifiez la configuration serveur.',
            'No SSL/TLS results available. Check server configuration.'
          )}
        </div>
      );
    }

    if (sslPayload?.valid !== undefined) {
      return (
        <div className="space-y-4 text-sm text-slate-700">
          {sslMode && (
            <p className="text-xs text-slate-500">
              {localize('Mode:', 'Mode:')} {sslMode}
              {sslFallback ? ` (${localize('fallback', 'fallback')})` : ''}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Badge className={sslPayload.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}>
              {sslPayload.valid
                ? localize('Certificat valide', 'Valid certificate')
                : localize('Certificat invalide', 'Invalid certificate')}
            </Badge>
            {sslPayload.days_remaining !== undefined && sslPayload.days_remaining !== null && (
              <span className="text-xs text-slate-500">
                {localize('Jours restants:', 'Days remaining:')} {sslPayload.days_remaining}
              </span>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">{localize('Début', 'Valid from')}</p>
              <p>{sslPayload.not_before || '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">{localize('Expiration', 'Expires')}</p>
              <p>{sslPayload.not_after || '—'}</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-slate-400">{localize('Sujet', 'Subject')}</p>
              <p className="break-words text-xs text-slate-600">
                {sslPayload.subject ? JSON.stringify(sslPayload.subject) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">{localize('Émetteur', 'Issuer')}</p>
              <p className="break-words text-xs text-slate-600">
                {sslPayload.issuer ? JSON.stringify(sslPayload.issuer) : '—'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 text-sm text-slate-700">
        {sslMode && (
          <p className="text-xs text-slate-500">
            {localize('Mode:', 'Mode:')} {sslMode}
            {sslFallback ? ` (${localize('fallback', 'fallback')})` : ''}
          </p>
        )}
        {sslPayload.protocols && (
          <div>
            <p className="text-xs uppercase text-slate-400">{localize('Protocoles', 'Protocols')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(sslPayload.protocols).map(([protocol, status]) => (
                <Badge key={protocol} variant="secondary" className="text-xs">
                  {protocol}: {String(status)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(sslPayload.vulnerabilities) && sslPayload.vulnerabilities.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-400">{localize('Vulnérabilités', 'Vulnerabilities')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {sslPayload.vulnerabilities.map((item: string, idx: number) => (
                <li key={`ssl-vuln-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(sslPayload.recommendations) && sslPayload.recommendations.length > 0 && (
          <div>
            <p className="text-xs uppercase text-slate-400">{localize('Recommandations', 'Recommendations')}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {sslPayload.recommendations.map((item: string, idx: number) => (
                <li key={`ssl-rec-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Nouveau Scan', 'New scan')}
            </h1>
            <p className="text-slate-600 mt-1">
              {localize('Lancez une analyse de sécurité de votre site web', 'Launch a security scan for your website')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard?section=support')}
            className="flex items-center gap-2"
          >
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            {localize('Support Technique', 'Support')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Configuration du scan', 'Scan configuration')}</CardTitle>
            <CardDescription>
              {localize('Entrez les informations du site à scanner', 'Provide the site information to scan')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* === URL === */}
              <div className="space-y-2">
                <Label htmlFor="siteUrl">{localize('URL du site', 'Website URL')}</Label>
                {allowMultipleUrls ? (
                  <Textarea
                    id="siteUrl"
                    placeholder={`https://example.com\nhttps://example.org`}
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    className="min-h-[120px]"
                    required
                  />
                ) : (
                  <Input
                    id="siteUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    required
                  />
                )}
               
              </div>

            

              {/* === Tool picker === */}
              <div className="space-y-3">
                <Label>{localize('Choisir un scanner', 'Pick a scanner')}</Label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(
                    [
                      {
                        key: 'website',
                        label: localize('Scanner site web', 'Website Scanner'),
                        description: localize('Analyse applicative (light/complete).', 'Web app scan (light/complete).'),
                        icon: <Scan className="h-4 w-4" />,
                      },
                      {
                        key: 'ssl',
                        label: localize('Scanner SSL/TLS', 'SSL/TLS Scanner'),
                        description: localize('Certificats, protocoles, vulnérabilités.', 'Certificates, protocols, vulnerabilities.'),
                        icon: <Lock className="h-4 w-4" />,
                      },
                      {
                        key: 'network',
                        label: localize('Scanner réseau', 'Network Scanner'),
                        description: localize('DNS, services, SSL (rapide/complet).', 'DNS, services, SSL (light/full).'),
                        icon: <Network className="h-4 w-4" />,
                      },
                    ] as Array<{
                      key: 'website' | 'ssl' | 'network';
                      label: string;
                      description: string;
                      icon: JSX.Element;
                    }>
                  ).map((tool) => {
                    const selected = activeTool === tool.key;
                    return (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => setActiveTool(tool.key)}
                        className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
                          selected ? 'border-slate-400 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="rounded-md bg-slate-100 p-2 text-slate-700">{tool.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold">{tool.label}</p>
                            {selected && (
                              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                {localize('Actif', 'Active')}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{tool.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeTool !== 'website' && activeToolCopy && (
                <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                  <Label>{activeToolCopy.label}</Label>
                  <RadioGroup
                    value={toolScanMode}
                    onValueChange={(value) => setToolScanMode(value as 'light' | 'full')}
                  >
                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="light" id="tool-light" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="tool-light" className="cursor-pointer flex items-center">
                          <Zap className="w-4 h-4 mr-2 text-yellow-600" />
                          <span className="font-medium">{activeToolCopy.light.title}</span>
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">{activeToolCopy.light.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{activeToolCopy.light.meta}</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="full" id="tool-full" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="tool-full" className="cursor-pointer flex items-center">
                          <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
                          <span className="font-medium">{activeToolCopy.full.title}</span>
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">{activeToolCopy.full.description}</p>
                        <p className="text-xs text-slate-500 mt-1">{activeToolCopy.full.meta}</p>
                      </div>
                    </div>
                  </RadioGroup>

                  {networkError && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{networkError}</div>
                  )}

                  <Button
                    type="button"
                    className="w-full"
                    onClick={startQuickToolScan}
                    disabled={isAnyQuickLoading}
                  >
                    {activeToolLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {activeToolCopy.buttonLabel}
                  </Button>
                </div>
              )}

              {/* === Type de scan === */}
              {activeTool === 'website' && (
                <div
                  ref={websiteConfigRef}
                  className="space-y-3 rounded-lg border border-slate-200 p-4"
                >
                  <Label>{localize('Website scanner', 'Website scanner')}</Label>
                  <RadioGroup
                    value={scanType}
                    onValueChange={(v) => {
                      setScanType(v as 'light' | 'complete');
                      setActiveTool('website');
                    }}
                  >
                    <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                      <RadioGroupItem value="light" id="light" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="light" className="cursor-pointer flex items-center">
                          <Zap className="w-4 h-4 mr-2 text-yellow-600" />
                          <span className="font-medium">{localize('Scan Léger', 'Light scan')}</span>
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">
                          {localize(
                            'Analyse rapide des vulnérabilités courantes. Idéal pour un aperçu général.',
                            'Quick check for common vulnerabilities. Ideal for a general overview.'
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {localize('Durée: ~5 minutes | Coût: 1 crédit', 'Duration: ~5 minutes | Cost: 1 credit')}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`flex items-start space-x-3 p-4 border rounded-lg ${
                        canUseFullScan ? 'hover:bg-slate-50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <RadioGroupItem value="complete" id="complete" className="mt-1" disabled={!canUseFullScan} />
                      <div className="flex-1">
                        <Label
                          htmlFor="complete"
                          className={`flex items-center ${canUseFullScan ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2 text-emerald-600" />
                          <span className="font-medium">{localize('Scan Complet', 'Full scan')}</span>
                          {!canUseFullScan && (
                            <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                              {localize('Pro/Enterprise/Admin', 'Pro/Enterprise/Admin')}
                            </span>
                          )}
                        </Label>
                        <p className="text-sm text-slate-600 mt-1">
                          {localize(
                            'Analyse approfondie avec tests actifs et couverture élargie.',
                            'In-depth analysis with active tests and extended coverage.'
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {localize('Durée: ~20 minutes | Coût: 3 crédits', 'Duration: ~20 minutes | Cost: 3 credits')}
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {activeTool === 'website' && (
                <>
                  {/* === Erreur === */}
                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
                  )}

                  {/* === Bouton === */}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {localize('Analyse en cours...', 'Scan in progress...')} {Math.round(scanProgress)}%
                      </>
                    ) : (
                      localize('Lancer le scan', 'Start scan')
                    )}
                  </Button>

                  {loading && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{localize('Progression du scan', 'Scan progress')}</span>
                        <span>{Math.round(scanProgress)}%</span>
                      </div>
                      <Progress value={scanProgress} />
                    </div>
                  )}
                </>
              )}
            </form>
          </CardContent>
        </Card>

        <Dialog open={networkDialogOpen} onOpenChange={setNetworkDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{localize('Résultats du scan réseau', 'Network scan results')}</DialogTitle>
              <DialogDescription>
                {networkDialogTarget || localize('Scan réseau', 'Network scan')}
              </DialogDescription>
            </DialogHeader>

            {!networkScanPayload ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {localize('Aucun résultat réseau disponible.', 'No network results available.')}
              </div>
            ) : (
              renderSslSection()
            )}
          </DialogContent>
        </Dialog>


      </div>
    </DashboardLayout>
  );
}
