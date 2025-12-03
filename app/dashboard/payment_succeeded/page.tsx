"use client";

import { useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

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

export default function PaymentSucceededPage() {
  const searchParams = useSearchParams();

  const plan = searchParams.get('plan') ?? 'Professional';
  const interval = searchParams.get('interval') ?? 'monthly';
  const amountParam = searchParams.get('amount');
  const formattedAmount = formatCurrency(amountParam) ?? '—';
  const billingLabel = interval === 'annual' ? 'Annual' : 'Monthly';

  const nextBillingDate = useMemo(() => {
    const date = new Date();
    const daysToAdd = interval === 'annual' ? 365 : 30;
    date.setDate(date.getDate() + daysToAdd);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }, [interval]);

  const orderId = useMemo(() => {
    const fromUrl = searchParams.get('order_id');
    if (fromUrl) return `#${fromUrl}`;
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 900000) + 100000;
    return `#CS-${year}-${random}`;
  }, [searchParams]);

  useEffect(() => {
    const colors = ['#6366f1', '#8b5cf6', '#22c55e', '#fbbf24', '#ec4899'];
    const elements: HTMLDivElement[] = [];

    for (let i = 0; i < 50; i += 1) {
      const confetti = document.createElement('div');
      confetti.className = 'payment-confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;
      document.body.appendChild(confetti);
      elements.push(confetti);
      setTimeout(() => confetti.remove(), 4000);
    }

    return () => {
      elements.forEach((el) => el.remove());
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="relative bg-gradient-to-br from-emerald-400 to-emerald-600 px-6 py-12 text-center text-white">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg">
              <svg viewBox="0 0 52 52" className="h-16 w-16 text-emerald-500">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="100"
                  strokeDashoffset="0"
                  d="M14 27l7.5 7.5L38 18"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold">Payment successful!</h1>
            <p className="text-lg text-emerald-50">Thank you for choosing CyberScan.</p>
          </div>

          <div className="space-y-10 px-6 py-10 sm:px-12">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900">Welcome to CyberScan 🎉</h2>
              <p className="mt-2 text-slate-600">
                Your subscription is active. You now have full access to our advanced security scanning platform.
              </p>
            </div>

            <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <span role="img" aria-hidden="true">📋</span>Order summary
              </h3>
              <div className="divide-y divide-slate-200">
                <DetailRow label="Plan" value={<span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-700">{plan}</span>} />
                <DetailRow label="Billing cycle" value={billingLabel} />
                <DetailRow label="Amount paid" value={<span className="text-2xl font-bold text-indigo-600">{formattedAmount}</span>} />
                <DetailRow label="Next billing date" value={nextBillingDate} />
                <DetailRow label="Order ID" value={orderId} />
              </div>
            </section>

            <div className="rounded-xl border-l-4 border-blue-500 bg-blue-50 px-5 py-4 text-sm text-blue-900">
              📧 Confirmation email sent. Check your inbox (and spam folder) for the receipt and login details.
            </div>

            <section>
              <h3 className="mb-6 text-center text-xl font-semibold text-slate-900">What&apos;s next?</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg"
                  >
                    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold">
                      {index + 1}
                    </div>
                    <h4 className="font-semibold text-slate-900">{step.title}</h4>
                    <p className="mt-2 text-sm text-slate-600">{step.description}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-3 text-center text-base font-semibold text-white shadow-lg transition hover:shadow-xl"
              >
                Go to dashboard
              </Link>
              <Link
                href="/help"
                className="flex-1 rounded-xl border border-indigo-200 bg-white px-5 py-3 text-center text-base font-semibold text-indigo-600 transition hover:bg-indigo-50"
              >
                Visit help center
              </Link>
            </div>

            <div className="border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
              Need assistance? Contact
              {' '}
              <a href="mailto:contact@cyberscan.fr" className="font-semibold text-indigo-600 hover:underline">
                contact@cyberscan.fr
              </a>
              .
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .payment-confetti {
          position: fixed;
          top: -10px;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation-name: payment-confetti-fall;
          animation-timing-function: linear;
        }
        @keyframes payment-confetti-fall {
          to {
            transform: translateY(110vh) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-base font-semibold text-slate-800">{value}</span>
    </div>
  );
}

