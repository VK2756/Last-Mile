'use client';
// One live map. GeoJSON layers only (no per-household DOM markers) so 600+ points stay at 60fps.
// Basemap: CARTO dark raster tiles over a background + grid that still looks right when tiles
// fail to load (flaky venue wifi), or when ?tiles=0 forces the offline style.
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import type { LatLng, SimFrame, SimInit } from '@lastmile/contracts';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/cn';
import { EMPTY_FC, fireFC, gridFC, helpersFC, householdsFC, ignitionFC, routesFC, safeZonesFC, type FC } from '@/lib/geo';
import { registerMapIcons } from '@/lib/map-icons';

export interface LiveMapProps {
  init: SimInit | null;
  frame: SimFrame | null;
  selectedId?: string | null;
  onSelect?: (householdId: string | null) => void;
  /** false = never request tiles (offline style) */
  tiles?: boolean;
  /** route colour (teal for Last Mile) */
  accent?: string;
  className?: string;
  'data-testid'?: string;
  /** other maps to mirror camera with (split screen) */
  onMove?: (view: { center: [number, number]; zoom: number }) => void;
  view?: { center: [number, number]; zoom: number } | null;
  label?: string;
  /** when set, a map click picks a point (e.g. the ignition) instead of selecting a household */
  onPick?: ((p: LatLng) => void) | null;
  /** draft ignition to preview instead of the running scenario's */
  pendingIgnition?: LatLng | null;
}

const TILE_ATTRIB = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>';

function baseStyle(tiles: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {
      grid: { type: 'geojson', data: EMPTY_FC },
      ...(tiles
        ? {
            carto: {
              type: 'raster',
              tiles: ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png`),
              tileSize: 256,
              attribution: TILE_ATTRIB,
              maxzoom: 19,
            },
          }
        : {}),
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#080b10' } },
      { id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#1a2330', 'line-width': 1 } },
      ...(tiles ? [{ id: 'carto', type: 'raster' as const, source: 'carto', paint: { 'raster-opacity': 0.92, 'raster-saturation': -0.4, 'raster-contrast': 0.08 } }] : []),
    ],
  };
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function LiveMap({ init, frame, selectedId = null, onSelect, tiles = true, accent = '#2ee6c5', className, label, onMove, view, onPick = null, pendingIgnition = null, ...rest }: LiveMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const syncing = useRef(false);

  // ---- create the map once ----
  useEffect(() => {
    let disposed = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (disposed || !el.current) return;
      const map = new maplibre.Map({
        container: el.current,
        style: baseStyle(tiles),
        center: [-72.52, 42.372],
        zoom: 13.4,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        fadeDuration: 0,
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
      mapRef.current = map;
      // keep the canvas sized to its box (layout settles after mount; split screen resizes)
      ro = new ResizeObserver(() => map.resize());
      ro.observe(el.current);
      map.on('error', (e) => {
        // tile failures are expected offline; the grid basemap stays visible underneath
        const msg = String((e as { error?: { message?: string } }).error?.message ?? '');
        if (!/tile|cartocdn|Failed to fetch|NetworkError/i.test(msg)) console.warn('[map]', msg);
      });
      map.on('load', () => {
        if (disposed) return;
        registerMapIcons(map);
        const add = (id: string) => map.addSource(id, { type: 'geojson', data: EMPTY_FC });
        ['fire', 'routes', 'zones', 'ignition', 'households', 'helpers'].forEach(add);

        map.addLayer({ id: 'fire-fill', type: 'fill', source: 'fire', paint: { 'fill-color': '#ff5a1f', 'fill-opacity': 0.26 } });
        map.addLayer({ id: 'fire-glow', type: 'line', source: 'fire', paint: { 'line-color': '#ff5a1f', 'line-width': 14, 'line-blur': 12, 'line-opacity': 0.55 } });
        map.addLayer({ id: 'fire-edge', type: 'line', source: 'fire', paint: { 'line-color': '#ffb020', 'line-width': 2 } });

        map.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#06080b', 'line-width': ['case', ['get', 'selected'], 7, 5], 'line-opacity': 0.8 } });
        map.addLayer({ id: 'routes', type: 'line', source: 'routes', layout: { 'line-cap': 'butt', 'line-join': 'round' }, paint: { 'line-color': accent, 'line-width': ['case', ['get', 'selected'], 4, 2.5], 'line-dasharray': [0, 4, 3] } });

        map.addLayer({ id: 'zones', type: 'symbol', source: 'zones', layout: { 'icon-image': 'safe-zone', 'icon-allow-overlap': true, 'icon-size': 1.1 } });
        map.addLayer({ id: 'ignition', type: 'circle', source: 'ignition', paint: { 'circle-radius': 5, 'circle-color': '#ff5a1f', 'circle-stroke-color': '#ffd2b8', 'circle-stroke-width': 2 } });

        map.addLayer({ id: 'hh-halo', type: 'circle', source: 'households', filter: ['==', ['get', 'selected'], true], paint: { 'circle-radius': 15, 'circle-color': 'rgba(255,255,255,0.08)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
        map.addLayer({
          id: 'households', type: 'symbol', source: 'households',
          layout: {
            'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true,
            'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 14, 0.95, 17, 1.4],
            'symbol-sort-key': ['get', 'rank'],
          },
        });
        map.addLayer({
          id: 'helpers', type: 'symbol', source: 'helpers',
          layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 15, 1.05] },
        });

        map.on('click', 'households', (e) => {
          if (onPickRef.current) return;
          const id = e.features?.[0]?.properties?.id;
          if (typeof id === 'string') onSelectRef.current?.(id);
        });
        map.on('click', (e) => {
          if (onPickRef.current) { onPickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }); return; }
          if (!map.queryRenderedFeatures(e.point, { layers: ['households'] }).length) onSelectRef.current?.(null);
        });
        map.on('mouseenter', 'households', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'households', () => { map.getCanvas().style.cursor = ''; });
        map.on('moveend', () => {
          if (syncing.current) { syncing.current = false; return; }
          const c = map.getCenter();
          onMoveRef.current?.({ center: [c.lng, c.lat], zoom: map.getZoom() });
        });

        // marching-ants routes (skipped for reduced motion)
        if (!prefersReducedMotion()) {
          // standard MapLibre "animated line" dash sequence
          const seq: number[][] = [
            [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
            [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
          ];
          let step = 0;
          let last = 0;
          const tick = (ts: number) => {
            if (disposed) return;
            if (ts - last > 60) {
              last = ts;
              step = (step + 1) % seq.length;
              if (map.getLayer('routes')) map.setPaintProperty('routes', 'line-dasharray', seq[step]!);
            }
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
        setReady(true);
      });
    })();
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [tiles, accent]);

  const setData = (id: string, data: FC) => (mapRef.current?.getSource(id) as GeoJSONSource | undefined)?.setData(data);

  // ---- static layers + camera when a new scenario starts ----
  const initId = init?.scenarioId;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !init) return;
    setData('grid', gridFC(init));
    setData('zones', safeZonesFC(init));
    if (!pendingIgnition) setData('ignition', ignitionFC(init));
    // frame the people, not the whole simulation grid (engine bounds include empty margin)
    let { sw, ne } = init.bounds;
    if (init.households.length) {
      const lats = init.households.map((h) => h.position.lat);
      const lngs = init.households.map((h) => h.position.lng);
      sw = { lat: Math.min(...lats), lng: Math.min(...lngs) };
      ne = { lat: Math.max(...lats), lng: Math.max(...lngs) };
    }
    if (!view) map.fitBounds([[sw.lng, sw.lat], [ne.lng, ne.lat]], { padding: { top: 160, bottom: 40, left: 40, right: 40 }, duration: 0, maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initId]);

  // ---- draft ignition preview + crosshair while picking ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getCanvas().style.cursor = onPick ? 'crosshair' : '';
    if (pendingIgnition) setData('ignition', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [pendingIgnition.lng, pendingIgnition.lat] } }] });
    else if (init) setData('ignition', ignitionFC(init));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onPick, pendingIgnition?.lat, pendingIgnition?.lng, initId]);

  // ---- dynamic layers every frame ----
  useEffect(() => {
    if (!ready || !init) return;
    setData('fire', fireFC(frame));
    setData('routes', routesFC(frame, selectedId));
    setData('helpers', helpersFC(frame));
    setData('households', householdsFC(init, frame, selectedId));
  }, [ready, init, frame, selectedId]);

  // ---- fly to the selected household ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !init || !selectedId) return;
    const h = init.households.find((x) => x.id === selectedId);
    if (h) map.easeTo({ center: [h.position.lng, h.position.lat], zoom: Math.max(map.getZoom(), 15), duration: prefersReducedMotion() ? 0 : 700 });
  }, [ready, init, selectedId]);

  // ---- mirror camera from a sibling map ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !view) return;
    const c = map.getCenter();
    if (Math.abs(c.lng - view.center[0]) < 1e-7 && Math.abs(c.lat - view.center[1]) < 1e-7 && Math.abs(map.getZoom() - view.zoom) < 1e-4) return;
    syncing.current = true;
    map.jumpTo({ center: view.center, zoom: view.zoom });
  }, [ready, view]);

  return (
    <div className={cn('overflow-hidden bg-[#080b10]', className ?? 'relative h-full w-full')} data-testid={rest['data-testid']} aria-label={label ?? 'Simulation map'} role="region">
      {/* inline style: maplibre's own CSS sets .maplibregl-map { position: relative } */}
      <div ref={el} style={{ position: 'absolute', inset: 0 }} />
      {!ready && <div className="ops-grid absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-[0.2em] text-fg-dim">Loading map…</div>}
    </div>
  );
}
