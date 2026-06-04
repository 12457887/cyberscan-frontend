export const dynamic = "force-dynamic";
// Proxy GET /service/admin/scan-logs -> backend /admin/scan-logs

export async function GET(req: Request) {
  try {
    const rawBackendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'http://localhost:8000';
    const backendUrl = rawBackendUrl.startsWith('http')
      ? rawBackendUrl
      : `http://${rawBackendUrl}`;
    const url = new URL(req.url);
    const queryString = url.searchParams.toString();
    const target = `${backendUrl}/admin/scan-logs${queryString ? `?${queryString}` : ''}`;

    const headers: Record<string, string> = {};
    const auth = req.headers.get('authorization');
    if (auth) {
      headers['authorization'] = auth;
    }
    const cookie = req.headers.get('cookie');
    if (cookie) {
      headers['cookie'] = cookie;
    }
    const backendKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(target, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        const payload = JSON.parse(text);
        const includeTotal = url.searchParams.get('include_total') === 'true';
        if (includeTotal && typeof payload?.total !== 'number') {
          const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
          const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && serviceRoleKey) {
            const countParams = new URLSearchParams();
            countParams.set('select', 'id');
            countParams.set('limit', '1');
            const userId = url.searchParams.get('user_id');
            if (userId) {
              countParams.set('user_id', `eq.${userId}`);
            }
            const search = url.searchParams.get('search');
            if (search) {
              countParams.set('target_url', `ilike.%${search}%`);
            }
            const countRes = await fetch(
              `${supabaseUrl.replace(/\/$/, '')}/rest/v1/scan_logs?${countParams.toString()}`,
              {
                headers: {
                  apikey: serviceRoleKey,
                  Authorization: `Bearer ${serviceRoleKey}`,
                  Prefer: 'count=exact',
                },
                cache: 'no-store',
              }
            );
            const contentRange = countRes.headers.get('content-range');
            if (contentRange) {
              const totalPart = contentRange.split('/')[1];
              const total = totalPart ? Number(totalPart) : NaN;
              if (!Number.isNaN(total)) {
                payload.total = total;
              }
            }
          }
        }
        return new Response(JSON.stringify(payload), {
          status: res.status,
          headers: { 'content-type': 'application/json' },
        });
      } catch {
        // fall through to raw response
      }
    }
    const responseHeaders: Record<string, string> = {};
    const responseContentType = res.headers.get('content-type');
    if (responseContentType) {
      responseHeaders['content-type'] = responseContentType;
    }
    return new Response(text, { status: res.status, headers: responseHeaders });
  } catch (err) {
    console.error('Proxy error /admin/scan-logs:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
