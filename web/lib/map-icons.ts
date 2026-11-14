// Map icons drawn on a canvas at runtime: no sprite/glyph server, so the map works offline.
// Shapes match components/ui/StatusIcon (shape = status, colour = urgency).
import type { HelperState } from '@lastmile/contracts';
import { URGENCY_COLOR, type Shape, type Urgency } from './status';

const PX = 2; // pixel ratio
const S = 16; // logical size

type Ctx = CanvasRenderingContext2D;

function drawShape(c: Ctx, shape: Shape, color: string) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.fillStyle = color;
  c.strokeStyle = '#06080b';
  c.lineWidth = 1.4;
  c.beginPath();
  switch (shape) {
    case 'dot': c.arc(8, 8, 4.5, 0, Math.PI * 2); c.fill(); c.stroke(); break;
    case 'ring':
      c.arc(8, 8, 5, 0, Math.PI * 2); c.strokeStyle = '#06080b'; c.lineWidth = 4.5; c.stroke();
      c.strokeStyle = color; c.lineWidth = 2.6; c.stroke(); break;
    case 'triangle': c.moveTo(8, 1.5); c.lineTo(14.8, 13.8); c.lineTo(1.2, 13.8); c.closePath(); c.fill(); c.stroke(); break;
    case 'diamond': c.moveTo(8, 1.2); c.lineTo(14.8, 8); c.lineTo(8, 14.8); c.lineTo(1.2, 8); c.closePath(); c.fill(); c.stroke(); break;
    case 'square': c.roundRect(2.8, 2.8, 10.4, 10.4, 1.5); c.fill(); c.stroke(); break;
    case 'arrow': c.moveTo(1.5, 6.3); c.lineTo(9, 6.3); c.lineTo(9, 2.6); c.lineTo(14.8, 8); c.lineTo(9, 13.4); c.lineTo(9, 9.7); c.lineTo(1.5, 9.7); c.closePath(); c.fill(); c.stroke(); break;
    case 'check':
      c.arc(8, 8, 6.6, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(4.8, 8.2); c.lineTo(7.1, 10.5); c.lineTo(11.3, 5.8); c.strokeStyle = '#06080b'; c.lineWidth = 2; c.stroke(); break;
    case 'cross':
      c.arc(8, 8, 6.6, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(5.4, 5.4); c.lineTo(10.6, 10.6); c.moveTo(10.6, 5.4); c.lineTo(5.4, 10.6); c.strokeStyle = '#ffd7dc'; c.lineWidth = 2; c.stroke(); break;
  }
}

function canvas(size = S): [HTMLCanvasElement, Ctx] {
  const el = document.createElement('canvas');
  el.width = size * PX;
  el.height = size * PX;
  const c = el.getContext('2d')!;
  c.scale(PX, PX);
  return [el, c];
}

const HELPER_COLOR: Record<HelperState['status'], string> = { idle: '#93a1b0', enroute: '#2ee6c5', loaded: '#2ee6c5', done: '#5e6b79' };

function drawHelper(c: Ctx, status: HelperState['status']) {
  const col = HELPER_COLOR[status];
  // rounded "vehicle" tile with a chevron; loaded = filled, enroute = outlined
  c.beginPath();
  c.roundRect(1.5, 1.5, 17, 17, 4);
  c.fillStyle = status === 'loaded' ? col : '#0c1016';
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = col;
  c.stroke();
  c.beginPath();
  c.moveTo(6, 13.5); c.lineTo(10, 6); c.lineTo(14, 13.5); c.lineTo(10, 11.2); c.closePath();
  c.fillStyle = status === 'loaded' ? '#06080b' : col;
  c.fill();
}

export const HOUSEHOLD_SHAPES: Shape[] = ['dot', 'ring', 'triangle', 'diamond', 'square', 'arrow', 'check', 'cross'];
export const URGENCIES = Object.keys(URGENCY_COLOR) as Urgency[];
export const householdIconName = (shape: Shape, u: Urgency) => `hh-${shape}-${u}`;
export const helperIconName = (s: HelperState['status']) => `helper-${s}`;

interface ImageSink {
  hasImage(name: string): boolean;
  addImage(name: string, img: ImageData, opts: { pixelRatio: number }): void;
}

/** Register every icon on a MapLibre map. Idempotent (safe after style reloads). */
export function registerMapIcons(map: ImageSink) {
  for (const shape of HOUSEHOLD_SHAPES) {
    for (const u of URGENCIES) {
      const name = householdIconName(shape, u);
      if (map.hasImage(name)) continue;
      const [el, c] = canvas();
      drawShape(c, shape, URGENCY_COLOR[u]);
      map.addImage(name, c.getImageData(0, 0, el.width, el.height), { pixelRatio: PX });
    }
  }
  for (const s of ['idle', 'enroute', 'loaded', 'done'] as const) {
    const name = helperIconName(s);
    if (map.hasImage(name)) continue;
    const [el, c] = canvas(20);
    drawHelper(c, s);
    map.addImage(name, c.getImageData(0, 0, el.width, el.height), { pixelRatio: PX });
  }
  if (!map.hasImage('safe-zone')) {
    const [el, c] = canvas(22);
    c.beginPath(); c.arc(11, 11, 9.5, 0, Math.PI * 2); c.fillStyle = '#0c1016'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#38bdf8'; c.stroke();
    c.beginPath(); c.moveTo(11, 4.5); c.lineTo(16.5, 7); c.lineTo(16, 12.5); c.quadraticCurveTo(14.5, 16, 11, 17.5); c.quadraticCurveTo(7.5, 16, 6, 12.5); c.lineTo(5.5, 7); c.closePath();
    c.fillStyle = '#38bdf8'; c.fill();
    map.addImage('safe-zone', c.getImageData(0, 0, el.width, el.height), { pixelRatio: PX });
  }
}
