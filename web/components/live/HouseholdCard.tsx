'use client';
import type { Assignment, Household, HouseholdState, Helper } from '@lastmile/contracts';
import { isVulnerable } from '@lastmile/contracts';
import { Phone, Users, Languages, X, Route } from 'lucide-react';
import { Badge, CountdownChip } from '@/components/ui';
import { formatTti } from '@/lib/format';
import { STATUS_META } from '@/lib/status';

const NEED_LABEL: Record<string, string> = {
  no_vehicle: 'No vehicle', wheelchair: 'Wheelchair', oxygen: 'Oxygen', dementia: 'Dementia', vision_impaired: 'Low vision',
  hearing_impaired: 'Hard of hearing', medical_device: 'Medical device', young_children: 'Young children', pets: 'Pets',
  limited_english: 'Limited English', no_cell_signal: 'No cell signal',
};
const LANG: Record<string, string> = { en: 'English', es: 'Spanish', pt: 'Portuguese', zh: 'Chinese', vi: 'Vietnamese', fr: 'French', ht: 'Haitian Creole' };

/** Selected household + "Why this helper?" */
export function HouseholdCard({ household, state, assignment, helper, onClose }: { household: Household; state: HouseholdState | undefined; assignment: Assignment | undefined; helper: Helper | undefined; onClose: () => void }) {
  const status = state?.status ?? 'unaware';
  return (
    <div className="glass-map rounded-xl p-4" data-testid="household-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-dim">Household {household.id}</div>
          <div className="text-base font-semibold">{household.name ?? STATUS_META[status].label}</div>
        </div>
        <div className="flex items-center gap-2">
          <CountdownChip status={status} tti={state?.ttiSeconds ?? null} />
          <button type="button" onClick={onClose} aria-label="Close household" className="rounded p-1 text-fg-muted hover:bg-surface-2 hover:text-fg"><X className="size-4" /></button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {isVulnerable(household) && <Badge tone="warn">Vulnerable</Badge>}
        {household.needs.map((n) => <Badge key={n}>{NEED_LABEL[n] ?? n}</Badge>)}
        {household.landlineOnly && <Badge tone="info">Landline only</Badge>}
      </div>
      <dl className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-fg-muted"><Users aria-hidden className="size-3.5" /><dd>{household.residents} {household.residents === 1 ? 'person' : 'people'}</dd></div>
        <div className="flex items-center gap-1.5 text-fg-muted"><Languages aria-hidden className="size-3.5" /><dd>{LANG[household.language] ?? household.language}</dd></div>
        <div className="flex items-center gap-1.5 text-fg-muted"><Phone aria-hidden className="size-3.5" /><dd>{household.landlineOnly ? 'Landline' : 'Mobile'}</dd></div>
      </dl>
      {assignment ? (
        <div className="rounded-md border border-accent/30 bg-accent/[0.06] p-3" data-testid="why-helper">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-accent"><Route aria-hidden className="size-3.5" />Why this helper?</div>
          <p className="text-sm leading-relaxed">{assignment.reason}</p>
          <div className="tabular mt-2 flex gap-4 font-mono text-xs text-fg-muted">
            <span>Helper <span className="text-fg">{helper?.id ?? assignment.helperId}</span></span>
            <span>ETA <span className="text-fg">{formatTti(assignment.etaSeconds)}</span></span>
            <span>Fire in <span className="text-fg">{formatTti(assignment.deadlineSeconds)}</span></span>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-line bg-surface-2 p-3 text-sm text-fg-muted">
          {status === 'needs_help' ? 'Waiting for a capable helper…' : status === 'evacuated' ? 'Reached a safe zone.' : status === 'trapped' ? 'The fire reached this home before anyone could.' : 'No helper assigned.'}
        </div>
      )}
    </div>
  );
}
