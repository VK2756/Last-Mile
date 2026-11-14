'use client';
import { memo, useMemo, useState } from 'react';
import type { SimFrame, SimInit } from '@lastmile/contracts';
import { Accessibility, Route, Siren } from 'lucide-react';
import { CountdownChip, EmptyState, Panel, Segmented } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatTti } from '@/lib/format';
import { atRiskRows, type AtRiskRow } from '@/lib/operator';
import { STATUS_META } from '@/lib/status';

const MAX_ROWS = 40;

type Filter = 'all' | 'vulnerable';

/** Dispatcher's queue for the Last Mile run: who the fire reaches next, and who is going to get them. */
export function OperatorPanel({ init, frame, selectedId, onSelect }: { init: SimInit | null; frame: SimFrame | null; selectedId: string | null; onSelect: (id: string) => void }) {
  const [filter, setFilter] = useState<Filter>('vulnerable');
  const rows = useMemo(() => atRiskRows(init, frame, filter === 'vulnerable'), [init, frame, filter]);
  const unassigned = rows.filter((r) => !r.assignment).length;
  return (
    <Panel
      eyebrow="Last Mile · operator"
      title={<span className="tabular">{rows.length} at risk{rows.length ? ` · ${unassigned} unassigned` : ''}</span>}
      actions={<Segmented<Filter> label="Filter households" value={filter} onChange={setFilter} options={[{ value: 'vulnerable', label: 'Vulnerable' }, { value: 'all', label: 'All' }]} />}
      flush
      className="flex flex-col"
      data-testid="operator-panel"
      id="operator-panel"
      tabIndex={-1}
    >
      {!frame ? (
        <ul className="divide-y divide-white/[0.05]" aria-label="Loading at-risk households" data-testid="operator-skeleton">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-2.5 px-4 py-3" aria-hidden>
              <div className="skeleton h-6 w-[5.375rem]" />
              <div className="skeleton h-3.5 flex-1" style={{ maxWidth: `${55 + ((i * 17) % 35)}%` }} />
              <div className="skeleton h-3 w-12" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <EmptyState icon={<Siren aria-hidden className="size-5" />} title={frame ? 'Nobody threatened right now' : 'Waiting for the run'}>
            {frame ? 'Households appear here when the fire model gives them a time to impact.' : 'The queue fills as soon as the first frame arrives.'}
          </EmptyState>
        </div>
      ) : (
        <ol className="max-h-[52vh] min-h-0 divide-y divide-line overflow-y-auto" aria-label="At-risk households, most urgent first">
          {rows.slice(0, MAX_ROWS).map((r) => (
            <Row key={r.household.id} row={r} selected={r.household.id === selectedId} onSelect={onSelect} />
          ))}
          {rows.length > MAX_ROWS && <li className="px-4 py-2 font-mono text-[0.6875rem] text-fg-dim">+{rows.length - MAX_ROWS} more</li>}
        </ol>
      )}
    </Panel>
  );
}

const Row = memo(function Row({ row, selected, onSelect }: { row: AtRiskRow; selected: boolean; onSelect: (id: string) => void }) {
  const { household: h, state, assignment, vulnerable } = row;
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(h.id)}
        aria-current={selected || undefined}
        data-testid="operator-row"
        className={cn('flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none', selected && 'bg-accent/[0.07] shadow-[inset_3px_0_0_var(--color-accent)]')}
      >
        <div className="flex items-center gap-2.5">
          <CountdownChip status={state.status} tti={state.ttiSeconds} className="w-[5.375rem] shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name ?? <span className="font-mono text-fg-muted">{h.id}</span>}<span className="ml-1.5 text-xs text-fg-dim">{h.residents}p</span></span>
          {vulnerable && <Accessibility aria-label="Vulnerable" className="size-3.5 shrink-0 text-warn" />}
          <span className={cn('shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.12em]', assignment ? 'text-accent' : 'text-fg-dim')}>
            {assignment ? STATUS_META[state.status].short : 'No helper'}
          </span>
        </div>
        {selected && assignment && (
          <div className="rounded border border-accent/30 bg-accent/[0.06] px-2.5 py-2" data-testid="operator-reason">
            <div className="mb-0.5 flex items-center gap-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-accent"><Route aria-hidden className="size-3" />Why this helper?</div>
            <p className="text-xs leading-relaxed text-fg">{assignment.reason}</p>
            <p className="tabular mt-1 font-mono text-[0.6875rem] text-fg-muted">ETA {formatTti(assignment.etaSeconds)} · fire in {formatTti(assignment.deadlineSeconds)}</p>
          </div>
        )}
      </button>
    </li>
  );
});
