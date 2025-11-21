import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL doit être configuré pour /service/admin/credits');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY est requis pour /service/admin/credits');
}
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY est requis pour /service/admin/credits');
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

export async function POST(req: Request) {
  try {
    const adminCheck = await ensureAdmin(req.headers.get('authorization'));
    if (!adminCheck.ok) {
      return new Response(JSON.stringify({ error: adminCheck.message }), {
        status: adminCheck.status,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = await req.json();
    const userId = body?.user_id;
    const amount = Number(body?.amount);

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: 'user_id et amount (>0) sont requis' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const { data: existing, error: fetchCreditsError } = await adminClient
      .from('credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchCreditsError) {
      console.error('Erreur lecture crédits admin:', fetchCreditsError);
      return new Response(JSON.stringify({ error: 'Impossible de charger les crédits' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    let creditsResult;
    if (!existing) {
      const { data, error } = await adminClient
        .from('credits')
        .insert({
          user_id: userId,
          total_credits: amount,
          used_credits: 0,
        })
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Erreur création crédits admin:', error);
        return new Response(JSON.stringify({ error: 'Impossible de créer les crédits' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      creditsResult = data;
    } else {
      const previousTotal = existing.total_credits ?? 0;
      const previousUsed = existing.used_credits ?? 0;
      const previousRemaining = previousTotal - previousUsed;
      const newTotal = previousRemaining + amount;

      const { data, error } = await adminClient
        .from('credits')
        .update({
          total_credits: Math.max(0, newTotal),
          used_credits: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Erreur mise à jour crédits admin:', error);
        return new Response(JSON.stringify({ error: 'Impossible de mettre à jour les crédits' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
      creditsResult = data;
    }

    return new Response(JSON.stringify({ success: true, credits: creditsResult }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error('Erreur route /service/admin/credits:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
