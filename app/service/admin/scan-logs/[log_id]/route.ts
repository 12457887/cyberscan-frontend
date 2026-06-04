export const dynamic = "force-dynamic";
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: Promise<{ log_id: string }> }) {
  try {
    const { log_id } = await params;
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';
    const backendUrl = rawBackendUrl.startsWith('http')
      ? rawBackendUrl
      : `http://${rawBackendUrl}`;
    const target = `${backendUrl}/admin/scan-logs/${log_id}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;
    const cookie = req.headers.get('cookie');
    if (cookie) headers['cookie'] = cookie;
    const backendKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) headers['x-backend-api-key'] = backendKey;

    const res = await fetch(target, { method: 'DELETE', headers, cache: 'no-store' });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
