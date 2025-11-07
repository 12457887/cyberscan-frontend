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
import { Download, Filter } from 'lucide-react';
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

export default function ReportsPage() {
  const { user } = useAuth();
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    cms: 'all',
    risk: 'all',
    dateFrom: '',
    dateTo: '',
  });

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
