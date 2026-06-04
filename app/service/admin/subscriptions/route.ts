export const dynamic = "force-dynamic";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  // throw new Error('SUPABASE_URL doit être configuré pour /service/admin/subscriptions');
}
if (!serviceRoleKey) {
  // throw new Error('SUPABASE_SERVICE_ROLE_KEY est requis pour /service/admin/subscriptions');
}
if (!anonKey) {
  // throw new Error('SUPABASE_ANON_KEY est requis pour /service/admin/subscriptions');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function ensureAdmin(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Token manquant' } as const;
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
    },
  });

  if (!userResponse.ok) {
    return { ok: false, status: 401, message: 'Utilisateur non authentifié' } as const;
  }

  const user = await userResponse.json();
  const userId = user?.id;
  if (!userId) {
    return { ok: false, status: 401, message: 'Utilisateur invalide' } as const;
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('Erreur vérification profil admin:', profileError);
    return { ok: false, status: 500, message: 'Erreur profil' } as const;
  }

  const role = profile?.role;
  if (role !== 'admin') {
    return { ok: false, status: 403, message: 'Accès refusé' } as const;
  }

  return { ok: true } as const;
}

export async function GET(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req.headers.get('authorization'));
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.message }), {
        status: adminCheck.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { data: subscriptions, error: subsError } = await adminClient
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (subsError) {
      console.error('Erreur lecture subscriptions admin:', subsError);
      return new Response(JSON.stringify({ error: 'Impossible de charger les abonnements' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { data: invoices, error: invoicesError } = await adminClient
      .from('invoices')
      .select('id,user_id,plan_type,invoice_id,invoice_pdf_url,hosted_invoice_url,customer_email,created_at')
      .order('created_at', { ascending: false });

    if (invoicesError) {
      console.error('Erreur lecture invoices admin:', invoicesError);
      return new Response(JSON.stringify({ error: 'Impossible de charger les factures' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const userIds = Array.from(
      new Set(
        [
          ...(subscriptions ?? []).map((row) => row.user_id),
          ...(invoices ?? []).map((row) => row.user_id),
        ].filter(Boolean)
      )
    );

    let profiles: Array<{ id: string; email?: string | null; full_name?: string | null }> = [];
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Erreur lecture profiles admin:', profilesError);
        return new Response(JSON.stringify({ error: 'Impossible de charger les profils' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      profiles = profilesData ?? [];
    }

    return new Response(
      JSON.stringify({
        subscriptions: subscriptions ?? [],
        invoices: invoices ?? [],
        profiles,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erreur route /service/admin/subscriptions:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
