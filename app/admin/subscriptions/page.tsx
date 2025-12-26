'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, Subscription, Invoice } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCcw, FileText } from 'lucide-react';

type ManagedSubscription = {
  id: string;
  user_id: string;
  plan_type?: Subscription['plan_type'] | string | null;
  status?: Subscription['status'] | null;
  credits_limit?: number | null;
  started_at?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  profile_email?: string | null;
  profile_full_name?: string | null;
  invoice_reference?: string | null;
  invoice_pdf_url?: string | null;
  hosted_invoice_url?: string | null;
  invoice_customer_email?: string | null;
};

export default function AdminSubscriptionsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });
  const locale = choose({ fr: 'fr-FR', en: 'en-US' });

  const [subscriptions, setSubscriptions] = useState<ManagedSubscription[]>([]);
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
        .order('created_at', { ascending: false });
      if (subsError) throw subsError;

      const subscriptionsList = (subsData ?? []) as Subscription[];
      const subscriptionUserIds = Array.from(new Set(subscriptionsList.map((sub) => sub.user_id))).filter(Boolean);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('id,user_id,plan_type,invoice_id,invoice_pdf_url,hosted_invoice_url,customer_email,created_at')
        .order('created_at', { ascending: false });
      if (invoicesError) throw invoicesError;

      const invoicesList = (invoicesData ?? []) as Invoice[];
      const invoiceUserIds = Array.from(new Set(invoicesList.map((invoice) => invoice.user_id))).filter(Boolean);
      const allUserIds = Array.from(new Set([...subscriptionUserIds, ...invoiceUserIds]));

      let profilesById = new Map<string, { email?: string | null; full_name?: string | null }>();
      if (allUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('admin_user_view')
          .select('id, email, full_name')
          .in('id', allUserIds);
        if (profilesError) throw profilesError;
        profilesById = new Map((profilesData ?? []).map((profile) => [profile.id, profile]));
      }

      const invoiceRows: ManagedSubscription[] = invoicesList.map((invoice) => {
        const profileInfo = profilesById.get(invoice.user_id);
        return {
          id: `invoice-${invoice.id}`,
          user_id: invoice.user_id,
          plan_type: invoice.plan_type ?? null,
          status: null,
          credits_limit: null,
          started_at: invoice.created_at ?? null,
          expires_at: null,
          created_at: invoice.created_at ?? null,
          updated_at: null,
          profile_email: profileInfo?.email ?? null,
          profile_full_name: profileInfo?.full_name ?? null,
          invoice_reference: invoice.invoice_id || invoice.id || null,
          invoice_pdf_url: invoice.invoice_pdf_url ?? null,
          hosted_invoice_url: invoice.hosted_invoice_url ?? null,
          invoice_customer_email: invoice.customer_email ?? null,
        };
      });

      const usersWithInvoices = new Set(invoiceUserIds);
      const subscriptionRows: ManagedSubscription[] = subscriptionsList
        .filter((sub) => !usersWithInvoices.has(sub.user_id))
        .map((sub) => {
          const profileInfo = profilesById.get(sub.user_id);
          return {
            ...sub,
            profile_email: profileInfo?.email ?? null,
            profile_full_name: profileInfo?.full_name ?? null,
            started_at: sub.started_at ?? sub.created_at ?? null,
          };
        });

      const merged = [...invoiceRows, ...subscriptionRows];
      merged.sort((a, b) => {
        const aDate = a.started_at || a.created_at || '';
        const bDate = b.started_at || b.created_at || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
      setSubscriptions(merged);
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

  const invoiceLink = (row: ManagedSubscription) => {
    return row.invoice_pdf_url || row.hosted_invoice_url || null;
  };
  const invoiceReference = (row: ManagedSubscription) => {
    return row.invoice_reference || null;
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
            <CardTitle>{localize('Historique des abonnements', 'Subscription history')}</CardTitle>
            <CardDescription>
              {localize(
                'Tous les achats et renouvellements, y compris les abonnements annulés.',
                'All purchases and renewals, including cancelled subscriptions.'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {subscriptions.length === 0 ? (
              <p className="text-sm text-slate-600 p-6">
                {localize('Aucun abonnement trouvé.', 'No subscriptions found.')}
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
                      const link = invoiceLink(sub);
                      const invoiceId = invoiceReference(sub);
                      const customerEmail = sub.profile_email || sub.invoice_customer_email || null;
                      const customerLabel = sub.profile_full_name && customerEmail
                        ? `${sub.profile_full_name} (${customerEmail})`
                        : sub.profile_full_name || customerEmail || sub.user_id;
                      const planLabel = sub.plan_type
                        ? sub.plan_type.charAt(0).toUpperCase() + sub.plan_type.slice(1)
                        : localize('Non défini', 'Not set');
                      return (
                        <tr key={`${sub.id}-${sub.user_id}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-900">
                            {customerLabel}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            {planLabel}
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
                            ) : invoiceId ? (
                              <span className="text-slate-600">{invoiceId}</span>
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
