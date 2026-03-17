'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, ScheduledScan } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Trash2, ToggleLeft, ToggleRight, Plus, RefreshCw } from 'lucide-react';
import { formatDateDMY } from '@/lib/date';

export default function ScheduledScansPage() {
  const { user } = useAuth();
  const { choose } = useLanguage();
  const loc = <T,>(fr: T, en: T) => choose({ fr, en });

  const [schedules, setSchedules] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ site_url: '', site_name: '', scan_type: 'light', frequency: 'weekly' });

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const load = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/scheduled-scans', { headers, cache: 'no-store' });
      if (res.ok) setSchedules(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.site_url.trim()) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/scheduled-scans', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const created = await res.json();
        setSchedules(prev => [created, ...prev]);
        setForm({ site_url: '', site_name: '', scan_type: 'light', frequency: 'weekly' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: ScheduledScan) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/scheduled-scans/${s.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ is_active: !s.is_active }),
    });
    if (res.ok) setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !s.is_active } : x));
  };

  const handleDelete = async (id: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/scheduled-scans/${id}`, { method: 'DELETE', headers });
    if (res.ok) setSchedules(prev => prev.filter(x => x.id !== id));
  };

  const formatDate = (v?: string | null) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : formatDateDMY(d);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-8 h-8 text-blue-600" />
            {loc('Scans automatiques', 'Scheduled Scans')}
          </h1>
          <p className="text-slate-600 mt-1">
            {loc('Planifiez des scans hebdomadaires ou mensuels — un rapport PDF vous sera envoyé par email à chaque fin de scan.', 'Schedule weekly or monthly scans — a PDF report will be emailed to you after each scan.')}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" />{loc('Nouveau scan planifié', 'New scheduled scan')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>{loc('URL du site *', 'Site URL *')}</Label>
                <Input
                  placeholder="https://mon-site.com"
                  value={form.site_url}
                  onChange={e => setForm(f => ({ ...f, site_url: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>{loc('Nom (optionnel)', 'Name (optional)')}</Label>
                <Input
                  placeholder={loc('Mon site', 'My site')}
                  value={form.site_name}
                  onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{loc('Type de scan', 'Scan type')}</Label>
                <Select value={form.scan_type} onValueChange={v => setForm(f => ({ ...f, scan_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{loc('Rapide', 'Light')}</SelectItem>
                    <SelectItem value="complete">{loc('Complet', 'Complete')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{loc('Fréquence', 'Frequency')}</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{loc('Hebdomadaire', 'Weekly')}</SelectItem>
                    <SelectItem value="monthly">{loc('Mensuel', 'Monthly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? loc('Création...', 'Creating...') : loc('Créer le scan planifié', 'Create scheduled scan')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{loc('Vos scans planifiés', 'Your scheduled scans')}</CardTitle>
              <CardDescription>{loc(`${schedules.length} scan(s) configuré(s)`, `${schedules.length} scan(s) configured`)}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-slate-500 text-sm">{loc('Chargement...', 'Loading...')}</p>
            ) : schedules.length === 0 ? (
              <div className="text-center py-10">
                <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{loc('Aucun scan planifié.', 'No scheduled scans.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedules.map(s => (
                  <div key={s.id} className={`flex items-center justify-between p-4 border rounded-lg ${s.is_active ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 truncate">{s.site_name || s.site_url}</span>
                        <Badge variant="outline">{s.frequency === 'weekly' ? loc('Hebdo', 'Weekly') : loc('Mensuel', 'Monthly')}</Badge>
                        <Badge variant="outline">{s.scan_type === 'complete' ? loc('Complet', 'Complete') : loc('Rapide', 'Light')}</Badge>
                        {s.is_running && <Badge className="bg-blue-500">{loc('En cours', 'Running')}</Badge>}
                        {!s.is_active && <Badge variant="secondary">{loc('Inactif', 'Inactive')}</Badge>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">{s.site_url}</p>
                      <div className="flex gap-4 mt-1 text-xs text-slate-500">
                        <span>{loc('Prochain :', 'Next:')} {formatDate(s.next_scan_date)}</span>
                        {s.last_scan_date && <span>{loc('Dernier :', 'Last:')} {formatDate(s.last_scan_date)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <Button variant="ghost" size="icon" title={s.is_active ? loc('Désactiver', 'Disable') : loc('Activer', 'Enable')} onClick={() => handleToggle(s)}>
                        {s.is_active
                          ? <ToggleRight className="w-5 h-5 text-blue-600" />
                          : <ToggleLeft className="w-5 h-5 text-slate-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" title={loc('Supprimer', 'Delete')} onClick={() => handleDelete(s.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
