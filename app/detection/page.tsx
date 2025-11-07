"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function DetectionRedirect() {
  const router = useRouter();
  const { choose } = useLanguage();

  useEffect(() => {
    // Redirect top-level /detection to dashboard detection (keeps backward compatibility)
    router.replace('/dashboard/detection');
  }, [router]);

  return (
    <div className="p-6 text-center">
      <p className="text-slate-600">
        {choose({
          fr: 'Redirection vers la page de détection…',
          en: 'Redirecting to the detection page…',
        })}
      </p>
    </div>
  );
}
