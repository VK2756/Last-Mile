'use client';
import type { ReactNode } from 'react';
import { Crosshair, Dices, Flame, Wind } from 'lucide-react';
import { Button, Kbd, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Preset } from '@/lib/presets';
import type { BaseConfig } from '@/lib/scenario';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const compass = (deg: number) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;

/** Draft scenario editor. Changes apply on Run (both sides get the same config). */
export function ScenarioPicker({
  draft, onChange, presets, presetSource, activePresetId, onPreset, onRandomize, picking, onTogglePick, dirty,
}: {
  draft: BaseConfig;
  onChange: (next: BaseConfig) => void;
  presets: Preset[];
  presetSource: 'engine' | 'local';
  activePresetId: string | null;
  onPreset: (p: Preset) => void;
  onRandomize: () => void;
  picking: boolean;
  onTogglePick: () => void;
  dirty: boolean;
}) {
  return (
    <Panel
      eyebrow={<>Scenario{presetSource === 'local' && <span className="ml-1 normal-case tracking-normal text-fg-dim">· built-in presets</span>}</>}
      title={dirty ? <span className="text-warn">Edited: press Run to apply</span> : 'Running this scenario'}
      data-testid="scenario-picker"
    >
      <div className="mb-3 grid grid-cols-3 gap-1.5" role="group" aria-label="Presets">
        {presets.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPreset(p)}
            title={p.description}
            aria-pressed={activePresetId === p.id}
            data-testid={`preset-${i + 1}`}
            className={cn(
              'flex min-h-14 flex-col items-start gap-1 rounded-md border px-2 py-1.5 text-left text-xs font-semibold leading-tight transition-colors',
              activePresetId === p.id ? 'border-accent/60 bg-accent/[0.08] text-fg' : 'border-line bg-surface-2 text-fg-muted hover:border-line-strong hover:text-fg',
            )}
          >
            <Kbd>{i + 1}</Kbd>
            {p.name}
          </button>
        ))}
      </div>

      <div className="space-y-3" data-dev-only>
        <Slider
          label={<><Wind aria-hidden className="size-3.5" />Wind</>}
          value={draft.wind.speedMph} min={0} max={40} step={1} unit="mph"
          onChange={(v) => onChange({ ...draft, wind: { ...draft.wind, speedMph: v } })}
        />
        <Slider
          label={<>Direction</>}
          value={draft.wind.dirDeg} min={0} max={355} step={5} unit={`° ${compass(draft.wind.dirDeg)}`}
          onChange={(v) => onChange({ ...draft, wind: { ...draft.wind, dirDeg: v } })}
        />
        <Slider
          label={<>Helpers</>}
          value={draft.helperCount} min={0} max={60} step={1}
          onChange={(v) => onChange({ ...draft, helperCount: v })}
        />
        <div className="flex items-center gap-2">
          <label className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-fg-muted" htmlFor="seed-input">Seed</label>
          <input
            id="seed-input"
            type="number"
            inputMode="numeric"
            value={draft.seed}
            onChange={(e) => { const v = Math.trunc(Number(e.target.value)); if (Number.isFinite(v)) onChange({ ...draft, seed: v }); }}
            className="tabular h-8 w-full rounded border border-line bg-surface-2 px-2 font-mono text-sm text-fg focus:border-accent/60 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-fg-muted"><Flame aria-hidden className="size-3.5" />Ignition</span>
          <span className="tabular min-w-0 flex-1 truncate font-mono text-[11px] text-fg-muted">{draft.ignition.lat.toFixed(4)}, {draft.ignition.lng.toFixed(4)}</span>
          <Button size="sm" variant={picking ? 'primary' : 'secondary'} onClick={onTogglePick} aria-pressed={picking} data-testid="pick-ignition">
            <Crosshair aria-hidden className="size-3.5" />{picking ? 'Click a map' : 'Set on map'}
          </Button>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="ghost" onClick={onRandomize} data-testid="randomize">
          <Dices aria-hidden className="size-3.5" /> Randomize
        </Button>
      </div>
    </Panel>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: ReactNode; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="flex w-24 shrink-0 items-center gap-1.5 text-xs font-semibold text-fg-muted">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1.5 w-full cursor-pointer accent-[var(--color-accent)]" />
      <span className="tabular w-20 shrink-0 text-right font-mono text-xs text-fg">{value}{unit ? ` ${unit}` : ''}</span>
    </label>
  );
}
