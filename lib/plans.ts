import { Building2, Crown, Shield, Zap } from 'lucide-react';

export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise';

export type PlanDefinition = {
  id: PlanId;
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

const ENTERPRISE_PRICE =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE
    ? `${process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE}€`
    : '150€';

export const PLAN_DEFINITIONS: PlanDefinition[] = [
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
      { fr: 'Jusqu’à 5 scans simultanés', en: 'Up to 5 concurrent scans' },
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
    description: {
      fr: 'Pour les professionnels exigeants, scannez jusqu’à 10 sites en parallèle',
      en: 'For demanding professionals, scan up to 10 sites in parallel',
    },
    creditsLimit: 200,
    creditsLabel: { fr: '200', en: '200' },
    features: [
      { fr: '200 crédits par mois', en: '200 credits per month' },
      { fr: 'Tous types de scans', en: 'All scan types' },
      { fr: 'Rapports avancés', en: 'Advanced reports' },
      { fr: 'Support 24/7', en: '24/7 support' },
      { fr: 'Détection CMS incluse', en: 'CMS detection included' },
      { fr: 'Jusqu’à 10 scans simultanés', en: 'Up to 10 concurrent scans' },
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

export const findPlanDefinition = (planId?: string | null) =>
  PLAN_DEFINITIONS.find((plan) => plan.id === planId);
