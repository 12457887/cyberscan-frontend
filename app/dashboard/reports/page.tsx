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
import { formatDateDMY } from '@/lib/date';
import { CheckCircle2, Download, Filter, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DISABLE_CREDIT_CHECK = process.env.NEXT_PUBLIC_DISABLE_CREDITS === 'true';
const LIGHT_SCAN_CREDIT_COST = 1;
const FULL_SCAN_CREDIT_COST = 3;
const ACTIVE_STATUSES = new Set(['pending', 'in_progress']);
const FINISHED_STATUSES = new Set(['completed', 'failed']);
const PENDING_FULL_SCAN_KEY = 'pending_full_scan_ids';
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

const getScanCreditCost = (scanType?: string | null) =>
  scanType === 'complete' ? FULL_SCAN_CREDIT_COST : LIGHT_SCAN_CREDIT_COST;

export default function ReportsPage() {
  const { user, refreshCredits } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${formatDateDMY(date)} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`;
  };
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
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [deleteConfirmScan, setDeleteConfirmScan] = useState<Scan | null>(null);
  const [pendingFullScanIds, setPendingFullScanIds] = useState<string[]>([]);
  const [readyFullScanIds, setReadyFullScanIds] = useState<string[]>([]);
  const [networkDialogOpen, setNetworkDialogOpen] = useState(false);
  const [networkDialogLoading, setNetworkDialogLoading] = useState(false);
  const [networkDialogError, setNetworkDialogError] = useState<string | null>(null);
  const [networkDialogScan, setNetworkDialogScan] = useState<Scan | null>(null);
  const [networkDialogReport, setNetworkDialogReport] = useState<any | null>(null);

  const updatePendingFullScanIds = (ids: string[]) => {
    setPendingFullScanIds(ids);
    if (typeof window === 'undefined') return;
    if (ids.length) {
      window.sessionStorage.setItem(PENDING_FULL_SCAN_KEY, JSON.stringify(ids));
    } else {
      window.sessionStorage.removeItem(PENDING_FULL_SCAN_KEY);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem(PENDING_FULL_SCAN_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        updatePendingFullScanIds(parsed.filter(Boolean));
      }
    } catch (storageError) {
      console.warn('Impossible de lire les scans complets en attente:', storageError);
      window.sessionStorage.removeItem(PENDING_FULL_SCAN_KEY);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadReports();
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

  useEffect(() => {
    if (!user) return;
    const intervalMs = scans.some((scan) => !scan.status || ACTIVE_STATUSES.has(scan.status))
      ? 5000
      : 30000;
    const interval = setInterval(loadReports, intervalMs);
    return () => clearInterval(interval);
  }, [user, scans]);

  useEffect(() => {
    if (!pendingFullScanIds.length) return;

    const completedIds: string[] = [];
    const failedIds: string[] = [];
    const stillPending: string[] = [];

    pendingFullScanIds.forEach((scanId) => {
      const scan = scans.find((entry) => entry.id === scanId);
      if (!scan) {
        stillPending.push(scanId);
        return;
      }
      if (scan.status === 'completed' && scan.mongo_report_id) {
        completedIds.push(scanId);
        return;
      }
      if (scan.status === 'failed') {
        failedIds.push(scanId);
        return;
      }
      stillPending.push(scanId);
    });

    if (completedIds.length || failedIds.length) {
      updatePendingFullScanIds(stillPending);
      if (completedIds.length) {
        setReadyFullScanIds((prev) => Array.from(new Set([...prev, ...completedIds])));
      }
    }
  }, [pendingFullScanIds, scans]);

  const getNetworkScanPayload = (report: any) =>
    report?.network_scan ||
    report?.network_results ||
    report?.network ||
    report?.networkScan ||
    null;
  const formatCertInfo = (value: any) => {
    if (value === null || value === undefined || value === '') return '—';

    const pairs: Array<[string, string]> = [];
    const keyMap: Record<string, string> = {
      commonname: 'CN',
      common_name: 'CN',
      cn: 'CN',
      organizationname: 'O',
      organization_name: 'O',
      o: 'O',
      organizationalunitname: 'OU',
      organizational_unit_name: 'OU',
      ou: 'OU',
      countryname: 'C',
      country_name: 'C',
      c: 'C',
      stateorprovincename: 'ST',
      state_or_province_name: 'ST',
      st: 'ST',
      localityname: 'L',
      locality_name: 'L',
      l: 'L',
      emailaddress: 'email',
      email_address: 'email',
      email: 'email',
    };
    const isPair = (input: any) =>
      Array.isArray(input) &&
      input.length === 2 &&
      typeof input[0] === 'string' &&
      (typeof input[1] === 'string' || typeof input[1] === 'number' || typeof input[1] === 'boolean');

    const pushPair = (key: string, val: any) => {
      if (val === null || val === undefined || val === '') return;
      pairs.push([key, String(val)]);
    };

    const collect = (input: any) => {
      if (input === null || input === undefined || input === '') return;
      if (isPair(input)) {
        pushPair(input[0], input[1]);
        return;
      }
      if (Array.isArray(input)) {
        input.forEach((item) => collect(item));
        return;
      }
      if (typeof input === 'object') {
        const keys = Object.keys(input);
        if (!keys.length) return;
        const numericOnly = keys.every((key) => /^\d+$/.test(key));
        if (numericOnly) {
          keys.forEach((key) => collect((input as Record<string, any>)[key]));
          return;
        }
        keys.forEach((key) => {
          const val = (input as Record<string, any>)[key];
          if (isPair(val)) {
            pushPair(val[0], val[1]);
          } else if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            pushPair(key, val);
          } else {
            collect(val);
          }
        });
        return;
      }
      pairs.push(['value', String(input)]);
    };

    collect(value);
    if (!pairs.length) return '—';

    const formatKey = (key: string) => {
      const normalized = key.replace(/\s+/g, '').toLowerCase();
      return keyMap[normalized] || key;
    };

    return pairs
      .map(([key, val]) => {
        const label = formatKey(key);
        return label === key ? `${key}: ${val}` : `${label}=${val}`;
      })
      .join(', ');
  };

  const openNetworkDialog = async (scan: Scan) => {
    if (!scan.site_url) {
      setNetworkDialogError(localize('URL introuvable pour ce scan.', 'No URL found for this scan.'));
      return;
    }

    setNetworkDialogScan(scan);
    setNetworkDialogOpen(true);
    setNetworkDialogLoading(true);
    setNetworkDialogError(null);
    setNetworkDialogReport(null);

    try {
      const endpoint = '/api/scan-network-ssl';
      const payload = { url: scan.site_url, full_ssl: true };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || localize('Impossible de récupérer le scan réseau.', 'Unable to fetch network scan.'));
      }
      const data = await response.json();
      setNetworkDialogReport(data);
    } catch (err) {
      setNetworkDialogError(
        err instanceof Error
          ? err.message
          : localize('Impossible de récupérer le scan réseau.', 'Unable to fetch network scan.')
      );
    } finally {
      setNetworkDialogLoading(false);
    }
  };

  const networkScanPayload = useMemo(
    () => (networkDialogReport ? getNetworkScanPayload(networkDialogReport) : null),
    [networkDialogReport]
  );


  const sslPayload = networkScanPayload?.ssl ?? null;
  const sslMode = networkScanPayload?.ssl_mode as string | undefined;
  const sslFallback = Boolean(networkScanPayload?.ssl_fallback);

  const ensureRescanCredit = async (requiredCredits: number) => {
    if (DISABLE_CREDIT_CHECK || !user?.id) {
      return { total: 0, used: 0 };
    }
    try {
      const syncCredits = async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          if (!accessToken) return null;
          const response = await fetch('/service/credits/sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!response.ok) {
            return null;
          }
          const payload = await response.json().catch(() => null);
          return payload?.credits ?? null;
        } catch (syncErr) {
          console.error('Erreur sync crédits rescan:', syncErr);
          return null;
        }
      };

      const { data, error } = await supabase
        .from('credits')
        .select('id, total_credits, used_credits, updated_at, created_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Erreur lecture crédits rescan:', error);
        const synced = await syncCredits();
        if (!synced) {
          setRescanError(
            localize('Impossible de vérifier vos crédits. Réessayez plus tard.', 'Unable to verify your credits. Please try again later.')
          );
          return null;
        }
      }

      let total = data?.total_credits ?? 0;
      let used = data?.used_credits ?? 0;
      let creditRowId = data?.id ?? null;
      const remaining = total - used;
      if (remaining < requiredCredits) {
        const synced = await syncCredits();
        if (synced && Number.isFinite(synced.total) && Number.isFinite(synced.used)) {
          const { data: refreshed } = await supabase
            .from('credits')
            .select('id, total_credits, used_credits, updated_at, created_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          total = refreshed?.total_credits ?? synced.total ?? 0;
          used = refreshed?.used_credits ?? synced.used ?? 0;
          creditRowId = refreshed?.id ?? null;
          const refreshedRemaining = total - used;
          if (refreshedRemaining >= requiredCredits) {
            return { id: creditRowId, total, used };
          }
        }

        setRescanError(
          localize(
            `Crédits insuffisants pour relancer ce scan. ${requiredCredits} crédits requis.`,
            `Not enough credits to relaunch this scan. ${requiredCredits} credits required.`
          )
        );
        return null;
      }

      return { id: creditRowId, total, used };
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

    const scanMode = (scan.scan_type || 'light') as 'light' | 'complete';
    const creditCost = getScanCreditCost(scanMode);

    const creditSnapshot = await ensureRescanCredit(creditCost);
    if (!creditSnapshot) {
      setRescanLoadingId(null);
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/service/credits/consume', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ amount: creditCost }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erreur réservation crédits rescan:', text || response.statusText);
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

      if (scanMode === 'complete') {
        const nextPending = Array.from(
          new Set([...pendingFullScanIds, String(inserted.id)].filter(Boolean))
        );
        updatePendingFullScanIds(nextPending);
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

  const handleDelete = async (scan: Scan) => {
    setDeleteLoadingId(scan.id);
    setDeleteConfirmScan(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch(`/service/scan-delete/${scan.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      await loadReports();
    } catch (err: any) {
      console.error('Erreur suppression:', err);
    } finally {
      setDeleteLoadingId(null);
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

const canDownloadReport = (scan: Scan) => (
  scan.status === 'completed' && !!scan.completed_at && !!scan.mongo_report_id
);

const handleDownloadReport = async (scan: Scan, format: ReportFormat = 'pdf') => {
  if (scan.status !== 'completed' || !scan.completed_at) {
    alert(localize('Le scan est toujours en cours. Réessayez plus tard.', 'Scan is still running. Please try again later.'));
    return;
  }
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

const handleOpenReport = (scan: Scan) => {
  if (scan.status !== 'completed' || !scan.mongo_report_id) {
    alert(localize("Rapport non disponible. Lancez un scan d'abord.", 'Report unavailable. Please run a scan first.'));
    return;
  }
  const url = `/api/generate-report/${scan.mongo_report_id}?report_format=pdf&display=inline`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const handleDownloadNetworkReport = async (scan: Scan, format: ReportFormat = 'pdf') => {
  if (!scan.mongo_report_id) {
    alert(localize("Rapport réseau non disponible.", 'Network report unavailable.'));
    return;
  }
  try {
    const apiUrl = `/api/generate-report-network/${scan.mongo_report_id}?report_format=${format}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(localize('Erreur lors du téléchargement du rapport réseau', 'Error downloading network report'));
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = format === 'xlsx' ? 'xlsx' : format === 'json' ? 'json' : 'pdf';
    link.download = `rapport-network-${scan.site_name || scan.site_url}-${timestamp}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error('Erreur téléchargement rapport réseau :', error);
    alert(localize('Erreur lors du téléchargement du rapport réseau : ', 'Error downloading network report: ') + error.message);
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

  const activeCompleteScans = scans.filter(
    (scan) => scan.scan_type === 'complete' && ACTIVE_STATUSES.has(scan.status)
  );
  const pendingFullCount = activeCompleteScans.length || pendingFullScanIds.length;
  const readyFullScans = scans.filter((scan) => readyFullScanIds.includes(scan.id));

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
        {readyFullScans.length > 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <div className="space-y-2">
                <p className="font-semibold">
                  {readyFullScans.length > 1
                    ? localize('Rapports complets prêts.', 'Full scan reports are ready.')
                    : localize('Rapport complet prêt.', 'Full scan report is ready.')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {readyFullScans.map((scan) => (
                    <Button
                      key={`ready-${scan.id}`}
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenReport(scan)}
                    >
                      {localize('Afficher le rapport', 'View report')}
                      {scan.site_name ? ` • ${scan.site_name}` : ''}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {pendingFullCount > 0 && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {pendingFullCount > 1
                    ? localize('Scans complets démarrés.', 'Full scans started.')
                    : localize('Scan complet démarré.', 'Full scan started.')}
                </p>
                <p>
                  {pendingFullCount > 1
                    ? localize(
                        'Les rapports seront affichés dès la fin du scan.',
                        'Reports will be available as soon as the scans finish.'
                      )
                    : localize(
                        'Le rapport sera affiché dès la fin du scan.',
                        'The report will be available as soon as the scan finishes.'
                      )}
                </p>
              </div>
            </div>
          </div>
        )}

        <Dialog open={!!deleteConfirmScan} onOpenChange={(open) => { if (!open) setDeleteConfirmScan(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{localize('Supprimer ce scan ?', 'Delete this scan?')}</DialogTitle>
              <DialogDescription>
                {deleteConfirmScan?.site_url}
                <br />
                {localize('Cette action est irréversible.', 'This action cannot be undone.')}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setDeleteConfirmScan(null)}>
                {localize('Annuler', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmScan && handleDelete(deleteConfirmScan)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {localize('Supprimer', 'Delete')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={networkDialogOpen} onOpenChange={setNetworkDialogOpen}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{localize('Scan réseau', 'Network scan')}</DialogTitle>
              <DialogDescription>
                {networkDialogScan?.site_name || networkDialogScan?.site_url || ''}
              </DialogDescription>
            </DialogHeader>
            {networkDialogLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {localize('Chargement des résultats réseau...', 'Loading network results...')}
              </div>
            ) : networkDialogError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {networkDialogError}
              </div>
            ) : !networkScanPayload ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {localize(
                  'Aucun résultat réseau disponible pour ce scan.',
                  'No network results available for this scan.'
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {!sslPayload ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {localize(
                      'Aucun résultat SSL/TLS disponible. Vérifiez que le scan SSL est activé côté serveur.',
                      'No SSL/TLS results available. Make sure SSL scanning is enabled on the server.'
                    )}
                  </div>
                ) : sslPayload?.valid !== undefined ? (
                  <div className="space-y-3 text-sm text-slate-700">
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
                          {formatCertInfo(sslPayload.subject)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-400">{localize('Émetteur', 'Issuer')}</p>
                        <p className="break-words text-xs text-slate-600">
                          {formatCertInfo(sslPayload.issuer)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

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
            <CardContent className="p-0">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">URL</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Site', 'Site')}</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Scan', 'Scan')}</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Statut', 'Status')}</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Date', 'Date')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{localize('Vulnér.', 'Vulns')}</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Risque', 'Risk')}</TableHead>
                    <TableHead className="whitespace-nowrap">{localize('Export', 'Export')}</TableHead>
                    <TableHead></TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => (
                    <TableRow key={`table-${scan.id}`}>
                      <TableCell className="pl-4 text-slate-900 truncate max-w-[160px]">
                        {scan.site_url}
                      </TableCell>
                      <TableCell className="capitalize whitespace-nowrap">{scan.cms_type || localize('Inconnu', 'Unknown')}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={scan.scan_type === 'complete' ? 'default' : 'secondary'} className="capitalize text-xs px-1.5 py-0">
                          {scan.scan_type === 'complete' ? 'Complete' : 'Light'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{getStatusBadge(scan.status)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(scan.created_at)}</TableCell>
                      <TableCell className="text-center font-semibold whitespace-nowrap">
                        {getVulnerabilityTotal(scan)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{getRiskBadge(scan.risk_level)}</TableCell>
                      <TableCell>
                        {canDownloadReport(scan) ? (
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
                              {scan.scan_type === 'complete' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => openNetworkDialog(scan)}>
                                    {localize('Scan SSL/TLS', 'SSL/TLS scan')}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDownloadNetworkReport(scan, 'pdf')}>
                                    {localize('Réseau PDF', 'Network PDF')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownloadNetworkReport(scan, 'xlsx')}>
                                    {localize('Réseau XLSX', 'Network XLSX')}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownloadNetworkReport(scan, 'json')}>
                                    {localize('Réseau JSON', 'Network JSON')}
                                  </DropdownMenuItem>
                                </>
                              )}
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
                          size="icon"
                          variant="ghost"
                          title={localize('Relancer', 'Rescan')}
                          onClick={() => handleRescan(scan)}
                          disabled={rescanLoadingId === scan.id}
                          className="h-8 w-8"
                        >
                          {rescanLoadingId === scan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteConfirmScan(scan)}
                          disabled={deleteLoadingId === scan.id}
                        >
                          {deleteLoadingId === scan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
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
