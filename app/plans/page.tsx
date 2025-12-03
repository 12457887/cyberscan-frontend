'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Check } from 'lucide-react';
import { PLAN_DEFINITIONS } from '@/lib/plans';

export default function PlansPage() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  const parsePriceValue = (price: string) => {
    const match = price.match(/[\d.,]+/);
    if (!match) return 0;
    return parseFloat(match[0].replace(',', '.'));
  };

  const plans = PLAN_DEFINITIONS.map((plan) => {
    const monthly = parsePriceValue(plan.price);
    const yearly = Math.round(monthly * 12);

    return {
      id: plan.id,
      name: localize(plan.name.fr, plan.name.en),
      tagline: plan.description ? localize(plan.description.fr, plan.description.en) : '',
      priceMonthly: `${monthly}€`,
      priceYearly: `${yearly}€`,
      perks: plan.features.map((feature) => localize(feature.fr, feature.en)),
      cta: localize('Choisir ce plan', 'Choose this plan'),
      href: '/register',
      iconBg:
        plan.id === 'basic'
          ? 'bg-blue-600'
          : plan.id === 'pro'
          ? 'bg-orange-600'
          : plan.id === 'enterprise'
          ? 'bg-slate-800'
          : 'bg-slate-700',
      icon: plan.icon,
      highlight: !!plan.popular,
    };
  });

  const whiteLabel = {
    title: localize('WHITE LABEL — Sur demande', 'WHITE LABEL — On request'),
    note: localize(
      '(Option supplémentaire non incluse dans les plans, activation via support)',
      '(Extra option not included in plans, activation via support)'
    ),
    items: [
      localize('Ajout du logo du client', 'Add your client logo'),
      localize('Dashboard personnalisé (couleurs & branding)', 'Custom dashboard (colors & branding)'),
      localize('Rapports PDF brandés', 'Branded PDF reports'),
      localize('Domaine personnalisé (ex : scan.votredomaine.com)', 'Custom domain (e.g., scan.yourdomain.com)'),
      localize('Solution idéale pour agences & MSSP', 'Ideal for agencies & MSSP'),
    ],
    cta: localize('Contacter le support', 'Contact support'),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="border-b border-slate-800 py-6 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-500" />
            <span className="text-xl font-bold">CyberScan</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
              <Link href="/#benefits">{localize('Bénéfices', 'Benefits')}</Link>
            </Button>
            <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
              <Link href="/login">{localize('Connexion', 'Sign in')}</Link>
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/register">{localize('Commencer', 'Get started')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-16">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <p className="uppercase text-xs tracking-[0.25em] text-blue-300">
            {localize('Plans & abonnements', 'Plans & subscriptions')}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold">
            {localize('Une offre claire, immédiate', 'Transparent plans, ready to start')}
          </h1>
          <p className="text-slate-300 max-w-3xl mx-auto">
            {localize(
              'Choisissez le niveau de protection adapté à votre rythme : de la découverte à la couverture complète.',
              'Pick the protection level that matches your pace—from discovery to full coverage.'
            )}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
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

        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-4 mt-12">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`h-full ${plan.highlight ? 'border-blue-600 bg-slate-800/70 shadow-xl' : 'bg-slate-800/50 border-slate-700'}`}
            >
              <CardHeader>
                <div className="flex justify-center mb-4">
                  <div className={`w-12 h-12 ${plan.iconBg} rounded-xl flex items-center justify-center`}>
                    <plan.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                {plan.highlight && (
                  <Badge className="mx-auto mb-2 bg-blue-600">
                    {localize('Populaire', 'Popular')}
                  </Badge>
                )}
                <CardTitle className="text-center text-white">{plan.name}</CardTitle>
                {plan.tagline && (
                  <CardDescription className="text-center text-slate-400 min-h-[20px]">
                    {plan.tagline}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">
                      {billingInterval === 'annual' ? plan.priceYearly : plan.priceMonthly}
                    </span>
                    <span className="text-slate-400">
                      {billingInterval === 'annual' ? localize('/an', '/year') : localize('/mois', '/month')}
                    </span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{perk}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="max-w-6xl mx-auto mt-10">
          <Card className="bg-slate-800/60 border-blue-600">
            <CardHeader>
              <CardTitle className="text-white">{whiteLabel.title}</CardTitle>
              <CardDescription className="text-slate-300">{whiteLabel.note}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-slate-200">
                {whiteLabel.items.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-green-400 mt-0.5" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="mailto:support@cyberscan.com">{whiteLabel.cta}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
