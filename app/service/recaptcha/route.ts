import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY || '';

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL must be set for /service/recaptcha');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for /service/recaptcha');
}

if (!recaptchaSecret) {
  throw new Error('RECAPTCHA_SECRET_KEY must be set for /service/recaptcha');
}

createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const { token, action } = await request.json();
    const trimmedToken = (token || '').toString().trim();

    if (!trimmedToken) {
      return NextResponse.json({ error: 'Token missing.' }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.append('secret', recaptchaSecret);
    params.append('response', trimmedToken);
    params.append('remoteip', request.headers.get('x-forwarded-for') || '');

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const verification = await res.json();
    const score = typeof verification.score === 'number' ? verification.score : 0;

    if (
      !verification.success ||
      (verification.action && action && verification.action !== action) ||
      score < 0.4
    ) {
      return NextResponse.json(
        {
          error: 'reCAPTCHA verification failed.',
          score,
          details: verification['error-codes'],
        },
        { status: 400 }
      );
    }

    const allowedHosts = ['localhost', '127.0.0.1', 'cyberscan.fr', 'cyber-scan.cloud'];
    if (verification.hostname && !allowedHosts.includes(verification.hostname)) {
      return NextResponse.json(
        { error: 'Invalid hostname for reCAPTCHA.', hostname: verification.hostname },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, score });
  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
