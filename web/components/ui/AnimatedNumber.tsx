'use client';
import { useEffect, useRef, useState } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Eases from the previous value to `target` (ease-out cubic). Instant under reduced motion. */
export function useCountUp(target: number, ms = 450): number {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const shownRef = useRef(target);
  shownRef.current = shown;
  useEffect(() => {
    if (reduced() || ms <= 0) { setShown(target); return; }
    const from = shownRef.current;
    fromRef.current = from;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - p) ** 3;
      setShown(Math.round(from + (target - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** A number that counts smoothly to its new value. Screen readers get the real value immediately. */
export function AnimatedNumber({ value, ms }: { value: number; ms?: number }) {
  const shown = useCountUp(value, ms);
  return (
    <>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
