import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const backendUrl =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV !== 'production' ? 'http://localhost:8000' : undefined) ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:8000';

function buildHeaders(token: string | undefined, csrfToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const backendKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
  if (backendKey) {
    headers['x-backend-api-key'] = backendKey;
  }
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

function extractAccessToken(req: Request): string | undefined {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookieStore = cookies();
  return cookieStore.get('sb-access-token')?.value;
}

export async function GET(req: Request) {
  try {
    const accessToken = extractAccessToken(req);
    if (!accessToken) {
      return new NextResponse(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    const res = await fetch(`${backendUrl}/refund-requests`, {
      headers: buildHeaders(accessToken),
      cache: 'no-store',
    });
    const payload = await res.text();
    return new NextResponse(payload, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.error('refund-requests GET error', error);
    return new NextResponse(JSON.stringify({ error: 'Impossible de récupérer les demandes.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId, decision, note } = body || {};
    if (!requestId || !decision) {
      return new NextResponse(JSON.stringify({ error: 'requestId et decision sont requis.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const cookieStore = cookies();
    const accessToken = extractAccessToken(req);
    let csrfToken = cookieStore.get('csrf-token')?.value;
    let shouldSetCsrf = false;

    if (!accessToken) {
      return new NextResponse(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (!csrfToken) {
      csrfToken = randomBytes(32).toString('hex');
      shouldSetCsrf = true;
    }

    const headers = buildHeaders(accessToken, csrfToken);
    headers['Cookie'] = `csrf-token=${csrfToken}; sb-access-token=${accessToken}`;

    const res = await fetch(`${backendUrl}/refund-requests/${requestId}/decision`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision, note }),
    });

    const payload = await res.text();
    const response = new NextResponse(payload, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });

    if (shouldSetCsrf && csrfToken) {
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
    console.error('refund-requests POST error', error);
    return new NextResponse(JSON.stringify({ error: 'Impossible de traiter la décision.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
