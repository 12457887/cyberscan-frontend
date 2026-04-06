import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 });
    }

    // Calculer redirectUri côté serveur — ne pas faire confiance au client
    const origin =
      request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      process.env.NEXT_PUBLIC_APP_URL;

    if (!origin) {
      return NextResponse.json({ error: 'Cannot determine origin' }, { status: 500 });
    }

    const redirectUri = `${origin}/auth/callback`;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.id_token) {
      console.error('Google token exchange failed:', tokens);
      return NextResponse.json(
        { error: tokens.error_description || 'Failed to get ID token from Google' },
        { status: 400 }
      );
    }

    return NextResponse.json({ idToken: tokens.id_token });
  } catch (error: any) {
    console.error('Google exchange error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
