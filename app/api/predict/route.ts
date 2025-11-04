export async function POST(req: Request) {
  try {
    // URL du backend (peut être configurée dans les variables d'environnement)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    console.log("backendUrl:", backendUrl);
    
    // Récupérer le corps brut de la requête
    const body = await req.text();
    const headers: Record<string, string> = {};

    // Préserver l'en-tête Content-Type
    const contentType = req.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    
    // Préserver l'en-tête Authorization (si présent)
    const auth = req.headers.get('authorization');
    if (auth) headers['authorization'] = auth;

    // Clé API à inclure dans les en-têtes (elle peut être définie dans un fichier d'environnement)
    const backendKey = "3f1c8f4a6f9b51b44d1d7a36de9b32d8a2c1e4ffdcbd84a1";
    
    // Ajouter les en-têtes nécessaires pour le backend
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
      // Ajouter Authorization avec Bearer si nécessaire
      if (!auth) {
        headers['authorization'] = `Bearer ${backendKey}`;  // Si pas de token Authorization existant
      }
    }

    // Effectuer la requête vers le backend FastAPI avec la méthode POST
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
    // Gérer les erreurs
    console.error('Erreur:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
