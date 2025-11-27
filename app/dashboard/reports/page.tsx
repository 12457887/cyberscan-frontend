'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase, Scan, Vulnerability } from '@/lib/supabase';
import { Download, Filter, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DISABLE_CREDIT_CHECK = process.env.NEXT_PUBLIC_DISABLE_CREDITS === 'true';
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

export default function ReportsPage() {
  const { user, refreshCredits } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const statusLabels = useMemo(
    () =>
      choose({
        fr: { completed: 'Terminé', failed: 'Échoué', in_progress: 'En cours', pending: 'En attente' },
        en: { completed: 'Completed', failed: 'Failed', in_progress: 'In progress', pending: 'Pending' },
      }),
    [choose]
  );
  const riskLabels = useMemo(
    () =>
      choose({
        fr: { critical: 'Critique', high: 'Élevé', medium: 'Moyen', low: 'Faible', na: 'N/A' },
        en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', na: 'N/A' },
      }),
    [choose]
  );
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<{ [key: string]: Vulnerability[] }>({});
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    cms: 'all',
    risk: 'all',
    dateFrom: '',
    dateTo: '',
  });
  const [rescanLoadingId, setRescanLoadingId] = useState<string | null>(null);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);
  const [rescanError, setRescanError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    loadReports();

    const interval = setInterval(loadReports, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadReports = async () => {
    if (!user) return;

    try {
      const { data: scansData } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (scansData) {
        setScans(scansData);

        const completedScans = scansData.filter(scan => scan.status === 'completed');
        const scanIds = completedScans.map(scan => scan.id);

        if (scanIds.length) {
          const { data: vulnRows, error: vulnError } = await supabase
            .from('vulnerabilities')
            .select('*')
            .in('scan_id', scanIds);

          if (vulnError) {
            console.error('Error loading vulnerabilities:', vulnError);
          } else if (vulnRows) {
            const grouped: { [key: string]: Vulnerability[] } = {};
            vulnRows.forEach((row) => {
              if (!grouped[row.scan_id]) {
                grouped[row.scan_id] = [];
              }
              grouped[row.scan_id].push(row);
            });
            setVulnerabilities(grouped);
          }
        } else {
          setVulnerabilities({});
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const ensureRescanCredit = async () => {
    if (DISABLE_CREDIT_CHECK || !user?.id) {
      return { total: 0, used: 0 };
    }
    try {
      const { data, error } = await supabase
        .from('credits')
        .select('total_credits, used_credits')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erreur lecture crédits rescan:', error);
        setRescanError(
          localize('Impossible de vérifier vos crédits. Réessayez plus tard.', 'Unable to verify your credits. Please try again later.')
        );
        return null;
      }

      const total = data?.total_credits ?? 0;
      const used = data?.used_credits ?? 0;
      const remaining = total - used;
      if (remaining < 1) {
        setRescanError(
          localize('Crédits insuffisants pour relancer ce scan.', 'Not enough credits to relaunch this scan.')
        );
        return null;
      }

      return { total, used };
    } catch (err) {
      console.error('Erreur rescan crédits:', err);
      setRescanError(
        localize('Impossible de vérifier vos crédits. Réessayez plus tard.', 'Unable to verify your credits. Please try again later.')
      );
      return null;
    }
  };

  const trackCreditConsumption = (scanIds: Array<string | number>) => {
    if (!user?.id || scanIds.length === 0) {
      return;
    }

    (async () => {
      await waitForScanCompletion(scanIds);
      if (typeof refreshCredits === 'function') {
        refreshCredits().catch((err) => console.error('Erreur refresh credits rescan:', err));
      }
    })().catch((err) => {
      console.error('Erreur suivi des crédits (rescan):', err);
    });
  };

  const handleRescan = async (scan: Scan) => {
    if (!user) return;
    setRescanError(null);
    setRescanMessage(null);
    setRescanLoadingId(scan.id);

    const creditSnapshot = await ensureRescanCredit();
    if (!creditSnapshot) {
      setRescanLoadingId(null);
      return;
    }
    const newUsed = (creditSnapshot.used ?? 0) + 1;
    try {
      const { error: reserveError } = await supabase
        .from('credits')
        .update({
          used_credits: newUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (reserveError) {
        console.error('Erreur réservation crédits rescan:', reserveError);
        setRescanError(localize('Impossible de réserver vos crédits.', 'Unable to reserve your credits.'));
        setRescanLoadingId(null);
        return;
      }
      if (typeof refreshCredits === 'function') {
        refreshCredits().catch((err) => console.error('Erreur refresh credits rescan:', err));
      }
    } catch (reserveException) {
      console.error('Erreur réservation crédits rescan:', reserveException);
      setRescanError(localize('Impossible de réserver vos crédits.', 'Unable to reserve your credits.'));
      setRescanLoadingId(null);
      return;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(scan.site_url).toString();
    } catch {
      setRescanError(
        localize("L'URL de ce scan est invalide. Lancez un nouveau scan depuis le formulaire.", 'Invalid scan URL. Please launch a new scan from the form.')
      );
      setRescanLoadingId(null);
      return;
    }

    const hostname = (() => {
      try {
        return new URL(normalizedUrl).hostname;
      } catch {
        return scan.site_name || normalizedUrl;
      }
    })();
    const scanMode = (scan.scan_type || 'light') as 'light' | 'complete';

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('scans')
        .insert({
          user_id: user.id,
          site_name: hostname,
          site_url: normalizedUrl,
          scan_type: scanMode,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError || !inserted) {
        throw insertError || new Error(localize('Impossible de créer un nouveau scan.', 'Unable to create a new scan.'));
      }

      await supabase.from('alerts').insert({
        user_id: user.id,
        scan_id: inserted.id,
        title: localize('Scan relancé', 'Scan relaunched'),
        message: localize(
          `Relance du scan pour ${hostname}.`,
          `Scan relaunched for ${hostname}.`
        ),
        type: 'system',
        severity: 'info',
      });

      const response = await fetch('/api/scan-auto-detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Max-Concurrent-Scans': '1',
        },
        body: JSON.stringify([
          {
            url: normalizedUrl,
            mode: scanMode,
            scan_id: inserted.id,
            frontend_scan_id: inserted.id,
            user_id: user.id,
          },
        ]),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || localize('Échec du lancement du scan.', 'Failed to launch the scan.'));
      }

      try {
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
      } catch (jsonError) {
        console.warn('Réponse inattendue de scan-auto-detect:', jsonError);
      }

      if (!DISABLE_CREDIT_CHECK) {
        trackCreditConsumption([inserted.id]);
      }

      setRescanMessage(
        localize('Scan relancé avec succès. Il apparaîtra dans la liste dès son démarrage.', 'Scan relaunched successfully. It will appear in the list once it starts.')
      );
      await loadReports();
    } catch (err: any) {
      console.error('Erreur rescan:', err);
      setRescanError(err?.message || String(err));
    } finally {
      setRescanLoadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">{statusLabels.completed}</Badge>;
      case 'failed':
        return <Badge variant="destructive">{statusLabels.failed}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-600">{statusLabels.in_progress}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600 text-black">{statusLabels.pending}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

const getRiskBadge = (risk: string | null) => {
  switch (risk) {
    case 'critical': return <Badge variant="destructive">{riskLabels.critical}</Badge>;
    case 'high': return <Badge className="bg-orange-500">{riskLabels.high}</Badge>;
    case 'medium': return <Badge className="bg-yellow-500 text-black">{riskLabels.medium}</Badge>;
    case 'low': return <Badge className="bg-green-500">{riskLabels.low}</Badge>;
    default: return <Badge variant="secondary">{riskLabels.na}</Badge>;
  }
};

type ReportFormat = 'pdf' | 'json' | 'xlsx';

const handleDownloadReport = async (scan: Scan, format: ReportFormat = 'pdf') => {
  if (!scan.mongo_report_id) {
    alert(localize("Rapport non disponible. Lancez un scan d'abord.", 'Report unavailable. Please run a scan first.'));
    return;
  }

  try {
    const apiUrl = `/api/generate-report/${scan.mongo_report_id}?report_format=${format}`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error(localize('Erreur lors du téléchargement du rapport', 'Error while downloading report'));

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().split("T")[0];
    const extension = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'pdf';
    link.download = `rapport-${scan.site_name}-${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Erreur lors du téléchargement du rapport :', error);
    alert(localize('Erreur lors du téléchargement du rapport : ', 'Error downloading report: ') + error.message);
  }
};


  const getVulnerabilityTotal = (scan: Scan) => {
    if (typeof scan.vulnerabilities_count === 'number') {
      return scan.vulnerabilities_count;
    }
    const vulns = vulnerabilities[scan.id] || [];
    return vulns.reduce((sum, row) => sum + (row.count || 0), 0);
  };

  const hasActiveFilters =
    filters.search.trim() ||
    filters.cms !== 'all' ||
    filters.risk !== 'all' ||
    filters.dateFrom ||
    filters.dateTo;

  const filteredScans = scans.filter((scan) => {
    if (filters.search) {
      const haystack = `${scan.site_url || ''}`.toLowerCase();
      if (!haystack.includes(filters.search.toLowerCase())) {
        return false;
      }
    }
    if (filters.cms !== 'all') {
      if ((scan.cms_type || 'inconnu').toLowerCase() !== filters.cms) {
        return false;
      }
    }
    if (filters.risk !== 'all') {
      if ((scan.risk_level || 'n/a').toLowerCase() !== filters.risk) {
        return false;
      }
    }
    if (filters.dateFrom) {
      const scanDate = new Date(scan.created_at).setHours(0, 0, 0, 0);
      const fromDate = new Date(filters.dateFrom).setHours(0, 0, 0, 0);
      if (scanDate < fromDate) return false;
    }
    if (filters.dateTo) {
      const scanDate = new Date(scan.created_at).setHours(0, 0, 0, 0);
      const toDate = new Date(filters.dateTo).setHours(0, 0, 0, 0);
      if (scanDate > toDate) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement des rapports...', 'Loading reports...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Mes scans', 'My scans')}
            </h1>
            <p className="text-slate-600 mt-1">
              {localize('Consultez et téléchargez vos rapports de scan', 'Review and download your scan reports')}
            </p>
          </div>
          {scans.length > 0 && (
            <Button
              variant="outline"
              className={`justify-between ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              {hasActiveFilters ? localize('Filtres actifs', 'Filters active') : localize('Filtres désactivés', 'Filters disabled')}
              <Filter className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>

        {filtersOpen && scans.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="search">URL</Label>
                  <Input
                    id="search"
                    placeholder={localize('Rechercher par URL', 'Search by URL')}
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{localize('Type de site (CMS)', 'Site type (CMS)')}</Label>
                  <Select
                    value={filters.cms}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, cms: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={localize('Tous les CMS', 'All CMS')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{localize('Tous', 'All')}</SelectItem>
                      <SelectItem value="wordpress">WordPress</SelectItem>
                      <SelectItem value="drupal">Drupal</SelectItem>
                      <SelectItem value="prestashop">PrestaShop</SelectItem>
                      <SelectItem value="inconnu">{localize('Inconnu', 'Unknown')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{localize('Niveau de risque', 'Risk level')}</Label>
                  <Select
                    value={filters.risk}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, risk: value }))}
                  >
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="dateFrom">{localize('Date (du)', 'Date from')}</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dateTo">{localize('Date (au)', 'Date to')}</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setFilters({ search: '', cms: 'all', risk: 'all', dateFrom: '', dateTo: '' })
                  }
                >
                  {localize('Réinitialiser', 'Reset')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {rescanError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rescanError}
          </div>
        )}
        {rescanMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {rescanMessage}
          </div>
        )}

        {scans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              {localize('Aucun scan effectué pour le moment.', 'No scan has been run yet.')}
            </CardContent>
          </Card>
        ) : filteredScans.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{localize('Historique complet', 'Full history')}</CardTitle>
              <CardDescription>
                {localize('Vision synthétique de vos derniers scans', 'Summary view of your latest scans')}
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>{localize('Type de site', 'Site type')}</TableHead>
                    <TableHead>{localize('Statut', 'Status')}</TableHead>
                    <TableHead>{localize('Date', 'Date')}</TableHead>
                    <TableHead className="text-center">{localize('Vulnérabilités', 'Vulnerabilities')}</TableHead>
                    <TableHead>{localize('Niveau de risque', 'Risk level')}</TableHead>
                    <TableHead>{localize('Export', 'Export')}</TableHead>
                    <TableHead>{localize('Relancer', 'Rescan')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => (
                    <TableRow key={`table-${scan.id}`}>
                      <TableCell className="text-sm text-slate-900 truncate max-w-[220px]">
                        {scan.site_url}
                      </TableCell>
                      <TableCell className="capitalize">{scan.cms_type || localize('Inconnu', 'Unknown')}</TableCell>
                      <TableCell>{getStatusBadge(scan.status)}</TableCell>
                      <TableCell>{new Date(scan.created_at).toLocaleString(locale)}</TableCell>
                      <TableCell className="text-center font-semibold">
                        {getVulnerabilityTotal(scan)}
                      </TableCell>
                      <TableCell>{getRiskBadge(scan.risk_level)}</TableCell>
                      <TableCell>
                        {scan.status === 'completed' && scan.mongo_report_id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-1" />
                                {localize('Exporter', 'Export')}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => handleDownloadReport(scan, 'pdf')}>
                                PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadReport(scan, 'json')}>
                                JSON
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadReport(scan, 'xlsx')}>
                                XLSX
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {localize('En attente de rapport', 'Waiting for report')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRescan(scan)}
                          disabled={rescanLoadingId === scan.id}
                        >
                          {rescanLoadingId === scan.id ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {localize('Relance...', 'Rescanning...')}
                            </span>
                          ) : (
                            localize('Relancer', 'Rescan')
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              {localize('Aucun scan ne correspond aux filtres sélectionnés.', 'No scan matches the selected filters.')}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
