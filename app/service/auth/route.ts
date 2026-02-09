import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { USERNAME_REQUIREMENTS_TEXT, validateUsername } from '@/lib/username';
import { PHONE_REQUIREMENTS_TEXT, validatePhoneNumber } from '@/lib/phone';

const backendUrl =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV !== 'production' ? 'http://localhost:8000' : undefined) ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:8000';
const backendKey = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_BACKEND_API_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL must be defined for /service/auth');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be defined for /service/auth');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function forwardPasswordReset(body: any) {
  if (!body?.email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(`${backendUrl}/auth/send-password-reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: body.email }),
    });

    const payload = await res.json();
    return NextResponse.json(payload, { status: res.status });
  } catch (error: any) {
    console.error('Password reset proxy error:', error);
    return NextResponse.json(
      { error: "Impossible d'envoyer le code de réinitialisation." },
      { status: 500 }
    );
  }
}

async function forwardPasswordChange(body: any) {
  if (!body?.email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const res = await fetch(`${backendUrl}/auth/send-password-change`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: body.email }),
    });

    const payload = await res.json();
    return NextResponse.json(payload, { status: res.status });
  } catch (error: any) {
    console.error('Password change proxy error:', error);
    return NextResponse.json(
      { error: "Impossible d'envoyer le code de confirmation." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.action === 'password-reset') {
      return forwardPasswordReset(body);
    }
    if (body?.action === 'password-change') {
      return forwardPasswordChange(body);
    }
    const { userId, email, fullName, phoneNumber } = body || {};

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    let sanitizedFullName: string | null = null;
    if (fullName) {
      const usernameCheck = validateUsername(fullName);
      if (!usernameCheck.valid) {
        console.warn('[service/auth] Suspicious full name blocked', {
          email,
          userId,
          reason: usernameCheck.reason,
          preview: String(fullName).slice(0, 120),
        });
        const errorMessage =
          usernameCheck.reason === 'suspicious'
            ? "Nom complet invalide : caractères suspects détectés."
            : `Nom complet invalide. ${USERNAME_REQUIREMENTS_TEXT}`;
        return NextResponse.json({ error: errorMessage }, { status: 400 });
      }
      sanitizedFullName = usernameCheck.sanitized;
    }

    let sanitizedPhoneNumber: string | null = null;
    if (phoneNumber) {
      const phoneCheck = validatePhoneNumber(phoneNumber);
      if (!phoneCheck.valid) {
        return NextResponse.json(
          {
            error:
              phoneCheck.reason === 'missing'
                ? 'Le numéro de téléphone est obligatoire.'
                : `Numéro de téléphone invalide. ${PHONE_REQUIREMENTS_TEXT}`,
          },
          { status: 400 }
        );
      }
      sanitizedPhoneNumber = phoneCheck.sanitized;
    }

    const profilePayload = {
      id: userId,
      email,
      full_name: sanitizedFullName || fullName || null,
      phone_number: sanitizedPhoneNumber,
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
