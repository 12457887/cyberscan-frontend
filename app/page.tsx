'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Zap, Lock, TrendingUp, CheckCircle, Check, Crown, Building2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
const showPricing = false; // 🔹 mets à true pour réafficher les plans

export default function Home() {
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

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
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-blue-500" />
              <span className="ml-2 text-xl font-bold text-white">CyberScan</span>
            </div>
            <div className="flex gap-4">
              <Button variant="ghost" className="text-white hover:text-blue-400" asChild>
                <Link href="/login">{localize('Connexion', 'Sign in')}</Link>
              </Button>
              {/*
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/register">S'inscrire</Link>
              </Button>
              */}
              <Button
                className="bg-blue-600 opacity-60 cursor-not-allowed"
                disabled
          >
              {localize("S'inscrire", 'Sign up')}
              </Button>

            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              {localize('Sécurisez votre présence en ligne avec', 'Secure your online presence with')}
              <span className="text-blue-500"> CyberScan</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              {localize(
                'Analysez, détectez et corrigez les vulnérabilités de vos applications web avec notre plateforme de scan de sécurité automatisée.',
                'Analyze, detect, and fix your web application vulnerabilities with our automated security scanning platform.'
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
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              {localize('Pourquoi choisir CyberScan ?', 'Why choose CyberScan?')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {featureCards.map((feature) => (
                <div key={feature.title.toString()} className="text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      {showPricing && (
        <section className="py-20 px-4" id="pricing">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                {localize('Choisissez votre plan', 'Choose your plan')}
              </h2>
              <p className="text-xl text-slate-300">
                {localize('Des solutions adaptées à tous vos besoins de sécurité', 'Solutions tailored to all your security needs')}
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 max-w-7xl mx-auto">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-slate-300" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-white">
                    {localize('Gratuit', 'Free')}
                  </CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    {localize('Parfait pour découvrir CyberScan', 'Perfect to discover CyberScan')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">0€</span>
                      <span className="text-slate-400 ml-1">{localize('/mois', '/month')}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{localize('10 crédits/mois', '10 credits/month')}</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('10 crédits par mois', '10 credits per month')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Scans légers', 'Light scans')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Rapports basiques', 'Basic reports')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Support par email', 'Email support')}</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-slate-700 hover:bg-slate-600" asChild>
                    <Link href="/register">{localize('Commencer', 'Get started')}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-blue-600 shadow-xl relative">
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600">
                  {localize('Populaire', 'Popular')}
                </Badge>
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-white">Basic</CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    {localize('Pour les petites entreprises', 'For small businesses')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">29€</span>
                      <span className="text-slate-400 ml-1">{localize('/mois', '/month')}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{localize('50 crédits/mois', '50 credits/month')}</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('50 crédits par mois', '50 credits per month')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Scans légers et complets', 'Light and full scans')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Rapports détaillés', 'Detailed reports')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Support prioritaire', 'Priority support')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Historique 6 mois', '6-month history')}</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/register">{localize('Choisir Basic', 'Choose Basic')}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center">
                      <Crown className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-white">Pro</CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    {localize('Pour les professionnels exigeants', 'For demanding professionals')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">99€</span>
                      <span className="text-slate-400 ml-1">{localize('/mois', '/month')}</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{localize('200 crédits/mois', '200 credits/month')}</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('200 crédits par mois', '200 credits per month')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Tous types de scans', 'All scan types')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Rapports avancés', 'Advanced reports')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Support 24/7', '24/7 support')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Historique illimité', 'Unlimited history')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('API access', 'API access')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Alertes en temps réel', 'Real-time alerts')}</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-orange-600 hover:bg-orange-700" asChild>
                    <Link href="/register">{localize('Choisir Pro', 'Choose Pro')}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-slate-300" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-white">Enterprise</CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    {localize('Solutions sur mesure', 'Tailor-made solutions')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-3xl font-bold text-white">
                        {localize('Sur devis', 'On request')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">{localize('Crédits illimités', 'Unlimited credits')}</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Crédits illimités', 'Unlimited credits')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Scans personnalisés', 'Custom scans')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Rapports sur mesure', 'Custom reports')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Support dédié', 'Dedicated support')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Intégration personnalisée', 'Custom integration')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('SLA garanti', 'Guaranteed SLA')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Formation incluse', 'Training included')}</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{localize('Audit de sécurité', 'Security audit')}</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-slate-700 hover:bg-slate-600" asChild>
                    <Link href="/register">{localize('Nous contacter', 'Contact us')}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}
        <section className="py-20 px-4">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              {localize('Prêt à sécuriser votre site ?', 'Ready to secure your site?')}
            </h2>
            <p className="text-xl text-slate-300 mb-8">
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

      <footer className="border-t border-slate-700 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400">
          <p>&copy; 2025 CyberScan. {localize('Tous droits réservés.', 'All rights reserved.')}</p>
        </div>
      </footer>
    </div>
  );
}
