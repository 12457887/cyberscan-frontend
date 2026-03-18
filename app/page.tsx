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
  LayoutDashboard,
  BellRing,
  FileText,
  DatabaseZap,
  Network,
} from 'lucide-react';

import { Language, useLanguage } from '@/contexts/LanguageContext';
import { QuickScanCard } from '@/components/QuickScanCard';
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { PLAN_DEFINITIONS } from '@/lib/plans';

const showPricing = false;

function HomeContent({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { choose, language, setLanguage } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  const targetStats = { totalScans: 12840, totalSites: 6420 };
  const [publicStats, setPublicStats] = useState({ totalScans: 0, totalSites: 0 });
  const [statsLoading] = useState(false);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactFeedback, setContactFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [contactLoading, setContactLoading] = useState(false);

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

  const secureFeatureCards = useMemo(
    () => [
      {
        emoji: '🤖',
        title: localize('Détection par IA', 'AI-powered detection'),
        description: localize(
          'Moteur propriétaire combinant IA, signatures CVE et heuristiques pour déceler les menaces invisibles aux autres outils.',
          'Proprietary engine blending AI, CVE signatures and heuristics to reveal threats other scanners miss.'
        ),
      },
      {
        emoji: '⚡',
        title: localize('Scans instantanés', 'Instant scans'),
        description: localize(
          'Diagnostic complet en moins de 30 secondes. Aucun compte requis pour votre premier scan gratuit.',
          'Complete diagnosis in under 30 seconds. No account required for your first free scan.'
        ),
      },
      {
        emoji: '🔔',
        title: localize('Alertes en temps réel', 'Real-time alerts'),
        description: localize(
          'Notifications instantanées par e-mail ou push dès qu’une nouvelle vulnérabilité apparaît.',
          'Instant email or push notifications whenever a new vulnerability shows up.'
        ),
      },
      {
        emoji: '📊',
        title: localize('Rapports détaillés', 'Detailed reports'),
        description: localize(
          'Cartographie complète des risques avec priorisation automatique des actions à mener.',
          'Complete risk mapping with automated prioritization of remediation tasks.'
        ),
      },
      {
        emoji: '🔁',
        title: localize('Scans automatiques', 'Automated scans'),
        description: localize(
          'Planifiez des analyses quotidiennes, hebdomadaires ou mensuelles pour rester protégé en continu.',
          'Schedule daily, weekly or monthly scans to stay protected continuously.'
        ),
      },
      {
        emoji: '🎯',
        title: localize('Dashboard centralisé', 'Centralized dashboard'),
        description: localize(
          'Pilotez tous vos sites depuis une seule interface. Idéal pour agences et MSSP.',
          'Control every site from one interface — perfect for agencies and MSSPs.'
        ),
      },
      {
        emoji: '🌐',
        title: localize('Scan réseau', 'Network Scan'),
        description: localize(
          'Analyse complète de l\'infrastructure réseau : ports ouverts, services exposés, bannières, SSL/TLS et vulnérabilités réseau. Pas seulement applicatif — CyberScan inspecte la couche réseau pour détecter les surfaces d\'attaque cachées.',
          'Full network infrastructure analysis: open ports, exposed services, banners, SSL/TLS and network vulnerabilities. Not just application-level — CyberScan inspects the network layer to uncover hidden attack surfaces.'
        ),
      },
      {
        emoji: '🔓',
        title: localize('Détection de fuites de données', 'Data Breach Detection'),
        description: localize(
          'Vérifiez si vos emails ou domaines ont été compromis dans des fuites de données. Accédez aux informations exposées : identifiants, mots de passe, sources.',
          'Check if your emails or domains were compromised in data breaches. Access exposed details: credentials, passwords, sources.'
        ),
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

  const parsePriceValue = (price: string) => {
    const match = price.match(/[\d.,]+/);
    if (!match) return 0;
    return parseFloat(match[0].replace(',', '.'));
  };

  const homepagePlans = useMemo(
    () =>
      PLAN_DEFINITIONS.map((plan) => ({
        id: plan.id,
        name: localize(plan.name.fr, plan.name.en).trim(),
        price: plan.price,
        period: plan.period ? localize(plan.period.fr, plan.period.en) : localize('/mois', '/month'),
        features: (plan.features || []).map((feature) => localize(feature.fr, feature.en)),
        highlight: plan.popular ?? false,
        oldPrice:
          parsePriceValue(plan.price) > 0 ? `${Math.max(1, Math.round(parsePriceValue(plan.price) * 2))}€` : null,
        ctaHref: '/register',
        ctaLabel: localize('Commencer maintenant', 'Start now'),
      })),
    [localize]
  );

  const whiteLabelPlan = useMemo(
    () => ({
      id: 'white-label',
      name: localize('White Label', 'White Label'),
      price: localize('Sur mesure', 'Custom'),
      period: '',
      features: [
        localize('Branding complet (logo, couleurs, sous-domaine)', 'Full branding (logo, colors, subdomain)'),
        localize('Scan hebdomadaire automatique', 'Automatic weekly scan'),
        localize('Rapports PDF en marque blanche', 'White-label PDF reports'),
        localize('Accès API illimité', 'Unlimited API access'),
        localize('Support dédié & onboarding prioritaire', 'Dedicated support & priority onboarding'),
        localize('Contrat multi-clients (agences, MSSP)', 'Multi-client contract (agencies, MSSPs)'),
      ],
      highlight: false,
      oldPrice: null,
      ctaHref: 'mailto:support@cyberscan.fr',
      ctaLabel: localize('Contacter le support', 'Contact support'),
    }),
    [localize]
  );

  const pricingCards = useMemo(() => [...homepagePlans, whiteLabelPlan], [homepagePlans, whiteLabelPlan]);

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

    {
      id: 'network-scan',
      icon: Network,
      label: localize('Scan réseau', 'Network Scan'),
      title: localize('Scan réseau & infrastructure', 'Network & Infrastructure Scan'),
      description: localize(
        "Au-delà des vulnérabilités applicatives, CyberScan analyse l'ensemble de votre infrastructure réseau : découverte des ports ouverts, identification des services exposés (SSH, FTP, RDP, bases de données…), lecture des bannières, audit SSL/TLS, détection des configurations faibles et des services non chiffrés. Une vue complète de votre surface d'attaque réseau, pas seulement web.",
        "Beyond application vulnerabilities, CyberScan analyses your full network infrastructure: open port discovery, exposed service identification (SSH, FTP, RDP, databases…), banner grabbing, SSL/TLS auditing, weak configuration detection and unencrypted service flagging. A complete view of your network attack surface — not just the web layer."
      ),
      image: '/network-scan.png',
      imageWidth: 340,
      imageHeight: 220,
      imageMaxWidth: 420,
    },

    {
      id: 'breach-detection',
      icon: DatabaseZap,
      label: localize('Détection de fuites de données', 'Data Breach Detection'),
      title: localize('Détection de fuites de données', 'Data Breach Detection'),
      description: localize(
        "Vérifiez en temps réel si vos emails ou domaines ont été exposés dans des fuites de données. CyberScan interroge les bases de données de fuites connues pour identifier les identifiants compromis, mots de passe, noms d'utilisateur et sources d'exposition. Résultats détaillés avec nom de la fuite, date et données affectées.",
        "Check in real time whether your emails or domains have been exposed in data breaches. CyberScan queries known breach databases to identify compromised credentials, passwords, usernames and exposure sources. Detailed results include breach name, date and affected data fields."
      ),
      image: '/check-domain.png',
      imageWidth: 340,
      imageHeight: 220,
      imageMaxWidth: 420,
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
        "Gestion automatisée de la facturation via Stripe : abonnements, essais gratuits, renouvellements, paiements récurrents, coupons, export des factures et reçus. Webhooks avancés gérant paiements réussis/échoués, remboursements, mises à jour de plan et changements de période. Support multi-devises, TVA internationale et paiements 3D Secure. Le système suit même les crédits, l’usage et envoie des notifications lors des renouvellements ou incidents de paiement.",
        "Automated billing powered by Stripe: subscriptions, free trials, renewals, recurring payments, coupons, invoice exports and receipts. Advanced webhooks handle successful/failed payments, refunds, plan updates and trial transitions. Supports multi-currency, international VAT and 3D Secure payments. The engine tracks credits, usage and sends notifications for renewals or payment issues."
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
      <nav className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md py-1 sticky top-0 z-50 shadow-lg shadow-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <div className="flex items-center gap-2">
              <Logo width={60} height={60} className="!justify-start" />
              <span className="text-lg font-bold text-white tracking-tight">CyberScan</span>
            </div>

            <div className="flex gap-1 items-center text-xs">
              {[
                { href: '/#hero', label: localize('Home', 'Home') },
                { href: '#features', label: localize('Fonctionnalités', 'Features') },
                { href: '#specification', label: localize('Spécifications', 'Specifications') },
                { href: '#benefits', label: localize('Bénéfices', 'Benefits') },
                { href: '/#plans-preview', label: localize('Plans', 'Plans') },
              ].map((item) => (
                <Button key={item.href} variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800/60 px-3 text-xs" asChild>
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}

              <div className="w-px h-5 bg-slate-700 mx-1" />

              <Button variant="ghost" className="text-slate-300 hover:text-white px-3 text-xs" asChild>
                <Link href="/login">{localize('Connexion', 'Sign in')}</Link>
              </Button>

              <Button className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-md shadow-blue-900/40 transition-all" asChild>
                <Link href="/register">{localize("S'inscrire", 'Sign up')}</Link>
              </Button>

              <div className="flex items-center gap-0.5 rounded-full border border-slate-700 bg-slate-800/80 px-1.5 py-1 ml-1">
                {(['fr', 'en'] as Language[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                      language === code ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <main>
        <section id="hero" className="relative py-20 px-4 overflow-hidden">
          {/* background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/20 rounded-full blur-[120px]" />
            <div className="absolute top-20 right-0 w-[300px] h-[300px] bg-indigo-700/15 rounded-full blur-[100px]" />
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            {/* badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs text-blue-300 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              {localize('Plateforme de cybersécurité tout-en-un', 'All-in-one cybersecurity platform')}
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-5 leading-tight tracking-tight">
              {localize(
                <>Votre site est-il protégé contre les <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">cybermenaces</span> ?</>,
                <>Is your website safe from <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">cyber threats</span>?</>
              )}
            </h1>

            <p className="text-base text-slate-300 max-w-2xl mx-auto mb-8 leading-relaxed">
              {localize(
                'Scannez votre site, détectez les fuites de données et analysez votre infrastructure réseau — gratuitement.',
                'Scan your website, detect data breaches and analyse your network infrastructure — for free.'
              )}
            </p>

            {/* trust badges */}
            <div className="flex flex-wrap justify-center gap-4 mb-8 text-xs text-slate-400">
              {[
                { emoji: '🛡️', label: localize('Scan IA avancé', 'Advanced AI Scan') },
                { emoji: '🌐', label: localize('Scan réseau', 'Network Scan') },
                { emoji: '🔓', label: localize('Fuites de données', 'Data Breach') },
                { emoji: '⚡', label: localize('Résultats en 30s', 'Results in 30s') },
              ].map((b) => (
                <span key={b.label} className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/60 rounded-full px-3 py-1">
                  <span>{b.emoji}</span>{b.label}
                </span>
              ))}
            </div>

            <div className="flex gap-3 justify-center mb-10">
              <Button
                size="sm"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/40 transition-all"
                asChild
              >
                <Link href="/register">{localize('Commencer gratuitement', 'Start for free')}</Link>
              </Button>

            </div>

            <div className="max-w-xl mx-auto">
              <QuickScanCard />
            </div>
          </div>
        </section>
        {/* FEATURES */}
        <section id="features" className="py-16 px-4 bg-white text-slate-900 text-sm">
          <div className="max-w-6xl mx-auto text-center space-y-3 mb-10">
            <p className="text-[11px] uppercase tracking-[0.25em] text-blue-600">
              {localize('Une technologie de pointe pour votre sécurité', 'Cutting-edge technology for your security')}
            </p>

            <h2 className="text-3xl font-bold">
              {localize('Tout est inclus pour garder vos CMS sous contrôle', 'Everything you need to keep your CMS secure')}
            </h2>

            <p className="text-slate-500 max-w-3xl mx-auto text-xs leading-relaxed">
              {localize(
                'CyberScan combine intelligence artificielle, signatures CVE et analyse dynamique pour anticiper les attaques.',
                'CyberScan blends artificial intelligence, CVE signatures, and dynamic analysis to stay ahead of attackers.'
              )}
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {secureFeatureCards.map((feature) => (
              <div
                key={feature.title as string}
                className="group rounded-3xl border border-slate-700/60 bg-gradient-to-br from-[#111d3a] to-[#0d142b] p-6 shadow-[0_20px_45px_rgba(2,6,23,0.45)] text-white hover:border-blue-500/50 hover:shadow-[0_20px_60px_rgba(37,99,235,0.2)] transition-all duration-300 hover:-translate-y-1 cursor-default"
              >
                <span className="text-3xl mb-4 inline-flex w-12 h-12 items-center justify-center rounded-2xl bg-slate-800/80 group-hover:bg-blue-500/20 transition-colors">{feature.emoji}</span>
                <h3 className="text-base font-semibold mb-2 text-white">{feature.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{feature.description}</p>
              </div>
            ))}
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

        {/* HOMEPAGE PLANS */}
        <section id="plans-preview" className="py-16 px-4 bg-[#090e1f] text-white text-sm">
          <div className="max-w-6xl mx-auto text-center space-y-3 mb-12">
            <p className="text-[11px] uppercase tracking-[0.25em] text-blue-200">
              {localize('Offre de lancement exceptionnelle', 'Exclusive launch offer')}
            </p>
            <h2 className="text-3xl font-bold">
              {localize('Choisissez le plan qui sécurise votre croissance', 'Choose the plan that secures your growth')}
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto text-xs">
              {localize(
                'Des tarifs préférentiels pour un nombre limité de clients. Upgradez quand vous le souhaitez.',
                'Limited-time pricing for the first customers. Upgrade whenever you need.'
              )}
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {pricingCards.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-3xl border px-6 py-8 flex flex-col h-full ${
                  plan.highlight
                    ? 'border-blue-400 shadow-[0_25px_60px_rgba(37,99,235,0.35)] bg-[#111b3d]'
                    : 'border-slate-700 bg-[#0f172f]'
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {plan.highlight && (
                    <span className="text-[10px] uppercase tracking-wide bg-pink-500/90 text-white px-3 py-1 rounded-full">
                      {localize('Plus populaire', 'Most popular')}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-4xl font-bold text-white">
                    {plan.price}
                    <span className="text-base font-normal text-slate-300 ml-1">{plan.period}</span>
                  </p>
                  {plan.oldPrice && (
                    <p className="text-xs text-slate-400">
                      {localize('Au lieu de', 'Instead of')} {plan.oldPrice}
                      {localize('/mois', '/month')}
                    </p>
                  )}
                </div>
                <ul className="mt-6 space-y-2 text-slate-200 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-300 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className="mt-8 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white text-xs py-3 rounded-xl"
                  asChild
                >
                  <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
        {/* READY TO SCAN */}
        <section className="relative py-20 px-4 bg-[#060c1d] text-center text-sm overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-blue-700/20 rounded-full blur-[100px]" />
          </div>
          <div className="max-w-2xl mx-auto relative z-10">
            <p className="text-[11px] uppercase tracking-[0.25em] text-blue-400 mb-3">
              {localize('Commencez maintenant', 'Get started now')}
            </p>
            <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight">
              {localize('Prêt à analyser vos vulnérabilités ?', 'Ready to scan for vulnerabilities?')}
            </h2>
            <p className="text-slate-400 text-sm mb-8">
              {localize(
                "Rejoignez des milliers d'entreprises qui font confiance à CyberScan pour protéger leur infrastructure.",
                'Join thousands of companies that trust CyberScan to protect their infrastructure.'
              )}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-8 py-2.5 text-sm font-semibold rounded-xl shadow-lg shadow-blue-900/50 transition-all" asChild>
                <Link href="/register">
                  {localize('Créer un compte gratuit', 'Create a free account')}
                </Link>
              </Button>
              <Button size="sm" className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-600/60 px-8 py-2.5 text-sm rounded-xl" asChild>
                <Link href="/login">
                  {localize('Se connecter', 'Sign in')}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-700 bg-slate-900/70 text-slate-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">

          <div className="grid gap-6 md:grid-cols-3">
            {/* BRAND */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <Logo width={80} height={80} className="!justify-start" />
                <span className="text-xl font-semibold text-white">CyberScan</span>
              </div>

              <p className="mt-3 text-xs text-slate-300">
                {/* éventuellement une phrase plus tard */}
              </p>

              <div className="mt-4 space-y-1 text-xs">
                <p className="font-semibold text-white">Securas Technologies</p>
                <p>contact@cyberscan.fr</p>
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
              <Link href="mailto:contact@cyberscan.fr" className="mt-2 md:mt-0 hover:text-white">
                contact@cyberscan.fr
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
