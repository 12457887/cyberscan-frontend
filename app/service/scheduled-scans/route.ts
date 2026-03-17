import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const rawBackendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:8000';
const backendUrl = rawBackendUrl.startsWith('http')
  ? rawBackendUrl
  : `http://${rawBackendUrl}`;

async function extractAccessToken(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  const cookieStore = await cookies();
  return cookieStore.get('sb-access-token')?.value;
}

export async function GET(req: Request) {
  try {
    const token = await extractAccessToken(req);
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const res = await fetch(`${backendUrl}/scheduled-scans`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const body = await res.text();
    return new NextResponse(body, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('scheduled-scans GET error', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await extractAccessToken(req);
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const body = await req.text();
    const res = await fetch(`${backendUrl}/scheduled-scans`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
    });
    const resBody = await res.text();
    return new NextResponse(resBody, { status: res.status, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('scheduled-scans POST error', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
