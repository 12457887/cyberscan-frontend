export const dynamic = "force-dynamic";
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  // throw new Error('SUPABASE_URL must be configured for /service/credits/sync');
}
if (!serviceRoleKey) {
  // throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured for /service/credits/sync');
}
if (!anonKey) {
  // throw new Error('SUPABASE_ANON_KEY must be configured for /service/credits/sync');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const PLAN_CREDITS_LIMITS: Record<string, number> = {
  free: 3,
  basic: 20,
  pro: 50,
  enterprise: 200,
  admin: 200,
};

type SubscriptionRow = {
  credits_limit?: number | null;
  plan_type?: string | null;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  expires_at?: string | null;
};

type CreditsRow = {
  id?: string | number | null;
  total_credits?: number | null;
  used_credits?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const toMs = (value?: string | null) => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

const pickLatestByDate = <T extends { created_at?: string | null; updated_at?: string | null }>(
  rows: T[] | null | undefined
): T | null => {
  if (!rows || rows.length === 0) return null;
  return rows.reduce<T | null>((best, row) => {
    if (!best) return row;
    const bestMs = Math.max(toMs(best.updated_at), toMs(best.created_at));
    const rowMs = Math.max(toMs(row.updated_at), toMs(row.created_at));
    return rowMs >= bestMs ? row : best;
  }, null);
};

const getSubscriptionRank = (row: SubscriptionRow, nowMs: number) => {
  if (row.status === 'active') return 3;
  if (row.status === 'cancelled') {
    const expiresAt = toMs(row.expires_at);
    if (expiresAt > nowMs) return 2;
  }
  return 1;
};

const pickBestSubscription = (rows: SubscriptionRow[] | null | undefined): SubscriptionRow | null => {
  if (!rows || rows.length === 0) return null;
  const nowMs = Date.now();
  return rows.reduce<SubscriptionRow | null>((best, row) => {
    if (!best) return row;
    const bestStatusRank = getSubscriptionRank(best, nowMs);
    const rowStatusRank = getSubscriptionRank(row, nowMs);
    if (rowStatusRank !== bestStatusRank) {
      return rowStatusRank > bestStatusRank ? row : best;
    }
    const bestTime = Math.max(toMs(best.started_at), toMs(best.updated_at), toMs(best.created_at));
    const rowTime = Math.max(toMs(row.started_at), toMs(row.updated_at), toMs(row.created_at));
    return rowTime >= bestTime ? row : best;
  }, null);
};

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

    const { data: subscriptionRows, error: subscriptionError } = await adminClient
      .from('subscriptions')
      .select('credits_limit, plan_type, status, started_at, created_at, updated_at, expires_at')
      .eq('user_id', userId);

    if (subscriptionError) {
      console.error('Erreur lecture abonnement pour credits sync:', subscriptionError);
      return NextResponse.json({ error: 'Impossible de charger abonnement.' }, { status: 500 });
    }

    let subscription = pickBestSubscription(subscriptionRows as SubscriptionRow[]);

    // Nouvel utilisateur OAuth (Google) : aucune subscription → créer le plan free
    if (!subscription) {
      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await adminClient.from('subscriptions').insert({
        user_id: userId,
        plan_type: 'free',
        credits_limit: PLAN_CREDITS_LIMITS['free'],
        status: 'active',
        started_at: nowIso,
        expires_at: expiresIso,
        created_at: nowIso,
        updated_at: nowIso,
      });
      subscription = {
        plan_type: 'free',
        credits_limit: PLAN_CREDITS_LIMITS['free'],
        status: 'active',
        started_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
        expires_at: expiresIso,
      } as SubscriptionRow;
    }

    const planType = subscription?.plan_type ?? null;
    const fallbackLimit =
      planType && typeof PLAN_CREDITS_LIMITS[planType] === 'number'
        ? PLAN_CREDITS_LIMITS[planType]
        : null;
    const creditsLimitValue = subscription?.credits_limit ?? fallbackLimit ?? null;
    const creditsLimit =
      creditsLimitValue !== null && creditsLimitValue !== undefined
        ? Number(creditsLimitValue)
        : NaN;
    const hasValidCreditsLimit = Number.isFinite(creditsLimit) && creditsLimit > 0;

    const { data: creditsRows, error: creditsError } = await adminClient
      .from('credits')
      .select('id, total_credits, used_credits, created_at, updated_at')
      .eq('user_id', userId);

    if (creditsError) {
      console.error('Erreur lecture credits pour sync:', creditsError);
      return NextResponse.json({ error: 'Impossible de charger credits.' }, { status: 500 });
    }

    const creditsRow = pickLatestByDate(creditsRows as CreditsRow[]);
    const nowIso = new Date().toISOString();
    let action = 'noop';
    let total = Number(creditsRow?.total_credits ?? 0);
    let used = Number(creditsRow?.used_credits ?? 0);
    const normalizedTotal = Number.isFinite(total) ? total : 0;
    const normalizedUsed = Number.isFinite(used) ? used : 0;
    const expectedRemaining = Math.max(normalizedTotal - normalizedUsed, 0);

    if (!creditsRow) {
      if (!hasValidCreditsLimit) {
        return NextResponse.json({ error: 'credits_limit invalide' }, { status: 400 });
      }
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
      if (!hasValidCreditsLimit) {
        return NextResponse.json({ error: 'credits_limit invalide' }, { status: 400 });
      }
      const creditsId = creditsRow?.id;
      const hasCreditsId = creditsId !== null && creditsId !== undefined;
      const { data, error } = await adminClient
        .from('credits')
        .update({
          total_credits: creditsLimit,
          used_credits: 0,
          last_reset_at: nowIso,
          updated_at: nowIso,
        })
        .eq(hasCreditsId ? 'id' : 'user_id', hasCreditsId ? creditsId : userId)
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
