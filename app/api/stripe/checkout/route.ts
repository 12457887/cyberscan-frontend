import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  try {
    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV !== 'production' ? 'http://localhost:8000' : undefined) ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';
    const body = await req.text();

    const cookieStore = cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    let csrfToken = cookieStore.get('csrf-token')?.value;
    let shouldSetCsrfCookie = false;

    if (!csrfToken) {
      csrfToken = randomBytes(32).toString('hex');
      shouldSetCsrfCookie = true;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': csrfToken,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const incomingCookies = req.headers.get('cookie');
    const csrfCookie = `csrf-token=${csrfToken}`;
    headers['Cookie'] = incomingCookies ? `${csrfCookie}; ${incomingCookies}` : csrfCookie;

    const res = await fetch(`${backendUrl}/stripe/create-checkout`, {
      method: 'POST',
      headers,
      body,
    });

    const payload = await res.text();
    const response = new NextResponse(payload, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
      },
    });

    if (shouldSetCsrfCookie) {
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60, // 1 hour
      });
    }

    return response;
  } catch (error) {
    console.error('Stripe proxy error', error);
    return new Response(JSON.stringify({ error: "Impossible de créer la session de paiement." }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
