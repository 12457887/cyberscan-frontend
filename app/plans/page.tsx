'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PlansRedirectPage() {
  const router = useRouter();
  const { choose } = useLanguage();
  const localize = <T,>(fr: T, en: T) => choose({ fr, en });

  useEffect(() => {
    router.replace('/#plans-preview');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white text-sm px-4">
      <p className="text-center max-w-md">
        {localize(
          'La page des plans est désormais accessible sur la page principale. Redirection en cours…',
          'Pricing now lives on the homepage. Redirecting you there…'
        )}
      </p>
    </div>
  );
}
