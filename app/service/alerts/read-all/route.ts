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

export async function PATCH(req: Request) {
  try {
    const accessToken = await extractAccessToken(req);
    if (!accessToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const res = await fetch(`${backendUrl}/alerts/read-all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('alerts read-all PATCH error', err);
    return NextResponse.json({ error: 'Erreur mise à jour alertes' }, { status: 500 });
  }
}
