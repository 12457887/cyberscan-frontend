import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

const defaultTitle = 'CyberScan | Website Security Scanner';
const defaultDescription = 'AI-powered security scans for CMS websites. Detect vulnerabilities, monitor risks, and generate reports.';

export const metadata: Metadata = {
  title: {
    default: defaultTitle,
    template: '%s | CyberScan',
  },
  description: defaultDescription,
  metadataBase,
  openGraph: {
    type: 'website',
    title: defaultTitle,
    description: defaultDescription,
    siteName: 'CyberScan',
    images: [
      {
        url: '/dark_logo.png',
        width: 512,
        height: 512,
        alt: 'CyberScan',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: defaultTitle,
    description: defaultDescription,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/dark_logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/dark_logo.png" />

        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-R2BTRJE19L"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-R2BTRJE19L');
          `}
        </Script>

        {/* Hotjar Tracking Code */}
        <Script id="hotjar-tracking" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:6592517,hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      </head>

      <body
        className={inter.className}
        suppressHydrationWarning
      >
        <Providers recaptchaSiteKey={recaptchaSiteKey}>
          {children}
        </Providers>

        {/* Crisp Chat */}
        <Script
          id="crisp-chat"
          strategy="afterInteractive"
        >
          {`
            window.$crisp = [];
            window.CRISP_WEBSITE_ID = "2a787981-77b3-4a89-99c2-9080319b43a3";
            (function(){
              var d = document;
              var s = d.createElement("script");
              s.src = "https://client.crisp.chat/l.js";
              s.async = 1;
              d.getElementsByTagName("head")[0].appendChild(s);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
