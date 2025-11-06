'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const DISABLE_CREDIT_CHECK = process.env.NEXT_PUBLIC_DISABLE_CREDITS === 'true'; // permet de désactiver la vérif en dev

const PLAN_CONCURRENCY: Record<string, number> = {
  free: 1,
  basic: 1,
  pro: 5,
  enterprise: 10,
};

export default function ScanPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [scanType, setScanType] = useState<'light' | 'complete'>('light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [planType, setPlanType] = useState<string>('free');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<'none' | 'weekly' | 'monthly'>('none');
  const [scheduleStartAt, setScheduleStartAt] = useState('');
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setScanProgress(1);
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 95) return prev;
        const next = prev + Math.random() * 7;
        return next >= 95 ? 95 : next;
      });
    }, 600);

    progressIntervalRef.current = interval;
  };

  const stopProgress = (completed: boolean) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    setScanProgress(completed ? 100 : 0);
  };

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    if (profile?.role === 'admin') {
      setPlanType('enterprise');
      return;
    }

    supabase
      .from('subscriptions')
      .select('plan_type')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Impossible de récupérer le plan:', error);
          return;
        }
        if (data?.plan_type) {
          setPlanType(data.plan_type);
        }
      });
  }, [user, profile?.role]);

  useEffect(() => {
    if (planType === 'free' || planType === 'basic') {
      setScheduleEnabled(false);
      setScheduleFrequency('none');
      setScheduleStartAt('');
    }
  }, [planType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);
    startProgress();

    try {
      const concurrencyLimit = PLAN_CONCURRENCY[planType] ?? 1;

      if (planType === 'free' && scanType === 'complete') {
        setError('Le plan Gratuit ne permet pas les scans complets.');
        setLoading(false);
        stopProgress(false);
        return;
      }

      if (scheduleEnabled && !canSchedule) {
        setError('La planification automatique est réservée aux plans Pro et Enterprise.');
        setLoading(false);
        stopProgress(false);
        return;
      }

      if (scheduleEnabled && scheduleFrequency === 'none') {
        setError('Sélectionnez une fréquence pour la planification.');
        setLoading(false);
        stopProgress(false);
        return;
      }

      let scheduleStartIso: string | null = null;
      if (scheduleEnabled && scheduleFrequency !== 'none') {
        if (!scheduleStartAt) {
          setError('Merci de préciser la date de premier lancement pour la planification.');
          setLoading(false);
          stopProgress(false);
          return;
        }
        const parsedStart = new Date(scheduleStartAt);
        if (Number.isNaN(parsedStart.getTime())) {
          setError('Date de planification invalide.');
          setLoading(false);
          stopProgress(false);
          return;
        }
        scheduleStartIso = parsedStart.toISOString();
      }
      const rawEntries = siteUrl
        .split(/\r?\n|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean);

      if (rawEntries.length === 0) {
        throw new Error('Veuillez saisir au moins une URL.');
      }

      if (concurrencyLimit <= 1 && rawEntries.length > 1) {
        setError('Votre abonnement permet un seul scan à la fois.');
        setLoading(false);
        stopProgress(false);
        return;
      }

      if (rawEntries.length > concurrencyLimit) {
        setError(`Votre plan autorise au maximum ${concurrencyLimit} scans simultanés. Réduisez la liste ou passez à un plan supérieur.`);
        setLoading(false);
        stopProgress(false);
        return;
      }

      const normalizedUrls: string[] = [];
      for (const entry of rawEntries) {
        let candidate = entry;
        if (!/^https?:\/\//i.test(candidate)) {
          candidate = `https://${candidate}`;
        }
        try {
          const url = new URL(candidate);
          normalizedUrls.push(url.toString());
        } catch (err) {
          setError(`URL invalide: ${entry}`);
          setLoading(false);
          stopProgress(false);
          return;
        }
      }

      let creditsData = { remaining_credits: 0, used_credits: 0 };

      if (!DISABLE_CREDIT_CHECK) {
        const { data } = await supabase
          .from('credits')
          .select('remaining_credits, used_credits')
          .eq('user_id', user.id)
          .maybeSingle();

        creditsData = data || { remaining_credits: 0, used_credits: 0 };

        if (!creditsData || (creditsData.remaining_credits || 0) < normalizedUrls.length) {
          setError('Crédits insuffisants pour lancer cette série de scans.');
          setLoading(false);
          stopProgress(false);
          return;
        }
      }

      const trimmedSiteName = siteName.trim();
      const displayNames: string[] = [];
      const scanInserts = normalizedUrls.map((url, index) => {
        const host = new URL(url).hostname;
        const derivedName =
          normalizedUrls.length === 1
            ? trimmedSiteName || host
            : trimmedSiteName
              ? `${trimmedSiteName} #${index + 1}`
              : host;
        displayNames.push(derivedName);
        return {
          user_id: user.id,
          site_name: derivedName,
          site_url: url,
          scan_type: scanType,
          status: 'pending',
        };
      });

      const { data: scanRows, error: scanError } = await supabase
        .from('scans')
        .insert(scanInserts)
        .select();

      if (scanError || !scanRows || scanRows.length === 0) {
        throw scanError || new Error('Impossible de créer les enregistrements de scan.');
      }

      if (!DISABLE_CREDIT_CHECK) {
        await supabase
          .from('credits')
          .update({
            used_credits: (creditsData.used_credits || 0) + normalizedUrls.length,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }

      await supabase.from('alerts').insert(
        scanRows.map((row, index) => ({
          user_id: user.id,
          scan_id: row.id,
          title: 'Scan lancé',
          message: `Le scan de ${displayNames[index]} (${row.site_url}) a été lancé avec succès.`,
          type: 'system',
          severity: 'info',
        }))
      );

      if (scheduleEnabled && scheduleFrequency !== 'none' && scheduleStartIso) {
        const scheduleRows = scanRows.map((row, index) => ({
          user_id: user.id,
          site_url: row.site_url,
          site_name: displayNames[index],
          scan_type: scanType,
          frequency: scheduleFrequency,
          next_scan_date: scheduleStartIso,
          last_scan_date: null,
          is_active: true,
          is_running: false,
        }));

        const { error: scheduleError } = await supabase.from('scheduled_scans').insert(scheduleRows);

        if (scheduleError) {
          console.error('Erreur planification:', scheduleError);
          setError('Le scan a été lancé, mais la planification automatique n\'a pas pu être enregistrée.');
        } else {
          await supabase.from('alerts').insert({
            user_id: user.id,
            scan_id: null,
            title: 'Planification confirmée',
            message:
              scheduleFrequency === 'weekly'
                ? 'Vos scans seront répétés chaque semaine automatiquement.'
                : 'Vos scans seront répétés chaque mois automatiquement.',
            type: 'system',
            severity: 'info',
          });
        }
      }

      const API_BASE = window.location.origin + '/api';

      const basePayload = scanRows.map((row) => ({
        url: row.site_url,
        mode: scanType,
        scan_id: row.id,
        frontend_scan_id: row.id,
        user_id: user.id,
      }));

      const response = await fetch(`${API_BASE}/scan-auto-detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Max-Concurrent-Scans': concurrencyLimit.toString(),
        },
        body: JSON.stringify(basePayload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erreur API FastAPI:', text);
        throw new Error('Échec du lancement du scan.');
      }

      const result = await response.json();

      if (Array.isArray(result?.scan_ids) && result.scan_ids.length > 0) {
        const uniqueIds = (result.scan_ids as string[]).filter(
          (id, index, arr) => arr.indexOf(id) === index
        );
        await Promise.all(
          uniqueIds.map((scanId) =>
            supabase
              .from('scans')
              .update({ backend_scan_id: scanId })
              .eq('id', scanId)
          )
        );
      }

      stopProgress(true);
      // ✅ Redirection vers la page des rapports
      router.push('/dashboard/reports');
    } catch (err) {
      console.error('Error starting scan:', err);
      setError('Une erreur est survenue lors du lancement du scan.');
      stopProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const canSchedule = planType === 'pro' || planType === 'enterprise';
  const minScheduleValue = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Nouveau Scan</h1>
            <p className="text-slate-600 mt-1">Lancez une analyse de sécurité de votre site web</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/dashboard?section=support')}
            className="flex items-center gap-2"
          >
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
            Support Technique
          </Button>
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
                  required={PLAN_CONCURRENCY[planType] <= 1}
                />
                </div>

              {/* === URL === */}
              <div className="space-y-2">
                <Label htmlFor="siteUrl">URL du site</Label>
                {PLAN_CONCURRENCY[planType] > 1 ? (
                  <Textarea
                    id="siteUrl"
                    placeholder={`https://example.com\nhttps://example.org`}
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    className="min-h-[120px]"
                    required
                  />
                ) : (
                  <Input
                    id="siteUrl"
                    type="url"
                    placeholder="https://example.com"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    required
                  />
                )}
               
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
                </RadioGroup>
              </div>

              {canSchedule && (
                <div className="space-y-4 border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Label className="flex items-center gap-2">
                        Planification automatique
                      </Label>
                      <p className="text-xs text-slate-500 mt-1">
                        Programmez des scans récurrents et recevez les rapports sans action manuelle.
                      </p>
                    </div>
                    <Switch
                      checked={scheduleEnabled}
                      onCheckedChange={(checked) => {
                        setScheduleEnabled(checked);
                        if (checked) {
                          if (scheduleFrequency === 'none') {
                            setScheduleFrequency('weekly');
                          }
                          if (!scheduleStartAt) {
                            const now = new Date();
                            const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                              .toISOString()
                              .slice(0, 16);
                            setScheduleStartAt(localIso);
                          }
                        } else {
                          setScheduleFrequency('none');
                          setScheduleStartAt('');
                        }
                      }}
                      aria-label="Activer la planification automatique"
                    />
                  </div>

                  {scheduleEnabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="scheduleFrequency">Fréquence</Label>
                        <select
                          id="scheduleFrequency"
                          value={scheduleFrequency}
                          onChange={(e) => setScheduleFrequency(e.target.value as 'weekly' | 'monthly')}
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="weekly">Hebdomadaire</option>
                          <option value="monthly">Mensuelle</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="scheduleStart">Première exécution</Label>
                        <Input
                          id="scheduleStart"
                          type="datetime-local"
                          min={minScheduleValue}
                          value={scheduleStartAt}
                          onChange={(e) => setScheduleStartAt(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* === Erreur === */}
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>
              )}

              {/* === Bouton === */}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyse en cours... {Math.round(scanProgress)}%
                  </>
                ) : (
                  'Lancer le scan'
                )}
              </Button>

              {loading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Progression du scan</span>
                    <span>{Math.round(scanProgress)}%</span>
                  </div>
                  <Progress value={scanProgress} />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
