import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL must be configured for /service/credits/consume');
}
if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be configured for /service/credits/consume');
}
if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY must be configured for /service/credits/consume');
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const anonClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false },
});

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

const getUserId = async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;
  const cookieStore = cookies();
  const accessToken =
    token || cookieStore.get('sb-access-token')?.value || cookieStore.get('supabase-auth-token')?.value;

  if (!accessToken) {
    return { ok: false, status: 401, message: 'Utilisateur invalide' } as const;
  }

  const { data, error } = await anonClient.auth.getUser(accessToken);
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, message: 'Utilisateur invalide' } as const;
  }

  return { ok: true, userId: data.user.id } as const;
};

export async function POST(req: Request) {
  try {
    const userCheck = await getUserId(req);
    if (!userCheck.ok) {
      return NextResponse.json({ error: userCheck.message }, { status: userCheck.status });
    }

    const { amount } = await req.json().catch(() => ({ amount: 0 }));
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount === 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 });
    }

    const userId = userCheck.userId;
    const { data: creditsRows, error: creditsError } = await adminClient
      .from('credits')
      .select('id, total_credits, used_credits, created_at, updated_at')
      .eq('user_id', userId);

    if (creditsError) {
      return NextResponse.json({ error: 'Impossible de charger credits.' }, { status: 500 });
    }

    const creditsRow = pickLatestByDate(creditsRows as CreditsRow[]);
    if (!creditsRow) {
      return NextResponse.json({ error: 'Credits introuvables.' }, { status: 404 });
    }

    const total = Number(creditsRow.total_credits ?? 0);
    const used = Number(creditsRow.used_credits ?? 0);
    if (numericAmount > 0 && total - used < numericAmount) {
      return NextResponse.json({ error: 'Crédits insuffisants.' }, { status: 400 });
    }

    const nextUsed = Math.max(0, used + numericAmount);
    const nowIso = new Date().toISOString();
    const creditsId = creditsRow.id;
    const hasCreditsId = creditsId !== null && creditsId !== undefined;

    const { data: updated, error: updateError } = await adminClient
      .from('credits')
      .update({ used_credits: nextUsed, updated_at: nowIso })
      .eq(hasCreditsId ? 'id' : 'user_id', hasCreditsId ? creditsId : userId)
      .select('total_credits, used_credits')
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: 'Impossible de mettre a jour credits.' }, { status: 500 });
    }

    const newTotal = Number(updated?.total_credits ?? total);
    const newUsed = Number(updated?.used_credits ?? nextUsed);
    const remaining = Math.max(newTotal - newUsed, 0);

    return NextResponse.json(
      {
        credits: {
          total: newTotal,
          used: newUsed,
          remaining,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur route /service/credits/consume:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
