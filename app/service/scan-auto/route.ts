export const dynamic = "force-dynamic";
// Proxy route: forwards POST /service/scan-auto to the backend FastAPI service
// The backend URL can be configured with the BACKEND_URL env var (defaults to http://localhost:8000)

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log("backendUrl:", backendUrl);
    // Read the incoming body and propagate useful headers
    const body = await req.text();
    const headers: Record<string, string> = {};
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;
    const concurrency = req.headers.get('x-max-concurrent-scans');
    if (concurrency) headers['x-max-concurrent-scans'] = concurrency;

    // Add backend API key header (server-side env) so backend can verify requests
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    console.log("backendKey:", backendKey);
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(`${backendUrl}/scan-auto`, {
      method: 'POST',
      headers,
      body,
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
