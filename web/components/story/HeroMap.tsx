/**
 * Illustrative dispatch-board graphic for the landing hero (inline SVG, no data).
 * It is a drawing, not a simulation frame: no outcome numbers appear in it.
 */
export function HeroMap({ className }: { className?: string }) {
  // households: [x, y, kind]  kind: 0 = ok/self-evacuating, 1 = needs help, 2 = assigned
  const homes: Array<[number, number, 0 | 1 | 2]> = [
    [92, 96, 0], [128, 82, 0], [164, 104, 1], [206, 86, 0], [250, 112, 0], [104, 150, 0], [148, 170, 2],
    [196, 158, 0], [240, 182, 1], [286, 160, 0], [330, 140, 0], [118, 226, 0], [170, 240, 0], [220, 256, 0],
    [268, 236, 2], [318, 222, 0], [362, 200, 0], [300, 290, 0], [352, 276, 0], [394, 256, 0], [86, 296, 0],
  ];
  return (
    <svg viewBox="0 0 480 380" className={className} role="img" aria-labelledby="hero-map-title">
      <title id="hero-map-title">
        Illustration: a fire perimeter spreading east, households marked by need, and a helper route to a safe zone
      </title>
      <style>{`
        @keyframes hm-march { to { stroke-dashoffset: -44; } }
        .hm-march-fire { animation: hm-march 3.2s linear infinite; }
        .hm-march-route { animation: hm-march 1.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .hm-march-fire, .hm-march-route { animation: none; } }
      `}</style>
      <defs>
        <radialGradient id="hm-fire" cx="30%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ff5a1f" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
        </radialGradient>
        <pattern id="hm-grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="#ffffff" strokeOpacity="0.04" />
        </pattern>
      </defs>
      <rect width="480" height="380" rx="10" fill="#0c1016" />
      <rect width="480" height="380" rx="10" fill="url(#hm-grid)" />
      {/* roads */}
      <g stroke="#2d3a4a" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M20 130 C 140 120, 260 140, 460 110" />
        <path d="M30 270 C 160 250, 300 280, 460 240" />
        <path d="M140 20 C 150 140, 120 260, 150 360" />
        <path d="M330 20 C 320 150, 360 250, 340 360" />
      </g>
      {/* fire */}
      <ellipse cx="150" cy="170" rx="190" ry="150" fill="url(#hm-fire)" />
      <path
        d="M58 120 C 70 80, 140 70, 180 96 C 214 118, 226 160, 208 196 C 190 232, 128 250, 88 226 C 50 204, 46 160, 58 120 Z"
        fill="#ff5a1f"
        fillOpacity="0.16"
        stroke="#ff5a1f"
        strokeWidth="2"
        strokeDasharray="6 5"
        className="hm-march-fire"
      />
      {/* route: van -> household -> safe zone */}
      <path
        id="hm-route"
        d="M420 330 C 380 300, 300 300, 268 236 C 250 200, 300 170, 420 70"
        fill="none"
        stroke="#2ee6c5"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
        className="hm-march-route"
      />
      {/* households */}
      {homes.map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {k === 1 ? (
            <path d="M0 -7 L7 6 L-7 6 Z" fill="#ff3b47" />
          ) : k === 2 ? (
            <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#f5b301" stroke="#06080b" strokeWidth="1.5" />
          ) : (
            <circle r="4" fill="#5e6b79" />
          )}
        </g>
      ))}
      {/* van */}
      <g transform="translate(420 330)">
        <circle r="13" fill="#06080b" stroke="#2ee6c5" strokeWidth="2" />
        <path d="M-6 3 V-3 H2 L6 1 V3 Z" fill="#2ee6c5" />
      </g>
      {/* safe zone */}
      <g transform="translate(420 70)">
        <circle r="16" fill="#34d399" fillOpacity="0.12" stroke="#34d399" strokeWidth="2" />
        <path d="M-5 0 L-1 4 L6 -4" stroke="#34d399" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
      {/* call-out */}
      <g transform="translate(282 222)">
        <line x1="0" y1="0" x2="28" y2="-28" stroke="#93a1b0" strokeWidth="1" />
        <rect x="28" y="-62" width="150" height="40" rx="5" fill="#121821" stroke="#2d3a4a" />
        <text x="38" y="-45" fill="#e8edf3" fontSize="10.5" fontFamily="ui-monospace, monospace" fontWeight="700">
          WHEELCHAIR · NO CAR
        </text>
        <text x="38" y="-31" fill="#2ee6c5" fontSize="10" fontFamily="ui-monospace, monospace">
          accessible van assigned
        </text>
      </g>
      <text x="16" y="364" fill="#5e6b79" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="1.5">
        ILLUSTRATION · NOT LIVE DATA
      </text>
    </svg>
  );
}
