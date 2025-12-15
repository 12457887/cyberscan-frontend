'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { Toaster } from '@/components/ui/toaster';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

interface ProvidersProps {
  children: ReactNode;
  recaptchaSiteKey?: string;
}

export function Providers({ children, recaptchaSiteKey }: ProvidersProps) {
  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaSiteKey ?? ''}
      scriptProps={{ async: true, defer: true }}
    >
      <LanguageProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </GoogleReCaptchaProvider>
  );
}
