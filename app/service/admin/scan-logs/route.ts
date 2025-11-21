// Proxy GET /service/admin/scan-logs -> backend /admin/scan-logs
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const target = `${backendUrl}/admin/scan-logs${queryString ? `?${queryString}` : ''}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) {
      headers['authorization'] = auth;
    }
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(target, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    const contentType = res.headers.get('content-type');
    if (contentType) {
      responseHeaders['content-type'] = contentType;
    }
    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error('Proxy error /admin/scan-logs:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
