export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function ensureAdmin(authHeader: string | null): Promise<{ ok: boolean; status?: number; message?: string }> {
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, status: 401, message: 'Token manquant' };

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!userRes.ok) return { ok: false, status: 401, message: 'Non authentifié' };

  const user = await userRes.json();
  const userId = user?.id;
  if (!userId) return { ok: false, status: 401, message: 'Utilisateur invalide' };

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const profiles = await profileRes.json();
  if (profiles?.[0]?.role !== 'admin') return { ok: false, status: 403, message: 'Accès refusé' };

  return { ok: true };
}

export async function GET(req: Request) {
  const adminCheck = await ensureAdmin(req.headers.get('authorization'));
  if (!adminCheck.ok) {
    return new Response(JSON.stringify({ error: adminCheck.message }), { status: adminCheck.status });
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?last_seen_at=gte.${encodeURIComponent(fiveMinutesAgo)}&select=id,email,full_name,role,last_seen_at&order=last_seen_at.desc`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return new Response(JSON.stringify({ error: text }), { status: 500 });
  }

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
