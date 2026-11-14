// OWNER: Lane A. Local equirectangular projection helpers (meters east/north of an origin).
import type { LatLng } from '@lastmile/contracts';

export const M_PER_DEG_LAT = 111_320;
export const mPerDegLng = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

export function toXY(p: LatLng, origin: LatLng): { x: number; y: number } {
  return { x: (p.lng - origin.lng) * mPerDegLng(origin.lat), y: (p.lat - origin.lat) * M_PER_DEG_LAT };
}
export function fromXY(x: number, y: number, origin: LatLng): LatLng {
  return { lat: origin.lat + y / M_PER_DEG_LAT, lng: origin.lng + x / mPerDegLng(origin.lat) };
}
export function distMeters(a: LatLng, b: LatLng): number {
  return Math.hypot((a.lat - b.lat) * M_PER_DEG_LAT, (a.lng - b.lng) * mPerDegLng((a.lat + b.lat) / 2));
}
