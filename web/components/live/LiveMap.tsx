'use client';
// One live map. GeoJSON layers only (no per-household DOM markers) so 600+ points stay at 60fps.
// Basemap: OpenFreeMap vector tiles (no API key) styled dark, added after the tile-free style has
// loaded, over a background + grid that still looks right when tiles are slow or blocked (flaky
// venue wifi), or when ?tiles=0 forces the offline style. Before MapLibre loads, StaticMap draws.
import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl';
import type { LatLng, SimFrame, SimInit } from '@lastmile/contracts';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/cn';
import { EMPTY_FC, embersFC, fireFC, gridFC, helpersFC, householdsFC, ignitionFC, routesFC, safeZonesFC, type FC } from '@/lib/geo';
import { registerMapIcons } from '@/lib/map-icons';
import { StaticMap } from './StaticMap';

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

const TILE_ATTRIB = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

/** OpenFreeMap: free OpenMapTiles vector tiles, no API key. Styled here so it matches the ops-room theme. */
export const OPENFREEMAP_URL = 'https://tiles.openfreemap.org/planet';

type Layer = StyleSpecification['layers'][number];
const roadWidth = (base: number) => ['interpolate', ['exponential', 1.5], ['zoom'], 11, base * 0.4, 14, base, 17, base * 4] as unknown as number;

/** Dark, label-free basemap layers (no glyphs or sprites needed). */
function basemapLayers(): Layer[] {
  const src = { source: 'ofm' } as const;
  return [
    { id: 'bm-landuse', type: 'fill', ...src, 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'commercial', 'retail', 'industrial']]], paint: { 'fill-color': '#0c1118', 'fill-opacity': 0.9 } },
    { id: 'bm-green', type: 'fill', ...src, 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland']]], paint: { 'fill-color': '#0c1612', 'fill-opacity': 0.8 } },
    { id: 'bm-park', type: 'fill', ...src, 'source-layer': 'park', paint: { 'fill-color': '#0d1813', 'fill-opacity': 0.8 } },
    { id: 'bm-water', type: 'fill', ...src, 'source-layer': 'water', paint: { 'fill-color': '#0a1826' } },
    { id: 'bm-waterway', type: 'line', ...src, 'source-layer': 'waterway', paint: { 'line-color': '#0f2335', 'line-width': 1.2 } },
    { id: 'bm-building', type: 'fill', ...src, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': '#131a24', 'fill-outline-color': '#1a2330' } },
    { id: 'bm-road-minor', type: 'line', ...src, 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1f2833', 'line-width': roadWidth(1.2) } },
    { id: 'bm-road-mid', type: 'line', ...src, 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2a3442', 'line-width': roadWidth(1.8) } },
    { id: 'bm-road-major', type: 'line', ...src, 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#384455', 'line-width': roadWidth(2.4) } },
  ];
}

/**
 * The map always starts tile-free (background + grid, no network), so 'load' fires at once and the
 * simulation draws immediately. Tiles are added afterwards by addTiles() and stream in underneath;
 * if they are slow or blocked, the tile-free map is what people see.
 */
function baseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: { grid: { type: 'geojson', data: EMPTY_FC } },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#080b10' } },
      { id: 'grid', type: 'line', source: 'grid', paint: { 'line-color': '#1a2330', 'line-width': 1, 'line-opacity': 1 } },
    ],
  };
}

/** Add the vector basemap under the simulation layers; the grid fades once the first tiles draw. */
function addTiles(map: MLMap, beforeId: string) {
  map.addSource('ofm', { type: 'vector', url: OPENFREEMAP_URL, attribution: TILE_ATTRIB });
  for (const l of basemapLayers()) map.addLayer(l, beforeId);
  const onData = (e: { sourceId?: string; isSourceLoaded?: boolean; tile?: unknown }) => {
    if (e.sourceId !== 'ofm' || !e.tile) return;
    map.off('sourcedata', onData);
    if (map.getLayer('grid')) map.setPaintProperty('grid', 'line-opacity', 0.35);
  };
  map.on('sourcedata', onData);
}

/** UI scale from the root font size (16px = 1). Map icons follow it so 4K screens aren't specks. */
const uiScale = () => (typeof window === 'undefined' ? 1 : parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1);
const zoomSize = (stops: [number, number][], k: number) => ['interpolate', ['linear'], ['zoom'], ...stops.flatMap(([z, v]) => [z, v * k])] as unknown as number;

function applyScale(map: MLMap, k: number) {
  if (!map.getLayer('households')) return;
  map.setLayoutProperty('households', 'icon-size', zoomSize([[11, 0.6], [14, 0.95], [17, 1.4]], k));
  map.setLayoutProperty('helpers', 'icon-size', zoomSize([[11, 0.7], [15, 1.05]], k));
  map.setLayoutProperty('zones', 'icon-size', 1.1 * k);
  map.setPaintProperty('ignition', 'circle-radius', 5 * k);
  map.setPaintProperty('hh-halo', 'circle-radius', 15 * k);
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
  /** what the animation tick has to animate right now */
  const animRef = useRef({ routes: false, fire: false });
  /** bounds of the last automatic camera fit; refit on resize until the user moves the map */
  const fitRef = useRef<[[number, number], [number, number]] | null>(null);
  const userMoved = useRef(false);
  const refit = (map: MLMap) => {
    if (!fitRef.current) return;
    const k = uiScale();
    map.fitBounds(fitRef.current, { padding: { top: 160 * k, bottom: 40 * k, left: 40 * k, right: 40 * k }, duration: 0, maxZoom: 16 });
  };

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
        style: baseStyle(),
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
      ro = new ResizeObserver(() => {
        map.resize();
        applyScale(map, uiScale());
        if (!userMoved.current) refit(map);
      });
      const markUser = (e: { originalEvent?: unknown }) => { if (e.originalEvent) userMoved.current = true; };
      map.on('dragstart', markUser);
      map.on('zoomstart', markUser);
      ro.observe(el.current);
      map.on('error', (e) => {
        // tile failures are expected offline; the grid basemap stays visible underneath
        const msg = String((e as { error?: { message?: string } }).error?.message ?? '');
        if (!/tile|openfreemap|Failed to fetch|NetworkError|AJAXError/i.test(msg)) console.warn('[map]', msg);
      });
      map.on('load', () => {
        if (disposed) return;
        registerMapIcons(map);
        const add = (id: string) => map.addSource(id, { type: 'geojson', data: EMPTY_FC });
        ['fire', 'embers', 'routes', 'zones', 'ignition', 'households', 'helpers'].forEach(add);

        // fire: wide soft halo, translucent body, hot glowing front, faint embers ahead of it
        map.addLayer({ id: 'fire-halo', type: 'line', source: 'fire', paint: { 'line-color': '#ff4d12', 'line-width': 46, 'line-blur': 40, 'line-opacity': 0.16 } });
        map.addLayer({ id: 'fire-fill', type: 'fill', source: 'fire', paint: { 'fill-color': '#ff5a1f', 'fill-opacity': 0.24 } });
        map.addLayer({ id: 'fire-glow', type: 'line', source: 'fire', paint: { 'line-color': '#ff5a1f', 'line-width': 14, 'line-blur': 12, 'line-opacity': 0.55 } });
        map.addLayer({ id: 'fire-edge', type: 'line', source: 'fire', paint: { 'line-color': '#ffc04d', 'line-width': 2, 'line-blur': 0.5 } });
        map.addLayer({
          id: 'embers', type: 'circle', source: 'embers', minzoom: 12,
          paint: { 'circle-color': '#ffb020', 'circle-radius': ['*', ['get', 'r'], ['interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 1.6]], 'circle-opacity': ['get', 'a'], 'circle-blur': 0.6 },
        });

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
        applyScale(map, uiScale());
        if (tiles) addTiles(map, 'fire-halo');

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
          // ~8 Hz: each paint-property change repaints the whole map (two of them, at up to 4K),
          // so only animate what is on screen and never faster than the eye needs.
          const tick = (ts: number) => {
            if (disposed) return;
            if (ts - last > 120 && !document.hidden && (animRef.current.routes || animRef.current.fire)) {
              last = ts;
              step = (step + 1) % seq.length;
              if (animRef.current.routes && map.getLayer('routes')) map.setPaintProperty('routes', 'line-dasharray', seq[step]!);
              if (animRef.current.fire && map.getLayer('fire-glow')) map.setPaintProperty('fire-glow', 'line-opacity', 0.45 + 0.18 * Math.sin(ts / 520));
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

  // ---- helpers glide between frames (ease-in-out) instead of jumping; instant under reduced motion ----
  const helperPos = useRef(new Map<string, [number, number]>());
  const tweenRaf = useRef(0);
  const lastFrameAt = useRef(0);
  useEffect(() => () => cancelAnimationFrame(tweenRaf.current), []);
  const tweenHelpers = (target: FC) => {
    cancelAnimationFrame(tweenRaf.current);
    const now = performance.now();
    const gap = lastFrameAt.current ? now - lastFrameAt.current : 0;
    lastFrameAt.current = now;
    const from = new Map(helperPos.current);
    const to = new Map<string, [number, number]>();
    for (const f of target.features) to.set(String(f.properties?.id), (f.geometry as GeoJSON.Point).coordinates as [number, number]);
    const finish = () => { helperPos.current = to; setData('helpers', target); };
    // first frame, reduced motion, or a long gap (paused / replay jump): snap
    if (!from.size || prefersReducedMotion() || gap === 0 || gap > 2000) { finish(); return; }
    const dur = Math.min(Math.max(gap * 0.9, 120), 700);
    const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
    let lastSet = 0;
    const step = (ts: number) => {
      const p = Math.min(1, (ts - now) / dur);
      // ~30 Hz is smooth for vehicles and halves GeoJSON re-tiling work
      if (p < 1 && ts - lastSet < 33) { tweenRaf.current = requestAnimationFrame(step); return; }
      lastSet = ts;
      const e = ease(p);
      const cur = new Map<string, [number, number]>();
      const features = target.features.map((f) => {
        const id = String(f.properties?.id);
        const b = to.get(id)!;
        const a = from.get(id) ?? b;
        const c: [number, number] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
        cur.set(id, c);
        return { ...f, geometry: { type: 'Point' as const, coordinates: c } };
      });
      helperPos.current = cur;
      setData('helpers', { type: 'FeatureCollection', features });
      if (p < 1) tweenRaf.current = requestAnimationFrame(step);
      else finish();
    };
    tweenRaf.current = requestAnimationFrame(step);
  };

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
    fitRef.current = [[sw.lng, sw.lat], [ne.lng, ne.lat]];
    userMoved.current = false;
    if (!view) refit(map);
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
    setData('embers', embersFC(frame));
    animRef.current = { routes: (frame?.assignments.length ?? 0) > 0, fire: (frame?.fire.rings.length ?? 0) > 0 };
    tweenHelpers(helpersFC(frame));
    setData('households', householdsFC(init, frame, selectedId));
    // setData/tweenHelpers only touch refs and the map instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, init, frame, selectedId]);

  // ---- fly to the selected household ----
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !init || !selectedId) return;
    const h = init.households.find((x) => x.id === selectedId);
    if (h) map.easeTo({ center: [h.position.lng, h.position.lat], zoom: Math.max(map.getZoom(), 15), duration: prefersReducedMotion() ? 0 : 700 });
  }, [ready, init, selectedId]);

  // ---- two maps on one page: each canvas gets its own accessible name (axe landmark-unique) ----
  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute('aria-label', `${label ?? 'Simulation map'} (interactive map)`);
  }, [ready, label]);

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
      {!ready && (
        // until MapLibre is up: the same frame drawn as plain SVG (no tiles, no scripts), never a spinner
        <div className="ops-grid absolute inset-0" role="status" aria-label="Preparing the interactive map">
          <StaticMap init={init} frame={frame} accent={accent} />
        </div>
      )}
    </div>
  );
}
