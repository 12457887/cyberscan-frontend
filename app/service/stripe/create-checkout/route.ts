export const dynamic = "force-dynamic";
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(req: Request) {
  try {
    const backendUrl =
      process.env.BACKEND_URL ||
      (process.env.NODE_ENV !== 'production'
        ? 'http://localhost:8000'
        : undefined) ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';

    const body = await req.text();

    // ✅ NEXT 15 : cookies() est async
    const cookieStore = await cookies();

    const accessToken = cookieStore.get('sb-access-token')?.value;
    let csrfToken = cookieStore.get('csrf-token')?.value;
    let shouldSetCsrfCookie = false;

    // Générer CSRF si absent
    if (!csrfToken) {
      csrfToken = randomBytes(32).toString('hex');
      shouldSetCsrfCookie = true;
    }

    // --- HEADERS ---
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-Token': csrfToken,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const backendKey =
      process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    // --- COOKIES À FORWARD ---
    const incomingCookies = req.headers.get('cookie') || '';

    const proxyCookies = [
      `csrf-token=${csrfToken}`,
      accessToken ? `sb-access-token=${accessToken}` : null,
    ]
      .filter(Boolean)
      .join('; ');

    headers['Cookie'] = [proxyCookies, incomingCookies]
      .filter(Boolean)
      .join('; ');

    // --- ROUTING STRIPE ---
    let targetPath = '/stripe/create-checkout';
    let forwardBody = body;

    try {
      const parsed = body ? JSON.parse(body) : null;

      if (parsed?.action === 'sync-subscription') {
        targetPath = '/stripe/sync-subscription';
        delete parsed.action;
        forwardBody = JSON.stringify(parsed);
      } else if (parsed?.action === 'confirm-session') {
        targetPath = '/stripe/confirm-checkout-session';
        delete parsed.action;
        forwardBody = JSON.stringify(parsed);
      } else if (parsed?.action === 'request-refund') {
        targetPath = '/stripe/request-refund';
        delete parsed.action;
        forwardBody = JSON.stringify(parsed);
      }
    } catch {
      // ignore JSON parse errors
    }

    // --- CALL BACKEND ---
    const res = await fetch(`${backendUrl}${targetPath}`, {
      method: 'POST',
      headers,
      body: forwardBody,
    });

    const payload = await res.text();

    const response = new NextResponse(payload, {
      status: res.status,
      headers: {
        'content-type':
          res.headers.get('content-type') || 'application/json',
      },
    });

    // --- SET CSRF COOKIE ---
    if (shouldSetCsrfCookie && csrfToken) {
      response.cookies.set('csrf-token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error('Stripe proxy error', error);
    return new NextResponse(
      JSON.stringify({
        error: 'Impossible de créer la session de paiement.',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
