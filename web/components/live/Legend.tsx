import { ShapeGlyph } from '@/components/ui';
import { STATUS_META, URGENCY_COLOR, URGENCY_LABEL, type Urgency } from '@/lib/status';
import type { HouseholdStatus } from '@lastmile/contracts';

const STATUSES: HouseholdStatus[] = ['unaware', 'warned', 'needs_help', 'assigned', 'enroute', 'self_evacuating', 'evacuated', 'trapped'];
const URG: Urgency[] = ['calm', 'watch', 'urgent', 'critical'];

/** Shape = what's happening, colour = how much time is left. */
export function Legend() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">Shape · status</div>
        <ul className="space-y-1">
          {STATUSES.map((s) => (
            <li key={s} className="flex items-center gap-2 text-fg-muted">
              <ShapeGlyph shape={STATUS_META[s].shape} color="#c9d3dd" size={12} />
              {STATUS_META[s].label}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-dim">Colour · time to fire</div>
        <ul className="space-y-1">
          {URG.map((u) => (
            <li key={u} className="flex items-center gap-2 text-fg-muted">
              <span className="size-2.5 rounded-sm" style={{ background: URGENCY_COLOR[u] }} />
              {URGENCY_LABEL[u]}
            </li>
          ))}
          <li className="flex items-center gap-2 text-fg-muted"><span className="size-2.5 rounded-sm" style={{ background: URGENCY_COLOR.safe }} />Evacuated</li>
          <li className="flex items-center gap-2 text-fg-muted"><span className="size-2.5 rounded-sm" style={{ background: URGENCY_COLOR.lost }} />Trapped</li>
          <li className="flex items-center gap-2 text-fg-muted"><span className="h-0.5 w-3 bg-accent" />Helper route</li>
          <li className="flex items-center gap-2 text-fg-muted"><span className="size-2.5 rounded-sm bg-fire/60 ring-1 ring-ember" />Fire</li>
        </ul>
      </div>
    </div>
  );
}
