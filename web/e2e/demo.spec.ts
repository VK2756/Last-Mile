import { expect, test, type Page } from '@playwright/test';
import { sampleInit } from '@lastmile/contracts/fixtures';

function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('mock live view renders both maps and advances frames without console errors', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/live?mock=1');
  await expect(page.getByTestId('sim-badge').first()).toBeVisible();
  await expect(page.getByTestId('map-alerts')).toBeVisible();
  await expect(page.getByTestId('map-last-mile')).toBeVisible();
  const frame = page.getByTestId('frame-counter');
  await expect(frame).toBeVisible();
  const first = await frame.textContent();
  await expect.poll(() => frame.textContent()).not.toBe(first);
  expect(errors).toEqual([]);
});

test('real live view updates scoreboards', async ({ page }) => {
  test.skip(process.env.E2E_REAL_ENGINE !== '1', 'Set E2E_REAL_ENGINE=1 when the deployed engine is available');
  const errors = watchConsole(page);
  await page.goto('/live');
  await expect(page.getByTestId('sim-badge').first()).toBeVisible();
  const baseline = page.getByTestId('score-alerts');
  const lastMile = page.getByTestId('score-last-mile');
  await expect(baseline).toBeVisible();
  await expect(lastMile).toBeVisible();
  const first = await lastMile.textContent();
  await expect.poll(() => lastMile.textContent()).not.toBe(first);
  expect(errors).toEqual([]);
});

test('results show confidence intervals', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/results');
  await expect(page.getByTestId('sim-badge').first()).toBeVisible();
  await expect(page.getByTestId('confidence-intervals')).toBeVisible();
  expect(errors).toEqual([]);
});

test('call screen renders and accepts a typed answer', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/call?scenario=demo-1&household=h1');
  await expect(page.getByTestId('sim-badge')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Household needs call' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simulation assumptions' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Your answer' }).fill('I need a ride and use a wheelchair.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText(/Needs:.*wheelchair/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('completed call updates a real engine scenario', async ({ page, request }) => {
  test.skip(process.env.E2E_REAL_ENGINE !== '1', 'Set E2E_REAL_ENGINE=1 with a local or deployed engine');
  const errors = watchConsole(page);
  const engine = process.env.E2E_ENGINE_URL || 'http://127.0.0.1:8080';
  const created = await request.post(`${engine}/scenarios`, {
    data: { ...sampleInit.config, seed: 9876, speedMultiplier: 0.25 },
  });
  expect(created.ok()).toBe(true);
  const { scenarioId } = await created.json() as { scenarioId: string };
  await page.goto(`/call?scenario=${encodeURIComponent(scenarioId)}&household=h1`);
  await page.getByRole('textbox', { name: 'Your answer' }).fill('I need a ride and use a wheelchair. Two people are with me.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Needs recorded in the simulation. The live map has been updated.')).toBeVisible();
  expect(errors).toEqual([]);
});
