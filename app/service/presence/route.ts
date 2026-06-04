export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // Verify the user token
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: anonKey },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }
  const user = await userRes.json();
  const userId = user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Invalid user' }), { status: 401 });
  }

  // Update last_seen_at using service role key (bypasses RLS)
  const updateRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ last_seen_at: new Date().toISOString() }),
    }
  );

  if (!updateRes.ok) {
    const text = await updateRes.text();
    console.error('[presence] update failed:', updateRes.status, text);
    return new Response(JSON.stringify({ error: 'Update failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
