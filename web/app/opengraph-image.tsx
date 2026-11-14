import { ImageResponse } from 'next/og';

// Social card for every route (Lane E). Static: no data, no outcome numbers; carries the SIMULATION label.
export const alt = "Last Mile: live evacuation dispatch for people who can't drive out. Simulation with synthetic people.";
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  const dots: Array<[number, number, string]> = [
    [760, 250, '#5e6b79'], [810, 210, '#5e6b79'], [870, 260, '#ff3b47'], [930, 220, '#5e6b79'], [990, 280, '#f5b301'],
    [780, 330, '#5e6b79'], [850, 360, '#5e6b79'], [920, 340, '#ff3b47'], [1000, 370, '#5e6b79'], [1060, 320, '#5e6b79'],
    [800, 430, '#5e6b79'], [880, 450, '#f5b301'], [960, 430, '#5e6b79'], [1040, 460, '#5e6b79'],
  ];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#06080b', color: '#e8edf3', fontFamily: 'sans-serif', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 600, top: 60, width: 560, height: 500, borderRadius: 280, background: 'radial-gradient(circle at 35% 45%, rgba(255,90,31,0.45), rgba(255,90,31,0.08) 55%, rgba(255,90,31,0) 75%)', display: 'flex' }} />
        {dots.map(([x, y, c], i) => (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: 14, height: 14, borderRadius: 7, background: c, display: 'flex' }} />
        ))}
        <div style={{ position: 'absolute', left: 1080, top: 150, width: 40, height: 40, borderRadius: 20, border: '4px solid #34d399', display: 'flex' }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 72px', width: 780 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#ff5a1f', display: 'flex' }} />
            <div style={{ fontSize: 34, fontWeight: 800, display: 'flex' }}>Last Mile</div>
          </div>
          <div style={{ marginTop: 70, fontSize: 60, fontWeight: 800, lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}>
            <span>Live dispatch for</span>
            <span>the people who</span>
            <span style={{ color: '#2ee6c5' }}>can&apos;t drive out.</span>
          </div>
          <div style={{ marginTop: 28, fontSize: 26, color: '#93a1b0', display: 'flex' }}>Predict · Dispatch · Call · Prove</div>
          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', padding: '8px 16px', borderRadius: 8, border: '2px solid rgba(245,179,1,0.6)', background: 'rgba(245,179,1,0.12)', color: '#f5b301', fontSize: 22, fontWeight: 700, letterSpacing: 3 }}>
              SIMULATION
            </div>
            <div style={{ fontSize: 22, color: '#5e6b79', display: 'flex' }}>synthetic people</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
