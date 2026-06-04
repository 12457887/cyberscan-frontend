export const dynamic = "force-dynamic";
// Proxy GET /service/admin/medianet-dehashed-usage -> backend /admin/medianet-dehashed-usage
export const dynamic = 'force-dynamic';
console.log('🔥 PROXY MEDIANET DEHASHED USAGE HIT');

export async function GET(req: Request) {
  try {
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';
    const backendUrl = rawBackendUrl.startsWith('http')
      ? rawBackendUrl
      : `http://${rawBackendUrl}`;
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const target = `${backendUrl}/admin/medianet-dehashed-usage${queryString ? `?${queryString}` : ''}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) {
      headers['authorization'] = auth;
    }
    const cookie = req.headers.get('cookie');
    if (cookie) {
      headers['cookie'] = cookie;
    }
    const backendKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(target, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(text);
        return new Response(JSON.stringify(payload), {
          status: res.status,
          headers: { 'content-type': 'application/json' },
        });
      } catch {
        // fall through to raw response
      }
    }

    const responseHeaders: Record<string, string> = {};
    const responseContentType = res.headers.get('content-type');
    if (responseContentType) {
      responseHeaders['content-type'] = responseContentType;
    }

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error('Proxy error /admin/medianet-dehashed-usage:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
