import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Zap, Lock, TrendingUp, CheckCircle, Check, Crown, Building2 } from 'lucide-react';
const showPricing = false; // 🔹 mets à true pour réafficher les plans

export default function Home() {
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
                <Link href="/login">Connexion</Link>
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
              S'inscrire
              </Button>

            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Sécurisez votre présence en ligne avec
              <span className="text-blue-500"> CyberScan</span>
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto">
              Analysez, détectez et corrigez les vulnérabilités de vos applications web avec notre plateforme de scan de sécurité automatisée.
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
  Commencer gratuitement
</Button>
              <Button size="lg" className="bg-slate-700 hover:bg-slate-600 text-white border border-slate-600" asChild>
                <Link href="/login">Voir la démo</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 bg-slate-800/50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Pourquoi choisir CyberScan ?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Scans Rapides</h3>
                <p className="text-slate-400">
                  Analyses complètes en quelques minutes pour une réactivité maximale
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Sécurité Avancée</h3>
                <p className="text-slate-400">
                  Détection des vulnérabilités critiques avec recommandations
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Rapports Détaillés</h3>
                <p className="text-slate-400">
                  Rapports PDF complets avec visualisations et analyses
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Suivi en Temps Réel</h3>
                <p className="text-slate-400">
                  Notifications instantanées et historique complet des scans
                </p>
              </div>
            </div>
          </div>
        </section>

      {showPricing && (
        <section className="py-20 px-4" id="pricing">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Choisissez votre plan
              </h2>
              <p className="text-xl text-slate-300">
                Des solutions adaptées à tous vos besoins de sécurité
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
                  <CardTitle className="text-center text-white">Gratuit</CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    Parfait pour découvrir CyberScan
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">0€</span>
                      <span className="text-slate-400 ml-1">/mois</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">10 crédits/mois</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">10 crédits par mois</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Scans légers</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Rapports basiques</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Support par email</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-slate-700 hover:bg-slate-600" asChild>
                    <Link href="/register">Commencer</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-blue-600 shadow-xl relative">
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600">
                  Populaire
                </Badge>
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-white">Basic</CardTitle>
                  <CardDescription className="text-center text-slate-400 min-h-[40px]">
                    Pour les petites entreprises
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">29€</span>
                      <span className="text-slate-400 ml-1">/mois</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">50 crédits/mois</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">50 crédits par mois</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Scans légers et complets</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Rapports détaillés</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Support prioritaire</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Historique 6 mois</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                    <Link href="/register">Choisir Basic</Link>
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
                    Pour les professionnels exigeants
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-white">99€</span>
                      <span className="text-slate-400 ml-1">/mois</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">200 crédits/mois</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">200 crédits par mois</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Tous types de scans</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Rapports avancés</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Support 24/7</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Historique illimité</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">API access</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Alertes en temps réel</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-orange-600 hover:bg-orange-700" asChild>
                    <Link href="/register">Choisir Pro</Link>
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
                    Solutions sur mesure
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center">
                    <div className="flex items-baseline justify-center">
                      <span className="text-3xl font-bold text-white">Sur devis</span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1">Crédits illimités</p>
                  </div>
                  <ul className="space-y-3">
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Crédits illimités</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Scans personnalisés</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Rapports sur mesure</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Support dédié</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Intégration personnalisée</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">SLA garanti</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Formation incluse</span>
                    </li>
                    <li className="flex items-start text-slate-300">
                      <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">Audit de sécurité</span>
                    </li>
                  </ul>
                  <Button className="w-full bg-slate-700 hover:bg-slate-600" asChild>
                    <Link href="/register">Nous contacter</Link>
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
              Prêt à sécuriser votre site ?
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              Rejoignez des milliers d'entreprises qui font confiance à CyberScan
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
          <p>&copy; 2025 CyberScan. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
