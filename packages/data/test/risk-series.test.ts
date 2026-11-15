import { afterEach, expect, it, vi } from 'vitest';

const { query, end } = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ default: { Pool: class { query = query; end = end; } } }));

import { dispatchSeries } from '../src/risk-series';

const originalUrl = process.env.TIGER_DATABASE_URL;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.TIGER_DATABASE_URL;
  else process.env.TIGER_DATABASE_URL = originalUrl;
  query.mockReset();
  end.mockReset();
});

it('returns no dispatch counts when Tiger is not configured', async () => {
  delete process.env.TIGER_DATABASE_URL;
  expect(await dispatchSeries('scenario-1')).toEqual([]);
  expect(query).not.toHaveBeenCalled();
});

it('groups distinct Last Mile assignments by simulated minute for one scenario', async () => {
  process.env.TIGER_DATABASE_URL = 'test-only';
  query.mockResolvedValue({ rows: [{ minute: 0, dispatches: '2' }, { minute: 1, dispatches: '3' }] });
  expect(await dispatchSeries('scenario-1')).toEqual([{ minute: 0, dispatches: 2 }, { minute: 1, dispatches: 3 }]);
  expect(query).toHaveBeenCalledWith(expect.stringMatching(/floor\(sim_t \/ 60\).*count\(DISTINCT assignment_id\)/s), ['scenario-1']);
  expect(query.mock.calls[0]?.[0]).toContain("policy = 'last_mile'");
  expect(end).toHaveBeenCalledOnce();
});
