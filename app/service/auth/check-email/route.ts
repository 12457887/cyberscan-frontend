export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ exists: false }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ exists: false }, { status: 500 });
    }

    return NextResponse.json({ exists: !!data });
  } catch {
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
