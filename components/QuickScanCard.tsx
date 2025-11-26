'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle2, Globe, Lock, Loader2, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

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
  cms_scan?: { cves?: Array<{ severity?: string | null }> } | null;
  nuclei_scan?: { parsed_results?: Array<{ severity?: string | null }> } | null;
  zap_scan?: { alerts?: Array<{ risk?: string | null; severity?: string | null }> } | null;
};

type AnalyzerResult = {
  domain?: string;
  cms?: string[];
  online?: boolean;
  ip?: string | null;
  status_code?: number | null;
  title?: string | null;
  error?: string | null;
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

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatCmsLabel = (name?: string | null) => {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower === 'unknown' || lower === 'inconnu') return null;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export function QuickScanCard() {
  const { choose } = useLanguage();
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
  const [ctaEmail, setCtaEmail] = useState('');
  const [ctaStatus, setCtaStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [lastScannedUrl, setLastScannedUrl] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const pickHighest = (current: Severity | null, candidate: Severity | null) => {
    if (!candidate) return current;
    if (!current) return candidate;
    return severityOrder.indexOf(candidate) > severityOrder.indexOf(current) ? candidate : current;
  };

  const computeRiskFromResult = (scan: ScanApiResult): QuickScanResult => {
    const severityCounts: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    let highest: Severity | null = null;

    const registerSeverity = (value?: string | null) => {
      const normalized = (value || '').toLowerCase() as Severity;
      if (!severityOrder.includes(normalized)) return;
      severityCounts[normalized] += 1;
      highest = pickHighest(highest, normalized);
    };

    scan.cms_scan?.cves?.forEach((cve) => registerSeverity(cve?.severity));
    scan.nuclei_scan?.parsed_results?.forEach((item) => registerSeverity(item?.severity));
    scan.zap_scan?.alerts?.forEach((alert) => {
      const mapped = zapSeverityMap[(alert?.risk || alert?.severity || '').toLowerCase()];
      if (mapped) registerSeverity(mapped);
    });

    return {
      cmsLabel: formatCmsLabel(scan.cms_type),
      cmsSource: scan.cms_type ? 'scan' : null,
      riskLevel: highest,
      severityCounts,
      scanTime: scan.scan_time,
    };
  };

  const logFreeScan = async (payload: {
    id?: string | null;
    url?: string;
    email?: string;
    cms_label?: string | null;
    risk_level?: string | null;
    analyzer_domain?: string | null;
    severity_counts?: Record<Severity, number>;
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
    setCtaEmail('');
    setCtaStatus(null);

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
          const asJson = rawBody ? JSON.parse(rawBody) : null;
          message = asJson?.detail || asJson?.message || asJson?.error;
        } catch {
          message = rawBody;
        }
        throw new Error(
          message ||
            localize(
              "Le scan n'a pas pu démarrer. Réessayez dans quelques instants.",
              'The scan could not start. Please try again shortly.'
            )
        );
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

      const loggedId = await logFreeScan({
        url: normalizedUrl,
        cms_label: combinedResult.cmsLabel,
        risk_level: combinedResult.riskLevel,
        analyzer_domain: analyzerDomain,
        severity_counts: combinedResult.severityCounts,
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

  const handleCtaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setCtaStatus(null);
    if (!ctaEmail.trim()) {
      setCtaStatus({ type: 'error', message: localize('Merci de saisir un email.', 'Please enter an email.') });
      return;
    }
    setCtaLoading(true);
    const emailValue = ctaEmail.trim();
    const payload = {
      id: freeScanId,
      url: freeScanId ? undefined : lastScannedUrl || url,
      email: emailValue,
      cms_label: result?.cmsLabel ?? null,
      risk_level: result?.riskLevel ?? null,
      analyzer_domain: analyzerDetails?.domain ?? null,
      severity_counts: result?.severityCounts,
    };
    const id = await logFreeScan(payload);
    if (id) {
      setFreeScanId(id);
      try {
        await fetch('/service/free-scan-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailValue,
            url: lastScannedUrl || url,
            cms_label: result?.cmsLabel ?? null,
            risk_level: result?.riskLevel ?? null,
          }),
        });
      } catch (sendError) {
        console.error('Unable to send CTA email:', sendError);
      }
      setCtaStatus({
        type: 'success',
        message: localize('Merci ! Nous vous recontacterons avec le rapport complet.', 'Thanks! We will follow up with the full report.'),
      });
      setCtaEmail('');
    } else {
      setCtaStatus({
        type: 'error',
        message: localize('Impossible de sauvegarder votre demande.', 'Unable to save your request.'),
      });
    }
    setCtaLoading(false);
  };

  const riskBadgeClass = (risk: Severity) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <Lock className="w-4 h-4" />
            {localize('Analyse 100% gratuite et confidentielle', '100% free and confidential analysis')}
          </div>
        </div>

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

        {result && (
          <div className="bg-white rounded-2xl p-5 space-y-4 border border-slate-100 shadow-inner">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {localize('Niveau de risque', 'Risk level')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {result.riskLevel ? (
                    <Badge className={`text-sm ${riskBadgeClass(result.riskLevel)}`}>
                      {riskLabels[result.riskLevel]}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-600 border-slate-300">
                      {localize('Non évalué', 'Not assessed')}
                    </Badge>
                  )}
                  {result.cmsLabel && (
                    <span className="text-xs text-slate-500">
                      {localize('CMS détecté :', 'Detected CMS:')}{' '}
                      <strong className="text-slate-700">
                        {result.cmsLabel}{' '}
                        {result.cmsSource === 'analyzer'
                          ? localize('(analyse IA)', '(AI detection)')
                          : localize('(scan)', '(scan)')}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              {severityOrder.map((level) => (
                <div key={level} className="bg-slate-50 rounded-lg py-2 shadow-sm border border-slate-100">
                  <p className="font-semibold text-slate-700">{result.severityCounts[level] ?? 0}</p>
                  <p className="text-slate-500">{riskLabels[level]}</p>
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
        )}

        {result && (
          <div className="mt-4 bg-white/95 border border-blue-100 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm uppercase tracking-[0.25em] text-blue-500">
                {localize('Rapport complet', 'Full report')}
              </p>
              <h4 className="text-xl font-semibold text-slate-900">
                {localize('Recevez le rapport détaillé par email', 'Get the detailed report by email')}
              </h4>
              <p className="text-sm text-slate-500">
                {localize(
                  'Ou créez un compte pour débloquer toutes les recommandations.',
                  'Or create an account to unlock every recommendation.'
                )}
              </p>
            </div>
            <form onSubmit={handleCtaSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={ctaEmail}
                  onChange={(event) => setCtaEmail(event.target.value)}
                  required
                  disabled={ctaLoading}
                  className="flex-1"
                />
                <Button type="submit" disabled={ctaLoading}>
                  {ctaLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {localize('Envoi...', 'Sending...')}
                    </>
                  ) : (
                    localize('Envoyer le rapport', 'Send the report')
                  )}
                </Button>
              </div>
              {ctaStatus && (
                <p
                  className={`text-xs ${
                    ctaStatus.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {ctaStatus.message}
                </p>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/register">{localize('Créer un compte gratuitement', 'Create a free account')}</Link>
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
