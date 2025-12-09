'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, Subscription, Invoice } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw, FileText } from 'lucide-react';

type ActiveSubscription = Subscription & {
  profile_email?: string | null;
};

export default function AdminSubscriptionsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });

  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([]);
  const [invoicesByUser, setInvoicesByUser] = useState<Record<string, Invoice | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      } else {
        void loadData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, profile?.role]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: subsData, error: subsError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (subsError) throw subsError;

      const subscriptionsList = subsData ?? [];
      setSubscriptions(subscriptionsList);

      if (subscriptionsList.length > 0) {
        const userIds = Array.from(new Set(subscriptionsList.map((sub) => sub.user_id))).filter(Boolean);
        if (userIds.length > 0) {
          const { data: invoicesData, error: invoicesError } = await supabase
            .from('invoices')
            .select('*')
            .in('user_id', userIds)
            .order('created_at', { ascending: false });
          if (invoicesError) throw invoicesError;

          const grouped: Record<string, Invoice | undefined> = {};
          (invoicesData ?? []).forEach((invoice) => {
            if (!grouped[invoice.user_id]) {
              grouped[invoice.user_id] = invoice;
            }
          });
          setInvoicesByUser(grouped);
        } else {
          setInvoicesByUser({});
        }
      } else {
        setInvoicesByUser({});
      }
    } catch (err: any) {
      console.error('Error loading subscriptions:', err);
      setError(
        err?.message ||
          localize(
            'Impossible de charger la liste des abonnements actifs.',
            'Unable to load the active subscription list.'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return localize('Non défini', 'Not set');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return localize('Non défini', 'Not set');
    return date.toLocaleString(locale);
  };

  const invoiceLink = (invoice?: Invoice | null) => {
    if (!invoice) return null;
    return invoice.invoice_pdf_url || invoice.hosted_invoice_url || null;
  };

  if (authLoading || (loading && subscriptions.length === 0)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>{localize('Chargement des abonnements...', 'Loading subscriptions...')}</p>
        </div>
      </DashboardLayout>
    );
  }

  if (profile?.role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {localize('Gestion des abonnements', 'Manage subscriptions')}
            </h1>
            <p className="text-slate-600 mt-1">
              {localize(
                'Suivez les abonnements actifs, leurs factures et les prochaines dates de renouvellement.',
                'Track active subscriptions, invoices, and upcoming renewal dates.'
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => router.push('/admin')}>
              {localize('Retour administration', 'Back to admin')}
            </Button>
            <Button variant="secondary" className="flex items-center gap-2" onClick={loadData}>
              <RefreshCcw className="w-4 h-4" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">{localize('Erreur :', 'Error:')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{localize('Abonnements actifs', 'Active subscriptions')}</CardTitle>
            <CardDescription>
              {localize(
                'Liste des clients sous contrat, avec leurs factures et les dates clés.',
                'List of active customers, invoices, and key dates.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-slate-600 p-6">
                {localize('Aucun abonnement actif.', 'No active subscriptions.')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">{localize('Client', 'Customer')}</th>
                      <th className="px-4 py-3 font-medium">{localize('Plan', 'Plan')}</th>
                      <th className="px-4 py-3 font-medium">{localize('Acheté le', 'Purchased at')}</th>
                      <th className="px-4 py-3 font-medium">{localize('Renouvellement', 'Renewal')}</th>
                      <th className="px-4 py-3 font-medium">{localize('Facture', 'Invoice')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub) => {
                      const invoice = invoicesByUser[sub.user_id];
                      const link = invoiceLink(invoice);
                      return (
                        <tr key={`${sub.id}-${sub.user_id}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-900">
                            {invoice?.customer_email || sub.user_id}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {sub.plan_type.charAt(0).toUpperCase() + sub.plan_type.slice(1)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(sub.started_at)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(sub.expires_at)}</td>
                          <td className="px-4 py-3">
                            {link ? (
                              <Button variant="outline" size="sm" asChild className="flex items-center gap-2">
                                <a href={link} target="_blank" rel="noopener noreferrer">
                                  <FileText className="w-4 h-4" />
                                  {localize('PDF', 'PDF')}
                                </a>
                              </Button>
                            ) : (
                              <span className="text-slate-500">
                                {localize('Non disponible', 'Not available')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
