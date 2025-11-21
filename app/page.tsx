'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Zap, Lock, TrendingUp, CheckCircle, Check, Crown, Building2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { QuickScanCard } from '@/components/QuickScanCard';
const showPricing = false; // 🔹 mets à true pour réafficher les plans

export default function Home() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const targetStats = { totalScans: 12840, totalSites: 6420 };
  const [publicStats, setPublicStats] = useState({ totalScans: 0, totalSites: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = new Date(`${new Date().getFullYear()}-11-28T23:59:59`);
    const tick = () => {
      const now = new Date();
      const diff = Math.max(0, target.getTime() - now.getTime());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 🎛️ Animate numbers from 0 up to fixed targets on page load
    const stepDuration = 35;
    const increment = () => {
      setPublicStats((prev) => {
        const nextScans = Math.min(prev.totalScans + 500, targetStats.totalScans);
        const nextSites = Math.min(prev.totalSites + 500, targetStats.totalSites);
        if (nextScans === targetStats.totalScans && nextSites === targetStats.totalSites) {
          return prev;
        }
        return { totalScans: nextScans, totalSites: nextSites };
      });
    };

    const interval = setInterval(increment, stepDuration);
    return () => clearInterval(interval);
  }, []);

  const benefits = useMemo(
    () => [
      {
        title: localize('Visibilité instantanée', 'Instant visibility'),
        description: localize('Vue claire des crédits, scans récents et alertes critiques.', 'Clear view of credits, latest scans, and critical alerts.'),
        icon: ShieldCheck,
      },
      {
        title: localize('Priorité aux incidents', 'Incident-first'),
        description: localize('Les anomalies prioritaires remontent en premier pour agir vite.', 'Critical issues surface first so you can react fast.'),
        icon: AlertTriangle,
      },
      {
        title: localize('Scans rapides', 'Fast scans'),
        description: localize('Déclenchez ou suivez un scan en quelques secondes.', 'Start or monitor a scan in seconds.'),
        icon: Zap,
      },
      {
        title: localize('Sécurité renforcée', 'Secure by design'),
        description: localize('Accès sécurisé et données protégées pour votre équipe.', 'Protected data and gated access for your team.'),
        icon: Lock,
      },
    ],
    [localize]
  );

  const featureCards = [
    {
      icon: Zap,
      title: localize('Scans Rapides', 'Fast scans'),
      description: localize('Analyses complètes en quelques minutes pour une réactivité maximale', 'Complete analyses within minutes for maximum responsiveness'),
    },
    {
      icon: Lock,
      title: localize('Sécurité Avancée', 'Advanced security'),
      description: localize('Détection des vulnérabilités critiques avec recommandations', 'Detect critical vulnerabilities with actionable recommendations'),
    },
    {
      icon: TrendingUp,
      title: localize('Rapports Détaillés', 'Detailed reports'),
      description: localize('Rapports PDF complets avec visualisations et analyses', 'Complete PDF reports with visuals and insights'),
    },
    {
      icon: CheckCircle,
      title: localize('Suivi en Temps Réel', 'Real-time tracking'),
      description: localize('Notifications instantanées et historique complet des scans', 'Instant notifications and a complete scan history'),
    },
  ];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Logo width={72} height={72} className="!justify-start" />
              <span className="text-xl font-bold text-white">CyberScan</span>
            </div>
            <div className="flex gap-3 items-center">
              <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
                <Link href="#benefits">{localize('Bénéfices', 'Benefits')}</Link>
              </Button>
              <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
                <Link href="/plans">{localize('Plans', 'Plans')}</Link>
              </Button>
              <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
                <Link href="/login">{localize('Connexion', 'Sign in')}</Link>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/register"> {localize("S'inscrire", 'Sign up')}</Link>
              </Button>
             
            </div>
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 text-white px-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="uppercase text-xs tracking-[0.3em] text-white/70">Black Friday</p>
              <h2 className="text-3xl font-bold mt-2">
                {localize('Offre limitée : -40% sur les plans Pro & Enterprise', 'Limited offer: 50% off  plans')}
              </h2>
              <p className="mt-3 text-white/80">
                {localize('Crédits bonus et onboarding prioritaire durant la période Black Friday.', 'Bonus credits and priority onboarding during Black Friday.')}
              </p>
            </div>
            <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90" asChild>
              <Link href="/plans">
                {localize('Profiter de la promotion', 'Claim the deal')}
              </Link>
            </Button>
          </div>
          <div className="bg-white/10 border border-white/20 rounded-2xl p-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {[
                { label: localize('Jours', 'Days'), value: timeLeft.days },
                { label: localize('Heures', 'Hours'), value: timeLeft.hours },
                { label: localize('Minutes', 'Minutes'), value: timeLeft.minutes },
                { label: localize('Secondes', 'Seconds'), value: timeLeft.seconds },
              ].map((item) => (
                <div key={item.label} className="bg-slate-900/40 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold">{String(item.value).padStart(2, '0')}</div>
                  <div className="text-xs uppercase tracking-wide text-white/70">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="h-1 rounded-full bg-slate-900/50 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 via-purple-400 to-blue-400"
                style={{ width: `${Math.min(100, (timeLeft.seconds / 60) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              {localize(
                'Votre site est-il protégé contre les cybermenaces ?',
                'Is your website protected against cyber threats?'
              )}
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              {localize(
                'Scannez votre site dès maintenant et obtenez gratuitement une analyse de sécurité instantanée.',
                'Scan your website now and get free, instant access to your security analysis.'
              )}
            </p>
            <div className="flex gap-4 justify-center">
              {/* Ancien bouton (désactivé en commentaire)
<Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" asChild>
  <Link href="/register">Commencer gratuitement</Link>
</Button>
*/}

{/* Nouveau bouton désactivé pour la démo */}
<Button
  size="lg"
  className="bg-blue-600 text-white opacity-60 cursor-not-allowed"
  disabled
>
  {localize('Commencer gratuitement', 'Start for free')}
</Button>
              <Button size="lg" className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600" asChild>
                <Link href="/login">{localize('Voir la démo', 'See the demo')}</Link>
              </Button>
            </div>
            <div className="max-w-3xl mx-auto mt-10">
              <QuickScanCard />
            </div>
      </div>
    </section>

        <section id="benefits" className="py-12 px-4 scroll-mt-20 bg-white text-slate-900">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">
              {localize('Bénéfices clés', 'Key benefits')}
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <Card key={benefit.title} className="bg-white border-slate-200 h-full shadow-sm">
                    <CardContent className="p-5 flex flex-col gap-3">
                      <span className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </span>
                      <div>
                        <p className="text-slate-900 font-semibold">{benefit.title}</p>
                        <p className="text-sm text-slate-600 mt-1">{benefit.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="py-16 px-4" style={{ backgroundColor: '#f9f9f9' }}>
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
              {localize('Pourquoi choisir CyberScan ?', 'Why choose CyberScan?')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {featureCards.map((feature) => (
                <div key={feature.title.toString()} className="text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{feature.title}</h3>
                  <p className="text-slate-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 px-4 bg-white text-slate-900">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              {localize('Prêt à analyser vos vulnérabilités ?', 'Ready to scan for vulnerabilities?')}
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              {localize("Rejoignez des milliers d'entreprises qui font confiance à CyberScan", 'Join thousands of companies that trust CyberScan')}
            </p>
            {/*
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/register">Démarrer maintenant</Link>
            </Button>
            */}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-700 bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-lg">
              <Logo width={96} height={96} className="mb-2 !justify-start" />
              <p className="text-slate-300 mt-3">
              </p>
              <div className="mt-4 space-y-1 text-sm text-slate-400">
                <p className="font-semibold text-white">Securas Technologies</p>
                <p>contact@securas.fr</p>
                <p>{localize('Assistance 24/7', '24/7 assistance')}</p>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-lg">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                {localize('Statistiques en direct', 'Live security stats')}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-4">
                  <p className="text-xs text-slate-400">{localize('Scans totaux', 'Total scans')}</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {statsLoading ? '—' : publicStats.totalScans.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-900/70 border border-slate-700 p-4">
                  <p className="text-xs text-slate-400">{localize('Sites analysés', 'Websites scanned')}</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {statsLoading ? '—' : publicStats.totalSites.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                {localize('Mise à jour automatique toutes les 2 minutes.', 'Auto-updated every 2 minutes.')}
              </p>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-lg">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
                {localize('Liens utiles', 'Useful links')}
              </p>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <Link href="/conditions-generales" className="hover:text-white">
                  {localize("Conditions d'utilisation", 'Terms of Use')}
                </Link>
                <Link href="/login" className="hover:text-white">
                  {localize('Accéder au tableau de bord', 'Access the dashboard')}
                </Link>
                <Link href="/detection" className="hover:text-white">
                  {localize('Zone de détection', 'Detection area')}
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row md:items-center md:justify-between text-slate-500 text-sm">
            <span>&copy; 2025 CyberScan. {localize('Tous droits réservés.', 'All rights reserved.')}</span>
            <span className="mt-2 md:mt-0">
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
