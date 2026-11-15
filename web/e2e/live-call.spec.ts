import { expect, test } from '@playwright/test';

test('Live call shows simulation and falls back to browser voice or text without a key', async ({ page }) => {
  await page.route('**/api/live-token', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Live voice is not configured' }) }));
  const response = await page.goto('/call/live?debug=1');
  test.skip(response?.status() === 404, '/call/live is not deployed yet');
  await expect(page.getByTestId('sim-badge').first()).toBeVisible();
  await expect(page.getByText(/If you are in immediate danger, call 911/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Start live call' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'browser speech or typed answers' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Household needs call' })).toBeVisible();
});

test('mocked Live WebSocket updates transcript and extracted needs', async ({ page }) => {
  await page.route('**/api/live-token', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ token: 'ephemeral-test-only', model: 'models/test-live', apiVersion: 'v1beta', expiresAt: '2099-01-01T00:00:00Z' }) }));
  await page.route('**/api/triage', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ householdId: 'h1', needs: ['wheelchair'], hasRide: false, canWalkToRoad: false, residents: 2, urgency: 4, reply: 'Thank you.', summary: 'Two people need accessible transport.', done: true }) }));
  await page.goto('/call/live?debug=1');
  await page.evaluate(() => {
    class MockWebSocket {
      static instance: MockWebSocket;
      static OPEN = 1;
      readyState = 1;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      constructor() { MockWebSocket.instance = this; setTimeout(() => this.onopen?.(new Event('open')), 0); }
      send() {}
      close() { this.readyState = 3; this.onclose?.(new CloseEvent('close')); }
      receive(value: object) { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })); }
    }
    Object.defineProperty(window, 'WebSocket', { value: MockWebSocket });
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) } });
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock' });
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => {} });
    class MockAudioContext {
      currentTime = 0;
      destination = {};
      audioWorklet = { addModule: async () => {} };
      resume = async () => {};
      close = async () => {};
      createMediaStreamSource() { return { connect() {} }; }
      createGain() { return { gain: { value: 0 }, connect: () => ({ connect() {} }) }; }
    }
    class MockAudioWorkletNode { port = { onmessage: null }; connect(target: unknown) { return target; } disconnect() {} }
    Object.defineProperty(window, 'AudioContext', { value: MockAudioContext });
    Object.defineProperty(window, 'AudioWorkletNode', { value: MockAudioWorkletNode });
    Object.assign(window, { receiveLive: (value: object) => MockWebSocket.instance.receive(value) });
  });
  await page.getByRole('button', { name: 'Start live call' }).click();
  await expect(page.getByLabel('Live debug')).toContainText('Token: issued');
  await page.evaluate(() => (window as Window & { receiveLive: (value: object) => void }).receiveLive({ setupComplete: {} }));
  await expect(page.getByRole('button', { name: 'End call' })).toBeVisible();
  await page.evaluate(() => (window as Window & { receiveLive: (value: object) => void }).receiveLive({ serverContent: {
    inputTranscription: { text: 'I need a wheelchair and a ride for two people.' },
    outputTranscription: { text: 'Thank you. I have recorded your needs.' }, turnComplete: true,
  } }));
  await expect(page.getByLabel('Live transcript')).toContainText('wheelchair and a ride');
  await expect(page.getByLabel('Household needs')).toContainText('wheelchair');
  await expect(page.getByLabel('Live debug')).toContainText('16000 Hz');
});
