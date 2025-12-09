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
import { Loader2, RefreshCcw } from 'lucide-react';

interface FreeScanEntry {
  id: string;
  url: string;
  email: string | null;
  cms_label: string | null;
  risk_level: string | null;
  analyzer_domain?: string | null;
  severity_counts?: Record<string, number> | null;
  created_at: string;
}

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
      return <Badge variant="outline">{localize('Non défini', 'Not set')}</Badge>;
    }
    const normalized = risk.toLowerCase() as keyof typeof riskLabels;
    const label = riskLabels[normalized] || risk;
    const color = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-amber-50 text-amber-700 border border-amber-200',
      low: 'bg-emerald-100 text-emerald-700',
    }[normalized];
    return <Badge className={color ?? ''}>{label}</Badge>;
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
          <CardHeader>
            <CardTitle>{localize('Filtres', 'Filters')}</CardTitle>
            <CardDescription>
              {localize(
                'Affinez la liste grâce à la recherche, aux niveaux de risque et aux CMS détectés.',
                'Narrow the list with search, risk levels, and detected CMS.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="text-xs text-slate-500">
              {localize('Résultats affichés :', 'Results shown:')}{' '}
              <span className="font-semibold text-slate-900">{filteredScans.length}</span>
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
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">{localize('Date', 'Date')}</th>
                      <th className="px-4 py-3 font-medium">{localize('URL', 'URL')}</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">CMS</th>
                      <th className="px-4 py-3 font-medium">{localize('Risque', 'Risk')}</th>
                      <th className="px-4 py-3 font-medium">{localize('Détails', 'Details')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScans.map((scan) => (
                      <tr key={scan.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(scan.created_at).toLocaleString(locale)}
                        </td>
                        <td className="px-4 py-3 max-w-[220px] whitespace-normal break-words">
                          <p className="font-semibold text-slate-900">{scan.url}</p>
                          {scan.analyzer_domain && (
                            <p className="text-xs text-slate-500">{scan.analyzer_domain}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">{scan.email || '—'}</td>
                        <td className="px-4 py-3">
                          {scan.cms_label ? scan.cms_label : localize('Inconnu', 'Unknown')}
                        </td>
                        <td className="px-4 py-3">{renderRiskBadge(scan.risk_level)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {scan.severity_counts ? (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(scan.severity_counts).map(([severity, value]) => (
                                <span key={severity} className="inline-flex gap-1">
                                  <strong>{severity.toUpperCase()}:</strong>
                                  <span>{value}</span>
                                </span>
                              ))}
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
