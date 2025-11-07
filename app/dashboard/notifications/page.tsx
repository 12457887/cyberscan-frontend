'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase, Alert } from '@/lib/supabase';
import { Bell, Info, AlertTriangle, XCircle, Trash2 } from 'lucide-react';

export default function NotificationsPage() {
  const { user } = useAuth();
  const { choose, language } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });
  const severityLabels = choose({
    fr: { error: 'Erreur', warning: 'Attention', info: 'Info', new: 'Nouveau' },
    en: { error: 'Error', warning: 'Warning', info: 'Info', new: 'New' },
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) setAlerts(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      setAlerts(alerts.map(alert =>
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setAlerts(alerts.map(alert => ({ ...alert, is_read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId);

      setAlerts(alerts.filter(alert => alert.id !== alertId));
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
    if (language === 'fr') {
      return { title: alert.title, message: alert.message };
    }

    if (alert.type === 'subscription') {
      const planMatch = alert.message.match(/plan\s+([a-z]+)/i);
      const planId = planMatch?.[1];
      return {
        title: 'Subscription updated',
        message: planId
          ? `Your subscription has been confirmed for the ${planId} plan.`
          : 'Your subscription has been updated successfully.',
      };
    }

    if (alert.type === 'scan_complete') {
      return {
        title: 'Scan completed',
        message: 'Your security scan has finished. Review the report for more details.',
      };
    }

    if (alert.type === 'vulnerability_found') {
      return {
        title: 'New vulnerability detected',
        message: 'We detected new vulnerabilities on your target. Please review the latest scan.',
      };
    }

    if (alert.type === 'system') {
      return {
        title: 'System notification',
        message: alert.message || 'Important information regarding your account.',
      };
    }

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
                              {new Date(alert.created_at).toLocaleString(locale)}
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
