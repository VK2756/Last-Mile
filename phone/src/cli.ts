export {};
const number = process.argv.slice(2).find((item) => item !== '--');
if (!number || !/^\+[1-9]\d{7,14}$/.test(number)) {
  console.error('Usage: pnpm phone:call -- +1XXXXXXXXXX');
  process.exitCode = 2;
} else {
  const url = process.env.PHONE_SERVICE_URL ?? 'http://127.0.0.1:8443';
  const secret = process.env.PHONE_SHARED_SECRET;
  if (!secret) { console.error('PHONE_SHARED_SECRET is missing'); process.exitCode = 2; }
  else {
    try {
      const response = await fetch(url.replace(/\/$/, '') + '/call', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-phone-secret': secret }, body: JSON.stringify({ to: number }) });
      if (!response.ok) { console.error('Call request failed (HTTP ' + response.status + ')'); process.exitCode = 1; }
      else {
        const result = await response.json() as { sid?: string; status?: string };
        console.log((result.sid ?? 'unknown') + ' ' + (result.status ?? 'unknown'));
      }
    } catch { console.error('Phone service unavailable'); process.exitCode = 1; }
  }
}
