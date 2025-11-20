'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setAnalyzerDetails(null);

    if (!url.trim()) {
      setError(localize('Merci de saisir une URL valide.', 'Please enter a valid URL.'));
      return;
    }

    const normalizedUrl = normalizeUrl(url);
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

      const analyzerPromise = fetch(`/api/analyzer/analyze/${encodeURIComponent(analyzerDomain)}`)
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as AnalyzerResult;
        })
        .catch(() => null);

      const response = await fetch('/api/scan-auto-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Scan failed');
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


      setResult({
        ...computed,
        cmsLabel: analyzerCms ?? computed.cmsLabel,
        cmsSource:
          analyzerCms && analyzerCms !== computed.cmsLabel
            ? 'analyzer'
            : computed.cmsLabel
            ? computed.cmsSource
            : null,
      });
    } catch (err: any) {
      console.error('Quick scan error:', err);
      setError(
        err?.message ||
          localize('Une erreur est survenue pendant le scan.', 'An error occurred while scanning.')
      );
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
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

        <div className="flex items-start gap-2 text-[11px] leading-snug text-slate-500">
          <ShieldCheck className="w-4 h-4 mt-0.5" />
          <p>
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
      </CardContent>
    </Card>
  );
}
