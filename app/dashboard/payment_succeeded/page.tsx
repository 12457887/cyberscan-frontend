// app/dashboard/payment_succeeded/payment-succeeded-client.tsx
'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const formatCurrency = (value?: string | null) => {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ''));
  if (Number.isNaN(numeric)) return null;
  return `€${numeric.toFixed(2)}`;
};

const steps = [
  { title: 'Access Dashboard', description: 'Log in to your account and explore your new workspace.' },
  { title: 'Add Your Sites', description: 'Start by adding the websites you want CyberScan to monitor.' },
  { title: 'Run First Scan', description: 'Launch your first deep scan to get instant insights.' },
];

export default function PaymentSucceededClient() {
  const searchParams = useSearchParams();
  const { refreshCredits } = useAuth();

  const plan = searchParams.get('plan') ?? 'Professional';
  const interval = searchParams.get('interval') ?? 'monthly';
  const amountParam = searchParams.get('amount');
  const formattedAmount = formatCurrency(amountParam) ?? '—';
  const billingLabel = interval === 'annual' ? 'Annual' : 'Monthly';
  const sessionId = searchParams.get('session_id');

  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>(
    sessionId ? 'idle' : 'success'
  );
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const hasConfirmedRef = useRef(false);

  const nextBillingDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + (interval === 'annual' ? 365 : 30));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [interval]);

  const [orderId, setOrderId] = useState(() => {
    const fromUrl = searchParams.get('order_id');
    if (fromUrl) return `#${fromUrl}`;
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `#CS-${year}-${random}`;
  });

  useEffect(() => {
    const fromUrl = searchParams.get('order_id');
    if (fromUrl) setOrderId(`#${fromUrl}`);
  }, [searchParams]);

  useEffect(() => {
    if (!sessionId || hasConfirmedRef.current) return;
    hasConfirmedRef.current = true;

    const confirmSession = async () => {
      try {
        setSyncState('syncing');
        setSyncMessage('Validating your payment and refreshing your credits...');

        const res = await fetch('/service/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm-session',
            sessionId,
            plan,
            interval,
          }),
        });

        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;

        if (!res.ok) {
          throw new Error(
            payload?.detail ||
              payload?.error ||
              'Unable to confirm payment. Please contact support.'
          );
        }

        setSyncState('success');
        setSyncMessage('Payment confirmed. Your credits are now available.');
      } catch (err: any) {
        setSyncState('error');
        setSyncMessage(err?.message || 'Unable to refresh your credits.');
      }
    };

    confirmSession();
  }, [sessionId, plan, interval]);

  useEffect(() => {
    if (syncState === 'success') {
      refreshCredits().catch(console.error);
    }
  }, [syncState, refreshCredits]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-3xl bg-white shadow-2xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-center text-emerald-600">
          Payment successful 🎉
        </h1>

        {sessionId && syncMessage && (
          <div className="rounded-xl bg-slate-100 p-4 text-center">
            {syncMessage}
          </div>
        )}

        <div className="divide-y">
          <DetailRow label="Plan" value={plan} />
          <DetailRow label="Billing cycle" value={billingLabel} />
          <DetailRow label="Amount paid" value={formattedAmount} />
          <DetailRow label="Next billing date" value={nextBillingDate} />
          <DetailRow label="Order ID" value={orderId} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border p-4 text-center">
              <div className="font-bold">{i + 1}</div>
              <h4 className="font-semibold">{s.title}</h4>
              <p className="text-sm text-gray-600">{s.description}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <Link href="/dashboard" className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-white text-center">
            Go to dashboard
          </Link>
          <Link href="/help" className="flex-1 rounded-xl border px-4 py-3 text-center">
            Help center
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
