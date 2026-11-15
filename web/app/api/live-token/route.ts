import { NextRequest, NextResponse } from 'next/server';
import { createLiveToken } from '@lastmile/ai';

export const runtime = 'nodejs';
const attempts = new Map<string, { count: number; until: number }>();

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  const prior = attempts.get(ip);
  const window = !prior || prior.until < now ? { count: 0, until: now + 60_000 } : prior;
  window.count++;
  attempts.set(ip, window);
  if (attempts.size > 2000) for (const [key, value] of attempts) if (value.until < now) attempts.delete(key);
  if (window.count > 6) return NextResponse.json({ error: 'Too many Live sessions' }, { status: 429 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: 'Live voice is not configured' }, { status: 503 });
  try {
    const token = await createLiveToken();
    if (!token) return NextResponse.json({ error: 'Live voice is not configured' }, { status: 503 });
    return NextResponse.json(token, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Live voice is unavailable' }, { status: 503 });
  }
}
