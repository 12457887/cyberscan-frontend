import { Building2, Crown, Shield, Zap } from 'lucide-react';

export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise';

export type PlanDefinition = {
  id: PlanId;
  icon: typeof Zap;
  price: string;
  period?: { fr: string; en: string };
  name: { fr: string; en: string };
  description?: { fr: string; en: string };
  creditsLimit: number;
  creditsLabel: { fr: string; en: string };
  features: Array<{ fr: string; en: string }>;
  popular?: boolean;
};

const ENTERPRISE_PRICE =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE
    ? `${process.env.NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE}€`
    : '39€';

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    name: { fr: ' FREE ', en: ' FREE ' },
    price: '0€',
    period: { fr: '/mois', en: '/month' },
    icon: Zap,
    description: { fr: '', en: '' },
    creditsLimit: 3,
    creditsLabel: { fr: '3', en: '3' },
    features: [
      { fr: '3 crédits de scan', en: '3 scan credits' },
      { fr: '1 site', en: '1 site' },
      { fr: 'Dashboard basique', en: 'Basic dashboard' },
      { fr: 'Rapports simples', en: 'Simple reports' },
    ],
  },
  {
    id: 'basic',
    name: { fr: ' BASIC ', en: 'BASIC ' },
    price: '9€',
    period: { fr: '/mois', en: '/month' },
    icon: Shield,
    description: { fr: '', en: '' },
    creditsLimit: 20,
    creditsLabel: { fr: '20', en: '20' },
    features: [
      { fr: '20 crédits', en: '20 credits' },
      { fr: 'Scan automatique hebdomadaire', en: 'Weekly automatic scan' },
      { fr: 'Détection CMS par IA', en: 'AI CMS detection' },
      { fr: 'Rapports détaillés', en: 'Detailed reports' },
      { fr: 'Alertes email', en: 'Email alerts' },
      { fr: 'Support standard', en: 'Standard support' },
    ],
    popular: true,
  },
  {
    id: 'pro',
    name: { fr: ' PRO ', en: ' PRO ' },
    price: '19€',
    period: { fr: '/mois', en: '/month' },
    icon: Crown,
    description: { fr: '', en: '' },
    creditsLimit: 50,
    creditsLabel: { fr: '50', en: '50' },
    features: [
      { fr: '50 crédits', en: '50 credits' },
      { fr: 'Scan hebdomadaire automatique', en: 'Automatic weekly scan' },
      { fr: 'Analyse quotidienne', en: 'Daily analysis' },
      { fr: 'Détection CMS par IA', en: 'AI CMS detection' },
      { fr: 'Scan complet', en: 'Full scan' },
      { fr: "Jusqu'à 5 scans simultanés", en: 'Up to 5 concurrent scans' },
      { fr: 'Rapports avancés', en: 'Advanced reports' },
      { fr: 'Dashboard complet', en: 'Full dashboard' },
      { fr: 'Support prioritaire', en: 'Priority support' },
    ],
  },
  {
    id: 'enterprise',
    name: { fr: ' PREMIUM — Full Access', en: ' PREMIUM — Full Access' },
    price: ENTERPRISE_PRICE,
    period: { fr: '/mois', en: '/month' },
    icon: Building2,
    description: { fr: '', en: '' },
    creditsLimit: 200,
    creditsLabel: { fr: '200', en: '200' },
    features: [
      { fr: '200 crédits', en: '200 credits' },
      { fr: 'Scan hebdomadaire automatique', en: 'Automatic weekly scan' },
      { fr: 'Accès à toutes les fonctionnalités', en: 'Access to all features' },
      { fr: 'Détection CMS par IA', en: 'AI CMS detection' },
      { fr: 'Scan complet', en: 'Full scan' },
      { fr: "Jusqu'à 10 scans simultanés", en: 'Up to 10 concurrent scans' },
      { fr: 'Check domain ', en: 'Check domain' },
      { fr: 'Détection de fuites de données', en: 'Data breach detection' },
      { fr: 'Rapports complets', en: 'Full reports' },
      { fr: 'Support dédié', en: 'Dedicated support' },
    ],
  },
];

export const findPlanDefinition = (planId?: string | null) =>
  PLAN_DEFINITIONS.find((plan) => plan.id === planId);
