import type { ReactNode } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { StatTile, type StatTileProps } from './StatTile';

/**
 * A headline number with a label. Numbers count up smoothly (instant under reduced motion).
 * Never pass a hard-coded outcome: values must come from the engine / Monte Carlo results.
 */
export function Stat({ value, format, ...rest }: Omit<StatTileProps, 'value'> & {
  value: number | ReactNode;
  /** formats a numeric value after counting, e.g. (n) => `${n}%` (counting is skipped when set) */
  format?: (n: number) => ReactNode;
}) {
  const shown = typeof value === 'number' ? (format ? format(value) : <AnimatedNumber value={value} />) : value;
  return <StatTile {...rest} value={shown} />;
}
