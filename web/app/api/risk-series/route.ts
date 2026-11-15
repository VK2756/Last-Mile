import { NextResponse } from 'next/server';
import { dispatchSeries, riskSeries } from '../../../../packages/data/src/risk-series';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const scenarioId = new URL(request.url).searchParams.get('scenarioId')?.trim();
  if (!scenarioId || scenarioId.length > 128) {
    return NextResponse.json({ error: 'scenarioId is required (maximum 128 characters)' }, { status: 400 });
  }
  if (!process.env.TIGER_DATABASE_URL) {
    return NextResponse.json({ scenarioId, points: [], dispatches: [], source: 'not configured' });
  }
  try {
    const [points, dispatches] = await Promise.all([riskSeries(scenarioId), dispatchSeries(scenarioId)]);
    return NextResponse.json({ scenarioId, points, dispatches, source: 'Tiger Data' });
  } catch {
    return NextResponse.json({ error: 'Risk series unavailable' }, { status: 503 });
  }
}
