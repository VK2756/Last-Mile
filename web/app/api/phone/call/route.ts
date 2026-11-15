import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const service = process.env.PHONE_SERVICE_URL;
  const secret = process.env.PHONE_SHARED_SECRET;
  if (process.env.NEXT_PUBLIC_PHONE_DEMO !== '1' || !service || !secret) return NextResponse.json({ error: 'Phone demo is unavailable.' }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const value = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (typeof value.to !== 'string' || !/^\+[1-9]\d{7,14}$/.test(value.to)) return NextResponse.json({ error: 'Enter a number in international format, such as +1…' }, { status: 400 });
  try {
    const response = await fetch(service.replace(/\/$/, '') + '/call', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-phone-secret': secret },
      body: JSON.stringify({ to: value.to, scenarioId: value.scenarioId, householdId: value.householdId, language: value.language }),
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? 'This number is not registered for this demo.' : response.status === 429 ? 'This number has reached the demo call limit or has an active call.' : 'Could not start the demo call.' }, { status: response.status });
    const result = await response.json() as { sid?: string; status?: string };
    return NextResponse.json({ sid: result.sid, status: result.status }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Phone service is unavailable.' }, { status: 502 }); }
}
