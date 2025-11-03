'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
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

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    icon: Zap,
    description: 'Parfait pour découvrir CyberScan',
    creditsLimit: 10,
    creditsLabel: '10',
    features: [
      '10 crédits par mois',
      'Scans légers',
      'Rapports basiques',
      'Support par email',
      '1 scan simultané',
      'Support via tickets communautaires',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '29€',
    period: '/mois',
    icon: Shield,
    description: 'Pour les petites entreprises',
    creditsLimit: 50,
    creditsLabel: '50',
    features: [
      '50 crédits par mois',
      'Scans légers et complets',
      'Rapports détaillés',
      'Support prioritaire',
      'Historique 6 mois',
      '1 scan simultané',
      'Support via tickets standard',
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '99€',
    period: '/mois',
    icon: Crown,
    description: 'Pour les professionnels exigeants',
    creditsLimit: 200,
    creditsLabel: '200',
    features: [
      '200 crédits par mois',
      'Tous types de scans',
      'Rapports avancés',
      'Support 24/7',
      'Détection CMS incluse',
      'Jusqu’à 5 scans simultanés',
      'Support avancé par tickets',
      'Planification automatique (hebdo/mensuelle)',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: ENTERPRISE_PRICE,
    period: '/mois',
    icon: Building2,
    description: 'Solutions sur mesure',
    creditsLimit: 999999,
    creditsLabel: 'Illimités',
    features: [
      'Crédits illimités',
      'Tous types de scans',
      'Rapports sur mesure',
      'Support dédié',
      'Jusqu’à 10 scans simultanés',
      'Support premium par tickets illimités',
      'Planification personnalisée des scans',
      'Détection CMS incluse',
      'Accès complet à l’analyseur avancé',
    ],
  },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionLoadingPlan, setActionLoadingPlan] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledCheckoutRef = useRef(false);

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
        title: 'Abonnement mis à jour',
        message: `Votre abonnement a été mis à jour vers le plan ${planType}.`,
        type: 'subscription',
        severity: 'info',
      });

      loadSubscription();
      if (!options?.silent) {
        setStatusMessage({
          type: 'success',
          text: options?.successMessage || 'Abonnement mis à jour avec succès !',
        });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      setStatusMessage({
        type: 'error',
        text: 'Erreur lors de la mise à jour de l\'abonnement.',
      });
    }
    setActionLoadingPlan(null);
  };

  const handleStripeCheckout = async (plan: (typeof plans)[number]) => {
    if (!user) return;

    if (plan.id === 'free') {
      handleSubscribe(plan.id, plan.creditsLimit, { successMessage: 'Abonnement activé.' });
      return;
    }

    if (plan.id === 'enterprise') {
      handleSubscribe(plan.id, plan.creditsLimit, {
        successMessage: 'Plan Enterprise activé. Notre équipe vous contactera pour la configuration avancée.',
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
        throw new Error(body?.error || 'Erreur lors de la création de la session Stripe.');
      }

      const data = await response.json();
      if (data?.url) {
        window.location.href = data.url as string;
        return;
      }

      throw new Error('URL de redirection Stripe manquante.');
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      setStatusMessage({
        type: 'error',
        text: error?.message || 'Impossible de démarrer le paiement Stripe.',
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
      const planConfig = plans.find((p) => p.id === planParam);
      if (planConfig) {
        handledCheckoutRef.current = true;
        handleSubscribe(planConfig.id, planConfig.creditsLimit, {
          successMessage: 'Paiement confirmé, votre abonnement est actif.',
        });
      }
    }

    if (canceled === 'true' && !handledCheckoutRef.current) {
      handledCheckoutRef.current = true;
      setStatusMessage({ type: 'error', text: 'Paiement annulé.' });
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
          <p className="text-slate-600">Chargement...</p>
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
          <h1 className="text-4xl font-bold text-slate-900">Choisissez votre abonnement</h1>
          <p className="max-w-2xl mx-auto text-slate-600">
            Passez au plan qui correspond à vos besoins en sécurité. Crédit mensuel, support prioritaire et fonctionnalités avancées selon votre choix.
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
              Plan actuel
            </span>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold">
                Abonnement {subscription.plan_type.charAt(0).toUpperCase() + subscription.plan_type.slice(1)}
              </CardTitle>
              <CardDescription className="text-slate-200/80">
                Gérez votre plan directement depuis cette page. Vous pouvez évoluer vers un plan supérieur à tout moment.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300">Statut</p>
                <Badge className={`mt-2 border border-white/20 ${subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-100' : 'bg-white/10 text-white'}`}>
                  {subscription.status === 'active' ? 'Actif' : subscription.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300">Crédits mensuels</p>
                <p className="mt-2 text-2xl font-semibold text-white">{subscription.credits_limit}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300">Dernière mise à jour</p>
                <p className="mt-2 text-sm text-slate-200">
                  {subscription.updated_at ? new Date(subscription.updated_at).toLocaleDateString('fr-FR') : '—'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 justify-items-center">
          {plans
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
                    Populaire
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 transform bg-green-600 px-6 py-1 text-xs uppercase tracking-wide">
                    Actuel
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
                    <p className="text-sm text-slate-600 mt-1">{plan.creditsLabel} crédits/mois</p>
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
                          successMessage: 'Plan Enterprise activé. Notre équipe vous contactera pour la configuration avancée.',
                        });
                      }
                      return plan.id === 'free'
                        ? handleSubscribe(plan.id, plan.creditsLimit, { successMessage: 'Abonnement activé.' })
                        : handleStripeCheckout(plan);
                    }}
                    disabled={isCurrentPlan || actionLoadingPlan === plan.id}
                  >
                    {isCurrentPlan ? (
                      'Plan actuel'
                    ) : actionLoadingPlan === plan.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Traitement...
                      </>
                    ) : plan.id === 'free' ? (
                      'Choisir ce plan'
                    ) : isEnterprise ? (
                      'Souscrire'
                    ) : (
                      'Souscrire'
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mx-auto max-w-4xl">
          <CardHeader>
            <CardTitle>Questions fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Comment fonctionnent les crédits ?</h4>
              <p className="text-sm text-slate-600">
                Chaque scan consomme 1 crédit, qu'il soit léger ou complet. Les crédits sont renouvelés chaque mois.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Puis-je changer de plan à tout moment ?</h4>
              <p className="text-sm text-slate-600">
                Oui, vous pouvez upgrader ou downgrader votre plan à tout moment. Les changements prennent effet immédiatement.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-slate-900 mb-1">Les crédits non utilisés sont-ils reportés ?</h4>
              <p className="text-sm text-slate-600">
                Non, les crédits non utilisés ne sont pas reportés au mois suivant. Ils sont réinitialisés à chaque nouveau cycle.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
