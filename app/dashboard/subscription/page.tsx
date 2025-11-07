'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Subscription } from '@/lib/supabase';
import { Check, Zap, Shield, Building2, Crown, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

const ENTERPRISE_PRICE =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE
    ? `${process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE}€`
    : '150€';

type PlanDefinition = {
  id: 'free' | 'basic' | 'pro' | 'enterprise';
  icon: typeof Zap;
  price: string;
  period?: { fr: string; en: string };
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  creditsLimit: number;
  creditsLabel: { fr: string; en: string };
  features: Array<{ fr: string; en: string }>;
  popular?: boolean;
};

type LocalizedPlan = PlanDefinition & {
  name: string;
  description: string;
  creditsLabel: string;
  period?: string;
  features: string[];
};

const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    name: { fr: 'Gratuit', en: 'Free' },
    price: '0€',
    period: { fr: '/mois', en: '/month' },
    icon: Zap,
    description: { fr: 'Parfait pour découvrir CyberScan', en: 'Perfect to discover CyberScan' },
    creditsLimit: 10,
    creditsLabel: { fr: '10', en: '10' },
    features: [
      { fr: '10 crédits par mois', en: '10 credits per month' },
      { fr: 'Scans légers', en: 'Light scans' },
      { fr: 'Rapports basiques', en: 'Basic reports' },
      { fr: 'Support par email', en: 'Email support' },
      { fr: '1 scan simultané', en: '1 concurrent scan' },
      { fr: 'Support via tickets communautaires', en: 'Community ticket support' },
    ],
  },
  {
    id: 'basic',
    name: { fr: 'Basic', en: 'Basic' },
    price: '29€',
    period: { fr: '/mois', en: '/month' },
    icon: Shield,
    description: { fr: 'Pour les petites entreprises', en: 'For small businesses' },
    creditsLimit: 50,
    creditsLabel: { fr: '50', en: '50' },
    features: [
      { fr: '50 crédits par mois', en: '50 credits per month' },
      { fr: 'Scans légers et complets', en: 'Light and full scans' },
      { fr: 'Rapports détaillés', en: 'Detailed reports' },
      { fr: 'Support prioritaire', en: 'Priority support' },
      { fr: 'Historique 6 mois', en: '6-month history' },
      { fr: '1 scan simultané', en: '1 concurrent scan' },
      { fr: 'Support via tickets standard', en: 'Standard ticket support' },
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro' },
    price: '99€',
    period: { fr: '/mois', en: '/month' },
    icon: Crown,
    description: { fr: 'Pour les professionnels exigeants', en: 'For demanding professionals' },
    creditsLimit: 200,
    creditsLabel: { fr: '200', en: '200' },
    features: [
      { fr: '200 crédits par mois', en: '200 credits per month' },
      { fr: 'Tous types de scans', en: 'All scan types' },
      { fr: 'Rapports avancés', en: 'Advanced reports' },
      { fr: 'Support 24/7', en: '24/7 support' },
      { fr: 'Détection CMS incluse', en: 'CMS detection included' },
      { fr: 'Jusqu’à 5 scans simultanés', en: 'Up to 5 concurrent scans' },
      { fr: 'Support avancé par tickets', en: 'Advanced ticket support' },
      { fr: 'Planification automatique (hebdo/mensuelle)', en: 'Automatic scheduling (weekly/monthly)' },
    ],
  },
  {
    id: 'enterprise',
    name: { fr: 'Enterprise', en: 'Enterprise' },
    price: ENTERPRISE_PRICE,
    period: { fr: '/mois', en: '/month' },
    icon: Building2,
    description: { fr: 'Solutions sur mesure', en: 'Tailor-made solutions' },
    creditsLimit: 999999,
    creditsLabel: { fr: 'Illimités', en: 'Unlimited' },
    features: [
      { fr: 'Crédits illimités', en: 'Unlimited credits' },
      { fr: 'Tous types de scans', en: 'All scan types' },
      { fr: 'Rapports sur mesure', en: 'Custom reports' },
      { fr: 'Support dédié', en: 'Dedicated support' },
      { fr: 'Jusqu’à 10 scans simultanés', en: 'Up to 10 concurrent scans' },
      { fr: 'Support premium par tickets illimités', en: 'Premium unlimited ticket support' },
      { fr: 'Planification personnalisée des scans', en: 'Custom scan scheduling' },
      { fr: 'Détection CMS incluse', en: 'CMS detection included' },
      { fr: 'Accès complet à l’analyseur avancé', en: 'Full access to the advanced analyzer' },
    ],
  },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledCheckoutRef = useRef(false);
  const planConfigs: LocalizedPlan[] = PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    name: localize(plan.name.fr, plan.name.en),
    description: localize(plan.description.fr, plan.description.en),
    creditsLabel: localize(plan.creditsLabel.fr, plan.creditsLabel.en),
    period: plan.period ? localize(plan.period.fr, plan.period.en) : undefined,
    features: plan.features.map((feature) => localize(feature.fr, feature.en)),
  }));
  const planNameMap = Object.fromEntries(planConfigs.map((plan) => [plan.id, plan.name]));

  useEffect(() => {
    if (user) {
      loadSubscription();
    }
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) setSubscription(data);
    } catch (error) {
      console.error('Error loading subscription:', error);
    } finally {
      setLoading(false);
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

  const handleStripeCheckout = async (plan: LocalizedPlan) => {
    if (!user) return;

    if (plan.id === 'free') {
      handleSubscribe(plan.id, plan.creditsLimit, { successMessage: localize('Abonnement activé.', 'Plan activated.') });
      return;
    }

    if (plan.id === 'enterprise') {
      handleSubscribe(plan.id, plan.creditsLimit, {
        successMessage: localize(
          'Plan Enterprise activé. Notre équipe vous contactera pour la configuration avancée.',
          'Enterprise plan activated. Our team will contact you for advanced setup.'
        ),
      });
      return;
    }

    setStatusMessage(null);
    setActionLoadingPlan(plan.id);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, userId: user.id, email: user.email }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || localize('Erreur lors de la création de la session Stripe.', 'Error creating the Stripe session.'));
      }

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      throw new Error(localize('URL de redirection Stripe manquante.', 'Missing Stripe redirect URL.'));
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      setStatusMessage({
        type: 'error',
        text: error?.message || localize('Impossible de démarrer le paiement Stripe.', 'Unable to start Stripe checkout.'),
      });
      setActionLoadingPlan(null);
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
        handleSubscribe(planConfig.id, planConfig.creditsLimit, {
          successMessage: localize('Paiement confirmé, votre abonnement est actif.', 'Payment confirmed, your subscription is active.'),
        });
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
          <Card className="relative mx-auto max-w-3xl overflow-hidden border-none bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl">
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
            <CardContent className="grid gap-6 md:grid-cols-3">
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
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 justify-items-center">
          {planConfigs
            .filter((plan) => plan.id !== 'enterprise')
            .map((plan) => {
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
                  <CardDescription className="text-center min-h-[48px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                      {plan.period && <span className="text-slate-600 ml-1">{plan.period}</span>}
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
                      if (isEnterprise) {
                        return handleSubscribe(plan.id, plan.creditsLimit, {
                          successMessage: localize(
                            'Plan Enterprise activé. Notre équipe vous contactera pour la configuration avancée.',
                            'Enterprise plan activated. Our team will contact you for advanced setup.'
                          ),
                        });
                      }
                      return plan.id === 'free'
                        ? handleSubscribe(plan.id, plan.creditsLimit, { successMessage: localize('Abonnement activé.', 'Plan activated.') })
                        : handleStripeCheckout(plan);
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
    </DashboardLayout>
  );
}
