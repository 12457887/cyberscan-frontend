import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL must be configured for /service/credits/sync');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured for /service/credits/sync');
}
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY must be configured for /service/credits/sync');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

async function getUserId(req: Request) {
  let authHeader = req.headers.get('authorization');
  if (!authHeader) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('sb-access-token')?.value;
    if (accessToken) {
      authHeader = `Bearer ${accessToken}`;
    }
  }

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
    return { ok: false, status: 401, message: 'Utilisateur non authentifie' } as const;
  }

  const user = await userResponse.json();
  const userId = user?.id;
  if (!userId) {
    return { ok: false, status: 401, message: 'Utilisateur invalide' } as const;
  }

  return { ok: true, userId } as const;
}

export async function POST(req: Request) {
  try {
    const userCheck = await getUserId(req);
    if (!userCheck.ok) {
      return NextResponse.json({ error: userCheck.message }, { status: userCheck.status });
    }

    const userId = userCheck.userId;

    const { data: subscription, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('credits_limit')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscriptionError) {
      console.error('Erreur lecture abonnement pour credits sync:', subscriptionError);
      return NextResponse.json({ error: 'Impossible de charger abonnement.' }, { status: 500 });
    }

    const creditsLimit = Number(subscription?.credits_limit ?? 0);
    if (!Number.isFinite(creditsLimit) || creditsLimit <= 0) {
      return NextResponse.json({ error: 'credits_limit invalide' }, { status: 400 });
    }

    const { data: creditsRow, error: creditsError } = await adminClient
      .from('credits')
      .select('total_credits, used_credits')
      .eq('user_id', userId)
      .maybeSingle();

    if (creditsError) {
      console.error('Erreur lecture credits pour sync:', creditsError);
      return NextResponse.json({ error: 'Impossible de charger credits.' }, { status: 500 });
    }

    const nowIso = new Date().toISOString();
    let action = 'noop';
    let total = Number(creditsRow?.total_credits ?? 0);
    let used = Number(creditsRow?.used_credits ?? 0);
    const normalizedTotal = Number.isFinite(total) ? total : 0;
    const normalizedUsed = Number.isFinite(used) ? used : 0;
    const expectedRemaining = Math.max(normalizedTotal - normalizedUsed, 0);

    if (!creditsRow) {
      const { data, error } = await adminClient
        .from('credits')
        .insert({
          user_id: userId,
          total_credits: creditsLimit,
          used_credits: 0,
          last_reset_at: nowIso,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select('total_credits, used_credits')
        .maybeSingle();

      if (error) {
        console.error('Erreur creation credits sync:', error);
        return NextResponse.json({ error: 'Impossible de creer credits.' }, { status: 500 });
      }
      action = 'inserted';
      total = data?.total_credits ?? creditsLimit;
      used = data?.used_credits ?? 0;
    } else if (normalizedTotal <= 0 && normalizedUsed <= 0) {
      const { data, error } = await adminClient
        .from('credits')
        .update({
          total_credits: creditsLimit,
          used_credits: 0,
          last_reset_at: nowIso,
          updated_at: nowIso,
        })
        .eq('user_id', userId)
        .select('total_credits, used_credits')
        .maybeSingle();

      if (error) {
        console.error('Erreur update credits sync:', error);
        return NextResponse.json({ error: 'Impossible de mettre a jour credits.' }, { status: 500 });
      }
      action = 'repaired';
      total = data?.total_credits ?? creditsLimit;
      used = data?.used_credits ?? 0;
    }
    const remaining = Math.max((Number(total) || 0) - (Number(used) || 0), 0);

    return NextResponse.json(
      {
        status: action,
        credits: {
          total,
          used,
          remaining,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur route /service/credits/sync:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
