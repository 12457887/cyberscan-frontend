export const dynamic = "force-dynamic";
// Proxy route: forwards POST /service/scan-network to the backend FastAPI service

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    const body = await req.text();
    const headers: Record<string, string> = {};
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(`${backendUrl}/scan-network`, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(290_000),
    });

    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    const resContentType = res.headers.get('content-type');
    if (resContentType) responseHeaders['content-type'] = resContentType;

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
