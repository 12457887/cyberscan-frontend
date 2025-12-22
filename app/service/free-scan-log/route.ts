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

const extractClientIp = (request: Request): string | null => {
  const headerOrder = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'true-client-ip',
    'fastly-client-ip',
  ];
  for (const header of headerOrder) {
    const value = request.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }
  return null;
};

export async function POST(request: Request) {
  try {
    const {
      id,
      url,
      email,
      cms_label,
      risk_level,
      analyzer_domain,
      severity_counts,
      scan_id,
      mongo_report_id,
    } = await request.json();
    const clientIp = extractClientIp(request);

    if (!id && !url) {
      return NextResponse.json({ error: 'url is required when creating a new record.' }, { status: 400 });
    }

    if (id) {
      const { data, error } = await supabase
        .from('free_scans')
        .update({
          email,
          cms_label,
          risk_level,
          analyzer_domain,
          severity_counts,
          scan_id,
          mongo_report_id,
        })
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      return NextResponse.json({ id: data.id });
    }

    const { data, error } = await supabase
      .from('free_scans')
      .insert({
        url,
        email,
        cms_label,
        risk_level,
        analyzer_domain,
        severity_counts,
        ip_address: clientIp,
        scan_id,
        mongo_report_id,
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error('Error logging free scan:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
