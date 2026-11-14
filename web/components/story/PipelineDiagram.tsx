/**
 * Inline-SVG pipeline for /how-it-works. Two layouts from one data list: horizontal (md and up) and
 * vertical (phones), so nothing needs horizontal scrolling. Purely structural: no outcome numbers.
 */
export const PIPELINE = [
  { id: 'fire', n: '01', title: 'Fire model', sub: 'arrival time per 50 m cell', color: '#ff5a1f' },
  { id: 'clock', n: '02', title: 'Risk clock', sub: 'time to impact, every home', color: '#ffb020' },
  { id: 'dispatch', n: '03', title: 'Dispatch', sub: 'match + route, re-plan', color: '#2ee6c5' },
  { id: 'voice', n: '04', title: 'Voice triage', sub: 'Gemini call to needs', color: '#38bdf8' },
  { id: 'proof', n: '05', title: 'Monte Carlo', sub: 'paired seeds, 95% CI', color: '#34d399' },
] as const;

const BOX_W = 168;
const BOX_H = 92;

function Node({ x, y, i }: { x: number; y: number; i: number }) {
  const s = PIPELINE[i]!;
  return (
    <a href={`#${s.id}`} aria-label={`${s.title}: ${s.sub}`}>
      <g transform={`translate(${x} ${y})`} className="pd-node">
        <rect width={BOX_W} height={BOX_H} rx="8" fill="#0c1016" stroke="#2d3a4a" strokeWidth="1.5" />
        <rect width="4" height={BOX_H} rx="2" fill={s.color} />
        <text x="18" y="26" fill="#5e6b79" fontSize="11" fontFamily="ui-monospace, monospace" letterSpacing="1">
          {s.n}
        </text>
        <text x="18" y="52" fill="#e8edf3" fontSize="17" fontWeight="700" fontFamily="Inter, system-ui, sans-serif">
          {s.title}
        </text>
        <text x="18" y="73" fill="#93a1b0" fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">
          {s.sub}
        </text>
      </g>
    </a>
  );
}

const Arrow = ({ d }: { d: string }) => (
  <path d={d} fill="none" stroke="#5e6b79" strokeWidth="1.5" markerEnd="url(#pd-arrow)" className="pd-flow" />
);

const Defs = () => (
  <>
    <style>{`
      .pd-flow { stroke-dasharray: 4 5; animation: pd-march 1.4s linear infinite; }
      @keyframes pd-march { to { stroke-dashoffset: -18; } }
      .pd-node rect:first-child { transition: stroke 150ms; }
      a:hover .pd-node rect:first-child, a:focus-visible .pd-node rect:first-child { stroke: #2ee6c5; }
      @media (prefers-reduced-motion: reduce) { .pd-flow { animation: none; } }
    `}</style>
    <defs>
      <marker id="pd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 Z" fill="#5e6b79" />
      </marker>
    </defs>
  </>
);

export function PipelineDiagram() {
  const gap = 34;
  const W = PIPELINE.length * BOX_W + (PIPELINE.length - 1) * gap + 8;
  return (
    <figure className="m-0">
      {/* horizontal */}
      <svg viewBox={`0 0 ${W} 210`} className="hidden w-full md:block" role="img" aria-labelledby="pd-title-h">
        <title id="pd-title-h">
          Pipeline: fire model feeds the risk clock, which feeds dispatch; voice triage feeds needs into dispatch; the Monte Carlo evaluator runs the whole loop many times
        </title>
        <Defs />
        {PIPELINE.slice(0, 4).map((_, i) => (
          <Node key={i} x={4 + i * (BOX_W + gap)} y={20} i={i} />
        ))}
        {/* fire -> clock -> dispatch */}
        <Arrow d={`M${4 + BOX_W} 66 h${gap - 2}`} />
        <Arrow d={`M${4 + 2 * BOX_W + gap} 66 h${gap - 2}`} />
        {/* voice -> dispatch (needs flow back) */}
        <Arrow d={`M${4 + 3 * (BOX_W + gap)} 66 h-${gap - 2}`} />
        {/* proof box spans below, loop arrow */}
        <Node x={4 + 4 * (BOX_W + gap)} y={20} i={4} />
        <path
          d={`M${4 + 4 * (BOX_W + gap) + BOX_W / 2} ${20 + BOX_H} v44 H${4 + BOX_W / 2} v-40`}
          fill="none"
          stroke="#34d399"
          strokeOpacity="0.7"
          strokeWidth="1.5"
          markerEnd="url(#pd-arrow)"
          className="pd-flow"
        />
        <text x={W / 2} y={188} textAnchor="middle" fill="#34d399" fontSize="11.5" fontFamily="ui-monospace, monospace" letterSpacing="0.5">
          re-run the whole loop: same seed, both policies, many seeds
        </text>
      </svg>
      {/* vertical */}
      <svg viewBox="0 0 260 640" className="mx-auto block w-full max-w-xs md:hidden" role="img" aria-labelledby="pd-title-v">
        <title id="pd-title-v">Pipeline from fire model to risk clock to dispatch, with voice triage feeding dispatch and Monte Carlo re-running the loop</title>
        <Defs />
        {PIPELINE.map((_, i) => (
          <Node key={i} x={46} y={8 + i * 126} i={i} />
        ))}
        {[0, 1, 3].map((i) => (
          <Arrow key={i} d={i === 3 ? `M130 ${8 + 3 * 126} v-${126 - BOX_H - 4}` : `M130 ${8 + i * 126 + BOX_H} v${126 - BOX_H - 4}`} />
        ))}
        <path d={`M${46 + BOX_W} ${8 + 4 * 126 + BOX_H / 2} h28 V${8 + BOX_H / 2} h-26`} fill="none" stroke="#34d399" strokeOpacity="0.7" strokeWidth="1.5" markerEnd="url(#pd-arrow)" className="pd-flow" />
      </svg>
      <figcaption className="mt-3 text-center font-mono text-[0.6875rem] text-fg-muted">Click a stage to jump to its explanation.</figcaption>
    </figure>
  );
}
