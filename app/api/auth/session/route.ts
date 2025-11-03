import { NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';

type Payload = {
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | string;
  session: Session | null;
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

export async function POST(request: Request) {
  let payload: Payload;

  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
  }

  const { event, session } = payload;
  const response = NextResponse.json({ status: 'ok' });

  if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
    const accessExpires = session.expires_at
      ? new Date(session.expires_at * 1000)
      : new Date(Date.now() + 60 * 60 * 1000);
    const refreshExpires = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    response.cookies.set('sb-access-token', session.access_token, {
      ...COOKIE_OPTIONS,
      expires: accessExpires,
    });
    if (session.refresh_token) {
      response.cookies.set('sb-refresh-token', session.refresh_token, {
        ...COOKIE_OPTIONS,
        expires: refreshExpires,
      });
    }
  }

  if (event === 'SIGNED_OUT' || !session) {
    response.cookies.set('sb-access-token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set('sb-refresh-token', '', { ...COOKIE_OPTIONS, maxAge: 0 });
  }

  return response;
}
