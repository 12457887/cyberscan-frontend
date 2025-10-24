"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DetectionRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect top-level /detection to dashboard detection (keeps backward compatibility)
    router.replace('/dashboard/detection');
  }, [router]);

  return (
    <div className="p-6 text-center">
      <p className="text-slate-600">Redirection vers la page de détection…</p>
    </div>
  );
}
