import { createClient } from '@supabase/supabase-js';

type PublicStats = {
  totalScans: number;
  totalSites: number;
};

const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Supabase credentials are missing');
  }

  const resolvedKey = serviceRoleKey ?? anonKey;
  if (!resolvedKey) {
    throw new Error('Supabase credentials are missing');
  }

  // Service role is preferred to bypass RLS for aggregate stats; fall back to anon in dev.
  return createClient(supabaseUrl, resolvedKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Primary path: use the dedicated RPC to return aggregate stats.
    const { data, error } = await supabase.rpc('get_public_stats');
    if (!error && data) {
      const payload: PublicStats = {
        totalScans: Number((data as any).total_scans ?? (data as any).totalScans ?? 0),
        totalSites: Number((data as any).total_sites ?? (data as any).totalSites ?? 0),
      };
      return Response.json(payload, {
        headers: { 'Cache-Control': 'public, max-age=120' },
      });
    }

    // Fallback: lightweight counts if the RPC isn't available yet.
    const [scansCount, sampleSites] = await Promise.all([
      supabase.from('scans').select('id', { count: 'exact', head: true }),
      supabase.from('scans').select('site_url, site_name').limit(500),
    ]);

    const uniqueSites =
      sampleSites.data?.reduce((acc, row) => {
        const normalized = (row.site_url || row.site_name || '').trim().toLowerCase();
        if (normalized) acc.add(normalized);
        return acc;
      }, new Set<string>()).size ?? 0;

    const payload: PublicStats = {
      totalScans: scansCount.count ?? 0,
      totalSites: uniqueSites,
    };

    return Response.json(payload, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (err: any) {
    console.error('Failed to load public stats:', err);
    return new Response(
      JSON.stringify({ error: 'Unable to load public statistics at this time.' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
