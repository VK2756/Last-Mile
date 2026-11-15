'use client';
// Tile-free, script-free stand-in for the live map: an SVG of the same frame, shown from the very
// first paint until MapLibre is ready (its ~250 kB bundle can take seconds on slow venue wifi).
// Same data, same colours; no basemap. Nothing here is decorative-only: it draws the real frame.
import { memo } from 'react';
import type { SimFrame, SimInit } from '@lastmile/contracts';
import { URGENCY_COLOR, urgencyOf } from '@/lib/status';

const W = 1000;
const H = 625;

/** Equirectangular fit of the households' bbox into the W x H box (lat scaled by cos(lat)). */
export function staticProjection(init: SimInit, w = W, h = H, pad = 0.08) {
  const pts = init.households.length ? init.households.map((x) => x.position) : [init.bounds.sw, init.bounds.ne];
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of pts) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); }
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const s = Math.min((w * (1 - 2 * pad)) / spanX, (h * (1 - 2 * pad)) / spanY);
  const ox = (w - spanX * s) / 2;
  const oy = (h - spanY * s) / 2;
  return (lng: number, lat: number): [number, number] => [ox + (lng - minLng) * k * s, h - (oy + (lat - minLat) * s)];
}

export const StaticMap = memo(function StaticMap({ init, frame, accent }: { init: SimInit | null; frame: SimFrame | null; accent: string }) {
  if (!init) return null;
  const P = staticProjection(init);
  const states = new Map((frame?.households ?? []).map((s) => [s.id, s]));
  const path = (pts: Array<[number, number]>) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" aria-hidden="true" data-testid="static-map">
      {frame?.fire.rings.map((r, i) => (
        <path key={i} d={path(r.map(([lng, lat]) => P(lng, lat))) + 'Z'} fill="#ff5a1f" fillOpacity={0.22} stroke="#ffc04d" strokeWidth={2} />
      ))}
      {frame?.assignments.map((a) => (
        <path key={a.id} d={path(a.route.map((p) => P(p.lng, p.lat)))} fill="none" stroke={accent} strokeWidth={2.5} strokeDasharray="3 4" />
      ))}
      {init.safeZones.map((z) => { const [x, y] = P(z.position.lng, z.position.lat); return <rect key={z.id} x={x - 6} y={y - 6} width={12} height={12} rx={2} fill="#38bdf8" />; })}
      {init.households.map((h) => {
        const st = states.get(h.id);
        const [x, y] = P(h.position.lng, h.position.lat);
        return <circle key={h.id} cx={x} cy={y} r={4} fill={URGENCY_COLOR[urgencyOf(st?.status ?? 'unaware', st?.ttiSeconds ?? null)]} />;
      })}
      {frame?.helpers.map((p) => { const [x, y] = P(p.position.lng, p.position.lat); return <circle key={p.id} cx={x} cy={y} r={5} fill="#e8edf3" stroke="#06080b" strokeWidth={1.5} />; })}
    </svg>
  );
});
