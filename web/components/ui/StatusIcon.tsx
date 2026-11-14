import type { HouseholdStatus } from '@lastmile/contracts';
import { STATUS_META, URGENCY_COLOR, urgencyOf, type Shape } from '@/lib/status';

/** SVG path for each status shape, in a 16x16 box. Same shapes as the map icons (lib/map-icons.ts). */
export function ShapeGlyph({ shape, color, size = 14, title }: { shape: Shape; color: string; size?: number; title?: string }) {
  const common = { fill: color, stroke: '#06080b', strokeWidth: 1.25 } as const;
  let body: React.ReactNode;
  switch (shape) {
    case 'dot':
      body = <circle cx="8" cy="8" r="4.5" {...common} />;
      break;
    case 'ring':
      body = <circle cx="8" cy="8" r="5" fill="none" stroke={color} strokeWidth={2.5} />;
      break;
    case 'triangle':
      body = <path d="M8 2 L14.5 13.5 H1.5 Z" {...common} />;
      break;
    case 'diamond':
      body = <path d="M8 1.5 L14.5 8 L8 14.5 L1.5 8 Z" {...common} />;
      break;
    case 'square':
      body = <rect x="3" y="3" width="10" height="10" rx="1.5" {...common} />;
      break;
    case 'arrow':
      body = <path d="M2 6.5 H9 V3 L14.5 8 L9 13 V9.5 H2 Z" {...common} />;
      break;
    case 'check':
      body = (
        <>
          <circle cx="8" cy="8" r="6.5" fill={color} />
          <path d="M4.8 8.2 L7.1 10.5 L11.3 5.8" fill="none" stroke="#06080b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
      break;
    case 'cross':
      body = (
        <>
          <circle cx="8" cy="8" r="6.5" fill={color} />
          <path d="M5.5 5.5 L10.5 10.5 M10.5 5.5 L5.5 10.5" stroke="#ffd7dc" strokeWidth={2} strokeLinecap="round" />
        </>
      );
      break;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {body}
    </svg>
  );
}

/** Household status glyph coloured by urgency, labelled for screen readers. */
export function StatusIcon({ status, tti, size = 14 }: { status: HouseholdStatus; tti: number | null; size?: number }) {
  const meta = STATUS_META[status];
  return <ShapeGlyph shape={meta.shape} color={URGENCY_COLOR[urgencyOf(status, tti)]} size={size} title={meta.label} />;
}
