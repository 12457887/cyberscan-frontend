export async function POST(req: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log("backendUrl:", backendUrl);
    
    // Préserver le corps brut et les en-têtes pertinents
    const body = await req.text();
    const headers: Record<string, string> = {};
    
    // Préserver l'en-tête Content-Type
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    
    // Préserver l'en-tête Authorization (s'il est présent)
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    // Clé API du backend, à inclure dans les en-têtes
    const backendKey = "3f1c8f4a6f9b51b44d1d7a36de9b32d8a2c1e4ffdcbd84a1";
    
    // Ajouter l'en-tête X-Backend-Api-Key et l'en-tête Authorization avec Bearer
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
      // Si Authorization est déjà présent, il faut soit le conserver, soit le remplacer.
      if (!auth) {
        headers['authorization'] = `Bearer ${backendKey}`;  // Si pas de token existant
      }
    }

    // Effectuer la requête fetch vers le backend FastAPI
    const res = await fetch(`${backendUrl}/predict`, {
      method: 'POST',
      headers,
      body,
    });

    // Traiter la réponse du backend
    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    const resContentType = res.headers.get('content-type');
    if (resContentType) responseHeaders['content-type'] = resContentType;

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    // Gérer les erreurs et retourner une réponse JSON avec le message d'erreur
    console.error('Erreur:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
