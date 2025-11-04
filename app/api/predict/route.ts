// Proxy route: forwards POST /api/predict to the backend FastAPI service
// The backend URL can be configured with the BACKEND_URL env var (defaults to http://localhost:8000)

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log("backendUrl:", backendUrl);
    
    // Preserve raw body and relevant headers
    const body = await req.text();
    const headers: Record<string, string> = {};
    
    // Preserve Content-Type header
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    
    // Preserve Authorization header (if present)
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    // Attach backend API key from server env so backend only accepts requests with this key
    const backendKey = "3f1c8f4a6f9b51b44d1d7a36de9b32d8a2c1e4ffdcbd84a1";
    
    // Add the X-Backend-Api-Key and Authorization Bearer token
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
      headers['authorization'] = `Bearer ${backendKey}`;  // Ensure the Bearer prefix is added
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
