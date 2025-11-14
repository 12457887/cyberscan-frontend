'use client';

declare global {
  interface Window {
    Stripe?: (key: string) => any;
  }
}

let stripeJsPromise: Promise<(key: string) => any> | null = null;

export const loadStripeJs = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Stripe.js ne peut pas être chargé côté serveur.'));
  }

  if (window.Stripe) {
    return Promise.resolve(window.Stripe);
  }

  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        if (window.Stripe) {
          resolve(window.Stripe);
        } else {
          reject(new Error('Stripe.js est introuvable après le chargement du script.'));
        }
      };
      script.onerror = () => reject(new Error('Impossible de charger Stripe.js.'));
      document.body.appendChild(script);
    });
  }

  return stripeJsPromise;
};
