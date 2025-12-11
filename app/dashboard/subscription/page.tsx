'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Subscription, Invoice } from '@/lib/supabase';
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

export default function SubscriptionPage() {
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

      const { data, error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          expires_at: effectiveExpiry.toISOString(),
          updated_at: nowIso,
        })
        .eq('user_id', user.id)
        .select('*')
        .maybeSingle();

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

      if (data) {
        setSubscription(data);
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
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  const formattedExpiryLabel = nextExpiryDate
    ? formatDate(nextExpiryDate.toISOString())
    : localize('Non défini', 'Not set');

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

    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan_type: 'free',
        credits_limit: FREE_PLAN_CREDITS,
        status: 'active',
        started_at: nowIso,
        expires_at: null,
        updated_at: nowIso,
      })
      .eq('user_id', user.id)
      .select('*')
      .maybeSingle();

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

    return data ?? record;
  };

  const loadSubscription = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const normalized = await finalizeCancellationIfNeeded(data);
        setSubscription(normalized ?? data);
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
      data: existingCredits,
      error: fetchCreditsError,
    } = await supabase
      .from('credits')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchCreditsError) throw fetchCreditsError;

    const creditsPayload = {
      total_credits: creditsLimit,
      used_credits: 0,
      last_reset_at: nowIso,
      updated_at: nowIso,
    };

    if (existingCredits) {
      const { error: creditsError } = await supabase
        .from('credits')
        .update(creditsPayload)
        .eq('user_id', user.id);

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
        data: existingSubscription,
        error: fetchSubscriptionError,
      } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchSubscriptionError) throw fetchSubscriptionError;

      if (existingSubscription) {
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
          .eq('user_id', user.id);

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

  const loadInvoices = async () => {
    if (!user) return;
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setInvoices(data ?? []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setInvoicesError(
        localize("Impossible de charger l'historique des paiements.", 'Unable to load payment history.')
      );
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleRefundRequest = async () => {
    if (!subscription) return;
    setStatusMessage(null);
    setActionLoadingPlan('refund');
    try {
      const latestInvoice = invoices?.[0];
      const invoiceId = latestInvoice?.id ?? null;
      const paymentIntentId = latestInvoice?.stripe_payment_intent_id ?? null;

      if (!latestInvoice || !paymentIntentId) {
        throw new Error(
          localize(
            'Aucune facture éligible au remboursement ou paiement incomplet.',
            'No eligible invoice or missing payment information.'
          )
        );
      }
      const response = await fetch('/service/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-refund',
          userId: subscription.user_id,
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
                    {subscription.status === 'active' ? localize('Actif', 'Active') : subscription.status}
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
                    {subscription.updated_at ? new Date(subscription.updated_at).toLocaleDateString(locale) : '—'}
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
                    disabled={!subscription || actionLoadingPlan === 'refund'}
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
            {invoicesError && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {invoicesError}
              </div>
            )}
            {invoicesLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                {localize('Chargement des transactions...', 'Loading transactions...')}
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-slate-600">
                {localize('Aucune transaction trouvée pour le moment.', 'No payment history yet.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500">
                      <th className="px-2 py-2 font-medium">{localize('Date', 'Date')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Plan', 'Plan')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Montant', 'Amount')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Statut', 'Status')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Carte', 'Card')}</th>
                      <th className="px-2 py-2 font-medium">{localize('Facture', 'Invoice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const readablePlan =
                        planNameMap[invoice.plan_type as keyof typeof planNameMap] ||
                        invoice.plan_type.charAt(0).toUpperCase() + invoice.plan_type.slice(1);
                      const statusLabel = invoice.payment_status || localize('Inconnu', 'Unknown');
                      const cardLabel = invoice.card_brand && invoice.card_last4
                        ? `${invoice.card_brand.toUpperCase()} •••• ${invoice.card_last4}`
                        : localize('Non disponible', 'Not available');
                      const invoiceLink =
                        invoice.hosted_invoice_url ||
                        invoice.invoice_pdf_url ||
                        null;
                      return (
                        <tr key={invoice.id} className="border-t border-slate-100">
                          <td className="px-2 py-3 text-slate-700">{formatDate(invoice.created_at)}</td>
                          <td className="px-2 py-3 text-slate-700">{readablePlan}</td>
                          <td className="px-2 py-3 font-medium text-slate-900">
                            {formatAmount(invoice.amount_total_cents, invoice.currency)}
                          </td>
                          <td className="px-2 py-3 text-slate-700">{statusLabel}</td>
                          <td className="px-2 py-3 text-slate-700">{cardLabel}</td>
                          <td className="px-2 py-3 text-slate-700">
                            {invoiceLink ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={invoiceLink} target="_blank" rel="noopener noreferrer">
                                  {localize('Télécharger', 'Download')}
                                </a>
                              </Button>
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
                  "Chaque scan consomme 1 crédit, qu'il soit léger ou complet. Les crédits sont renouvelés chaque mois.",
                  'Each scan costs 1 credit, whether light or full. Credits renew every month.'
                )}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">
                {localize('Puis-je changer de plan à tout moment ?', 'Can I change plans at any time?')}
              </h4>
              <p className="text-sm text-slate-600">
                {localize(
                  'Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements prennent effet immédiatement.',
                  'Yes, you can upgrade or downgrade whenever you want. Changes take effect immediately.'
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
