'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Credits, Scan, Alert, Ticket, ScheduledScan } from '@/lib/supabase';
import { TicketsPanel } from '@/components/ui/tickets-panel';
import { ScanCalendarPanel } from '@/components/ui/scan-calendar-panel';
import { TicketDialog } from '@/components/ui/ticket-dialog';
import { ScheduleScanDialog } from '@/components/ui/schedule-scan-dialog';
import { Calendar } from '@/components/ui/calendar';
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

const statusLabels: Record<Scan['status'], string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};

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

const riskLabels: Record<NonNullable<Scan['risk_level']>, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  critical: 'Critique',
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

type VulnerabilityTrendPoint = {
  dateKey: string;
  label: string;
  low: number;
  medium: number;
  high: number;
  critical: number;
};

const buildTrendBase = (
  startDate: Date,
  days: number
): [VulnerabilityTrendPoint[], Map<string, VulnerabilityTrendPoint>] => {
  const base: VulnerabilityTrendPoint[] = [];
  const map = new Map<string, VulnerabilityTrendPoint>();
  const formatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

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

const vulnerabilityChartConfig = {
  critical: { label: 'Critique', color: 'hsl(0, 82%, 60%)' },
  high: { label: 'Élevé', color: 'hsl(12, 82%, 55%)' },
  medium: { label: 'Moyen', color: 'hsl(38, 85%, 55%)' },
  low: { label: 'Faible', color: 'hsl(210, 85%, 55%)' },
} as const;

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams?.get('section') ?? 'overview';
  const { plan, loading: planLoading } = useSubscriptionPlan();
  const [credits, setCredits] = useState<Credits | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [vulnerabilityTrend, setVulnerabilityTrend] = useState<VulnerabilityTrendPoint[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [scheduledScans, setScheduledScans] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isAdminUser = profile?.role === 'admin';

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, isAdminUser]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoadError(null);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rangeStart = new Date(today);
      rangeStart.setDate(today.getDate() - (DAYS_RANGE - 1));
      const rangeStartIso = rangeStart.toISOString();

      const [creditsRes, scansRes, alertsRes, scheduledScansRes] = await Promise.all([
        supabase.from('credits').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('scans')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', rangeStartIso)
          .order('created_at', { ascending: false }),
        supabase.from('alerts').select('*').eq('user_id', user.id).eq('is_read', false).limit(5),
        supabase
          .from('scheduled_scans')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('next_scan_date', { ascending: true }),
      ]);

      if (creditsRes.data) setCredits(creditsRes.data);
      let scansData = scansRes.data || [];
      if (scheduledScansRes.data) setScheduledScans(scheduledScansRes.data);

      let ticketsData: Ticket[] = [];
      if (isAdminUser) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          const token = session?.access_token;
          if (token) {
            const res = await fetch('/api/admin?resource=tickets', {
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

      if (!scansData.length) {
        const fallback = await supabase
          .from('scans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8);
        if (fallback.data) {
          scansData = fallback.data;
        }
      }

      setScans(scansData.slice(0, 8));
      if (alertsRes.data) setAlerts(alertsRes.data);

      const [baseTrend, trendMap] = buildTrendBase(rangeStart, DAYS_RANGE);

      if (scansData.length) {
        const scanMap = new Map(scansData.map((scan) => [scan.id, scan]));
        const scanIds = Array.from(scanMap.keys());

        if (scanIds.length) {
          const { data: vulnerabilityRows } = await supabase
            .from('vulnerabilities')
            .select('scan_id,severity,count')
            .in('scan_id', scanIds);

          if (vulnerabilityRows) {
            vulnerabilityRows.forEach((row) => {
              const severity = (row.severity || '').toLowerCase() as SeverityKey;
              if (!SEVERITY_KEYS.includes(severity)) return;

              const scan = scanMap.get(row.scan_id);
              if (!scan) return;

              const createdAt = new Date(scan.created_at);
              createdAt.setHours(0, 0, 0, 0);
              const dateKey = createdAt.toISOString().split('T')[0];
              const trendEntry = trendMap.get(dateKey);
              if (!trendEntry) return;

              const amount = Number(row.count) || 0;
              trendEntry[severity] += amount;
            });
          }
        }
      }

      setVulnerabilityTrend([...baseTrend]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoadError("Impossible de charger toutes les données du tableau de bord.");
    } finally {
      setLoading(false);
    }
  };

  const activeScans = scans.filter(s => s.status === 'in_progress' || s.status === 'pending').length;
  const unreadAlerts = alerts.length;
  const totalCredits = credits?.total_credits ?? 0;
  const remainingCredits = credits?.remaining_credits ?? 0;
  const usedCredits = credits?.used_credits ?? 0;
  const creditDetails =
    totalCredits > 0 ? `${remainingCredits} / ${totalCredits} restants` : 'Aucun crédit défini';

  const circleClass =
    'flex h-20 w-20 items-center justify-center rounded-full border-[6px] bg-white text-xl font-semibold shadow-sm';

  const effectivePlan = plan ?? 'free';
  const isAdminEffective = effectivePlan === 'admin';
  const isAdminDisplay = isAdminUser || isAdminEffective;
  const planLabel = planLoading ? 'Chargement...' : isAdminEffective ? 'Admin' : effectivePlan;
  const subscriptionBadges: string[] = [];

  if (isAdminEffective || effectivePlan === 'enterprise') {
    subscriptionBadges.push('Analyseur avancé');
  }
  if (isAdminEffective || effectivePlan === 'enterprise' || effectivePlan === 'pro') {
    subscriptionBadges.push('Planification automatique');
    subscriptionBadges.push('Détection CMS');
  } else if (effectivePlan === 'basic') {
    subscriptionBadges.push('Scan complet');
  } else {
    subscriptionBadges.push('Scan léger uniquement');
  }

  const formatCms = (value?: string | null) => {
    if (!value) return 'Inconnu';
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
      return <Badge variant="secondary">N/A</Badge>;
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

  if (activeSection === 'support') {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Support & Automatisation</h1>
              <p className="text-slate-600 mt-1">
                Gérez vos tickets d'assistance et configurez vos scans planifiés.
              </p>
            </div>
            <button
              className="text-sm text-blue-600 underline"
              onClick={() => router.push('/dashboard')}
            >
              Retour au tableau de bord
            </button>
          </div>

          {loadError && (
            <Card className="border-red-200 bg-red-50 text-red-700">
              <CardHeader className="flex flex-row items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <CardTitle>Erreur</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{loadError}</CardContent>
            </Card>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <TicketsPanel tickets={tickets} onTicketCreated={loadDashboardData} isAdmin={isAdminUser} />
            <ScanCalendarPanel scheduledScans={scheduledScans} onScanScheduled={loadDashboardData} />
          </div>

          {loading && (
            <Card>
              <CardHeader>
                <CardTitle>Chargement…</CardTitle>
                <CardDescription>Récupération de vos tickets et scans programmés.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-500">Merci de patienter…</CardContent>
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
          <p className="text-slate-600">Chargement des données...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tableau de bord</h1>
          <p className="text-slate-600 mt-1">Bienvenue sur votre tableau de bord CyberScan</p>
        </div>

        {loadError && (
          <Card className="border-red-200 bg-red-50 text-red-700">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Erreur</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{loadError}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Type d&apos;abonnement</CardTitle>
              <CardDescription>Fonctionnalités disponibles pour votre compte</CardDescription>
            </div>
            <Badge variant="secondary" className="uppercase">
              {planLabel}
            </Badge>
          </CardHeader>
          <CardContent>
            {planLoading ? (
              <p className="text-sm text-slate-600">Récupération de vos informations d&apos;abonnement…</p>
            ) : isAdminDisplay ? (
              <p className="text-sm text-slate-600">
                Vous êtes administrateur et disposez d&apos;un accès complet à toutes les fonctionnalités.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Plan actuel : <span className="font-semibold capitalize">{effectivePlan}</span>
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
                Résumé des scans
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Crédits restants</p>
                      <p className="mt-1 text-xs text-slate-400">{creditDetails}</p>
                    </div>
                    <div className={`${circleClass} border-blue-300 text-blue-600`}>
                      <span>{remainingCredits}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <CreditCard className="mr-2 h-4 w-4 text-blue-500" />
                    <span>{usedCredits} crédits utilisés</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Scans en cours</p>
                      <p className="mt-1 text-xs text-slate-400">En attente ou en progression</p>
                    </div>
                    <div className={`${circleClass} border-amber-300 text-amber-600`}>
                      <span>{activeScans}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <Activity className="mr-2 h-4 w-4 text-amber-500" />
                    <span>{scans.length} scans suivis</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Alertes</p>
                      <p className="mt-1 text-xs text-slate-400">Notifications non lues</p>
                    </div>
                    <div className={`${circleClass} border-red-300 text-red-600`}>
                      <span>{unreadAlerts}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
                    <span>Surveillez vos alertes critiques</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Total scans</p>
                      <p className="mt-1 text-xs text-slate-400">Dernières exécutions enregistrées</p>
                    </div>
                    <div className={`${circleClass} border-emerald-300 text-emerald-600`}>
                      <span>{scans.length}</span>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-xs text-slate-500">
                    <TrendingUp className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>Vue sur les 8 derniers scans</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="flex flex-col overflow-hidden">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-rose-500" />
                <CardTitle>Vulnerability summary</CardTitle>
              </div>
              <CardDescription>Évolution sur les {DAYS_RANGE} derniers jours</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ChartContainer
                config={vulnerabilityChartConfig}
                className="h-full min-h-[180px]"
              >
                <LineChart data={vulnerabilityTrend} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} dy={8} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="critical" stroke="var(--color-critical)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="high" stroke="var(--color-high)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="medium" stroke="var(--color-medium)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="low" stroke="var(--color-low)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
              {!hasVulnerabilityData && (
                <p className="mt-4 text-sm text-slate-600">Aucune donnée de vulnérabilité disponible pour cette période.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Historique des scans</CardTitle>
              <CardDescription>URL, CMS, mode, niveau de risque, date et statut</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {scans.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-600">Aucun scan disponible</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL du site</TableHead>
                      <TableHead>CMS</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Risque</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Statut</TableHead>
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
                          <TableCell className="capitalize">{scan.scan_type}</TableCell>
                          <TableCell>{getRiskBadge(scan.risk_level)}</TableCell>
                          <TableCell>{new Date(scan.created_at).toLocaleString('fr-FR')}</TableCell>
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
              <CardTitle>Alertes récentes</CardTitle>
              <CardDescription>Vos 5 dernières notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {alerts.length === 0 ? (
                <p className="text-sm text-slate-600 text-center">Aucune alerte non lue</p>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{alert.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{alert.message}</p>
                      </div>
                      <span className={`text-xs font-medium uppercase ${severityStyles[alert.severity]}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {new Date(alert.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Tickets de support</CardTitle>
              <CardDescription>Les 5 derniers tickets ouverts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <TicketDialog onTicketCreated={() => loadDashboardData()} />
              {tickets.length === 0 ? (
                <p className="text-sm text-slate-600 text-center mt-4">Aucun ticket en cours</p>
              ) : (
                tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{ticket.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{ticket.description}</p>
                      </div>
                      <Badge variant="outline" className={
                        ticket.status === 'open' ? 'bg-blue-100 text-blue-700' :
                        ticket.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-700' :
                        'bg-slate-100 text-slate-700'
                      }>
                        {ticket.status === 'open' ? 'Ouvert' :
                         ticket.status === 'in_progress' ? 'En cours' :
                         ticket.status === 'resolved' ? 'Résolu' :
                         'Fermé'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {new Date(ticket.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calendrier des scans programmés</CardTitle>
              <CardDescription>Vos prochains scans automatiques</CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduleScanDialog onScanScheduled={() => loadDashboardData()} />
              <div className="mt-4">
                <Calendar
                  mode="multiple"
                  selected={scheduledScans.map(scan => new Date(scan.next_scan_date))}
                  className="rounded-md border"
                />
                <div className="mt-4 space-y-2">
                  {scheduledScans.map((scan) => (
                    <div key={scan.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                        <span className="text-slate-700">{scan.site_url}</span>
                      </div>
                      <span className="text-slate-500">
                        {new Date(scan.next_scan_date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
