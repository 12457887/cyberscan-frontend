'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Scan, Vulnerability } from '@/lib/supabase';
import { Download, Eye, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function ReportsPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<{ [key: string]: Vulnerability[] }>({});
  const [loading, setLoading] = useState(true);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
  if (user) {
    const interval = setInterval(loadReports, 10000); // toutes les 10s
    return () => clearInterval(interval);
  }
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

        for (const scan of scansData) {
          const { data: vulnData } = await supabase
            .from('vulnerabilities')
            .select('*')
            .eq('scan_id', scan.id);

          if (vulnData) {
            setVulnerabilities(prev => ({ ...prev, [scan.id]: vulnData }));
          }
        }
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'in_progress': return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      default: return <Clock className="w-5 h-5 text-slate-600" />;
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
const handleDownloadReport = async (scan: Scan) => {
  if (!scan.mongo_report_id) {
    alert("Rapport non disponible. Lancez un scan d'abord.");
    return;
  }

  try {
    // ✅ On passe par le proxy Next.js
    const apiUrl = `/api/generate-report/${scan.mongo_report_id}`;
    const response = await fetch(apiUrl);

    if (!response.ok) throw new Error("Erreur lors du téléchargement du rapport");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rapport-${scan.site_name}-${new Date()
      .toISOString()
      .split("T")[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error("Erreur lors du téléchargement du rapport :", error);
    alert("Erreur lors du téléchargement du rapport : " + error.message);
  }
};


  const handleViewDetails = (scan: Scan) => {
    setSelectedScan(scan);
    setDialogOpen(true);
  };

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
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Rapports</h1>
          <p className="text-slate-600 mt-1">Consultez et téléchargez vos rapports de scan</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tous les scans</CardTitle>
            <CardDescription>Historique complet de vos analyses de sécurité</CardDescription>
          </CardHeader>
          <CardContent>
            {scans.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600">Aucun scan effectué pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scans.map((scan) => {
                  const vulns = vulnerabilities[scan.id] || [];
                  const critical = vulns.find(v => v.severity === 'critical')?.count || 0;
                  const high = vulns.find(v => v.severity === 'high')?.count || 0;
                  const medium = vulns.find(v => v.severity === 'medium')?.count || 0;
                  const low = vulns.find(v => v.severity === 'low')?.count || 0;

                  return (
                    <div key={scan.id} className="p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          {getStatusIcon(scan.status)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-slate-900">{scan.site_name}</h3>
                              {getStatusBadge(scan.status)}
                              {scan.status === 'completed' && getRiskBadge(scan.risk_level)}
                            </div>
                            <p className="text-sm text-slate-600">{scan.site_url}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span>Type: {scan.scan_type === 'light' ? 'Léger' : 'Complet'}</span>
                              <span>Date: {new Date(scan.created_at).toLocaleDateString('fr-FR')}</span>
                              {scan.status === 'completed' && scan.vulnerabilities_count > 0 && (
                                <span className="text-red-600 font-medium">
                                  {scan.vulnerabilities_count} vulnérabilités
                                </span>
                              )}
                            </div>
                            {scan.status === 'completed' && (critical + high + medium + low > 0) && (
                              <div className="flex gap-3 mt-2 text-xs">
                                {critical > 0 && <span className="text-red-600">Critique: {critical}</span>}
                                {high > 0 && <span className="text-orange-600">Élevé: {high}</span>}
                                {medium > 0 && <span className="text-yellow-600">Moyen: {medium}</span>}
                                {low > 0 && <span className="text-green-600">Faible: {low}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        {scan.status === 'completed' && (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(scan)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Détails
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleDownloadReport(scan)}
                              disabled={!scan.mongo_report_id}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Télécharger
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails du scan</DialogTitle>
            <DialogDescription>
              {selectedScan?.site_name} - {selectedScan?.site_url}
            </DialogDescription>
          </DialogHeader>
          {selectedScan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-600">Type de scan</p>
                  <p className="font-medium">{selectedScan.scan_type === 'light' ? 'Léger' : 'Complet'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Niveau de risque</p>
                  <div className="mt-1">{getRiskBadge(selectedScan.risk_level)}</div>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Date de début</p>
                  <p className="font-medium">{new Date(selectedScan.started_at).toLocaleString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Date de fin</p>
                  <p className="font-medium">
                    {selectedScan.completed_at
                      ? new Date(selectedScan.completed_at).toLocaleString('fr-FR')
                      : 'En cours'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Vulnérabilités détectées</h4>
                <div className="space-y-2">
                  {vulnerabilities[selectedScan.id]?.map((vuln) => (
                    <div key={vuln.id} className="flex justify-between p-3 bg-slate-50 rounded">
                      <span className="capitalize">{vuln.severity}</span>
                      <span className="font-medium">{vuln.count} vulnérabilités</span>
                    </div>
                  ))}
                  {(!vulnerabilities[selectedScan.id] || vulnerabilities[selectedScan.id].length === 0) && (
                    <p className="text-sm text-slate-600">Aucune vulnérabilité détectée</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
