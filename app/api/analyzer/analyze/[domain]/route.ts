// Route API Next.js qui fait proxy vers le backend FastAPI

export async function GET(
  req: Request,
  { params }: { params: { domain: string } }
) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const domain = params.domain;
    
    // Add backend API key header (server-side env) so backend can verify requests
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const response = await fetch(
      `${backendUrl}/analyzer/analyze/${encodeURIComponent(domain)}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Erreur analyzer:', error);
    return Response.json(
      { error: 'Une erreur est survenue lors de l\'analyse' },
      { status: 500 }
    );
  }
}
