'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Subscription, Invoice, SubscriptionHistory } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import { Check, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLAN_DEFINITIONS, PlanDefinition } from '@/lib/plans';
import { loadStripeJs } from '@/lib/stripe';

type LocalizedPlan = {
  id: PlanDefinition['id'];
  icon: PlanDefinition['icon'];
  price: string;
  creditsLimit: number;
  popular?: boolean;
  name: string;
  description?: string;
  creditsLabel: string;
  period?: string;
  features: string[];
  priceMonthly: string;
  priceYearly: string;
};

type InvoiceMeta = {
  id: string;
  planType: string;
  createdAt: string;
  createdAtMs: number;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  invoice_link: string | null;
  invoice_reference: string | null;
};

type PaymentHistoryItem = {
  id: string;
  kind: 'subscription' | 'invoice';
  status_kind: 'invoice' | 'subscription';
  created_at: string;
  plan_type: string | null;
  status: string | null;
  amount_cents: number | null;
  currency: string | null;
  invoice_link: string | null;
  invoice_reference: string | null;
  credits_limit?: number | null;
  expires_at?: string | null;
};

type SubscriptionRow = {
  id?: string | null;
  plan_type?: string | null;
  status?: string | null;
  credits_limit?: number | null;
  started_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CreditsRow = {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const toMs = (value?: string | null) => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const pickLatestByDate = <T extends { created_at?: string | null; updated_at?: string | null }>(
  rows: T[] | null | undefined
): T | null => {
  if (!rows || rows.length === 0) return null;
  return rows.reduce<T | null>((best, row) => {
    if (!best) return row;
    const bestMs = Math.max(toMs(best.updated_at), toMs(best.created_at));
    const rowMs = Math.max(toMs(row.updated_at), toMs(row.created_at));
    return rowMs >= bestMs ? row : best;
  }, null);
};

const getSubscriptionRank = (row: SubscriptionRow, nowMs: number) => {
  if (row.status === 'active') return 3;
  if (row.status === 'cancelled') {
    const expiresAt = toMs(row.expires_at);
    if (expiresAt > nowMs) return 2;
  }
  return 1;
};

const pickBestSubscription = (rows: SubscriptionRow[] | null | undefined): SubscriptionRow | null => {
  if (!rows || rows.length === 0) return null;
  const nowMs = Date.now();
  return rows.reduce<SubscriptionRow | null>((best, row) => {
    if (!best) return row;
    const bestStatusRank = getSubscriptionRank(best, nowMs);
    const rowStatusRank = getSubscriptionRank(row, nowMs);
    if (rowStatusRank !== bestStatusRank) {
      return rowStatusRank > bestStatusRank ? row : best;
    }
    const bestTime = Math.max(toMs(best.started_at), toMs(best.updated_at), toMs(best.created_at));
    const rowTime = Math.max(toMs(row.started_at), toMs(row.updated_at), toMs(row.created_at));
    return rowTime >= bestTime ? row : best;
  }, null);
};

function SubscriptionPageContent() {
  const { user } = useAuth();
  const { choose } = useLanguage();
  const localize = useMemo(
    () => <T,>(fr: T, en: T) => choose({ fr, en }),
    [choose]
  );
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledCheckoutRef = useRef(false);
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<LocalizedPlan | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [stripeElements, setStripeElements] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const paymentElementRef = useRef<HTMLDivElement | null>(null);
  const paymentElementInstance = useRef<any>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  const parsePriceValue = (price: string) => {
    const match = price.match(/[\d.,]+/);
    if (!match) return 0;
    return parseFloat(match[0].replace(',', '.'));
  };

  const CYCLE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

  const getNextCycleEndDate = (record: Subscription): Date | null => {
    const start = record.started_at ? new Date(record.started_at) : null;
    if (!start || Number.isNaN(start.getTime())) {
      return null;
    }
    const candidate = new Date(start.getTime() + CYCLE_DURATION_MS);
    if (candidate > new Date()) {
      return candidate;
    }
    return new Date(new Date().getTime() + CYCLE_DURATION_MS);
  };
  const nextExpiryDate = useMemo(() => {
    if (!subscription) return null;
    if (subscription.expires_at) {
      const date = new Date(subscription.expires_at);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const next = getNextCycleEndDate(subscription);
    return next ?? null;
  }, [subscription]);

  const handleScheduleCancellation = async () => {
    if (!user || !subscription) return;
    if (subscription.plan_type === 'free') {
      setStatusMessage({
        type: 'info',
        text: localize('Vous êtes déjà sur le plan Free.', 'You are already on the Free plan.'),
      });
      return;
    }
    if (subscription.status === 'cancelled') {
      setStatusMessage({
        type: 'info',
        text: localize(
          'Votre annulation est déjà programmée.',
          'Your cancellation is already scheduled.'
        ),
      });
      return;
    }

    setStatusMessage(null);
    setActionLoadingPlan('cancel');

    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const cycleEnd = getNextCycleEndDate(subscription);
      const effectiveExpiry = cycleEnd ?? new Date(now.getTime() + CYCLE_DURATION_MS);

      const { data: updatedRows, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          expires_at: effectiveExpiry.toISOString(),
          updated_at: nowIso,
        })
        .eq(subscription.id ? 'id' : 'user_id', subscription.id ?? user.id)
        .select('*');

      if (error) throw error;

      const formattedDate = formatDate(effectiveExpiry.toISOString());

      await supabase.from('alerts').insert({
        user_id: user.id,
        title: localize('Annulation programmée', 'Cancellation scheduled'),
        message: localize(
          `Votre abonnement restera actif jusqu'au ${formattedDate}, puis repassera automatiquement sur l'offre Free.`,
          `Your subscription will remain active until ${formattedDate} and then revert to the Free plan automatically.`
        ),
        type: 'subscription',
        severity: 'info',
      });

      const updated = pickBestSubscription(updatedRows as SubscriptionRow[]);
      if (updated) {
        setSubscription(updated as Subscription);
      }
      setStatusMessage({
        type: 'success',
        text: localize(
          `Votre abonnement restera actif jusqu'au ${formattedDate}, puis repassera en Free.`,
          `Your subscription will stay active until ${formattedDate}, then switch back to Free.`
        ),
      });
    } catch (error: any) {
      console.error('Error scheduling cancellation:', error);
      setStatusMessage({
        type: 'error',
        text:
          error?.message ||
          localize("Impossible de programmer l'annulation.", 'Unable to schedule the cancellation.'),
      });
    } finally {
      setActionLoadingPlan(null);
    }
  };

  const planConfigs: LocalizedPlan[] = PLAN_DEFINITIONS.map((plan) => ({
    id: plan.id,
    icon: plan.icon,
    price: plan.price,
    creditsLimit: plan.creditsLimit,
    popular: plan.popular,
    name: localize(plan.name.fr, plan.name.en),
    description: plan.description ? localize(plan.description.fr, plan.description.en) : undefined,
    creditsLabel: localize(plan.creditsLabel.fr, plan.creditsLabel.en),
    period: plan.period ? localize(plan.period.fr, plan.period.en) : undefined,
    features: plan.features.map((feature) => localize(feature.fr, feature.en)),
    priceMonthly: `${parsePriceValue(plan.price)}€`,
    priceYearly: `${Math.round(parsePriceValue(plan.price) * 12)}€`,
  }));
  const planNameMap = Object.fromEntries(planConfigs.map((plan) => [plan.id, plan.name]));
  const FREE_PLAN_CREDITS = PLAN_DEFINITIONS.find((plan) => plan.id === 'free')?.creditsLimit ?? 3;
  const formatAmount = (amountCents?: number | null, currency?: string | null) => {
    const amount = (amountCents ?? 0) / 100;
    const safeCurrency = (currency || 'EUR').toUpperCase();
    return new Intl.NumberFormat(locale, { style: 'currency', currency: safeCurrency }).format(amount);
  };
  const formatDate = (isoDate?: string | null) => {
    return formatDateDMY(isoDate);
  };
  const formatSubscriptionStatus = (status?: Subscription['status'] | string | null) => {
    if (!status) return localize('Non disponible', 'Not available');
    switch (status) {
      case 'active':
        return localize('Actif', 'Active');
      case 'cancelled':
        return localize('Annulé', 'Cancelled');
      case 'expired':
        return localize('Expiré', 'Expired');
      case 'refunded':
        return localize('Remboursé', 'Refunded');
      default:
        return status;
    }
  };
  const subscriptionStatusClassName = (status?: Subscription['status'] | string | null) => {
    switch (status) {
      case 'active':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'cancelled':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'expired':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'refunded':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-500';
    }
  };
  const formatInvoiceStatus = (status?: string | null) => {
    if (!status) return localize('Non disponible', 'Not available');
    const normalized = status.toLowerCase();
    switch (normalized) {
      case 'paid':
        return localize('Payé', 'Paid');
      case 'open':
        return localize('Ouverte', 'Open');
      case 'void':
        return localize('Annulée', 'Void');
      case 'uncollectible':
        return localize('Irrécouvrable', 'Uncollectible');
      case 'draft':
        return localize('Brouillon', 'Draft');
      case 'refunded':
        return localize('Remboursé', 'Refunded');
      default:
        return status;
    }
  };
  const invoiceStatusClassName = (status?: string | null) => {
    const normalized = status?.toLowerCase();
    switch (normalized) {
      case 'paid':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'open':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'refunded':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'void':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'uncollectible':
        return 'border-red-200 bg-red-50 text-red-700';
      case 'draft':
        return 'border-slate-200 bg-slate-50 text-slate-500';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-500';
    }
  };
  const formattedExpiryLabel = nextExpiryDate
    ? formatDate(nextExpiryDate.toISOString())
    : localize('Non défini', 'Not set');
  const subscriptionStatusLabel = formatSubscriptionStatus(subscription?.status);
  const subscriptionStatusBadgeClass = subscriptionStatusClassName(subscription?.status);
  const paymentHistoryLoading = invoicesLoading || historyLoading;
  const paymentHistoryError = invoicesError || historyError;
  const paymentHistoryItems = useMemo<PaymentHistoryItem[]>(() => {
    const invoiceMeta: InvoiceMeta[] = invoices.map((invoice) => ({
      id: invoice.id,
      planType: (invoice.plan_type || '').toLowerCase(),
      createdAt: invoice.created_at,
      createdAtMs: Date.parse(invoice.created_at || ''),
      status: (invoice.payment_status || '').toLowerCase(),
      amount_cents: invoice.amount_total_cents ?? null,
      currency: invoice.currency ?? null,
      invoice_link: invoice.invoice_pdf_url || invoice.hosted_invoice_url || null,
      invoice_reference: invoice.invoice_id || invoice.id || null,
    }));
    const dateKey = (value?: string | null) => {
      if (!value) return '';
      const time = Date.parse(value);
      if (!Number.isFinite(time)) return value;
      return new Date(time).toISOString().slice(0, 10);
    };
    const historyByPeriod = new Map<string, SubscriptionHistory>();
    subscriptionHistory.forEach((entry) => {
      const planKey = (entry.plan_type || '').toLowerCase();
      const startKey = dateKey(entry.started_at || entry.created_at || '');
      const subscriptionKey = entry.subscription_id || '';
      const key = `${subscriptionKey}::${planKey}::${startKey}`;
      const existing = historyByPeriod.get(key);
      if (!existing) {
        historyByPeriod.set(key, entry);
        return;
      }
      const existingTime = Date.parse(existing.created_at || '');
      const entryTime = Date.parse(entry.created_at || '');
      if (!Number.isFinite(existingTime) || entryTime >= existingTime) {
        historyByPeriod.set(key, entry);
      }
    });

    const normalizedHistory: SubscriptionHistory[] = Array.from(historyByPeriod.values());
    const invoicesByPlan = new Map<string, InvoiceMeta[]>();
    invoiceMeta.forEach((invoice) => {
      if (!invoice.planType) return;
      const list = invoicesByPlan.get(invoice.planType) ?? [];
      list.push(invoice);
      invoicesByPlan.set(invoice.planType, list);
    });
    invoicesByPlan.forEach((list) => list.sort((a, b) => a.createdAtMs - b.createdAtMs));

    const usedInvoiceIds = new Set<string>();
    const matchWindowMs = 45 * 24 * 60 * 60 * 1000;

    const pickInvoiceForEntry = (entry: SubscriptionHistory): InvoiceMeta | null => {
      const planKey = (entry.plan_type || '').toLowerCase();
      if (!planKey) return null;
      const invoicesForPlan = invoicesByPlan.get(planKey);
      if (!invoicesForPlan || invoicesForPlan.length === 0) {
        return null;
      }
      const targetTime = Date.parse(entry.started_at || entry.created_at || '');
      let best: InvoiceMeta | null = null;
      let bestId: string | null = null;
      let bestDelta = Number.POSITIVE_INFINITY;

      invoicesForPlan.forEach((invoice) => {
        if (usedInvoiceIds.has(invoice.id)) return;
        if (!Number.isFinite(invoice.createdAtMs) || !Number.isFinite(targetTime)) return;
        const delta = Math.abs(invoice.createdAtMs - targetTime);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = invoice;
          bestId = invoice.id;
        }
      });

      if (best && bestId && bestDelta <= matchWindowMs) {
        usedInvoiceIds.add(bestId);
        return best;
      }

      const remaining = invoicesForPlan.filter((invoice) => !usedInvoiceIds.has(invoice.id));
      if (remaining.length === 1) {
        usedInvoiceIds.add(remaining[0].id);
        return remaining[0];
      }
      return null;
    };

    const subscriptionItems = normalizedHistory.map((entry) => {
      const matchedInvoice = pickInvoiceForEntry(entry);
      const statusFromInvoice = matchedInvoice?.status || null;
      const status = statusFromInvoice || entry.status || null;
      return {
        id: `subscription-${entry.id}`,
        kind: 'subscription' as const,
        status_kind: statusFromInvoice ? ('invoice' as const) : ('subscription' as const),
        created_at: matchedInvoice?.createdAt || entry.started_at || entry.created_at,
        plan_type: entry.plan_type ?? null,
        status,
        amount_cents: matchedInvoice?.amount_cents ?? null,
        currency: matchedInvoice?.currency ?? null,
        invoice_link: matchedInvoice?.invoice_link ?? null,
        invoice_reference: matchedInvoice?.invoice_reference ?? null,
        credits_limit: entry.credits_limit ?? null,
        expires_at: entry.expires_at ?? null,
      };
    });

    const invoiceItems = invoiceMeta
      .filter((invoice) => !usedInvoiceIds.has(invoice.id))
      .map((invoice) => ({
        id: `invoice-${invoice.id}`,
        kind: 'invoice' as const,
        status_kind: 'invoice' as const,
        created_at: invoice.createdAt,
        plan_type: invoice.planType || null,
        status: invoice.status || null,
        amount_cents: invoice.amount_cents ?? null,
        currency: invoice.currency ?? null,
        invoice_link: invoice.invoice_link ?? null,
        invoice_reference: invoice.invoice_reference ?? null,
      }));

    const merged = [...subscriptionItems, ...invoiceItems];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  }, [invoices, subscriptionHistory]);

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadSubscriptionHistory();
    }
  }, [user]);

  useEffect(() => {
    if (!publishableKey || typeof window === 'undefined') {
      return;
    }
    let canceled = false;
    loadStripeJs()
      .then((StripeConstructor) => {
        if (canceled || !StripeConstructor) return;
        const instance = StripeConstructor(publishableKey);
        if (!instance) {
          throw new Error('Impossible d’initialiser Stripe.');
        }
        if (!canceled) {
          setStripeInstance(instance);
        }
      })
      .catch((error) => {
        if (!canceled) {
          console.error('Erreur de chargement Stripe.js:', error);
          setPaymentError(error?.message || 'Stripe.js est indisponible.');
        }
      });
    return () => {
      canceled = true;
    };
  }, [publishableKey]);

  const finalizeCancellationIfNeeded = async (record: Subscription | null): Promise<Subscription | null> => {
    if (!user || !record) return record;
    if (record.plan_type === 'free') return record;
    if (record.status !== 'cancelled') return record;
    if (!record.expires_at) return record;

    const expiryDate = new Date(record.expires_at);
    if (Number.isNaN(expiryDate.getTime()) || expiryDate > new Date()) {
      return record;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: updatedRows, error } = await supabase
      .from('subscriptions')
      .update({
        plan_type: 'free',
        credits_limit: FREE_PLAN_CREDITS,
        status: 'active',
        started_at: nowIso,
        expires_at: null,
        updated_at: nowIso,
      })
      .eq(record.id ? 'id' : 'user_id', record.id ?? user.id)
      .select('*');

    if (error) {
      console.error('Error finalizing cancellation:', error);
      return record;
    }

    try {
      await upsertCredits(FREE_PLAN_CREDITS, nowIso);
    } catch (creditsError) {
      console.error('Error resetting credits after cancellation:', creditsError);
    }

    setStatusMessage({
      type: 'success',
      text: localize(
        'Votre abonnement a expiré et vous êtes revenu(e) sur le plan Free.',
        'Your subscription expired and your account has been moved back to the Free plan.'
      ),
    });

    const updated = pickBestSubscription(updatedRows as SubscriptionRow[]);
    return (updated ?? record) as Subscription;
  };

  const loadSubscription = async () => {
    if (!user) return;

    try {
      const { data: subscriptionRows, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const best = pickBestSubscription(subscriptionRows as SubscriptionRow[]);
      if (best) {
        const normalized = await finalizeCancellationIfNeeded(best as Subscription);
        setSubscription((normalized ?? best) as Subscription);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const upsertCredits = async (creditsLimit: number, nowIso: string) => {
    if (!user) return;

    const {
      data: existingCreditsRows,
      error: fetchCreditsError,
    } = await supabase
      .from('credits')
      .select('id, created_at, updated_at')
      .eq('user_id', user.id);

    if (fetchCreditsError) throw fetchCreditsError;

    const existingCredits = pickLatestByDate(existingCreditsRows as CreditsRow[]);

    const creditsPayload = {
      total_credits: creditsLimit,
      used_credits: 0,
      last_reset_at: nowIso,
      updated_at: nowIso,
    };

    if (existingCredits?.id) {
      const { error: creditsError } = await supabase
        .from('credits')
        .update(creditsPayload)
        .eq('id', existingCredits.id);

      if (creditsError) throw creditsError;
    } else {
      const { error: creditsError } = await supabase
        .from('credits')
        .insert({
          user_id: user.id,
          ...creditsPayload,
          created_at: nowIso,
        });

      if (creditsError) throw creditsError;
    }
  };

  const handleSubscribe = async (
    planType: string,
    creditsLimit: number,
    options?: { silent?: boolean; successMessage?: string }
  ) => {
    if (!user) return;

    try {
      if (!options?.silent) {
        setStatusMessage(null);
      }
      setActionLoadingPlan(planType);

      const now = new Date();
      const expiresAt =
        planType === 'enterprise'
          ? null
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const nowIso = now.toISOString();

      const {
        data: subscriptionRows,
        error: fetchSubscriptionError,
      } = await supabase
        .from('subscriptions')
        .select('id, status, started_at, created_at, updated_at, expires_at')
        .eq('user_id', user.id);

      if (fetchSubscriptionError) throw fetchSubscriptionError;

      const existingSubscription = pickBestSubscription(subscriptionRows as SubscriptionRow[]);

      if (existingSubscription?.id) {
        const { error: subscriptionError } = await supabase
          .from('subscriptions')
          .update({
            plan_type: planType,
            credits_limit: creditsLimit,
            status: 'active',
            started_at: nowIso,
            expires_at: expiresAt,
            updated_at: nowIso,
          })
          .eq('id', existingSubscription.id);

        if (subscriptionError) throw subscriptionError;
      } else {
        const { error: subscriptionError } = await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_type: planType,
          credits_limit: creditsLimit,
          status: 'active',
          started_at: nowIso,
          expires_at: expiresAt,
          created_at: nowIso,
          updated_at: nowIso,
        });

        if (subscriptionError) throw subscriptionError;
      }

      await upsertCredits(creditsLimit, nowIso);

      await supabase.from('alerts').insert({
        user_id: user.id,
        title: localize('Abonnement mis à jour', 'Subscription updated'),
        message: localize(
          `Votre abonnement a été mis à jour vers le plan ${planType}.`,
          `Your subscription has been updated to the ${planType} plan.`
        ),
        type: 'subscription',
        severity: 'info',
      });

      loadSubscription();
      if (!options?.silent) {
        setStatusMessage({
          type: 'success',
          text: options?.successMessage || localize('Abonnement mis à jour avec succès !', 'Subscription updated successfully!'),
        });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      setStatusMessage({
        type: 'error',
        text: localize("Erreur lors de la mise à jour de l'abonnement.", 'Error updating subscription.'),
      });
    }
    setActionLoadingPlan(null);
  };

  const loadInvoices = async (): Promise<Invoice[]> => {
    if (!user) return [];
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((prev) => {
        if (data && data.length > 0) return data;
        if (prev.length > 0) return prev;
        return data ?? [];
      });
      if (data && data.length > 0) {
        return data;
      }
      if (invoices.length > 0) {
        return invoices;
      }
      return data ?? [];
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoicesError(
        localize("Impossible de charger l'historique des paiements.", 'Unable to load payment history.')
      );
      return invoices;
    } finally {
      setInvoicesLoading(false);
    }
  };

  const loadSubscriptionHistory = async (): Promise<SubscriptionHistory[]> => {
    if (!user) return [];
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data, error } = await supabase
        .from('subscription_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscriptionHistory(data ?? []);
      return data ?? [];
    } catch (error) {
      console.error('Error loading subscription history:', error);
      setHistoryError(
        localize("Impossible de charger l'historique des abonnements.", 'Unable to load subscription history.')
      );
      return subscriptionHistory;
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefundRequest = async () => {
    if (!subscription) {
      setStatusMessage({
        type: 'error',
        text: localize(
          "Aucun abonnement actif. Vous ne pouvez pas demander de remboursement.",
          'No active subscription. Refunds cannot be requested.'
        ),
      });
      return;
    }

    if (!user) {
      setStatusMessage({
        type: 'error',
        text: localize('Vous devez être connecté pour demander un remboursement.', 'You must be signed in to request a refund.'),
      });
      return;
    }
    setStatusMessage(null);
    setActionLoadingPlan('refund');
    try {
      const currentInvoices = invoices.length > 0 ? invoices : await loadInvoices();
      const eligibleInvoice = currentInvoices?.find((invoice) => invoice?.stripe_payment_intent_id);
      const fallbackInvoice = currentInvoices?.[0];
      const targetInvoice = eligibleInvoice ?? fallbackInvoice ?? null;
      const invoiceId = targetInvoice?.id ?? null;
      const paymentIntentId = targetInvoice?.stripe_payment_intent_id ?? null;

      const targetUserId = subscription?.user_id ?? user.id;
      if (!targetUserId) {
        throw new Error(localize('Utilisateur introuvable.', 'Unable to determine user ID.'));
      }

      if (!invoiceId) {
        throw new Error(
          localize(
            'Aucune facture disponible pour le moment. Réessayez après la confirmation du paiement.',
            'No invoice is available yet. Please try again after the payment is confirmed.'
          )
        );
      }
      const response = await fetch('/service/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-refund',
          userId: targetUserId,
          invoiceId,
          paymentIntentId,
        }),
      });

      const rawPayload = await response.text();
      let data: any = null;
      try {
        data = rawPayload ? JSON.parse(rawPayload) : null;
      } catch (err) {
        data = null;
      }

      if (!response.ok) {
        const message =
          data?.detail ||
          data?.error ||
          data?.message ||
          localize('Impossible de traiter votre demande de remboursement.', 'Unable to process your refund request.');
        throw new Error(message);
      }

      setStatusMessage({
        type: 'success',
        text: localize(
          'Votre demande a été transmise à notre équipe. Vous serez notifié après vérification.',
          'Your request has been sent to our team. You will be notified once it has been reviewed.'
        ),
      });

      await loadInvoices();
      await loadSubscription();
    } catch (error: any) {
      console.error('Refund request error:', error);
      setStatusMessage({
        type: 'error',
        text:
          error?.message ||
          localize('Impossible de traiter votre demande de remboursement.', 'Unable to process your refund request.'),
      });
    } finally {
      setActionLoadingPlan(null);
    }
  };

  const handleStripeCheckout = (plan: LocalizedPlan) => {
    if (!user) return;

    if (plan.id === 'free') {
      handleSubscribe(plan.id, plan.creditsLimit, { successMessage: localize('Abonnement activé.', 'Plan activated.') });
      return;
    }

    if (!publishableKey) {
      setStatusMessage({
        type: 'error',
        text: localize(
          'Configuration Stripe incomplète. Contactez un administrateur.',
          'Stripe configuration is incomplete. Please contact an administrator.'
        ),
      });
      return;
    }

    setPaymentError(null);
    setStatusMessage(null);
    startStripeCheckout(plan);

  };


  const startStripeCheckout = async (plan: LocalizedPlan) => {
  if (!user) return;

  const response = await fetch('/service/stripe/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      planId: plan.id,
      userId: user.id,
      email: user.email,
      billingInterval,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data?.url) {
    setStatusMessage({ type: 'error', text: 'Erreur Stripe.' });
    return;
  }

  // 🚀 REDIRECTION VERS STRIPE CHECKOUT
  window.location.href = data.url;
};


  const syncSubscriptionCredits = async (paymentIntentId: string | undefined | null) => {
    if (!paymentIntentId || !user || !selectedPlan) {
      return;
    }
    try {
    const response = await fetch('/service/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync-subscription',
          paymentIntentId,
          planId: selectedPlan.id,
          userId: user.id,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
          payload?.detail || payload?.error || localize('Impossible de synchroniser votre abonnement.', 'Unable to sync your subscription.');
        throw new Error(message);
      }
      await loadInvoices();
    } catch (error) {
      console.error('Stripe sync error:', error);
      const message =
        error instanceof Error ? error.message : localize('La synchronisation de votre abonnement a échoué.', 'Subscription sync failed.');
      setStatusMessage({ type: 'error', text: message });
      throw new Error(message);
    }
  };

  const handleConfirmPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stripeInstance || !stripeElements || !selectedPlan) {
      return;
    }
    setConfirmingPayment(true);
    setPaymentError(null);
    try {
      const { error, paymentIntent } = await stripeInstance.confirmPayment({
        elements: stripeElements,
        redirect: 'if_required',
        confirmParams: {
          return_url:
            typeof window !== 'undefined'
              ? `${window.location.origin}/dashboard/subscription?success=true&plan=${selectedPlan.id}`
              : undefined,
        },
      });

      if (error) {
        throw new Error(error.message || localize('Le paiement a échoué.', 'Payment failed.'));
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        await syncSubscriptionCredits(paymentIntent?.id);
        setPaymentDialogOpen(false);
        router.push(`/dashboard/subscription?success=true&plan=${selectedPlan.id}`);
        return;
      }

      setStatusMessage({
        type: 'success',
        text: localize(
          'Paiement initié. Suivez les instructions supplémentaires si nécessaire.',
          'Payment initiated. Follow any additional instructions if required.'
        ),
      });
      setPaymentDialogOpen(false);
    } catch (error: any) {
      console.error('Stripe confirmation error:', error);
      setPaymentError(error?.message || localize('Le paiement a échoué.', 'Payment failed.'));
    } finally {
      setConfirmingPayment(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const success = searchParams.get('success');
    const planParam = searchParams.get('plan');
    const canceled = searchParams.get('canceled');

    if (!success && !canceled) {
      handledCheckoutRef.current = false;
    }

    if (success === 'true' && planParam && !handledCheckoutRef.current) {
      const planConfig = planConfigs.find((p) => p.id === planParam);
      if (planConfig) {
        handledCheckoutRef.current = true;
        setStatusMessage({
          type: 'success',
          text: localize(
            `Paiement confirmé ! Votre plan ${planNameMap[planConfig.id]} va être mis à jour.`,
            `Payment confirmed! Your ${planNameMap[planConfig.id]} plan will be updated shortly.`
          ),
        });
        loadSubscription();
      }
    }

    if (canceled === 'true' && !handledCheckoutRef.current) {
      handledCheckoutRef.current = true;
      setStatusMessage({ type: 'error', text: localize('Paiement annulé.', 'Payment canceled.') });
    }

    if ((success || canceled) && typeof window !== 'undefined') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('success');
      params.delete('canceled');
      params.delete('plan');
      params.delete('session_id');
      const newQuery = params.toString();
      router.replace(`${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`, { scroll: false });
    }
  }, [searchParams, user, router]);

  useEffect(() => {
    if (!paymentDialogOpen || !selectedPlan || !user) {
      return;
    }
    let active = true;

    const preparePayment = async () => {
      setPaymentLoading(true);
      setPaymentError(null);
      setPaymentClientSecret(null);
      try {
        const response = await fetch('/service/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: selectedPlan.id,
            userId: user.id,
            email: user.email,
            checkoutMode: 'embedded',
          }),
        });
        const textPayload = await response.text();
        let data: any = null;
        try {
          data = textPayload ? JSON.parse(textPayload) : null;
        } catch {
          throw new Error(localize('Réponse Stripe inattendue.', 'Unexpected response from Stripe.'));
        }

        if (!response.ok) {
          throw new Error(
            data?.detail ||
              data?.error ||
              localize('Impossible de préparer le paiement Stripe.', 'Unable to prepare the Stripe payment.')
          );
        }
        if (!data?.clientSecret) {
          throw new Error(localize('Client secret Stripe manquant.', 'Missing Stripe client secret.'));
        }
        if (active) {
          setPaymentClientSecret(data.clientSecret);
        }
      } catch (error: any) {
        if (active) {
          console.error('Erreur lors de la préparation du paiement Stripe:', error);
          setPaymentError(
            error?.message || localize('Impossible de préparer le paiement Stripe.', 'Unable to prepare the Stripe payment.')
          );
        }
      } finally {
        if (active) {
          setPaymentLoading(false);
        }
      }
    };

    preparePayment();
    return () => {
      active = false;
    };
  }, [paymentDialogOpen, selectedPlan, user, localize]);

  useEffect(() => {
    if (!stripeInstance || !paymentClientSecret || !paymentDialogOpen) {
      return;
    }
    const container = paymentElementRef.current;
    if (!container) {
      return;
    }
    const elements = stripeInstance.elements({
      clientSecret: paymentClientSecret,
      appearance: { theme: 'stripe' },
    });
    setStripeElements(elements);
    const paymentElement = elements.create('payment');
    paymentElementInstance.current = paymentElement;
    paymentElement.mount(container);

    return () => {
      paymentElementInstance.current?.destroy?.();
      paymentElementInstance.current = null;
      setStripeElements(null);
    };
  }, [stripeInstance, paymentClientSecret, paymentDialogOpen]);

  useEffect(() => {
    if (paymentDialogOpen) {
      return;
    }
    paymentElementInstance.current?.destroy?.();
    paymentElementInstance.current = null;
    setStripeElements(null);
    setPaymentClientSecret(null);
    setPaymentError(null);
    setPaymentLoading(false);
    setConfirmingPayment(false);
    setSelectedPlan(null);
  }, [paymentDialogOpen]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement...', 'Loading...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-10 py-10 px-4 lg:px-0">
        <div className="text-center space-y-3">
          <Badge variant="outline" className="mx-auto border-blue-200 bg-blue-50 text-blue-700">
            CyberScan Premium
          </Badge>
          <h1 className="text-4xl font-bold text-slate-900">
            {localize('Choisissez votre abonnement', 'Choose your subscription')}
          </h1>
          <p className="max-w-2xl mx-auto text-slate-600">
            {localize(
              'Passez au plan qui correspond à vos besoins en sécurité. Crédit mensuel, support prioritaire et fonctionnalités avancées selon votre choix.',
              'Pick the plan that matches your security needs. Monthly credits, priority support, and advanced features as you grow.'
            )}
          </p>
        </div>

        {statusMessage && (
          <div
            className={`mx-auto max-w-3xl rounded-md border px-4 py-3 text-sm ${
              statusMessage.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {subscription && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="relative overflow-hidden border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
              <span className="absolute top-0 right-0 rounded-bl-md bg-blue-600 px-3 py-1 text-xs font-semibold uppercase">
                {localize('Plan actuel', 'Current plan')}
              </span>
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-semibold">
                  {localize('Abonnement', 'Plan')}{' '}
                  {planNameMap[subscription.plan_type as keyof typeof planNameMap] ??
                    subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1)}
                </CardTitle>
                <CardDescription className="text-slate-200/80">
                  {localize(
                    'Gérez votre plan directement depuis cette page. Vous pouvez évoluer vers un plan supérieur à tout moment.',
                    'Manage your plan directly from this page. You can upgrade at any time.'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">{localize('Statut', 'Status')}</p>
                  <Badge className={`mt-2 border border-white/20 ${subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white'}`}>
                    {formatSubscriptionStatus(subscription.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">
                    {localize('Crédits mensuels', 'Monthly credits')}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">{subscription.credits_limit}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">
                    {localize('Dernière mise à jour', 'Last update')}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">
                    {formatDateDMY(subscription.updated_at)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-300">
                    {localize('Expiration / prochaine échéance', 'Expiration / next billing')}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">{formattedExpiryLabel}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
              <CardHeader>
                <CardTitle className="text-slate-900">
                  {localize('Annulation et remboursement', 'Cancellation and refund')}
                </CardTitle>
                <CardDescription className="text-slate-600">
                  {localize(
                    'Arrêtez votre abonnement à tout moment et demandez un remboursement (selon les conditions).',
                    'Stop your subscription anytime and request a refund (per policy).'
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
                <p>
                  {localize(
                    'L’annulation prend effet à la fin de votre cycle en cours. Vous gardez vos accès jusqu’à cette date.',
                    'Cancellation takes effect at the end of your current billing cycle. You keep your access until then.'
                  )}
                </p>
                {subscription?.status === 'cancelled' && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 text-sm">
                    {localize(
                      `Retour automatique au plan Free le ${formatDate(subscription.expires_at ?? undefined)}.`,
                      `You will automatically switch back to the Free plan on ${formatDate(subscription.expires_at ?? undefined)}.`
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={handleScheduleCancellation}
                    disabled={!subscription || actionLoadingPlan === 'cancel'}
                  >
                    {actionLoadingPlan === 'cancel' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {localize('Programmation…', 'Scheduling…')}
                      </>
                    ) : (
                      localize('Programmer la fin du plan', 'Schedule plan cancellation')
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleRefundRequest}
                    disabled={!subscription || !user || actionLoadingPlan === 'refund' || invoicesLoading}
                  >
                    {actionLoadingPlan === 'refund' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {localize('Demande en cours...', 'Submitting...')}
                      </>
                    ) : (
                      localize('Demander un remboursement', 'Request a refund')
                    )}
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  {localize(
                    'Les remboursements sont traités par le support après vérification (prorata possible selon la consommation de crédits).',
                    'Refunds are handled by support after review (proration may apply depending on credits used).'
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button
            variant={billingInterval === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingInterval('monthly')}
          >
            {localize('Mensuel', 'Monthly')}
          </Button>
          <Button
            variant={billingInterval === 'annual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingInterval('annual')}
          >
            {localize('Annuel', 'Annual')}
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 justify-items-center">
          {planConfigs.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = subscription?.plan_type === plan.id;
            const isEnterprise = plan.id === 'enterprise';

            return (
              <Card
                key={plan.id}
                className={`relative w-full max-w-sm transition-all duration-200 ${
                  plan.popular ? 'border-blue-600 shadow-xl' : 'border-slate-200 shadow-sm'
                } ${
                  isCurrentPlan ? 'ring-2 ring-blue-600' : ''
                } hover:-translate-y-1`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-blue-600 px-6 py-1 text-xs uppercase tracking-wide">
                    {localize('Populaire', 'Popular')}
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-green-600 px-6 py-1 text-xs uppercase tracking-wide">
                    {localize('Actuel', 'Current')}
                  </Badge>
                )}
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-xl">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-slate-900">
                        {billingInterval === 'annual' ? plan.priceYearly : plan.priceMonthly}
                      </span>
                      <span className="text-slate-600 ml-1">
                        {billingInterval === 'annual'
                          ? localize('/an', '/year')
                          : localize('/mois', '/month')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {plan.creditsLabel} {localize('crédits/mois', 'credits/month')}
                    </p>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => {
                      if (plan.id === 'free') {
                        return handleSubscribe(plan.id, plan.creditsLimit, { successMessage: localize('Abonnement activé.', 'Plan activated.') });
                      }
                      return handleStripeCheckout(plan);
                    }}
                    disabled={isCurrentPlan || actionLoadingPlan === plan.id}
                  >
                    {isCurrentPlan ? (
                      localize('Plan actuel', 'Current plan')
                    ) : actionLoadingPlan === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {localize('Traitement...', 'Processing...')}
                      </>
                    ) : plan.id === 'free' ? (
                      localize('Choisir ce plan', 'Choose this plan')
                    ) : isEnterprise ? (
                      localize('Souscrire', 'Subscribe')
                    ) : (
                      localize('Souscrire', 'Subscribe')
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mx-auto max-w-4xl bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardHeader>
            <CardTitle className="text-slate-900">
              {localize('WHITE LABEL — Sur demande', 'WHITE LABEL — On request')}
            </CardTitle>
            <CardDescription className="text-slate-600">
              {localize(
                '(Option supplémentaire non incluse dans les plans, activation via support)',
                '(Extra option not included in plans, activation via support)'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-slate-800">
              {[
                localize('Ajout du logo du client', 'Add your client logo'),
                localize('Dashboard personnalisé (couleurs & branding)', 'Custom dashboard (colors & branding)'),
                localize('Rapports PDF brandés', 'Branded PDF reports'),
                localize('Domaine personnalisé (ex : scan.votredomaine.com)', 'Custom domain (e.g., scan.yourdomain.com)'),
                localize('Solution idéale pour agences & MSSP', 'Ideal for agencies & MSSPs'),
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
              <a href="mailto:support@cyberscan.com">{localize('Contacter le support', 'Contact support')}</a>
            </Button>
          </CardContent>
        </Card>

        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>{localize('Historique des paiements', 'Payment history')}</CardTitle>
            <CardDescription>
              {localize('Consultez vos dernières transactions Stripe.', 'Review your latest Stripe transactions.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentHistoryError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {paymentHistoryError}
              </div>
            )}
            {paymentHistoryLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {localize('Chargement des transactions...', 'Loading transactions...')}
              </div>
            ) : paymentHistoryItems.length === 0 ? (
              <p className="text-sm text-slate-600">
                {localize('Aucune transaction trouvée pour le moment.', 'No payment history yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500">
                      <th className="px-2 py-2 font-medium">{localize('Date de paiement', 'Payment date')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Plan', 'Plan')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Statut', 'Status')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Montant', 'Amount')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Facture', 'Invoice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistoryItems.map((item) => {
                      const planType = item.plan_type;
                      const readablePlan = planType
                        ? planNameMap[planType as keyof typeof planNameMap] ||
                          planType.charAt(0).toUpperCase() + planType.slice(1)
                        : localize('Non disponible', 'Not available');
                      const invoiceLink = item.invoice_link || null;
                      const statusKind = item.status_kind === 'invoice' ? 'invoice' : 'subscription';
                      const statusLabel =
                        statusKind === 'invoice'
                          ? formatInvoiceStatus(item.status)
                          : formatSubscriptionStatus(item.status);
                      const statusClass =
                        statusKind === 'invoice'
                          ? invoiceStatusClassName(item.status)
                          : subscriptionStatusClassName(item.status);
                      const amountLabel =
                        typeof item.amount_cents === 'number'
                          ? formatAmount(item.amount_cents, item.currency ?? undefined)
                          : '—';
                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-2 py-3 text-slate-700">{formatDate(item.created_at)}</td>
                          <td className="px-2 py-3 text-slate-700">{readablePlan}</td>
                          <td className="px-2 py-3 text-slate-700">
                            <Badge variant="outline" className={statusClass}>
                              {statusLabel}
                            </Badge>
                          </td>
                          <td className="px-2 py-3 font-medium text-slate-900">
                            {amountLabel}
                          </td>
                          <td className="px-2 py-3 text-slate-700">
                            {invoiceLink ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={invoiceLink} target="_blank" rel="noopener noreferrer">
                                  {localize('Télécharger', 'Download')}
                                </a>
                              </Button>
                            ) : item.invoice_reference ? (
                              <span className="text-slate-600">{item.invoice_reference}</span>
                            ) : (
                              <span className="text-slate-500">{localize('Non disponible', 'Not available')}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>{localize('Questions fréquentes', 'Frequently asked questions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-slate-900 mb-1">
                {localize('Comment fonctionnent les crédits ?', 'How do credits work?')}
              </h4>
              <p className="text-sm text-slate-600">
                {localize(
                  "Le scan léger coûte 1 crédit, le scan complet coûte 3 crédits. Les crédits sont renouvelés chaque mois.",
                  'Light scans cost 1 credit, full scans cost 3 credits. Credits renew every month.'
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">
                {localize('Puis-je changer de plan à tout moment ?', 'Can I change plans at any time?')}
              </h4>
              <p className="text-sm text-slate-600">
                {localize(
                  'Les modifications seront appliquées lors du prochain cycle de facturation.',
                  'Changes will take effect at the next billing cycle.'
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">
                {localize('Les crédits non utilisés sont-ils reportés ?', 'Do unused credits roll over?')}
              </h4>
              <p className="text-sm text-slate-600">
                {localize(
                  'Non, les crédits non utilisés ne sont pas reportés au mois suivant. Ils sont réinitialisés à chaque nouveau cycle.',
                  'No, unused credits do not roll over to the next month. They reset every cycle.'
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{localize('Finaliser votre paiement', 'Complete your payment')}</DialogTitle>
            <DialogDescription>
              {selectedPlan
                ? localize(
                    `Plan ${selectedPlan.name}`,
                    `Plan ${selectedPlan.name}`
                  )
                : localize('Choisissez un plan pour continuer.', 'Select a plan to continue.')}
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">{localize('Plan sélectionné', 'Selected plan')}</p>
                  <p className="text-base font-semibold text-slate-900">{selectedPlan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-900">
                    {billingInterval === 'annual' ? selectedPlan.priceYearly : selectedPlan.priceMonthly}
                  </p>
                  <p className="text-xs text-slate-500">
                    {billingInterval === 'annual'
                      ? localize('/an', '/year')
                      : localize('/mois', '/month')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {paymentError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{paymentError}</div>
          )}

          {paymentLoading && (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              {localize('Préparation du paiement...', 'Preparing payment...')}
            </div>
          )}

          {!paymentLoading && paymentClientSecret && (
            <form className="space-y-4" onSubmit={handleConfirmPayment}>
              <div ref={paymentElementRef} className="rounded-md border border-slate-200 bg-white p-3" />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!stripeInstance || !stripeElements || confirmingPayment}
                >
                {confirmingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {localize('Confirmation...', 'Confirming...')}
                  </>
                ) : (
                  localize('Confirmer le paiement', 'Confirm payment')
                )}
              </Button>
            </form>
          )}

          {!paymentLoading && !paymentClientSecret && !paymentError && (
            <p className="text-sm text-slate-600">
              {localize('Initialisation du paiement en cours...', 'Initializing payment...')}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[400px] items-center justify-center text-sm text-muted-foreground">
          Chargement de votre abonnement...
        </div>
      }
    >
      <SubscriptionPageContent />
    </Suspense>
  );
}
