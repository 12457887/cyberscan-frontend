'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ScanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [scanType, setScanType] = useState<'light' | 'complete'>('light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      const TEST_MODE = true; // désactive le système de crédits pour test
      let creditsData = { remaining_credits: 1, used_credits: 0 };

      if (!TEST_MODE) {
        const { data } = await supabase
          .from('credits')
          .select('remaining_credits, used_credits')
          .eq('user_id', user.id)
          .maybeSingle();

        creditsData = data || { remaining_credits: 0, used_credits: 0 };

        if (!creditsData || creditsData.remaining_credits < 1) {
          setError('Crédits insuffisants. Veuillez améliorer votre abonnement.');
          setLoading(false);
          return;
        }
      }

      // === 🔹 Crée une entrée du scan dans Supabase
      const { data: scanData, error: scanError } = await supabase
        .from('scans')
        .insert({
          user_id: user.id,
          site_name: siteName,
          site_url: siteUrl,
          scan_type: scanType,
          status: 'pending',
        })
        .select()
        .single();

      if (scanError) throw scanError;

      // 🔹 Si mode réel, décrémente les crédits
      if (!TEST_MODE) {
        await supabase
          .from('credits')
          .update({
            used_credits: (creditsData.used_credits || 0) + 1,
            remaining_credits: creditsData.remaining_credits - 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      // 🔹 Ajoute une alerte utilisateur
      await supabase.from('alerts').insert({
        user_id: user.id,
        scan_id: scanData.id,
        title: 'Scan lancé',
        message: `Le scan de ${siteName} a été lancé avec succès.`,
        type: 'system',
        severity: 'info',
      });

      // === 🔹 Envoie la requête au backend FastAPI
      const API_BASE = window.location.origin + '/api';
      const siteList = [
        {
          url: siteUrl,
          mode: scanType,
           scan_id: scanData.id,
           frontend_scan_id: scanData.id,
          user_id: user.id,     // 🔹 On passe l’ID Supabase au backend
        },
      ];

      const response = await fetch(`${API_BASE}/scan-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteList),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erreur API FastAPI:', text);
        throw new Error('Échec du lancement du scan.');
      }
      const result = await response.json();

      // 🔹 Si backend renvoie un scan_id, on le stocke pour traçabilité
      if (result?.scan_ids?.[0]) {
        await supabase
          .from('scans')
          .update({ backend_scan_id: result.scan_ids[0] })
          .eq('id', scanData.id);
      }

      // ✅ Redirection vers la page des rapports
      router.push('/dashboard/reports');
    } catch (err) {
      console.error('Error starting scan:', err);
      setError('Une erreur est survenue lors du lancement du scan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Nouveau Scan</h1>
          <p className="text-slate-600 mt-1">Lancez une analyse de sécurité de votre site web</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuration du scan</CardTitle>
            <CardDescription>Entrez les informations du site à scanner</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* === Nom du site === */}
              <div className="space-y-2">
                <Label htmlFor="siteName">Nom du site</Label>
                <Input
                  id="siteName"
                  type="text"
                  placeholder="Mon Site Web"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  required
                />
              </div>

              {/* === URL === */}
              <div className="space-y-2">
                <Label htmlFor="siteUrl">URL du site</Label>
                <Input
                  id="siteUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  required
                />
              </div>

              {/* === Type de scan === */}
              <div className="space-y-3">
                <Label>Type de scan</Label>
                <RadioGroup
                  value={scanType}
                  onValueChange={(v) => setScanType(v as 'light' | 'complete')}
                >
                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="light" id="light" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="light" className="cursor-pointer flex items-center">
                        <Zap className="w-4 h-4 mr-2 text-yellow-600" />
                        <span className="font-medium">Scan Léger</span>
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        Analyse rapide des vulnérabilités courantes. Idéal pour un aperçu général.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Durée: ~5 minutes | Coût: 1 crédit
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <RadioGroupItem value="complete" id="complete" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="complete" className="cursor-pointer flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-blue-600" />
                        <span className="font-medium">Scan Complet</span>
                      </Label>
                      <p className="text-sm text-slate-600 mt-1">
                        Analyse approfondie incluant tests de pénétration et vérifications avancées.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Durée: ~30 minutes | Coût: 1 crédit
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* === Erreur === */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
              )}

              {/* === Bouton === */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Lancement en cours...
                  </>
                ) : (
                  'Lancer le scan'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
