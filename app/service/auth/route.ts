import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for /service/auth');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be defined for /service/auth');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, fullName, phoneNumber } = body || {};

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const profilePayload = {
      id: userId,
      email,
      full_name: fullName || null,
      phone_number: phoneNumber || null,
      role: 'client',
      created_at: now,
      updated_at: now,
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(profilePayload)
      .select('*')
      .single();

    if (profileError) {
      console.error('Bootstrap profile error:', profileError);
      throw profileError;
    }

    const creditsPayload = {
      user_id: userId,
      total_credits: 3,
      used_credits: 0,
      last_reset_at: now,
      created_at: now,
      updated_at: now,
    };

    const { data: creditsRow, error: creditsError } = await supabaseAdmin
      .from('credits')
      .upsert(creditsPayload)
      .select('*')
      .single();

    if (creditsError) {
      console.error('Bootstrap credits error:', creditsError);
      throw creditsError;
    }

    const subscriptionPayload = {
      user_id: userId,
      plan_type: 'free',
      status: 'active',
      credits_limit: 3,
      started_at: now,
      created_at: now,
      updated_at: now,
    };

    const { error: subscriptionError } = await supabaseAdmin
      .from('subscriptions')
      .upsert(subscriptionPayload);

    if (subscriptionError) {
      console.error('Bootstrap subscription error:', subscriptionError);
      throw subscriptionError;
    }

    return NextResponse.json({
      profile,
      credits: {
        total: creditsRow?.total_credits ?? 0,
        used: creditsRow?.used_credits ?? 0,
        remaining:
          creditsRow?.remaining_credits ??
          Math.max((creditsRow?.total_credits ?? 0) - (creditsRow?.used_credits ?? 0), 0),
      },
    });
  } catch (error: any) {
    console.error('Bootstrap user error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unable to bootstrap user.' },
      { status: 500 }
    );
  }
}
