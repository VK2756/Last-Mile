'use client';
import { useMemo } from 'react';
import type { LatLng, Policy, SimFrame, SimInit } from '@lastmile/contracts';
import { POLICY_LABEL } from '@/lib/status';
import { HouseholdCard } from './HouseholdCard';
import { LiveMap } from './LiveMap';
import { Scoreboard } from './Scoreboard';

export type MapView = { center: [number, number]; zoom: number };

const TESTIDS = {
  left: { map: 'map-left', score: 'scoreboard-left', mapAlias: 'map-alerts', scoreAlias: 'score-alerts' },
  right: { map: 'map-right', score: 'scoreboard-right', mapAlias: 'map-last-mile', scoreAlias: 'score-last-mile' },
} as const;

/** One half of the split screen: map + live scoreboard (carries the policy label) + selected-household card. */
export function MapPane({
  side, policy, init, frame, tiles, selectedId, showCard, onSelect, view, onMove, onPick = null, pendingIgnition = null, winner = false,
}: {
  side: 'left' | 'right';
  policy: Policy;
  init: SimInit | null;
  frame: SimFrame | null;
  tiles: boolean;
  selectedId: string | null;
  showCard: boolean;
  onSelect: (id: string | null) => void;
  view: MapView | null;
  onMove: (v: MapView) => void;
  onPick?: ((p: LatLng) => void) | null;
  pendingIgnition?: LatLng | null;
  /** set from the real final metrics only */
  winner?: boolean;
}) {
  const ids = TESTIDS[side];
  const isLM = policy === 'last_mile';
  const card = useMemo(() => {
    if (!showCard || !selectedId || !init) return null;
    const household = init.households.find((h) => h.id === selectedId);
    if (!household) return null;
    const state = frame?.households.find((h) => h.id === selectedId);
    const assignment = frame?.assignments.find((a) => a.householdIds.includes(selectedId));
    const helper = assignment ? init.helpers.find((p) => p.id === assignment.helperId) : undefined;
    return { household, state, assignment, helper };
  }, [showCard, selectedId, init, frame]);

  return (
    // the alias testid wraps the map so both naming schemes (brief + e2e) resolve
    <div className="relative min-h-0 bg-bg" data-testid={ids.mapAlias}>
      <LiveMap
        className="absolute inset-0" init={init} frame={frame} selectedId={selectedId} onSelect={onSelect}
        tiles={tiles} accent={isLM ? '#2ee6c5' : '#c9a227'} view={view} onMove={onMove} onPick={onPick} pendingIgnition={pendingIgnition}
        data-testid={ids.map} label={`${POLICY_LABEL[policy]} map`}
      />
      <div className="absolute left-3 top-3 w-[min(18.75rem,calc(100%-1.5rem))]" data-testid={ids.scoreAlias}>
        <Scoreboard policy={policy} metrics={frame?.metrics ?? null} compact winner={winner} data-testid={ids.score} />
      </div>
      {card && (
        <div className="absolute bottom-3 left-3 z-10 w-[min(26rem,calc(100%-1.5rem))]">
          <HouseholdCard {...card} onClose={() => onSelect(null)} />
        </div>
      )}
    </div>
  );
}
