'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
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
      case 'completed': return <Badge className="bg-green-600">Terminé</Badge>;
      case 'failed': return <Badge variant="destructive">Échoué</Badge>;
      case 'in_progress': return <Badge className="bg-blue-600">En cours</Badge>;
      case 'pending': return <Badge className="bg-yellow-600 text-black">En attente</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

const getRiskBadge = (risk: string | null) => {
  switch (risk) {
    case 'critical': return <Badge variant="destructive">Critique</Badge>;
    case 'high': return <Badge className="bg-orange-500">Élevé</Badge>;
    case 'medium': return <Badge className="bg-yellow-500 text-black">Moyen</Badge>;
    case 'low': return <Badge className="bg-green-500">Faible</Badge>;
    default: return <Badge variant="secondary">N/A</Badge>;
  }
};

type ReportFormat = 'pdf' | 'json' | 'xlsx';

const handleDownloadReport = async (scan: Scan, format: ReportFormat = 'pdf') => {
  if (!scan.mongo_report_id) {
    alert("Rapport non disponible. Lancez un scan d'abord.");
    return;
  }

  try {
    const apiUrl = `/api/generate-report/${scan.mongo_report_id}?report_format=${format}`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error("Erreur lors du téléchargement du rapport");

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
    console.error("Erreur lors du téléchargement du rapport :", error);
    alert("Erreur lors du téléchargement du rapport : " + error.message);
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
          <p className="text-slate-600">Chargement des rapports...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Mes scans</h1>
            <p className="text-slate-600 mt-1">Consultez et téléchargez vos rapports de scan</p>
          </div>
          {scans.length > 0 && (
            <Button
              variant="outline"
              className={`justify-between ${hasActiveFilters ? 'border-blue-500 text-blue-600' : ''}`}
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              {hasActiveFilters ? 'Filtres actifs' : 'Filtres désactivés'}
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
                    placeholder="Rechercher par URL"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Type de site (CMS)</Label>
                  <Select
                    value={filters.cms}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, cms: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les CMS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="wordpress">WordPress</SelectItem>
                      <SelectItem value="drupal">Drupal</SelectItem>
                      <SelectItem value="prestashop">PrestaShop</SelectItem>
                      <SelectItem value="inconnu">Inconnu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Niveau de risque</Label>
                  <Select
                    value={filters.risk}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, risk: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les niveaux" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="low">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="dateFrom">Date (du)</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dateTo">Date (au)</Label>
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
                  Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {scans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              Aucun scan effectué pour le moment.
            </CardContent>
          </Card>
        ) : filteredScans.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Historique complet</CardTitle>
              <CardDescription>Vision synthétique de vos derniers scans</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Type de site</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Vulnérabilités</TableHead>
                    <TableHead>Niveau de risque</TableHead>
                    <TableHead>Export</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => (
                    <TableRow key={`table-${scan.id}`}>
                      <TableCell className="text-sm text-slate-900 truncate max-w-[220px]">
                        {scan.site_url}
                      </TableCell>
                      <TableCell className="capitalize">{scan.cms_type || 'Inconnu'}</TableCell>
                      <TableCell>{getStatusBadge(scan.status)}</TableCell>
                      <TableCell>{new Date(scan.created_at).toLocaleString('fr-FR')}</TableCell>
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
                                Exporter
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
                          <span className="text-xs text-slate-400">En attente de rapport</span>
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
              Aucun scan ne correspond aux filtres sélectionnés.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
