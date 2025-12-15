import { Suspense } from 'react';
import PaymentSucceededClient from './client';

export default function PaymentSucceededPage() {
  return (
    <Suspense fallback={<div>Loading payment confirmation…</div>}>
      <PaymentSucceededClient />
    </Suspense>
  );
}