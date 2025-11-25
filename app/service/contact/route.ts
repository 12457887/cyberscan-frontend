import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY ?? '';

if (!recaptchaSecret) {
  console.warn('RECAPTCHA_SECRET_KEY is not set; /service/contact will skip token validation.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const { name, email, message, recaptchaToken } = await request.json();

    const trimmedEmail = (email || '').toString().trim();
    const trimmedMessage = (message || '').toString().trim();
    const trimmedName = (name || '').toString().trim();

    if (!trimmedEmail || !trimmedMessage) {
      return NextResponse.json(
        { error: 'Email and message are required.' },
        { status: 400 }
      );
    }

    // 🔐 Verify reCAPTCHA v3
    if (recaptchaSecret) {
      if (!recaptchaToken) {
        return NextResponse.json(
          { error: 'reCAPTCHA token missing.' },
          { status: 400 }
        );
      }

      const params = new URLSearchParams();
      params.append('secret', recaptchaSecret);
      params.append('response', recaptchaToken);
      params.append('remoteip', request.headers.get('x-forwarded-for') || '');

      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const verification = await verifyRes.json();

      const score = typeof verification.score === 'number' ? verification.score : 0;
      if (
        !verification.success ||
        (verification.action && verification.action !== 'contact_form') ||
        score < 0.4
      ) {
        return NextResponse.json(
          { error: 'reCAPTCHA verification failed.', score, details: verification['error-codes'] },
          { status: 400 }
        );
      }

      // Hostname check
      const allowedHosts = [
        'localhost',
        '127.0.0.1',
        'cyberscan.fr',
        'scanner.securas.cloud',
      ];

      if (verification.hostname && !allowedHosts.includes(verification.hostname)) {
        return NextResponse.json(
          { error: 'Invalid hostname for reCAPTCHA.', hostname: verification.hostname },
          { status: 400 }
        );
      }
    }

    // Save to Supabase
    const { error } = await supabase.from('contact_messages').insert({
      full_name: trimmedName || null,
      email: trimmedEmail,
      message: trimmedMessage,
    });

    if (error) {
      console.error('Error saving contact message:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected contact API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
