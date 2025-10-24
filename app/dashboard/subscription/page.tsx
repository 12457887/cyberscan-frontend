'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Subscription } from '@/lib/supabase';
import { Check, Zap, Shield, Building2, Crown } from 'lucide-react';

const plans = [
  {
    id: 'free',
    name: 'Gratuit',
    price: '0€',
    period: '/mois',
    icon: Zap,
    description: 'Parfait pour découvrir CyberScan',
    credits: 10,
    features: [
      '10 crédits par mois',
      'Scans légers',
      'Rapports basiques',
      'Support par email',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '29€',
    period: '/mois',
    icon: Shield,
    description: 'Pour les petites entreprises',
    credits: 50,
    features: [
      '50 crédits par mois',
      'Scans légers et complets',
      'Rapports détaillés',
      'Support prioritaire',
      'Historique 6 mois',
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
    credits: 200,
    features: [
      '200 crédits par mois',
      'Tous types de scans',
      'Rapports avancés avec recommandations',
      'Support 24/7',
      'Historique illimité',
      'API access',
      'Alertes en temps réel',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sur devis',
    period: '',
    icon: Building2,
    description: 'Solutions sur mesure',
    credits: 999999,
    features: [
      'Crédits illimités',
      'Scans personnalisés',
      'Rapports sur mesure',
      'Support dédié',
      'Intégration personnalisée',
      'SLA garanti',
      'Formation incluse',
      'Audit de sécurité',
    ],
  },
];

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSubscribe = async (planType: string, creditsLimit: number) => {
    if (!user) return;

    try {
      if (subscription) {
        await supabase
          .from('subscriptions')
          .update({
            plan_type: planType,
            credits_limit: creditsLimit,
            status: 'active',
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('user_id', user.id);

        await supabase
          .from('credits')
          .update({
            total_credits: creditsLimit,
            remaining_credits: creditsLimit,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      await supabase.from('alerts').insert({
        user_id: user.id,
        title: 'Abonnement mis à jour',
        message: `Votre abonnement a été mis à jour vers le plan ${planType}.`,
        type: 'subscription',
        severity: 'info',
      });

      loadSubscription();
      alert('Abonnement mis à jour avec succès !');
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Erreur lors de la mise à jour de l\'abonnement');
    }
  };

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
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Abonnements</h1>
          <p className="text-slate-600 mt-2">Choisissez le plan qui correspond à vos besoins</p>
        </div>

        {subscription && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Votre abonnement actuel</CardTitle>
              <CardDescription>
                Plan: <span className="font-medium capitalize">{subscription.plan_type}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600">Statut</p>
                  <Badge className={subscription.status === 'active' ? 'bg-green-600' : ''}>
                    {subscription.status === 'active' ? 'Actif' : subscription.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Crédits mensuels</p>
                  <p className="font-medium text-lg">{subscription.credits_limit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = subscription?.plan_type === plan.id;

            return (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? 'border-blue-600 shadow-lg' : ''} ${
                  isCurrentPlan ? 'ring-2 ring-blue-600' : ''
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600">
                    Populaire
                  </Badge>
                )}
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-green-600">
                    Actuel
                  </Badge>
                )}
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <CardTitle className="text-center">{plan.name}</CardTitle>
                  <CardDescription className="text-center min-h-[40px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                      {plan.period && <span className="text-slate-600 ml-1">{plan.period}</span>}
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{plan.credits} crédits/mois</p>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    onClick={() => handleSubscribe(plan.id, plan.credits)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? 'Plan actuel' : 'Choisir ce plan'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="max-w-4xl mx-auto">
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
