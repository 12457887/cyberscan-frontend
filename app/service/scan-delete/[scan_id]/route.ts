export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';

const rawBackendUrl =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:8000';
const backendUrl = rawBackendUrl.startsWith('http')
  ? rawBackendUrl
  : `http://${rawBackendUrl}`;

export async function DELETE(
  req: Request,
  context: { params: Promise<{ scan_id: string }> }
) {
  try {
    const { scan_id } = await context.params;
    const authHeader = req.headers.get('Authorization') || '';

    const res = await fetch(`${backendUrl}/scans/${scan_id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('scan-delete error', err);
    return NextResponse.json({ error: 'Erreur suppression scan' }, { status: 500 });
  }
}
