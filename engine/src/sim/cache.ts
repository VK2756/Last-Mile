// OWNER: Lane A. Tiny in-process cache of the policy-independent parts of a run (road graph, fire model, population).
// The two policies of a paired Monte Carlo run use exactly the same fire and people, so building them once saves ~25% of the CPU.
// Everything cached is treated as READ-ONLY by the sim (the engine clones households before mutating them).
import type { FireModel, RoadGraph, ScenarioConfig } from '@lastmile/contracts';
import { createFireModel } from './fire';
import { loadGraph } from './deps';
import { generatePopulation, type Population } from '../world/population';

interface Entry { graph: RoadGraph; fire: FireModel; pop: Population }
const MAX = 6;
const cache = new Map<string, Entry>();
const graphs = new Map<string, RoadGraph>();

export function sharedWorld(config: ScenarioConfig): Entry {
  const key = JSON.stringify([config.seed, config.town, config.helperCount, config.wind, config.ignition]);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
  let graph = graphs.get(config.town); if (!graph) { graph = loadGraph(config); graphs.set(config.town, graph); }
  const fire = createFireModel(config);
  const entry = { graph, fire, pop: generatePopulation(config, graph, fire) };
  cache.set(key, entry); if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return entry;
}
