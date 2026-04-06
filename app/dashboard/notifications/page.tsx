'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Alert } from '@/lib/supabase';
import { formatDateDMY } from '@/lib/date';
import { Bell, Info, AlertTriangle, XCircle, Trash2 } from 'lucide-react';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { choose, language } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${formatDateDMY(date)} ${date.toLocaleTimeString(locale, { timeStyle: 'short' })}`;
  };
  const severityLabels = choose({
    fr: { error: 'Erreur', warning: 'Attention', info: 'Info', new: 'Nouveau' },
    en: { error: 'Error', warning: 'Warning', info: 'Info', new: 'New' },
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    loadNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${user.id}` },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const getAccessToken = async (): Promise<string | undefined> => {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token;
  };

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/alerts', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      const token = await getAccessToken();
      await fetch(`/api/alerts/${alertId}/read`, {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      const token = await getAccessToken();
      await fetch('/api/alerts/read-all', {
        method: 'PATCH',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/alerts/${alertId}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info': return <Info className="w-5 h-5 text-blue-600" />;
      default: return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error': return <Badge variant="destructive">{severityLabels.error}</Badge>;
      case 'warning': return <Badge className="bg-yellow-500 text-black">{severityLabels.warning}</Badge>;
      case 'info': return <Badge className="bg-blue-500">{severityLabels.info}</Badge>;
      default: return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const translateAlertContent = (alert: Alert) => {
    const isFr = language === 'fr';

    // Scan lancé / Scan started
    // FR: "Le scan de {name} ({url}) a été lancé avec succès."
    // EN: "Scan for {name} ({url}) started successfully."
    const scanStartedMatch =
      alert.message.match(/Le scan de (.+?) \((.+?)\) a été lancé/) ||
      alert.message.match(/Scan for (.+?) \((.+?)\) started successfully/);
    if (scanStartedMatch) {
      const [, name, url] = scanStartedMatch;
      return {
        title: isFr ? 'Scan lancé' : 'Scan started',
        message: isFr
          ? `Le scan de ${name} (${url}) a été lancé avec succès.`
          : `Scan for ${name} (${url}) started successfully.`,
      };
    }

    // Scan relancé / Scan relaunched
    // FR: "Relance du scan pour {name}."
    // EN: "Scan relaunched for {name}."
    const scanRelaunchedMatch =
      alert.message.match(/Relance du scan pour (.+?)\./) ||
      alert.message.match(/Scan relaunched for (.+?)\./);
    if (scanRelaunchedMatch) {
      const [, name] = scanRelaunchedMatch;
      return {
        title: isFr ? 'Scan relancé' : 'Scan relaunched',
        message: isFr
          ? `Relance du scan pour ${name}.`
          : `Scan relaunched for ${name}.`,
      };
    }

    // Abonnement mis à jour / Subscription updated
    // FR: "Votre abonnement a été mis à jour vers le plan {plan}."
    // EN: "Your subscription has been updated to the {plan} plan."
    const subUpdatedMatch =
      alert.message.match(/mis à jour vers le plan (\w+)/) ||
      alert.message.match(/updated to the (\w+) plan/);
    if (subUpdatedMatch) {
      const [, plan] = subUpdatedMatch;
      return {
        title: isFr ? 'Abonnement mis à jour' : 'Subscription updated',
        message: isFr
          ? `Votre abonnement a été mis à jour vers le plan ${plan}.`
          : `Your subscription has been updated to the ${plan} plan.`,
      };
    }

    // Annulation programmée / Cancellation scheduled
    // FR: "Votre abonnement restera actif jusqu'au {date}, puis repassera..."
    // EN: "Your subscription will remain active until {date} and then revert..."
    const subCancelledMatch =
      alert.message.match(/restera actif jusqu'au (.+?),/) ||
      alert.message.match(/remain active until (.+?) and then/);
    if (subCancelledMatch) {
      const [, date] = subCancelledMatch;
      return {
        title: isFr ? 'Annulation programmée' : 'Cancellation scheduled',
        message: isFr
          ? `Votre abonnement restera actif jusqu'au ${date}, puis repassera automatiquement sur l'offre Free.`
          : `Your subscription will remain active until ${date} and then revert to the Free plan automatically.`,
      };
    }

    // Scan terminé sans vulnérabilité
    // FR: "Le scan de {hostname} est terminé. Aucune vulnérabilité détectée."
    const scanCleanMatch = alert.message.match(/Le scan de (.+?) est terminé\. Aucune vulnérabilité/);
    if (scanCleanMatch || alert.type === 'scan_complete') {
      const hostname = scanCleanMatch?.[1] ?? '';
      return {
        title: isFr ? 'Scan terminé' : 'Scan completed',
        message: isFr
          ? `Le scan de ${hostname} est terminé. Aucune vulnérabilité détectée.`
          : `Scan for ${hostname} completed. No vulnerabilities detected.`,
      };
    }

    // Scan terminé avec vulnérabilités
    // FR: "Le scan de {hostname} est terminé. {n} vulnérabilité(s) détectée(s) (niveau : {risk})."
    const scanVulnMatch = alert.message.match(/Le scan de (.+?) est terminé\. (\d+) vulnérabilité.+niveau\s*:\s*(\w+)/);
    if (scanVulnMatch || alert.type === 'vulnerability_found') {
      const hostname = scanVulnMatch?.[1] ?? '';
      const count = scanVulnMatch?.[2] ?? '';
      const risk = scanVulnMatch?.[3] ?? '';
      return {
        title: isFr ? 'Vulnérabilités détectées' : 'Vulnerabilities detected',
        message: isFr
          ? `Le scan de ${hostname} est terminé. ${count} vulnérabilité(s) détectée(s) (niveau : ${risk}).`
          : `Scan for ${hostname} completed. ${count} vulnerability(ies) found (level: ${risk}).`,
      };
    }

    // Fallback — retourne le contenu brut de la DB
    return { title: alert.title, message: alert.message };
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">{localize('Chargement des notifications...', 'Loading notifications...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{localize('Notifications', 'Notifications')}</h1>
            <p className="text-slate-600 mt-1">
              {unreadCount > 0
                ? localize(
                    `${unreadCount} notification(s) non lue(s)`,
                    `${unreadCount} unread notification(s)`
                  )
                : localize('Toutes les notifications sont lues', 'All notifications are read')}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="outline">
              {localize('Tout marquer comme lu', 'Mark all as read')}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Toutes les notifications', 'All notifications')}</CardTitle>
            <CardDescription>
              {localize('Historique de vos alertes et notifications', 'History of your alerts and notifications')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">{localize('Aucune notification', 'No notifications')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const translated = translateAlertContent(alert);
                  return (
                    <div
                      key={alert.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        alert.is_read ? 'bg-white' : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getAlertIcon(alert.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-slate-900">{translated.title}</h3>
                              {getSeverityBadge(alert.severity)}
                              {!alert.is_read && (
                                <Badge className="bg-blue-600">{severityLabels.new}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{translated.message}</p>
                            <p className="text-xs text-slate-500">
                              {formatDateTime(alert.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!alert.is_read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsRead(alert.id)}
                            >
                              {localize('Marquer comme lu', 'Mark as read')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(alert.id)}
                          >
                            <Trash2 className="w-4 h-4 text-slate-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
