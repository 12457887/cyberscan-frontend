export const dynamic = "force-dynamic";
// Proxy route: forwards GET /service/scan-report/:scan_id to the backend FastAPI service

export async function GET(
  req: Request,
  context: { params: Promise<{ scan_id: string }> }
) {
  try {
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';
    const backendUrl = rawBackendUrl.startsWith('http')
      ? rawBackendUrl
      : `http://${rawBackendUrl}`;
    const { scan_id } = await context.params;

    const headers: Record<string, string> = {};
    const backendKey =
      process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) headers['x-backend-api-key'] = backendKey;

    const res = await fetch(`${backendUrl}/scan-report/${encodeURIComponent(scan_id)}`, {
      method: 'GET',
      headers,
    });

    const text = await res.text();
    const responseHeaders: Record<string, string> = {};
    const contentType = res.headers.get('content-type');
    if (contentType) responseHeaders['content-type'] = contentType;

    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
