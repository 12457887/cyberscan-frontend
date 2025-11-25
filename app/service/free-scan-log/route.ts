import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL must be set for /service/free-scan-log');
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set for /service/free-scan-log');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: Request) {
  try {
    const { id, url, email, cms_label, risk_level, analyzer_domain, severity_counts } = await request.json();

    if (!id && !url) {
      return NextResponse.json({ error: 'url is required when creating a new record.' }, { status: 400 });
    }

    if (id) {
      const { data, error } = await supabase
        .from('free_scans')
        .update({ email, cms_label, risk_level, analyzer_domain, severity_counts })
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      return NextResponse.json({ id: data.id });
    }

    const { data, error } = await supabase
      .from('free_scans')
      .insert({ url, email, cms_label, risk_level, analyzer_domain, severity_counts })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error('Error logging free scan:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
