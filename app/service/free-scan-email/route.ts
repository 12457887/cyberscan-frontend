export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const backendKey = process.env.NEXT_PUBLIC_BACKEND_API_KEY;
    const body = await request.text();

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (backendKey) {
      headers['x-backend-api-key'] = backendKey;
    }

    const response = await fetch(`${backendUrl}/free-scan/send-report`, {
      method: 'POST',
      headers,
      body,
    });

    const responseText = await response.text();
    try {
      const json = responseText ? JSON.parse(responseText) : {};
      return NextResponse.json(json, { status: response.status });
    } catch {
      return new NextResponse(responseText, {
        status: response.status,
        headers: { 'content-type': response.headers.get('content-type') || 'text/plain' },
      });
    }
  } catch (error: any) {
    console.error('Error proxying free scan email:', error);
    return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
  }
}
