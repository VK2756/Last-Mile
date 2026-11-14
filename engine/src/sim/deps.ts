// OWNER: Lane A. Adapter between the sim and Lane D's modules (routing, dispatch, town). Keeping the calls here means a
// signature change on their side touches one file of mine.
import type { Dispatcher, FireModel, RoadGraph, Router, ScenarioConfig } from '@lastmile/contracts';
import { createRouter, routingAssumptions } from '../routing';
import { createDispatcher } from '../dispatch';
import { loadTown } from '../world/town';

export const makeRouter = (graph: RoadGraph, fire: FireModel): Router => (createRouter as unknown as (g: RoadGraph, f: FireModel) => Router)(graph, fire);
export const makeDispatcher = (): Dispatcher => createDispatcher();
export const loadGraph = (config: ScenarioConfig): RoadGraph => (loadTown as unknown as (town: ScenarioConfig['town']) => RoadGraph)(config.town);
export const routerAssumptions = (): string[] => routingAssumptions();
