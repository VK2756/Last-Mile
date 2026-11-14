import { expect, test, type Page } from '@playwright/test';

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
