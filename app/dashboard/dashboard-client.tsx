'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, Credits, Scan, Alert, Ticket, RefundRequest } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import { TicketsPanel } from '@/components/ui/tickets-panel';
import { RefundRequestsPanel } from '@/components/ui/refund-requests-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Activity, AlertTriangle, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useSearchParams, useRouter } from 'next/navigation';

const statusStyles: Record<Scan['status'], string> = {
  pending: 'bg-slate-200 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const severityStyles: Record<Alert['severity'], string> = {
  info: 'text-blue-600',
  warning: 'text-amber-600',
  error: 'text-red-600',
};

const riskStyles: Record<NonNullable<Scan['risk_level']>, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const DAYS_RANGE = 14;
const SEVERITY_KEYS = ['low', 'medium', 'high', 'critical'] as const;
type SeverityKey = (typeof SEVERITY_KEYS)[number];

type VulnerabilityChartConfig = Record<
  'critical' | 'high' | 'medium' | 'low',
  { label: string; color: string }
>;

type VulnerabilityTrendPoint = {
  dateKey: string;
  label: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
};

type TrendScan = Pick<Scan, 'id' | 'created_at' | 'completed_at' | 'risk_level' | 'vulnerabilities_count'>;

type FreeScanTrendRow = {
  created_at: string;
  severity_counts: Record<string, number> | null;
  risk_level: string | null;
};

const buildTrendBase = (
  startDate: Date,
  days: number,
  formatter: Intl.DateTimeFormat
): [VulnerabilityTrendPoint[], Map<string, VulnerabilityTrendPoint>] => {
  const base: VulnerabilityTrendPoint[] = [];
  const map = new Map<string, VulnerabilityTrendPoint>();

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const key = date.toISOString().split('T')[0];
    const entry: VulnerabilityTrendPoint = {
      dateKey: key,
      label: formatter.format(date),
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    base.push(entry);
    map.set(key, entry);
  }

  return [base, map];
};

export default function DashboardPageClient() {
  const { user, profile } = useAuth();
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
        fr: { pending: 'En attente', in_progress: 'En cours', completed: 'Terminé', failed: 'Échec' },
        en: { pending: 'Pending', in_progress: 'In progress', completed: 'Completed', failed: 'Failed' },
      }),
    [choose]
  );
  const riskLabels = useMemo(
    () =>
      choose({
        fr: { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' },
        en: { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' },
      }),
    [choose]
  );
  const chartConfig = useMemo<VulnerabilityChartConfig>(
    () =>
      choose({
        fr: {
          critical: { label: 'Critique', color: 'hsl(0, 82%, 60%)' },
          high: { label: 'Élevé', color: 'hsl(12, 82%, 55%)' },
          medium: { label: 'Moyen', color: 'hsl(38, 85%, 55%)' },
          low: { label: 'Faible', color: 'hsl(210, 85%, 55%)' },
        },
        en: {
          critical: { label: 'Critical', color: 'hsl(0, 82%, 60%)' },
          high: { label: 'High', color: 'hsl(12, 82%, 55%)' },
          medium: { label: 'Medium', color: 'hsl(38, 85%, 55%)' },
          low: { label: 'Low', color: 'hsl(210, 85%, 55%)' },
        },
      }),
    [choose]
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short' }),
    [locale]
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams?.get('section') ?? 'overview';
  const { plan, loading: planLoading } = useSubscriptionPlan();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [vulnerabilityTrend, setVulnerabilityTrend] = useState<VulnerabilityTrendPoint[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundActionId, setRefundActionId] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);

  const isAdminUser = profile?.role === 'admin';
  const planNames = useMemo(
    () =>
      choose({
        fr: { free: 'Gratuit', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise', admin: 'Admin' },
        en: { free: 'Free', basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise', admin: 'Admin' },
      }),
    [choose]
  );
  const featureLabels = useMemo(
    () =>
      choose({
        fr: {
          advancedAnalyzer: 'Analyseur avancé',
          autoScheduling: 'Planification automatique',
          cmsDetection: 'Détection CMS',
          fullScan: 'Scan complet',
          lightScanOnly: 'Scan léger uniquement',
        },
        en: {
          advancedAnalyzer: 'Advanced analyzer',
          autoScheduling: 'Automatic scheduling',
          cmsDetection: 'CMS detection',
          fullScan: 'Full scan',
          lightScanOnly: 'Light scan only',
        },
      }),
    [choose]
  );
  const scanModeLabels = useMemo(
    () =>
      choose({
        fr: { light: 'Léger', complete: 'Complet' },
        en: { light: 'Light', complete: 'Full' },
      }),
    [choose]
  );
  const alertSeverityLabels = useMemo(
    () =>
      choose({
        fr: { info: 'Info', warning: 'Alerte', error: 'Erreur' },
        en: { info: 'Info', warning: 'Warning', error: 'Error' },
      }),
    [choose]
  );

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, isAdminUser]);

  useEffect(() => {
    if (!vulnerabilityTrend.length) return;
    const totals = vulnerabilityTrend.reduce(
      (acc, entry) => {
        acc.low += entry.low;
        acc.medium += entry.medium;
        acc.high += entry.high;
        acc.critical += entry.critical;
        return acc;
      },
      { low: 0, medium: 0, high: 0, critical: 0 }
    );
    const size = chartRef.current
      ? { width: chartRef.current.clientWidth, height: chartRef.current.clientHeight }
      : null;
    console.info('[VulnerabilityTrend] render', {
      points: vulnerabilityTrend.length,
      totals,
      size,
    });
  }, [vulnerabilityTrend]);

  const loadDashboardData = async () => {
    if (!user) return;

    if (isAdminUser) {
      setRefundLoading(true);
      setRefundError(null);
    }

    let baseTrend: VulnerabilityTrendPoint[] = [];
    let trendMap = new Map<string, VulnerabilityTrendPoint>();

    try {
      setLoadError(null);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rangeStart = new Date(today);
      rangeStart.setDate(today.getDate() - (DAYS_RANGE - 1));
      const rangeStartIso = rangeStart.toISOString().split('T')[0] + 'T00:00:00.000Z';  // Forcer 00:00

      [baseTrend, trendMap] = buildTrendBase(rangeStart, DAYS_RANGE, dateFormatter);

      let scanHistoryQuery = supabase
        .from('scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!isAdminUser) {
        scanHistoryQuery = scanHistoryQuery.eq('user_id', user.id);
      }

      let trendScansQuery = supabase
        .from('scans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!isAdminUser) {
        trendScansQuery = trendScansQuery.eq('user_id', user.id);
      }

      const freeScansPromise = isAdminUser
        ? supabase
            .from('free_scans')
            .select('created_at,severity_counts,risk_level')
            .gte('created_at', rangeStartIso)
            .order('created_at', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null });

      const [creditsRes, scanHistoryRes, alertsRes, trendScansRes, freeScansRes] = await Promise.all([
        supabase.from('credits').select('*').eq('user_id', user.id).maybeSingle(),
        scanHistoryQuery,
        supabase.from('alerts').select('*').eq('user_id', user.id).eq('is_read', false).limit(5),
        trendScansQuery,
        freeScansPromise,
      ]);

      if (creditsRes.data) setCredits(creditsRes.data);
      const scansData = scanHistoryRes.data || [];
      const trendScans = (trendScansRes.data || []) as TrendScan[];
      const freeScans = (freeScansRes.data || []) as FreeScanTrendRow[];

      let ticketsData: Ticket[] = [];
      let refundsData: RefundRequest[] = [];
      if (isAdminUser) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          const token = session?.access_token;
          if (token) {
            const res = await fetch('/service/admin?resource=tickets', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (res.ok) {
              const json = await res.json();
              ticketsData = json?.tickets ?? [];
            } else {
              console.error('Erreur récupération tickets admin:', await res.text());
            }

            const refundsRes = await fetch('/service/refund-requests', {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (refundsRes.ok) {
              const json = await refundsRes.json();
              refundsData = json?.requests ?? [];
            } else {
              setRefundError(
                localize(
                  'Impossible de charger les demandes de remboursement.',
                  'Unable to load refund requests.'
                )
              );
              console.error('Erreur récupération refunds admin:', await refundsRes.text());
            }
          } else {
            console.error('Impossible de récupérer le token admin pour les tickets');
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des tickets admin:', error);
        }
      } else {
        const { data: userTickets, error: ticketsError } = await supabase
          .from('tickets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (ticketsError) {
          console.error('Erreur chargement tickets utilisateur:', ticketsError);
        }
        ticketsData = (userTickets ?? []).map((ticket) => {
          const profileInfo = profile
            ? {
                email: profile.email,
                full_name: profile.full_name,
              }
            : null;
          return {
            ...ticket,
            profiles: profileInfo,
            creator_email: profileInfo?.email ?? null,
          };
        });
      }

      setTickets(ticketsData);
      if (isAdminUser) {
        setRefundRequests(refundsData);
        setRefundLoading(false);
      }

      setScans(scansData.slice(0, 8));
      if (alertsRes.data) setAlerts(alertsRes.data);

      try {
        const trendDebug = {
          rangeStartIso,
          trendScans: trendScans.length,
          scanHistory: scansData.length,
          freeScans: freeScans.length,
          vulnerabilityRows: 0,
          severityTotals: { low: 0, medium: 0, high: 0, critical: 0 },
          fallbackScans: 0,
          fallbackTotal: 0,
          freeScansUsed: 0,
        };

        if (!trendScans.length && !freeScans.length) {
          console.info('[VulnerabilityTrend] no scans in range', trendDebug);
        }

        const scanDateKey = (createdAt?: string | null, completedAt?: string | null) => {
          const raw = completedAt || createdAt;
          if (!raw) return null;
          const createdAtDate = new Date(raw);
          if (Number.isNaN(createdAtDate.getTime())) return null;
          createdAtDate.setHours(0, 0, 0, 0);
          return createdAtDate.toISOString().split('T')[0];
        };

        const scanHasVulnRows = new Set<string>();

        if (trendScans.length) {
          const scanMap = new Map(trendScans.map((scan) => [scan.id, scan]));
          const scanIds = Array.from(scanMap.keys());

          if (scanIds.length) {
            const { data: vulnerabilityRows, error: vulnerabilityError } = await supabase
              .from('vulnerabilities')
              .select('scan_id,severity,count')
              .in('scan_id', scanIds);

            if (vulnerabilityError) {
              console.error('Error loading vulnerabilities:', vulnerabilityError);
            }

            if (vulnerabilityRows) {
              trendDebug.vulnerabilityRows = vulnerabilityRows.length;
              vulnerabilityRows.forEach((row) => {
                const severity = (row.severity || '').toLowerCase() as SeverityKey;
                if (!SEVERITY_KEYS.includes(severity)) return;

                const scan = scanMap.get(row.scan_id);
                if (!scan) return;

                const dateKey = scanDateKey(scan.created_at, scan.completed_at);
                if (!dateKey) return;
                const trendEntry = trendMap.get(dateKey);
                if (!trendEntry) return;

                const amount = Number(row.count);
                if (!Number.isFinite(amount)) return;

                trendEntry[severity] += amount;
                trendDebug.severityTotals[severity] += amount;
                scanHasVulnRows.add(row.scan_id);
              });
            }
          }

          trendScans.forEach((scan) => {
            if (scanHasVulnRows.has(scan.id)) return;
            const rawCount = Number((scan as TrendScan).vulnerabilities_count);
            const amount =
              Number.isFinite(rawCount) && rawCount > 0
                ? rawCount
                : (scan as TrendScan).risk_level
                ? 1
                : 0;
            if (amount <= 0) return;

            const severity = (((scan as TrendScan).risk_level || 'low') as string).toLowerCase() as SeverityKey;
            if (!SEVERITY_KEYS.includes(severity)) return;

            const dateKey = scanDateKey(scan.created_at, (scan as TrendScan).completed_at);
            if (!dateKey) return;

            const trendEntry = trendMap.get(dateKey);
            if (!trendEntry) return;

            trendEntry[severity] += amount;
            trendDebug.fallbackScans += 1;
            trendDebug.fallbackTotal += amount;
          });
        }

        if (isAdminUser && freeScans.length) {
          freeScans.forEach((scan) => {
            const dateKey = scanDateKey(scan.created_at);
            if (!dateKey) return;
            const trendEntry = trendMap.get(dateKey);
            if (!trendEntry) return;

            const counts =
              scan.severity_counts && typeof scan.severity_counts === 'object'
                ? scan.severity_counts
                : null;
            let hadCounts = false;

            if (counts) {
              SEVERITY_KEYS.forEach((key) => {
                const amount = Number(counts[key] ?? counts[key.toUpperCase()]);
                if (!Number.isFinite(amount) || amount <= 0) return;
                trendEntry[key] += amount;
                hadCounts = true;
              });
            }

            if (!hadCounts && scan.risk_level) {
              const severity = (scan.risk_level || '').toLowerCase() as SeverityKey;
              if (SEVERITY_KEYS.includes(severity)) {
                trendEntry[severity] += 1;
              }
            }

            if (hadCounts || scan.risk_level) {
              trendDebug.freeScansUsed += 1;
            }
          });
        }

        const trendTotals = baseTrend.reduce(
          (acc, entry) => {
            acc.low += entry.low;
            acc.medium += entry.medium;
            acc.high += entry.high;
            acc.critical += entry.critical;
            return acc;
          },
          { low: 0, medium: 0, high: 0, critical: 0 }
        );

        console.info('[VulnerabilityTrend] totals', { ...trendDebug, trendTotals });
      } catch (trendError) {
        console.error('Error building vulnerability trend:', trendError);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoadError(
        localize('Impossible de charger toutes les données du tableau de bord.', 'Unable to load every dashboard metric.')
      );
      if (isAdminUser) {
        setRefundLoading(false);
        if (!refundError) {
          setRefundError(
            localize('Impossible de charger les demandes de remboursement.', 'Unable to load refund requests.')
          );
        }
      }
    } finally {
      console.log('[DEBUG] baseTrend avant setState:', baseTrend);
      console.log('[DEBUG] baseTrend.length:', baseTrend.length);
  
      if (baseTrend.length) {
    // Créer une copie profonde pour forcer la mise à jour du state
        const trendData = baseTrend.map(entry => ({ ...entry }));
        console.log('[DEBUG] trendData à envoyer:', trendData);
        setVulnerabilityTrend(trendData);
      }
      setLoading(false);
      if (isAdminUser) {
        setRefundLoading(false);
      }
    }
  };

  const handleRefundDecision = async (requestId: string, decision: 'approve' | 'reject', note?: string) => {
    try {
      setRefundActionId(requestId);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error(
          localize('Session expirée, reconnectez-vous pour continuer.', 'Session expired, please log in again.')
        );
      }
      const response = await fetch('/service/refund-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, decision, note }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.detail || payload?.error || localize('Action impossible.', 'Unable to process this request.');
        throw new Error(message);
      }
      window.alert(
        decision === 'approve'
          ? localize('Remboursement approuvé.', 'Refund approved.')
          : localize('Demande rejetée.', 'Request rejected.')
      );
      await loadDashboardData();
    } catch (error: any) {
      console.error('Refund decision error:', error);
      window.alert(
        error?.message ||
          localize('Impossible de traiter cette demande de remboursement.', 'Unable to update this refund request.')
      );
    } finally {
      setRefundActionId(null);
    }
  };

  const activeScans = scans.filter(s => s.status === 'in_progress' || s.status === 'pending').length;
  const unreadAlerts = alerts.length;
  const totalCredits = credits?.total_credits ?? 0;
  const remainingCredits = credits?.remaining_credits ?? 0;
  const usedCredits = credits?.used_credits ?? 0;
  const creditDetails =
    totalCredits > 0
      ? localize(
          `${remainingCredits} / ${totalCredits} restants`,
          `${remainingCredits} / ${totalCredits} remaining`
        )
      : localize('Aucun crédit défini', 'No credits defined');

  const circleClass =
    'flex h-20 w-20 items-center justify-center rounded-full border-[6px] bg-white text-xl font-semibold shadow-sm';

  const effectivePlan = plan ?? 'free';
  const isAdminEffective = effectivePlan === 'admin';
  const isAdminDisplay = isAdminUser || isAdminEffective;
  const planLabel = planLoading
    ? localize('Chargement...', 'Loading...')
    : isAdminEffective
      ? localize('Admin', 'Admin')
      : planNames[effectivePlan as keyof typeof planNames] ?? effectivePlan;
  const subscriptionBadges: string[] = [];

  if (isAdminEffective || effectivePlan === 'enterprise') {
    subscriptionBadges.push(featureLabels.advancedAnalyzer);
  }
  if (isAdminEffective || effectivePlan === 'enterprise' || effectivePlan === 'pro') {
    subscriptionBadges.push(featureLabels.autoScheduling);
    subscriptionBadges.push(featureLabels.cmsDetection);
  } else if (effectivePlan === 'basic') {
    subscriptionBadges.push(featureLabels.fullScan);
  } else {
    subscriptionBadges.push(featureLabels.lightScanOnly);
  }

  const formatCms = (value?: string | null) => {
    if (!value) return localize('Inconnu', 'Unknown');
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const getStatusBadge = (status: Scan['status']) => (
    <Badge variant="outline" className={`${statusStyles[status]} border-transparent`}>
      {statusLabels[status]}
    </Badge>
  );

  const getRiskBadge = (risk: Scan['risk_level']) => {
    if (!risk) {
      return <Badge variant="secondary">{localize('N/A', 'N/A')}</Badge>;
    }
    return (
      <Badge variant="outline" className={`${riskStyles[risk]} border-transparent`}>
        {riskLabels[risk]}
      </Badge>
    );
  };

  const hasVulnerabilityData = vulnerabilityTrend.some((entry) =>
    SEVERITY_KEYS.some((key) => entry[key] > 0)
  );
  const maxVulnerabilityCount = useMemo(
    () =>
      vulnerabilityTrend.reduce(
        (max, entry) => Math.max(max, entry.low, entry.medium, entry.high, entry.critical),
        0
      ),
    [vulnerabilityTrend]
  );
  const useDecimalTicks = maxVulnerabilityCount > 0 && maxVulnerabilityCount <= 5;
  const trendSubtitle = localize(
    `Vue d'ensemble de l'espace de travail - ${DAYS_RANGE} derniers jours`,
    `Workspace overview - last ${DAYS_RANGE} days`
  );

  const translateAlertContent = (alert: Alert) => {
    if (locale === 'fr-FR') {
      return { title: alert.title, message: alert.message };
    }
    if (alert.type === 'subscription') {
      const planMatch = alert.message.match(/plan\s+([a-z]+)/i);
      const planId = planMatch?.[1];
      return {
        title: 'Subscription updated',
        message: planId
          ? `Your subscription has been confirmed for the ${planId} plan.`
          : 'Your subscription has been updated successfully.',
      };
    }
    if (alert.type === 'scan_complete') {
      return {
        title: 'Scan completed',
        message: 'Your security scan is finished. Review the report for more details.',
      };
    }
    if (alert.type === 'vulnerability_found') {
      return {
        title: 'New vulnerability detected',
        message: 'We found new vulnerabilities on your target. Review the latest scan.',
      };
    }
    if (alert.type === 'system') {
      return {
        title: 'System notification',
        message: alert.message || 'Important information regarding your account.',
      };
    }
    return { title: alert.title, message: alert.message };
  };

  if (activeSection === 'support') {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {localize('Support technique', 'Technical support')}
              </h1>
              <p className="text-slate-600 mt-1">
                {localize(
                  "Créez et suivez vos demandes d'assistance auprès de l'équipe Cyber Scan.",
                  'Create and track your support tickets with the CyberScan team.'
                )}
              </p>
            </div>
            <button
              className="text-sm text-blue-600 underline"
              onClick={() => router.push('/dashboard')}
            >
              {localize('Retour au tableau de bord', 'Back to dashboard')}
            </button>
          </div>

          {loadError && (
            <Card className="border-red-200 bg-red-50 text-red-700">
              <CardHeader className="flex flex-row items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <CardTitle>{localize('Erreur', 'Error')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{loadError}</CardContent>
            </Card>
          )}

          <TicketsPanel tickets={tickets} onTicketCreated={loadDashboardData} isAdmin={isAdminUser} />

          {isAdminUser && (
            <RefundRequestsPanel
              requests={refundRequests}
              loading={refundLoading}
              error={refundError}
              onDecision={handleRefundDecision}
              actionRequestId={refundActionId}
            />
          )}

          {loading && (
            <Card>
              <CardHeader>
                <CardTitle>{localize('Chargement…', 'Loading...')}</CardTitle>
                <CardDescription>
                  {localize('Récupération de vos tickets.', 'Fetching your tickets.')}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-500">
                {localize('Merci de patienter…', 'Please wait...')}
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement des données...', 'Loading data...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {localize('Tableau de bord', 'Dashboard')}
          </h1>
          <p className="text-slate-600 mt-1">
            {localize('Bienvenue sur votre tableau de bord CyberScan', 'Welcome to your CyberScan dashboard')}
          </p>
        </div>

        {loadError && (
          <Card className="border-red-200 bg-red-50 text-red-700">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>{localize('Erreur', 'Error')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{loadError}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{localize("Type d'abonnement", 'Plan type')}</CardTitle>
              <CardDescription>
                {localize('Fonctionnalités disponibles pour votre compte', 'Features available on your account')}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="uppercase">
              {planLabel}
            </Badge>
          </CardHeader>
          <CardContent>
            {planLoading ? (
              <p className="text-sm text-slate-600">
                {localize("Récupération de vos informations d'abonnement…", 'Fetching your subscription details...')}
              </p>
            ) : isAdminDisplay ? (
              <p className="text-sm text-slate-600">
                {localize(
                  "Vous êtes administrateur et disposez d'un accès complet à toutes les fonctionnalités.",
                  'You are an administrator and have full access to every feature.'
                )}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {localize('Plan actuel :', 'Current plan:')}{' '}
                  <span className="font-semibold capitalize">
                    {planNames[effectivePlan as keyof typeof planNames] ?? effectivePlan}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {subscriptionBadges.map((feature) => (
                    <Badge key={feature} variant="outline">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-stretch">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {localize('Résumé des scans', 'Scan summary')}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {localize('Crédits restants', 'Remaining credits')}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{creditDetails}</p>
                    </div>
                    <div className={`${circleClass} border-blue-300 text-blue-600`}>
                      <span>{remainingCredits}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
                    <span>
                      {localize(
                        `${usedCredits} crédits utilisés`,
                        `${usedCredits} credits used`
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {localize('Scans en cours', 'Ongoing scans')}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {localize('En attente ou en progression', 'Pending or in progress')}
                      </p>
                    </div>
                    <div className={`${circleClass} border-amber-300 text-amber-600`}>
                      <span>{activeScans}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <Activity className="mr-2 h-4 w-4 text-amber-500" />
                    <span>
                      {localize(
                        `${scans.length} scans suivis`,
                        `${scans.length} scans tracked`
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {localize('Alertes', 'Alerts')}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {localize('Notifications non lues', 'Unread notifications')}
                      </p>
                    </div>
                    <div className={`${circleClass} border-red-300 text-red-600`}>
                      <span>{unreadAlerts}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
                    <span>{localize('Surveillez vos alertes critiques', 'Keep an eye on critical alerts')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {localize('Total scans', 'Total scans')}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {localize('Dernières exécutions enregistrées', 'Latest recorded runs')}
                      </p>
                    </div>
                    <div className={`${circleClass} border-emerald-300 text-emerald-600`}>
                      <span>{scans.length}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <TrendingUp className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>{localize('Vue sur les 8 derniers scans', 'View over the last 8 scans')}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-rose-500" />
                <CardTitle>
                  {localize('Synthèse des vulnérabilités', 'Vulnerability summary')}
                </CardTitle>
              </div>
              <CardDescription>{trendSubtitle}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col overflow-hidden">
              {vulnerabilityTrend.length > 0 ? (
                <ChartContainer
                  config={chartConfig}
                  className="w-full"
                  style={{ width: '100%', height: 350 }}
                >
                    <LineChart 
                    data={vulnerabilityTrend} 
                    margin={{ left: 24, right: 16, top: 12, bottom: 64 }}
                    width={690}
                    height={350}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                     <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={true}
                      stroke="#d1d5db"
                      dy={8}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={vulnerabilityTrend.length > 7 ? Math.floor(vulnerabilityTrend.length / 7) : 0}
                      tickMargin={8}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                    />
                     <YAxis
                      allowDecimals={true}
                      tickLine={false}
                      axisLine={true}
                      stroke="#d1d5db"
                      width={40}
                      domain={[0, Math.max(1, maxVulnerabilityCount)]}
                      tick={false}
                    />
                    <ChartTooltip cursor={false} />
                    <ChartLegend 
                      verticalAlign="bottom"
                      height={60}
                      wrapperStyle={{ paddingTop: '150px' }}
                      iconType="circle"
                    />

                    <Line type="monotone" dataKey="critical" stroke="hsl(0, 82%, 60%)" strokeWidth={2.5} dot={false} name="Critical" />
                    <Line type="monotone" dataKey="high" stroke="hsl(0, 84%, 60%)" strokeWidth={2.5} dot={false} name="High" />
                    <Line type="monotone" dataKey="medium" stroke="hsl(38, 85%, 55%)" strokeWidth={2.5} dot={false} name="Medium" />
                    <Line type="monotone" dataKey="low" stroke="hsl(210, 85%, 55%)" strokeWidth={2.5} dot={false} name="Low" />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-sm text-slate-600">
                  {localize(
                    'Aucune donnée de vulnérabilité disponible pour cette période.',
                    'No vulnerability data available for this period.'
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{localize('Historique des scans', 'Scan history')}</CardTitle>
              <CardDescription>
                {localize('URL, CMS, mode, niveau de risque, date et statut', 'URL, CMS, mode, risk level, date and status')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {scans.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-600">
                  {localize('Aucun scan disponible', 'No scans available')}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{localize('URL du site', 'Site URL')}</TableHead>
                      <TableHead>CMS</TableHead>
                      <TableHead>{localize('Mode', 'Mode')}</TableHead>
                      <TableHead>{localize('Risque', 'Risk')}</TableHead>
                      <TableHead>{localize('Date', 'Date')}</TableHead>
                      <TableHead className="text-right">{localize('Statut', 'Status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((scan) => {
                      const cmsDisplay = formatCms(scan.cms_type);
                      const primaryUrl = scan.site_url || '—';
                      const secondaryName = scan.site_name && scan.site_name !== scan.site_url ? scan.site_name : null;
                      return (
                        <TableRow key={scan.id}>
                          <TableCell className="font-medium">
                            <div className="text-slate-900 break-all">{primaryUrl}</div>
                            {secondaryName && (
                              <div className="text-xs text-slate-500">{secondaryName}</div>
                            )}
                          </TableCell>
                          <TableCell>{cmsDisplay}</TableCell>
                          <TableCell className="capitalize">
                            {scanModeLabels[scan.scan_type]}
                          </TableCell>
                          <TableCell>{getRiskBadge(scan.risk_level)}</TableCell>
                          <TableCell>{formatDateTime(scan.created_at)}</TableCell>
                          <TableCell className="text-right">{getStatusBadge(scan.status)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{localize('Alertes récentes', 'Recent alerts')}</CardTitle>
              <CardDescription>
                {localize('Vos 5 dernières notifications', 'Your latest 5 notifications')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-600 text-center">
                  {localize('Aucune alerte non lue', 'No unread alerts')}
                </p>
              ) : (
                alerts.map((alert) => {
                  const translated = translateAlertContent(alert);
                  return (
                    <div key={alert.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{translated.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{translated.message}</p>
                        </div>
                        <span className={`text-xs font-medium uppercase ${severityStyles[alert.severity]}`}>
                          {alertSeverityLabels[alert.severity]}
                        </span>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        {formatDateTime(alert.created_at)}
                      </p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <TicketsPanel
          tickets={tickets}
          onTicketCreated={loadDashboardData}
          isAdmin={isAdminUser}
        />
      </div>
    </DashboardLayout>
  );
}
