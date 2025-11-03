'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useSubscriptionPlan } from '@/hooks/use-subscription-plan';

export default function DomainAnalyzerPage() {
  const { plan, loading: planLoading } = useSubscriptionPlan();

  if (planLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl">
          <p className="text-slate-600">Chargement de vos informations d&apos;abonnement...</p>
        </div>
      </DashboardLayout>
    );
  }

  const hasAnalyzerAccess = plan === 'admin' || plan === 'pro' || plan === 'enterprise';

  if (!hasAnalyzerAccess) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-3xl space-y-4">
          <h1 className="text-2xl font-bold">Analyseur indisponible</h1>
          <p className="text-slate-600">
            L&apos;analyseur avancé est réservé aux plans Pro et Enterprise. Mettez à niveau votre
            abonnement pour y accéder.
          </p>
          <Link
            href="/dashboard/subscription"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Voir les abonnements
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Resolve backend URL similarly to other server-side API routes:
  // - prefer process.env.BACKEND_URL (server-side configured)
  // - in development fallback to localhost:8000
  // NOTE: we intentionally avoid using NEXT_PUBLIC_BACKEND_URL here so the
  // client iframe doesn't accidentally point to a public host during local dev.
  const backendBase =
    process.env.BACKEND_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:8000' : undefined) || 'http://localhost:8000';

  const analyzerUrl = `${backendBase.replace(/\/$/, '')}/analyzer/`;

  return (
    <DashboardLayout>
      <iframe 
        src={analyzerUrl}
        style={{
          width: '100%',
          height: 'calc(100vh - 100px)', // Full height minus header
          border: 'none',
          borderRadius: '8px',
          backgroundColor: 'white'
        }}
      />
    </DashboardLayout>
  );
}
