import { NextResponse } from 'next/server';

const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
const ENABLE_RECAPTCHA = process.env.ENABLE_RECAPTCHA === 'true';

if (!ENABLE_RECAPTCHA) {
  console.warn('reCAPTCHA is DISABLED globally');
}

export async function POST(request: Request) {
  try {
    if (!ENABLE_RECAPTCHA || !recaptchaSecret) {
      return NextResponse.json({
        success: true,
        score: 1,
        skipped: true,
      });
    }

    const { token, action } = await request.json();
    const trimmedToken = (token || '').toString().trim();

    if (!trimmedToken) {
      return NextResponse.json(
        { error: 'Token missing.' },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.append('secret', recaptchaSecret);
    params.append('response', trimmedToken);

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

    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      'cyberscan.fr',
      'cyber-scan.cloud',
      'scanner.securas.cloud',
    ];

    if (verification.hostname && !allowedHosts.includes(verification.hostname)) {
      return NextResponse.json(
        {
          error: 'Invalid hostname for reCAPTCHA.',
          hostname: verification.hostname,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, score });
  } catch (error: any) {
    console.error('reCAPTCHA verification error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
