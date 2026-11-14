import { NextRequest, NextResponse } from 'next/server';
import { TriageRequest } from '@lastmile/contracts';
import { triage } from '@lastmile/ai';

const windows = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 20;

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const prior = windows.get(ip);
  const current = !prior || prior.until < now ? { count: 0, until: now + WINDOW_MS } : prior;
  current.count += 1;
  windows.set(ip, current);
  if (windows.size > 2000) for (const [key, value] of windows) if (value.until < now) windows.delete(key);
  if (current.count > LIMIT) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = TriageRequest.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid triage request' }, { status: 400 });
  try { return NextResponse.json(await triage(parsed.data)); }
  catch (error) {
    console.error('[triage] request failed', error);
    return NextResponse.json({ error: 'Triage unavailable' }, { status: 503 });
  }
}
