export const dynamic = "force-dynamic";
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

export async function DELETE(
  req: Request,
  context: { params: Promise<{ alert_id: string }> }
) {
  try {
    const { alert_id } = await context.params;
    const accessToken = await extractAccessToken(req);
    if (!accessToken) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const res = await fetch(`${backendUrl}/alerts/${alert_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('alerts DELETE error', err);
    return NextResponse.json({ error: 'Erreur suppression alerte' }, { status: 500 });
  }
}
