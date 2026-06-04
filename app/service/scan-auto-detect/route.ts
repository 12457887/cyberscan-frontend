export const dynamic = "force-dynamic";
// Proxy route: forwards POST /service/scan-auto to the backend FastAPI service
// The backend URL can be configured with the BACKEND_URL env var (defaults to http://localhost:8000)

// Proxy route: forwards POST /service/scan-auto-detect to the backend FastAPI service
// The backend URL can be configured with BACKEND_URL (defaults to http://localhost:8000)

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // On lit le corps de la requête et on propage les bons headers
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
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    // 🔹 Changement ici : on appelle l’endpoint FastAPI /scan-auto-detect
    const res = await fetch(`${backendUrl}/scan-auto-detect`, {
      method: 'POST',
      headers,
      body,
    });

    // On relit la réponse pour la renvoyer telle quelle au frontend
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
