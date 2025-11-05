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
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    
    // Ajouter les en-têtes nécessaires pour le backend
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
      // Ajouter Authorization avec Bearer si nécessaire
      if (!auth) {
        headers['Authorization'] = `Bearer ${backendKey}`;  // Si pas de token Authorization existant
      }
    }

    // Optionnel: log des headers de la requête entrante (contrôlé par LOG_HEADERS)
    const logHeaders = (process.env.LOG_HEADERS || 'false').toLowerCase();
    const shouldLog = ['1', 'true', 'yes'].includes(logHeaders);
    const showSensitive = (process.env.SHOW_SENSITIVE_HEADERS || 'false').toLowerCase();
    const showSensitiveEnabled = ['1', 'true', 'yes'].includes(showSensitive);

    if (shouldLog) {
      try {
        const incoming = Object.fromEntries((req as any).headers?.entries?.() ?? []);
        const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-backend-api-key'];
        const masked: Record<string,string|null> = {};
        for (const k of Object.keys(incoming)) {
          const v = incoming[k];
          if (!v) {
            masked[k] = v;
          } else if (sensitive.includes(k.toLowerCase()) && !showSensitiveEnabled) {
            masked[k] = v.length > 20 ? v.slice(0, 20) + '... (masked)' : '***masked***';
          } else {
            masked[k] = v;
          }
        }
        console.log('Predict API incoming headers:', masked);
      } catch (e) {
        console.warn('Could not log incoming headers:', e);
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

    if (shouldLog) {
      try {
        const rh: Record<string,string> = {};
        res.headers.forEach((v, k) => { rh[k] = v; });
        const sensitive = ['authorization', 'cookie', 'set-cookie', 'x-backend-api-key'];
        const maskedResp: Record<string,string|null> = {};
        for (const k of Object.keys(rh)) {
          const v = rh[k];
          if (!v) maskedResp[k] = v;
          else if (sensitive.includes(k.toLowerCase()) && !showSensitiveEnabled) maskedResp[k] = v.length > 20 ? v.slice(0,20) + '... (masked)' : '***masked***';
          else maskedResp[k] = v;
        }
        console.log('Predict API backend response headers:', maskedResp);
      } catch (e) {
        console.warn('Could not log response headers:', e);
      }
    }

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
