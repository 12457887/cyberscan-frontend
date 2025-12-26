'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2, Globe, Lock, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Severity = 'low' | 'medium' | 'high' | 'critical';

type QuickScanResult = {
  cmsLabel: string | null;
  cmsSource: 'scan' | 'analyzer' | null;
  riskLevel: Severity | null;
  severityCounts: Record<Severity, number>;
  scanTime?: number;
};

type ScanApiResult = {
  cms_type?: string | null;
  scan_time?: number;
  scan_id?: string | null;
  mongo_id?: string | null;
  cms_scan?: { cves?: Array<{ severity?: string | null }> } | null;
  nuclei_scan?: { parsed_results?: Array<{ severity?: string | null }> } | null;
  zap_scan?: { alerts?: Array<{ risk?: string | null; severity?: string | null }> } | null;
  severity_counts?: Record<string, number> | null;
  risk_level?: string | null;
};

type AnalyzerResult = {
  domain?: string;
  cms?: string[];
  online?: boolean;
  ip?: string | null;
  status_code?: number | null;
  title?: string | null;
  error?: string | null;
  technologies?: string[];
};

const severityOrder: Severity[] = ['low', 'medium', 'high', 'critical'];
const zapSeverityMap: Record<string, Severity | undefined> = {
  informational: 'low',
  info: 'low',
  low: 'low',
  warning: 'medium',
  medium: 'medium',
  high: 'high',
  severe: 'high',
  critical: 'critical',
};
const zapRiskCodeMap: Record<string, Severity> = {
  '0': 'low', // informational
  '1': 'low',
  '2': 'medium',
  '3': 'high',
  '4': 'critical',
};

const emptySeverityCounts = (): Record<Severity, number> => ({
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
});

const normalizeSeverityValue = (value?: string | null): Severity | null => {
  if (!value) return null;
  const normalized = value.toLowerCase() as Severity;
  return severityOrder.includes(normalized) ? normalized : null;
};

const normalizeServerCounts = (counts?: Record<string, number> | null): Record<Severity, number> | null => {
  if (!counts || typeof counts !== 'object') {
    return null;
  }
  let provided = false;
  const normalized = emptySeverityCounts();
  severityOrder.forEach((severity) => {
    const value = counts[severity] ?? counts[severity.toUpperCase()];
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[severity] = value;
      provided = true;
    }
  });
  return provided ? normalized : null;
};

const deriveHighestFromCounts = (counts: Record<Severity, number>): Severity | null => {
  for (let index = severityOrder.length - 1; index >= 0; index -= 1) {
    const severity = severityOrder[index];
    if (counts[severity] > 0) {
      return severity;
    }
  }
  return null;
};

const mapZapAlertSeverity = (alert: { risk?: string | null; severity?: string | null; riskcode?: string | number | null; riskCode?: string | number | null }): Severity | null => {
  const textual = (alert?.risk || alert?.severity || '').toLowerCase();
  if (textual && zapSeverityMap[textual]) {
    return zapSeverityMap[textual] ?? null;
  }

  const numericValue = alert?.riskcode ?? alert?.riskCode;
  if (numericValue !== undefined && numericValue !== null) {
    const code = String(numericValue).trim();
    if (code && zapRiskCodeMap[code] !== undefined) {
      return zapRiskCodeMap[code];
    }
  }

  return null;
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return candidate;
  }
};

const formatCmsLabel = (name?: string | null) => {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower === 'unknown' || lower === 'inconnu') return null;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export function QuickScanCard() {
  const { choose } = useLanguage();
  const router = useRouter();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const riskLabels = useMemo(
    () =>
      choose({
        fr: { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' },
        en: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
      }),
    [choose]
  );

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickScanResult | null>(null);
  const [analyzerDetails, setAnalyzerDetails] = useState<AnalyzerResult | null>(null);
  const [freeScanId, setFreeScanId] = useState<string | null>(null);
  const [reportScanId, setReportScanId] = useState<string | null>(null);
  const [reportMongoId, setReportMongoId] = useState<string | null>(null);
  const [unlockName, setUnlockName] = useState('');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockSubmittedEmail, setUnlockSubmittedEmail] = useState<string | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [resultUnlocked, setResultUnlocked] = useState(false);
  const [duplicateEmailUsed, setDuplicateEmailUsed] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastScannedUrl, setLastScannedUrl] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => () => {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current);
    }
  }, []);

  const pickHighest = (current: Severity | null, candidate: Severity | null) => {
    if (!candidate) return current;
    if (!current) return candidate;
    return severityOrder.indexOf(candidate) > severityOrder.indexOf(current) ? candidate : current;
  };

  const computeRiskFromResult = (scan: ScanApiResult): QuickScanResult => {
    const cmsLabel = formatCmsLabel(scan.cms_type);
    const cmsSource: 'scan' | null = scan.cms_type ? 'scan' : null;
    const serverCounts = normalizeServerCounts(scan.severity_counts);
    const serverRiskLevel = normalizeSeverityValue(scan.risk_level);

    if (serverCounts) {
      return {
        cmsLabel,
        cmsSource,
        riskLevel: serverRiskLevel ?? deriveHighestFromCounts(serverCounts),
        severityCounts: serverCounts,
        scanTime: scan.scan_time,
      };
    }

    const severityCounts = emptySeverityCounts();
    let highest: Severity | null = null;

    const registerSeverity = (value?: string | null) => {
      const normalized = normalizeSeverityValue(value);
      if (!normalized) return;
      severityCounts[normalized] += 1;
      highest = pickHighest(highest, normalized);
    };

    scan.cms_scan?.cves?.forEach((cve) => registerSeverity(cve?.severity));
    scan.nuclei_scan?.parsed_results?.forEach((item) => registerSeverity(item?.severity));
    const zapAlerts = scan.zap_scan?.alerts ?? [];
    zapAlerts.forEach((alert) => {
      const mapped = mapZapAlertSeverity(alert);
      if (mapped) registerSeverity(mapped);
    });

    if (!highest && zapAlerts.length > 0) {
      // If nuclei returned nothing but ZAP raised alerts without explicit severity,
      // fall back to marking the site as low risk at least.
      const fallbackSeverity =
        zapAlerts.map((alert) => mapZapAlertSeverity(alert)).find((sev): sev is Severity => !!sev) ?? 'low';
      registerSeverity(fallbackSeverity);
    }

    return {
      cmsLabel,
      cmsSource,
      riskLevel: highest,
      severityCounts,
      scanTime: scan.scan_time,
    };
  };

  const duplicateEmailMessage =
    'This email already used the free scan. Please sign in or sign up to continue.';

  const logFreeScan = async (payload: {
    id?: string | null;
    url?: string;
    email?: string;
    cms_label?: string | null;
    risk_level?: string | null;
    analyzer_domain?: string | null;
    severity_counts?: Record<Severity, number>;
    scan_id?: string | null;
    mongo_report_id?: string | null;
  }) => {
    try {
      const response = await fetch('/service/free-scan-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        console.error('Failed to log scan');
        return null;
      }
      const data = await response.json();
      return data?.id as string | null;
    } catch (err) {
      console.error('Error logging scan', err);
      return null;
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setAnalyzerDetails(null);
    setFreeScanId(null);
    setReportScanId(null);
    setReportMongoId(null);
    setResultUnlocked(false);
    setUnlockSubmittedEmail(null);
    setUnlockName('');
    setUnlockEmail('');
    setUnlockStatus(null);

    if (!url.trim()) {
      setError(localize('Merci de saisir une URL valide.', 'Please enter a valid URL.'));
      return;
    }
    if (!termsAccepted) {
      setError(
        localize(
          "Merci de confirmer que vous avez l'autorisation de scanner ce domaine.",
          'Please confirm that you are authorized to scan this domain.'
        )
      );
      return;
    }

    const normalizedUrl = normalizeUrl(url);
    setLastScannedUrl(normalizedUrl);
    let analyzerDomain: string;
    try {
      analyzerDomain = new URL(normalizedUrl).hostname;
    } catch {
      setError(localize('URL invalide.', 'Invalid URL.'));
      return;
    }

    setLoading(true);
    try {
      const payload = [
        {
          url: normalizedUrl,
          mode: 'light',
          preview_only: true,
        },
      ];

      const analyzerPromise = fetch(`/service/analyzer/analyze/${encodeURIComponent(analyzerDomain)}`)
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as AnalyzerResult;
        })
        .catch(() => null);

      const response = await fetch('/service/scan-auto-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message: string | undefined;
        const rawBody = await response.text();
        try {
          // Try JSON first
          const asJson = rawBody ? JSON.parse(rawBody) : null;
          message = asJson?.detail || asJson?.message || asJson?.error;
        } catch {
          // If backend (or a proxy like Cloudflare) returns HTML, suppress it
          const looksLikeHtml = /<html|<!doctype/i.test(rawBody || '');
          if (!looksLikeHtml) {
            message = rawBody;
          }
        }
        const fallback =
          response.status >= 500
            ? localize(
                'Le service de scan est temporairement indisponible. Merci de réessayer dans quelques instants.',
                'Our scanning service is temporarily unavailable. Please try again shortly.'
              )
            : localize(
                "Le scan n'a pas pu démarrer. Vérifiez l'URL et réessayez.",
                'The scan could not start. Please verify the URL and try again.'
              );
        throw new Error(message || fallback);
      }

      const data = await response.json();
      const analyzerData = await analyzerPromise;
      if (analyzerData) {
        setAnalyzerDetails(analyzerData);
      }
      const scanRaw = data?.results?.[0];

      if (!scanRaw) {
        throw new Error(localize("Impossible d'obtenir les résultats du scan.", 'Scan results are unavailable.'));
      }

      const scanId = (scanRaw as ScanApiResult)?.scan_id ?? null;
      const mongoId = (scanRaw as ScanApiResult)?.mongo_id ?? null;
      setReportScanId(scanId);
      setReportMongoId(mongoId);
      const computed = computeRiskFromResult(scanRaw as ScanApiResult);
      const analyzerCms =
        analyzerData &&
        Array.isArray(analyzerData.cms) &&
        analyzerData.cms.length > 0
          ? formatCmsLabel(analyzerData.cms[0])
          : null;


      const combinedResult = {
        ...computed,
        cmsLabel: analyzerCms ?? computed.cmsLabel,
        cmsSource:
          analyzerCms && analyzerCms !== computed.cmsLabel
            ? 'analyzer'
            : computed.cmsLabel
            ? computed.cmsSource
            : null,
      };

      setResult(combinedResult);
      setResultUnlocked(false);
      setUnlockSubmittedEmail(null);

      const loggedId = await logFreeScan({
        url: normalizedUrl,
        cms_label: combinedResult.cmsLabel,
        risk_level: combinedResult.riskLevel,
        analyzer_domain: analyzerDomain,
        severity_counts: combinedResult.severityCounts,
        scan_id: scanId,
        mongo_report_id: mongoId,
      });
      if (loggedId) {
        setFreeScanId(loggedId);
      }
    } catch (err: any) {
      console.error('Quick scan error:', err);
      const message =
        err?.message &&
        // Avoid leaking low-level fetch errors to users
        !/TypeError: fetch failed|Failed to fetch/i.test(err.message)
          ? err.message
          : localize(
              'Connexions impossibles pour ce site. Vérifiez que le domaine répond et réessayez.',
              'We could not reach this site. Please make sure it is reachable and try again.'
            );
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const sendReportEmail = async (emailValue: string) => {
    if (!reportScanId && !reportMongoId) {
      throw new Error(
        localize(
          "Relancez un scan gratuit pour générer le rapport avant de l'envoyer.",
          'Please rerun a quick scan so the report can be generated before sending.'
        )
      );
    }

    const payload = {
      id: freeScanId,
      url: freeScanId ? undefined : lastScannedUrl || url,
      email: emailValue,
      cms_label: result?.cmsLabel ?? null,
      risk_level: result?.riskLevel ?? null,
      analyzer_domain: analyzerDetails?.domain ?? null,
      severity_counts: result?.severityCounts,
      scan_id: reportScanId,
      mongo_report_id: reportMongoId,
    };
    const id = await logFreeScan(payload);
    if (!id) {
      throw new Error(localize('Impossible de sauvegarder votre demande.', 'Unable to save your request.'));
    }
    setFreeScanId(id);

    const response = await fetch('/service/free-scan-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailValue,
        url: lastScannedUrl || url,
        cms_label: result?.cmsLabel ?? null,
        risk_level: result?.riskLevel ?? null,
        scan_id: reportScanId,
        mongo_report_id: reportMongoId,
      }),
    });
    if (!response.ok) {
      const raw = await response.text();
      const statusCode = response.status;
      let message = localize("Impossible d'envoyer le rapport.", 'Unable to send the report.');
      if (statusCode === 403) {
        message = duplicateEmailMessage;
      } else {
        try {
          const parsed = raw ? JSON.parse(raw) : null;
          message = parsed?.detail || parsed?.message || parsed?.error || message;
        } catch {
          if (raw && !/<html|<!doctype/i.test(raw)) {
            message = raw;
          }
        }
      }
      const error = new Error(message) as Error & { status?: number };
      error.status = statusCode;
      throw error;
    }
  };

  const processUnlockSubmission = async (): Promise<boolean> => {
    setUnlockStatus(null);
    setDuplicateEmailUsed(false);
    if (!unlockName.trim()) {
      setUnlockStatus({
        type: 'error',
        message: localize('Merci de renseigner votre nom complet.', 'Please enter your full name.'),
      });
      return false;
    }
    if (!unlockEmail.trim()) {
      setUnlockStatus({
        type: 'error',
        message: localize('Merci de renseigner votre email professionnel.', 'Please enter your email.'),
      });
      return false;
    }
    setUnlockLoading(true);
    try {
      const emailToSend = unlockEmail.trim();
      await sendReportEmail(emailToSend);
      setResultUnlocked(true);
      setUnlockStatus({
        type: 'success',
        message: localize('Rapport envoyé ! Résultats débloqués.', 'Report sent! Results unlocked.'),
      });
      setUnlockSubmittedEmail(emailToSend);
      setUnlockName('');
      setUnlockEmail('');
      if (redirectTimer.current) {
        clearTimeout(redirectTimer.current);
      }
      redirectTimer.current = setTimeout(() => setUnlockStatus(null), 5000);
      return true;
    } catch (err: any) {
      const statusCode = typeof err?.status === 'number' ? err.status : undefined;
      const message =
        err instanceof Error ? err.message : localize("Impossible d'envoyer le rapport.", 'Unable to send the report.');
      setUnlockStatus({ type: 'error', message });
      setDuplicateEmailUsed(statusCode === 403);
      return false;
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleUnlockSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await processUnlockSubmission();
  };

  const riskBadgeClass = (risk: Severity) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  };

  const severityTheme: Record<Severity, { bg: string; border: string; text: string; accent: string }> = {
    low: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      text: 'text-emerald-700',
      accent: 'bg-emerald-500',
    },
    medium: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-100',
      text: 'text-yellow-700',
      accent: 'bg-yellow-400',
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      accent: 'bg-orange-600',
    },
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      text: 'text-red-700',
      accent: 'bg-red-500',
    },
  };

  return (
    <Card className="bg-gradient-to-br from-white via-slate-50 to-slate-100 shadow-2xl border border-slate-200 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_55%)] pointer-events-none" />
      <CardHeader className="pb-4 relative">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <ShieldCheck className="w-5 h-5 text-blue-500" />
          {localize('Aperçu sécurisé', 'Secure preview')}
        </div>
        <CardTitle className="text-slate-900 mt-2">
          {localize('Scan express de votre site', 'Instant website scan')}
        </CardTitle>
        <CardDescription className="text-slate-600">
          {localize(
            'Détectez le niveau de risque avant de créer votre compte.',
            'Check the risk level before creating an account.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 relative">
        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
          <Input
            type="url"
            className="h-12 flex-1"
            placeholder={localize('https://votre-site.com', 'https://your-site.com')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            required
          />
          <Button
            type="submit"
            className="h-12 px-8 text-white bg-gradient-to-r from-blue-600 to-cyan-500"
            disabled={loading || !termsAccepted}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {localize('Analyse…', 'Scanning…')}
              </span>
            ) : (
              localize('Scanner maintenant', 'Scan now')
            )}
          </Button>
        </form>

        <label
          htmlFor="quick-scan-permission"
          className="flex items-center gap-3 text-[11px] leading-snug text-slate-500"
        >
          <Checkbox
            id="quick-scan-permission"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            aria-describedby="quick-scan-permission-text"
          />
          <p id="quick-scan-permission-text" className="m-0">
            {localize("Je déclare que ", 'I declare that ')}
            <span className="italic font-semibold">
              {localize(
                "j'ai l'autorisation de scanner ce domaine et que j'accepte les ",
                'I have permission to scan this domain and that I agree with the '
              )}
            </span>
            <Link href="/conditions-generales" className="text-blue-600 hover:text-blue-500 font-medium">
              {localize("Conditions d'utilisation", 'Terms of Use')}
            </Link>
            <span className="italic font-semibold">.</span>
          </p>
        </label>

        <div className="flex items-center gap-1 text-xs text-slate-500">
          <Lock className="w-4 h-4" />
          {localize('Analyse 100% gratuite et confidentielle', '100% free and confidential analysis')}
        </div>

        {loading && (
          <div className="rounded-2xl border border-blue-100 bg-white/90 shadow-inner p-6 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-800">
              {localize('Analyse en cours…', 'Scan in progress…')}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {localize(
                'Merci de patienter pendant que nous collectons les données de sécurité. Cette étape peut prendre jusqu’à une minute.',
                'Please wait while we collect security signals. This may take up to a minute.'
              )}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && !resultUnlocked && (
          <div className="mt-6 bg-white border border-blue-100 rounded-2xl p-6 shadow-xl text-center space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-blue-500">
                {localize('Débloquez votre rapport', 'Unlock your report')}
              </p>
              <h4 className="text-lg font-semibold text-slate-900">
                {localize('Entrez vos informations pour afficher les résultats', 'Enter your details to view the results')}
              </h4>
              <p className="text-xs text-slate-500">
                {localize(
                  'Nous vous envoyons immédiatement le rapport détaillé par email.',
                  'We will immediately email you the detailed report.'
                )}
              </p>
            </div>
            <form onSubmit={handleUnlockSubmit} className="grid gap-3 text-left">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600" htmlFor="unlock-name">
                  {localize('Nom complet', 'Full name')}
                </label>
                <Input
                  id="unlock-name"
                  type="text"
                  placeholder={localize('Ex. Marie Dupont', 'e.g. Jane Doe')}
                  value={unlockName}
                  onChange={(event) => setUnlockName(event.target.value)}
                  disabled={unlockLoading}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600" htmlFor="unlock-email">
                  Email
                </label>
                <Input
                  id="unlock-email"
                  type="email"
                  placeholder="you@company.com"
                  value={unlockEmail}
                  onChange={(event) => setUnlockEmail(event.target.value)}
                  disabled={unlockLoading}
                  required
                />
              </div>
              {unlockStatus && (
                <p
                  className={`text-xs ${
                    unlockStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {unlockStatus.message}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={unlockLoading}>
                {unlockLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {localize('Envoi...', 'Sending...')}
                  </span>
                ) : (
                  localize('Débloquer votre rapport', 'Unlock your report')
                )}
              </Button>
              {duplicateEmailUsed && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-2">
                  <p>{duplicateEmailMessage}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => router.push('/login')}>
                      Sign in
                    </Button>
                    <Button type="button" className="flex-1" onClick={() => router.push('/register')}>
                      Sign up
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {result && resultUnlocked && (
          <div className="mt-6 bg-white border border-emerald-100 rounded-2xl p-5 shadow-lg text-center space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-600">
              {localize('Rapport envoyé', 'Report sent')}
            </p>
            <h4 className="text-lg font-semibold text-slate-900">
              {localize('Les résultats sont débloqués et visibles ci-dessous.', 'Results are unlocked and visible below.')}
            </h4>
            <p className="text-sm text-slate-600">
              {unlockSubmittedEmail
                ? localize(
                    `Un exemplaire a été envoyé à ${unlockSubmittedEmail}.`,
                    `A copy was sent to ${unlockSubmittedEmail}.`
                  )
                : localize(
                    'Votre rapport détaillé vient d’être envoyé.',
                    'Your detailed report has just been sent.'
                  )}
            </p>
          </div>
        )}

        {result && (
          <div className="mt-6">
            <div
              className={`bg-white rounded-2xl p-5 space-y-4 border border-slate-100 shadow-inner transition-all duration-300 ${
                resultUnlocked ? '' : 'blur-sm opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {localize('Niveau de risque', 'Risk level')}
                  </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {result.riskLevel ? (
                    <Badge className={`text-sm ${riskBadgeClass(result.riskLevel)}`}>
                      {riskLabels[result.riskLevel]}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-600 border-slate-300">
                      {localize('Non évalué', 'Not assessed')}
                    </Badge>
                  )}
                  {(() => {
                    const analyzerCmsFallback = formatCmsLabel(
                      analyzerDetails?.cms && analyzerDetails.cms.length > 0 ? analyzerDetails.cms[0] : null
                    );
                    const cmsLabel = result.cmsLabel || analyzerCmsFallback;
                    const cmsSourceLabel = result.cmsLabel
                      ? result.cmsSource === 'analyzer'
                        ? localize('(analyse IA)', '(AI detection)')
                        : localize('(scan)', '(scan)')
                      : analyzerCmsFallback
                      ? localize('(analyse IA)', '(AI detection)')
                      : localize('(non détecté)', 'Not detected');
                    return (
                      <span className="text-xs text-slate-500">
                        {localize('CMS détecté :', 'Detected CMS:')}{' '}
                        <strong className="text-slate-700">
                          {cmsLabel || localize('Inconnu', 'Unknown')} {cmsSourceLabel}
                        </strong>
                      </span>
                    );
                  })()}
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {severityOrder.map((level) => (
                <div
                  key={level}
                  className={`rounded-xl p-3 border shadow-sm text-center ${severityTheme[level].bg} ${severityTheme[level].border}`}
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${severityTheme[level].accent}`} />
                    <p className={`text-xs font-semibold uppercase tracking-wide ${severityTheme[level].text}`}>
                      {riskLabels[level]}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${severityTheme[level].text}`}>
                    {result.severityCounts[level] ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {localize('Vulnérabilités', 'Vulnerabilities')}
                  </p>
                </div>
              ))}
            </div>

            {analyzerDetails && (
              <div className="grid sm:grid-cols-3 gap-3 text-sm text-slate-600">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs uppercase text-slate-500">{localize('Disponibilité', 'Availability')}</p>
                  <p className="font-semibold mt-1">
                    {analyzerDetails.error
                      ? localize('Injoignable', 'Unreachable')
                      : analyzerDetails.online
                      ? localize('En ligne', 'Online')
                      : localize('Hors ligne', 'Offline')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs uppercase text-slate-500">{localize('Adresse IP', 'IP address')}</p>
                  <p className="font-semibold mt-1">
                    {analyzerDetails.ip || localize('Non détectée', 'Not detected')}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs uppercase text-slate-500">{localize('Statut HTTP', 'HTTP status')}</p>
                  <p className="font-semibold mt-1">
                    {analyzerDetails.status_code ? analyzerDetails.status_code : localize('N/A', 'N/A')}
                  </p>
                </div>
              </div>
            )}

            {typeof result.scanTime === 'number' && (
              <p className="text-xs text-slate-500 text-right">
                {localize('Durée du scan :', 'Scan duration:')}{' '}
                <span className="font-semibold text-slate-700">{result.scanTime}s</span>
              </p>
            )}
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}
