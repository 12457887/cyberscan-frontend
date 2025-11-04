// Proxy route: forwards POST /api/predict to the backend FastAPI service
// The backend URL can be configured with the BACKEND_URL env var (defaults to http://localhost:8000)

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log("backendUrl:", backendUrl);
    // Preserve raw body and relevant headers
    const body = await req.text();
    const headers: Record<string, string> = {};
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;
    // Attach backend API key from server env so backend only accepts requests with this key
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(`${backendUrl}/predict`, {
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
