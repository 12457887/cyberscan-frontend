'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, RefundRequest } from '@/lib/supabase';
import { RefundRequestsPanel } from '@/components/ui/refund-requests-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCcw, ArrowLeft } from 'lucide-react';

export default function AdminRefundsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);

  const loadRefundRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('/service/refund-requests', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload?.detail ||
            payload?.error ||
            localize('Impossible de charger les demandes de remboursement.', 'Unable to load refund requests.')
        );
      }
      const json = await response.json().catch(() => null);
      setRequests(json?.requests ?? []);
    } catch (err: any) {
      console.error('Error loading refund requests:', err);
      setError(err?.message || localize('Une erreur est survenue.', 'An error occurred.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (profile?.role !== 'admin') {
        router.push('/dashboard');
      } else {
        void loadRefundRequests();
      }
    }
  }, [user, profile, authLoading, router]);

  const handleRefundDecision = async (requestId: string, decision: 'approve' | 'reject', note?: string) => {
    try {
      setActionRequestId(requestId);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error(
          localize('Session expirée, reconnectez-vous pour continuer.', 'Session expired, please log in again.')
        );
      }
      const response = await fetch('/service/refund-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, decision, note }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload?.detail ||
          payload?.error ||
          localize('Impossible de traiter cette demande de remboursement.', 'Unable to update this refund request.');
        throw new Error(message);
      }
      await loadRefundRequests();
    } catch (err: any) {
      console.error('Refund decision error:', err);
      window.alert(
        err?.message ||
          localize('Impossible de traiter cette demande de remboursement.', 'Unable to update this refund request.')
      );
    } finally {
      setActionRequestId(null);
    }
  };

  const summary = useMemo(() => {
    return requests.reduce(
      (acc, req) => {
        const statusKey = (req.status || 'pending').toLowerCase();
        if (statusKey in acc) {
          acc[statusKey as keyof typeof acc] += 1;
        }
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );
  }, [requests]);

  if (authLoading || (loading && requests.length === 0)) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
          <RefreshCcw className="w-5 h-5 animate-spin mb-3" />
          <p>{localize('Chargement des demandes de remboursement...', 'Loading refund requests...')}</p>
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
            <h1 className="text-3xl font-bold text-slate-900">{localize('Demandes de remboursement', 'Refund requests')}</h1>
            <p className="text-slate-600 mt-1">
              {localize(
                'Consultez et approuvez/rejetez les demandes de remboursement.',
                'Review and approve/reject submitted refund requests.'
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => router.push('/admin')}>
              <ArrowLeft className="w-4 h-4" />
              {localize('Retour administration', 'Back to admin')}
            </Button>
            <Button variant="secondary" className="flex items-center gap-2" onClick={loadRefundRequests}>
              <RefreshCcw className="w-4 h-4" />
              {localize('Actualiser', 'Refresh')}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{localize('Statistiques rapides', 'Quick stats')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500">{localize('En attente', 'Pending')}</p>
                <p className="text-2xl font-semibold text-slate-900 mt-1">{summary.pending}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 p-4 text-center bg-emerald-50">
                <p className="text-xs uppercase tracking-wide text-emerald-600">{localize('Approuvées', 'Approved')}</p>
                <p className="text-2xl font-semibold text-emerald-700 mt-1">{summary.approved}</p>
              </div>
              <div className="rounded-xl border border-red-200 p-4 text-center bg-red-50">
                <p className="text-xs uppercase tracking-wide text-red-600">{localize('Rejetées', 'Rejected')}</p>
                <p className="text-2xl font-semibold text-red-700 mt-1">{summary.rejected}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            <p className="font-semibold">{localize('Erreur :', 'Error:')}</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <RefundRequestsPanel
          requests={requests}
          loading={loading}
          error={error}
          actionRequestId={actionRequestId}
          onDecision={handleRefundDecision}
        />
      </div>
    </DashboardLayout>
  );
}
