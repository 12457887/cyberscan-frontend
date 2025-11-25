'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Shield,
  Zap,
  Lock,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Crown,
  Gem,
  Search,
  RefreshCw,
  LayoutDashboard,
  BellRing,
  FileText,
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';
import { QuickScanCard } from '@/components/QuickScanCard';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';

const showPricing = false;

function HomeContent({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  const targetStats = { totalScans: 12840, totalSites: 6420 };
  const [publicStats, setPublicStats] = useState({ totalScans: 0, totalSites: 0 });
  const [statsLoading] = useState(false);

  // Compact countdown
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  // Countdown hook
  useEffect(() => {
    const target = new Date(`${new Date().getFullYear()}-11-28T23:59:59`);
    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, target.getTime() - now.getTime());

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Statistics animation
  useEffect(() => {
    const stepDuration = 40;
    const interval = setInterval(() => {
      setPublicStats((prev) => {
        const nextScans = Math.min(prev.totalScans + 400, targetStats.totalScans);
        const nextSites = Math.min(prev.totalSites + 400, targetStats.totalSites);
        if (nextScans === targetStats.totalScans && nextSites === targetStats.totalSites) return prev;
        return { totalScans: nextScans, totalSites: nextSites };
      });
    }, stepDuration);

    return () => clearInterval(interval);
  }, []);

  // FEATURE GROUPS
  const overviewFeatures = useMemo(
    () => [
      {
        title: localize('Technologie de scan approfondie', 'Deep scan technology'),
        description: localize(
          'Détection IA et moteurs propriétaires.',
          'AI-driven detection with proprietary engines.'
        ),
        icon: Gem,
      },
      {
        title: localize('Scans instantanés', 'Instant scans'),
        description: localize(
          'Diagnostic immédiat en un clic.',
          'Instant diagnostics with one click.'
        ),
        icon: Search,
      },
      {
        title: localize('Automatisation totale', 'Automatic scans'),
        description: localize(
          'Programmation quotidienne ou hebdo.',
          'Automated daily/weekly scheduling.'
        ),
        icon: RefreshCw,
      },
      {
        title: localize('Pilotage unifié', 'Unified dashboard'),
        description: localize(
          'Tous vos sites au même endroit.',
          'Centralize all sites in one place.'
        ),
        icon: LayoutDashboard,
      },
      {
        title: localize('Alertes intelligentes', 'Smart notifications'),
        description: localize(
          'Alertes dès qu’une faille critique apparaît.',
          'Alerts instantly when issues appear.'
        ),
        icon: BellRing,
      },
      {
        title: localize('Rapports avancés', 'Advanced reports'),
        description: localize(
          'Rapports avec priorisation automatique.',
          'Reports with automated prioritization.'
        ),
        icon: FileText,
      },
    ],
    [localize]
  );

  const vulnerabilityStats = [
    { label: localize('Hébergements vulnérables', 'Hosting vulnerabilities'), value: '41%', color: 'bg-rose-400', hex: '#f54f5a' },
    { label: localize('Thèmes vulnérables', 'Vulnerable themes'), value: '29%', color: 'bg-yellow-400', hex: '#f8e05c' },
    { label: localize('Plugins vulnérables', 'Vulnerable plugins'), value: '22%', color: 'bg-orange-300', hex: '#f9b25f' },
    { label: localize('Mots de passe faibles', 'Weak passwords'), value: '8%', color: 'bg-orange-500', hex: '#f28b20' },
  ];

  const benefitsBullets = [
    localize("Vue d'ensemble complète de vos CMS.", 'Complete overview of your CMS.'),
    localize('Alertes push/email dès qu’un site est vulnérable.', 'Push/email alerts when vulnerabilities appear.'),
    localize('Scans automatisés (jour/semaine/mois).', 'Automated scans (daily/weekly/monthly).'),
    localize('Technologie de scan avancée.', 'Advanced deep-scan technology.'),
    localize('Accès immédiat à votre historique.', 'Instant access to your scan history.'),
  ];

  // Dashboard detailed feature list
const dashboardFeatures = useMemo(
  () => [
    {
      id: 'advanced-scan',
      icon: Shield,
      label: localize('Technologie de scan avancée', 'Advanced Scan Technology'),
      title: localize('Technologie de scan avancée', 'Advanced Scan Technology'),
      description: localize(
        "Analyse avancée alliant IA, signatures CVE, heuristiques et scanning dynamique. CyberScan inspecte fichiers, plugins, thèmes, API, dépendances et configurations pour détecter failles critiques, vecteurs d’attaque et mauvaises pratiques. Cartographie complète des risques avec priorisation automatique.",
        "Advanced analysis combining AI, CVE signatures, heuristics and dynamic probing. CyberScan inspects files, plugins, themes, APIs, dependencies and configurations to detect critical flaws, attack vectors, and weak security practices. Produces a complete risk map with automated prioritization."
      ),
      image: '/advanced-scan.png',
      imageWidth: 250,
      imageHeight: 150,
      imageMaxWidth: 260,
    },

    {
      id: 'handy-dashboard',
      icon: LayoutDashboard,
      label: localize('Tableau de bord intuitif', 'Handy Dashboard'),
      title: localize('Tableau de bord intuitif', 'Handy Dashboard'),
      description: localize(
        "Interface unifiée regroupant sites, scans, historiques, alertes, crédits, incidents, paiements et renouvellements. Filtres avancés, graphiques de risques, timeline d’activités, gestion multi-sites et résumé en temps réel. Le cockpit idéal pour superviser toute votre cybersécurité.",
        "Unified interface combining sites, scans, history, alerts, credits, incidents, payments and renewals. Advanced filters, risk charts, activity timelines, multi-site management and real-time summaries. The perfect cockpit to supervise your entire security posture."
      ),
      image: '/dashboard.png',
      imageWidth: 400,
      imageHeight: 240,
      imageMaxWidth: 420,
    },

    {
      id: 'advanced-reporting',
      icon: FileText,
      label: localize('Rapports avancés', 'Advanced Reporting'),
      title: localize('Rapports avancés', 'Advanced Reporting'),
      description: localize(
        "Exports en PDF, JSON et XLSX. PDF professionnel avec preuves, CVE, impacts, priorités et recommandations. JSON pour intégrations DevSecOps. XLSX pour analyses tableur. Génération automatique de rapports hebdomadaires et mensuels pour un suivi continu.",
        "Exports in PDF, JSON and XLSX. Professional PDF with evidence, CVEs, impact, priorities and recommendations. JSON for DevSecOps pipelines. XLSX for spreadsheet analysis. Automatic weekly and monthly reporting included."
      ),
      image: '/rapport.png',
      imageWidth: 250,
      imageHeight: 250,
      imageMaxWidth: 300,
    },

    {
      id: 'push-notifications',
      icon: BellRing,
      label: localize('Notifications intelligentes', 'Smart Notifications'),
      title: localize('Notifications intelligentes', 'Smart Notifications'),
      description: localize(
        "Alertes en temps réel via e-mail, webhook ou notifications internes. Avertissements pour failles critiques, lancement/fin de scans, crédits restants, renouvellement d’abonnement et événements Stripe (paiement réussi, échec, remboursement).",
        "Real-time alerts via email, webhook or in-app messages. Alerts for critical issues, scan start/end, low credits, upcoming renewals and Stripe events (payment success, failure, refund)."
      ),
      image: '/notification.png',
      imageWidth: 320,
      imageHeight: 200,
      imageMaxWidth: 250,
    },

    {
      id: 'detection-cms',
      icon: CheckCircle,
      label: localize("Détection CMS par IA", "AI-Powered CMS Detection"),
      title: localize("Détection intelligente du CMS", "Smart CMS Detection"),
      description: localize(
        "Modèle IA détectant automatiquement WordPress, PrestaShop, Drupal, Joomla, Magento, Laravel… Les règles de scan s’ajustent selon le CMS pour révéler les vulnérabilités spécifiques à chaque technologie.",
        "AI model automatically detecting WordPress, PrestaShop, Drupal, Joomla, Magento, Laravel… Scanning rules adapt instantly based on the CMS to uncover technology-specific vulnerabilities."
      ),
      image: '/detection.png',
      imageWidth: 360,
      imageHeight: 210,
      imageMaxWidth: 550,
    },

    // ----------------------------------------------------------
    //  NEW BLOCK : Automated Billing & Subscription Manager
    // ----------------------------------------------------------
    {
      id: 'billing-manager',
      icon: Crown,
      label: localize("Facturation & Abonnements", "Billing & Subscription Manager"),
      title: localize("Automated Billing & Subscription Manager", "Automated Billing & Subscription Manager"),
      description: localize(
        "Gestion automatisée de la facturation via Stripe : abonnements, essais gratuits, renouvellements, paiements récurrents, coupons, remises Black Friday, export des factures et reçus. Webhooks avancés gérant paiements réussis/échoués, remboursements, mises à jour de plan et changements de période. Support multi-devises, TVA internationale et paiements 3D Secure. Le système suit même les crédits, l’usage et envoie des notifications lors des renouvellements ou incidents de paiement.",
        "Automated billing powered by Stripe: subscriptions, free trials, renewals, recurring payments, coupons, Black Friday discounts, invoice exports and receipts. Advanced webhooks handle successful/failed payments, refunds, plan updates and trial transitions. Supports multi-currency, international VAT and 3D Secure payments. The engine tracks credits, usage and sends notifications for renewals or payment issues."
      ),
      image: '/billing.png',
      imageWidth: 340,
      imageHeight: 230,
      imageMaxWidth: 450,
    },
  ],
  [localize]
);

  const [activeDashboardFeatureId, setActiveDashboardFeatureId] = useState('advanced-scan');

  const activeDashboardFeature =
    dashboardFeatures.find((f) => f.id === activeDashboardFeatureId) ?? dashboardFeatures[0];

  const donutGradient = useMemo(() => {
    let acc = 0;
    return vulnerabilityStats
      .map((stat) => {
        const start = acc;
        acc += parseInt(stat.value, 10);
        return `${stat.hex} ${start}% ${acc}%`;
      })
      .join(', ');
  }, [localize]);

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setContactFeedback(null);

  const trimmedEmail = contactForm.email.trim();
  const trimmedMessage = contactForm.message.trim();
  const trimmedName = contactForm.name.trim();

  if (!trimmedEmail || !trimmedMessage) {
    setContactFeedback({
      type: 'error',
      message: localize('Merci de fournir un email et un message.', 'Please provide an email and a message.'),
    });
    return;
  }

  // 🔐 reCAPTCHA v3
  if (!executeRecaptcha) {
    setContactFeedback({
      type: 'error',
      message: localize("Erreur reCAPTCHA : non initialisé.", "reCAPTCHA error: not initialized."),
    });
    return;
  }

  const token = await executeRecaptcha("contact_form");

  try {
    setContactLoading(true);

    const response = await fetch('/service/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
        recaptchaToken: token, // ✔️ envoi correct du token
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || localize("Impossible d'envoyer le message.", "Unable to send the message."));
    }

    setContactFeedback({
      type: 'success',
      message: localize('Message envoyé avec succès.', 'Message sent successfully.'),
    });

    setContactForm({ name: '', email: '', message: '' });

  } catch (error: any) {
    setContactFeedback({
      type: 'error',
      message: error?.message || localize('Une erreur est survenue.', 'An error occurred.'),
    });
  } finally {
    setContactLoading(false);
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-sm">
      {/* NAV */}
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm py-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-2">
              <Logo width={60} height={60} className="!justify-start" />
              <span className="text-lg font-semibold text-white">CyberScan</span>
            </div>

            <div className="flex gap-2 items-center text-xs">
              <Button variant="ghost" className="text-white hover:text-blue-400 px-2" asChild>
                <Link href="/#hero">{localize('Home', 'Home')}</Link>
              </Button>
              <Button variant="ghost" className="text-white hover:text-blue-400 px-2" asChild>
                <Link href="#features">{localize('Fonctionnalités', 'Features')}</Link>
              </Button>
              <Button variant="ghost" className="text-white hover:text-blue-400 px-2" asChild>
                <Link href="#specification">{localize('Spécifications', 'Specifications')}</Link>
              </Button>
              <Button variant="ghost" className="text-white hover:text-blue-400 px-2" asChild>
                <Link href="#benefits">{localize('Bénéfices', 'Benefits')}</Link>
              </Button>

              <Button variant="ghost" className="text-white hover:text-blue-400 px-2" asChild>
                <Link href="/login">{localize('Connexion', 'Sign in')}</Link>
              </Button>

              <Button className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs" asChild>
                <Link href="/register">{localize("S'inscrire", 'Sign up')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* BLACK FRIDAY */}
      <section className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 text-white px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <p className="uppercase text-[10px] tracking-[0.25em] text-white/70">Black Friday</p>

              <h2 className="text-2xl font-bold mt-1">
                {localize('Offre limitée : -40% sur les plans Pro & Enterprise', 'Limited offer: 50% off plans')}
              </h2>

              <p className="mt-2 text-white/80 text-xs">
                {localize(
                  'Crédits bonus et onboarding prioritaire.',
                  'Bonus credits & priority onboarding.'
                )}
              </p>
            </div>

            <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90 px-4 py-2 text-xs" asChild>
              <Link href="/plans">
                {localize('Profiter de la promotion', 'Claim the deal')}
              </Link>
            </Button>
          </div>

          <div className="bg-white/10 border border-white/20 rounded-xl p-4 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3 text-center text-sm">
              {[
                { label: localize('Jours', 'Days'), value: timeLeft.days },
                { label: localize('Heures', 'Hours'), value: timeLeft.hours },
                { label: localize('Minutes', 'Minutes'), value: timeLeft.minutes },
                { label: localize('Secondes', 'Seconds'), value: timeLeft.seconds },
              ].map((item) => (
                <div key={item.label} className="bg-slate-900/40 rounded-lg p-3">
                  <div className="text-2xl font-bold">{String(item.value).padStart(2, '0')}</div>
                  <div className="text-[10px] uppercase tracking-wide text-white/70">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="h-1 rounded-full bg-slate-900/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-400 to-blue-400"
                style={{ width: `${Math.min(100, (timeLeft.seconds / 60) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* HERO */}
      <main>
        <section id="hero" className="py-16 px-4">
          <div className="max-w-7xl mx-auto text-center">

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              {localize(
                'Votre site est-il protégé contre les cybermenaces ?',
                'Is your website protected against cyber threats?'
              )}
            </h1>

            <p className="text-base text-slate-300 max-w-2xl mx-auto mb-6">
              {localize(
                'Scannez votre site et obtenez gratuitement une analyse.',
                'Scan your website and get a free instant analysis.'
              )}
            </p>

            <div className="flex gap-3 justify-center mb-6">
              <Button
                size="sm"
                className="bg-blue-600 text-white opacity-60 cursor-not-allowed px-4"
                disabled
              >
                {localize('Commencer gratuitement', 'Start for free')}
              </Button>

              <Button
                size="sm"
                className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 px-4"
                asChild
              >
                <Link href="/login">{localize('Voir la démo', 'See the demo')}</Link>
              </Button>
            </div>

            <div className="max-w-xl mx-auto">
              <QuickScanCard />
            </div>
          </div>
        </section>
        {/* FEATURES */}
        <section id="features" className="py-14 px-4 bg-white text-slate-900 text-sm">
          <div className="max-w-6xl mx-auto text-center space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              {localize('Le scanner le plus complet', 'The most comprehensive scanner')}
            </p>

            <h2 className="text-2xl font-bold">
              {localize('Protégez vos CMS critiques facilement.', 'Protect your critical CMS with ease.')}
            </h2>

            <p className="text-slate-600 max-w-2xl mx-auto text-sm">
              {localize(
                "Une plateforme pensée pour automatiser l'analyse, prioriser les risques et garder le contrôle.",
                'A platform built to automate analysis, prioritize risks, and stay in control.'
              )}
            </p>
          </div>

          <div className="max-w-6xl mx-auto mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {overviewFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <Card key={feature.title} className="border-slate-200 shadow-sm h-full">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <span className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </span>

                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{feature.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{feature.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* SPECIFICATION — CMS VULNERABILITIES */}
        <section id="specification" className="py-14 px-4 bg-slate-50 text-slate-900 text-sm">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-2 mb-6">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {localize('Pourquoi sécuriser vos CMS ?', 'Why you should secure your CMS')}
              </p>

              <h2 className="text-2xl font-bold">
                {localize(
                  'Les CMS sont les cibles les plus attaquées.',
                  'CMS platforms are the most attacked targets.'
                )}
              </h2>

              <p className="text-slate-500 text-xs max-w-xl mx-auto leading-relaxed">
                {localize(
                  'Chaque jour, plus de 170 000 installations critiques sont vulnérables faute de mises à jour.',
                  'Every day, over 170,000 CMS installations are exposed due to missing updates.'
                )}
              </p>

              <div className="w-12 h-[2px] bg-slate-200 mx-auto"></div>
            </div>

            <div className="mt-8 flex flex-col lg:flex-row items-center gap-8">
              {/* TEXT + PERCENTAGES */}
              <div className="flex-1 space-y-4 text-center lg:text-left">
                <p className="text-slate-600 text-sm leading-relaxed">
                  {localize(
                    'Des millions de sites utilisent un CMS. Une seule faille peut provoquer une perte de données ou permettre une prise de contrôle. Les robots scannent le web en continu — les sites non protégés sont piratés en quelques secondes.',
                    'Millions of websites rely on CMS platforms. One flaw can cause data loss or full compromise. Bots scan the web 24/7 — unprotected sites are hacked in seconds.'
                  )}
                </p>

                <div className="space-y-2">
                  {vulnerabilityStats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-900 ${stat.color}`}
                      >
                        {stat.value}
                      </span>

                      <span className="text-xs font-medium">{stat.label}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-slate-500">
                  Source : Sucuri / SiteLock 2023-2024.
                </p>
              </div>

              {/* DONUT CHART */}
              <div className="flex-1 flex flex-col items-center gap-3">
                <div
                  className="relative w-48 h-48 rounded-full flex items-center justify-center shadow-lg"
                  style={{ backgroundImage: `conic-gradient(${donutGradient})` }}
                >
                  <div className="w-24 h-24 bg-white rounded-full shadow-inner"></div>
                </div>

                <p className="text-slate-600 text-xs text-center max-w-xs">
                  {localize(
                    'Graphique des pourcentages de vulnérabilités observées sur les CMS analysés.',
                    'Percentage distribution of vulnerabilities detected across analyzed CMS.'
                  )}
                </p>
              </div>
            </div>
          </div>
          {/* DASHBOARD FEATURES */}
          <div className="max-w-6xl mx-auto mt-14">
            <div className="text-center space-y-2 mb-8">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {localize('Tableau de bord', 'Dashboard')}
              </p>

              <h3 className="text-2xl font-bold text-slate-900">
                {localize(
                  'Liste complète des fonctionnalités.',
                  'Complete list of dashboard features.'
                )}
              </h3>

              <div className="w-12 h-[2px] bg-slate-200 mx-auto"></div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 grid gap-6 lg:grid-cols-[280px,1fr] text-sm">
              {/* LEFT LIST */}
              <div className="space-y-1.5">
                {dashboardFeatures.map((feature) => {
                  const Icon = feature.icon;
                  const isActive = activeDashboardFeature?.id === feature.id;

                  return (
                    <button
                      key={feature.id}
                      onClick={() => setActiveDashboardFeatureId(feature.id)}
                      className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center ${
                            isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="font-medium text-xs">{feature.label}</span>
                      </span>

                      <span className="text-[11px] opacity-70">
                        {isActive ? '›' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* RIGHT PANEL */}
              <div className="flex flex-col gap-3">
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    {localize('Tableau de bord', 'Dashboard')}
                  </p>

                  <h3 className="text-xl font-semibold text-slate-900">
                    {activeDashboardFeature?.title}
                  </h3>
                </div>

                <div className="flex flex-col lg:flex-row items-start gap-5">
                  <p className="text-slate-600 flex-1 text-xs leading-relaxed">
                    {activeDashboardFeature?.description}
                  </p>

                  <div
                    className="flex-1 w-full flex justify-center lg:justify-end"
                    style={{ maxWidth: `${activeDashboardFeature?.imageMaxWidth ?? 420}px` }}
                  >
                    {activeDashboardFeature?.image && (
                      <Image
                        src={activeDashboardFeature.image}
                        alt={
                          activeDashboardFeature.title?.toString() ??
                          'Dashboard illustration'
                        }
                        width={activeDashboardFeature.imageWidth ?? 420}
                        height={activeDashboardFeature.imageHeight ?? 260}
                        className="w-full object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* BENEFITS */}
        <section id="benefits" className="py-14 px-4 bg-white text-slate-900 scroll-mt-20 text-sm">
          <div className="max-w-6xl mx-auto text-center space-y-3 mb-10">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              {localize('Bénéfices d’un compte', 'Account benefits')}
            </p>

            <h2 className="text-2xl font-bold">
              {localize(
                'Créez un compte et débloquez toutes les fonctionnalités.',
                'Create an account and unlock all features.'
              )}
            </h2>

            <div className="w-12 h-[2px] bg-slate-200 mx-auto"></div>

            <p className="text-slate-600 max-w-2xl mx-auto text-xs leading-relaxed">
              {localize(
                'Optimisez vos workflows, restez synchronisés et recevez des alertes dès qu’un incident est détecté.',
                'Optimize workflows, stay synchronized, and receive alerts as soon as an issue is detected.'
              )}
            </p>
          </div>

          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-8">
            {/* BENEFIT LIST */}
            <div className="flex-1 w-full">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 text-left">
                <ul className="space-y-3 text-slate-700">
                  {benefitsBullets.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <span className="text-xs">{text}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full lg:w-auto text-xs px-4 py-2"
                  asChild
                >
                  <Link href="/register">
                    {localize('Créer un compte', 'Create an account')}
                  </Link>
                </Button>
              </div>
            </div>

            {/* IMAGE */}
            <div className="flex-1 w-full flex justify-center">
              <div className="rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-md">
                <Image
                  src="/dashboard.png"
                  alt="Dashboard preview"
                  width={900}
                  height={520}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>
        {/* READY TO SCAN */}
        <section className="py-16 px-4 bg-white text-slate-900 text-center text-sm">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-3">
              {localize('Prêt à analyser vos vulnérabilités ?', 'Ready to scan for vulnerabilities?')}
            </h2>

            <p className="text-slate-600 text-xs mb-6">
              {localize(
                "Rejoignez des milliers d'entreprises qui font confiance à CyberScan.",
                'Join thousands of companies that trust CyberScan.'
              )}
            </p>

            {/* CTA désactivé pour la démo – conservé pour future activation */}
            {/* 
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2" asChild>
              <Link href="/register">
                {localize("Démarrer maintenant", "Start now")}
              </Link>
            </Button>
            */}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-700 bg-slate-900/70 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">

          <div className="grid gap-6 md:grid-cols-3">
            {/* BRAND */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-md">
              <Logo width={80} height={80} className="mb-2 !justify-start" />

              <p className="mt-3 text-xs text-slate-300">
                {/* éventuellement une phrase plus tard */}
              </p>

              <div className="mt-4 space-y-1 text-xs">
                <p className="font-semibold text-white">Securas Technologies</p>
                <p>contact@securas.fr</p>
                <p>{localize('Assistance 24/7', '24/7 assistance')}</p>
              </div>
            </div>

            {/* LIVE STATS */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-md">
              <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                {localize('Statistiques en direct', 'Live Stats')}
              </p>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-4">
                  <p className="text-[10px] text-slate-400">{localize('Scans totaux', 'Total scans')}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {publicStats.totalScans.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-4">
                  <p className="text-[10px] text-slate-400">{localize('Sites analysés', 'Websites scanned')}</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {publicStats.totalSites.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* LINKS */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-md">
             <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-wider">
                {localize('Liens utiles', 'Useful links')}
              </p>

              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <Link href="/conditions-generales" className="hover:text-white">
                  {localize("Conditions d'utilisation", 'Terms of Use')}
                </Link>

                <Link href="/login" className="hover:text-white">
                  {localize('Accéder au tableau de bord', 'Dashboard access')}
                </Link>

                <Link href="/detection" className="hover:text-white">
                  {localize('Zone de détection', 'Detection area')}
                </Link>
              </div>
            </div>
          </div>

          {/* CONTACT & LEGAL */}
          <div className="border-t border-slate-800 pt-6 space-y-6 text-[11px] text-slate-500">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link href="/conditions-generales" className="hover:text-white">
                  {localize("Conditions d'utilisation", 'Terms of Use')}
                </Link>
                <span>|</span>
                <Link href="/politique-confidentialite" className="hover:text-white">
                  {localize('Politique de confidentialité', 'Privacy Policy')}
                </Link>
                <span>|</span>
                <button
                  type="button"
                  onClick={() => setContactOpen((prev) => !prev)}
                  className="hover:text-white underline underline-offset-2 decoration-dotted"
                >
                  {localize('Contact', 'Contact')}
                </button>
              </div>
              {contactOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                  <div className="absolute inset-0" onClick={() => setContactOpen(false)}></div>
                  <form
                    onSubmit={handleContactSubmit}
                    className="relative z-10 w-full max-w-md rounded-2xl bg-white text-slate-900 shadow-2xl p-6 space-y-4"
                  >
                    <button
                      type="button"
                      onClick={() => setContactOpen(false)}
                      className="absolute right-4 top-4 text-sm text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                    <div className="space-y-1 text-center">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        {localize('Formulaire', 'Contact form')}
                      </p>
                      <h3 className="text-xl font-semibold text-slate-900">{localize('Nous écrire', 'Get in touch')}</h3>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">{localize('Nom', 'Name')}</label>
                      <input
                        type="text"
                        value={contactForm.name}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder={localize('Votre nom', 'Your name')}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={contactLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Email</label>
                      <input
                        type="email"
                        value={contactForm.email}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="you@example.com"
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={contactLoading}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">{localize('Message', 'Message')}</label>
                      <textarea
                        value={contactForm.message}
                        onChange={(event) => setContactForm((prev) => ({ ...prev, message: event.target.value }))}
                        placeholder={localize('Votre message...', 'Your message...')}
                        rows={4}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={contactLoading}
                      ></textarea>
                    </div>
                    <p className="text-[11px] text-slate-500 text-center">
                     {!recaptchaSiteKey
                      ? localize(
                       'Configurez NEXT_PUBLIC_RECAPTCHA_SITE_KEY pour activer la protection anti-spam.',
                       'Set NEXT_PUBLIC_RECAPTCHA_SITE_KEY to enable spam protection.'
                      )
                    : null}
                  </p>
                    {contactFeedback && (
                      <p
                        className={`text-[11px] text-center ${
                          contactFeedback.type === 'success' ? 'text-green-600' : 'text-red-500'
                        }`}
                      >
                        {contactFeedback.message}
                      </p>
                    )}
                    <Button
                      size="lg"
                      type="submit"
                      disabled={contactLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {contactLoading ? localize('Envoi...', 'Sending...') : localize('Envoyer', 'Submit')}
                    </Button>
                  </form>
                </div>
              )}
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <span>&copy; 2025 CyberScan. {localize('Tous droits réservés.', 'All rights reserved.')}</span>
              <Link href="mailto:contact@securas.fr" className="mt-2 md:mt-0 hover:text-white">
                contact@securas.fr
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaSiteKey) {
    return (
      <GoogleReCaptchaProvider reCaptchaKey={recaptchaSiteKey} scriptProps={{ async: true, defer: true }}>
        <HomeContent recaptchaSiteKey={recaptchaSiteKey} />
      </GoogleReCaptchaProvider>
    );
  }
  return <HomeContent />;
}
