// Proxy route: forwards POST /api/admin/delete-user to the backend FastAPI service
// The backend URL can be configured with the BACKEND_URL env var (defaults to http://localhost:8000)

export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // Lire le body de la requête entrante
    const body = await req.text();
    const headers: Record<string, string> = {};

    // Transférer les bons headers
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;

    // Authentification utilisateur
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    // Ajouter la clé backend (authentifie le proxy côté serveur)
    const backendKey = process.env.BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    // Appel au backend FastAPI
    const res = await fetch(`${backendUrl}/admin/delete-user`, {
      method: 'POST',
      headers,
      body,
    });

    // Renvoyer la réponse telle quelle
    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    const resContentType = res.headers.get('content-type');
    if (resContentType) responseHeaders['content-type'] = resContentType;

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error('Proxy error /admin/delete-user:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
