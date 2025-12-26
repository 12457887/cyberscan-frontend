import { Suspense } from 'react';
import DashboardPageClient from './dashboard-client';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-slate-500">
          Chargement du tableau de bord… / Loading dashboard…
        </div>
      }
    >
      <DashboardPageClient />
    </Suspense>
  );
}
