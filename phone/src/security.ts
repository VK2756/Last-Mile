import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function isE164(value: string): boolean { return /^\+[1-9]\d{7,14}$/.test(value); }
export function maskPhone(value: string): string { return value.length < 6 ? '[hidden]' : value.slice(0, 3) + '…' + value.slice(-2); }
export function allowedNumbers(csv: string): Set<string> {
  return new Set(csv.split(',').map((item) => item.trim()).filter(isE164));
}
export function secretMatches(actual: string | undefined, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Reservation = { to: string; expires: number; used: boolean; callSid?: string };
export class CallGuard {
  private readonly history = new Map<string, number[]>();
  private readonly active = new Set<string>();
  private readonly tokens = new Map<string, Reservation>();
  constructor(private readonly secret: string, private readonly allowlist: Set<string>, private readonly now = Date.now) {}
  reserve(to: string): 'allowed' | 'forbidden' | 'rate' | 'active' {
    if (!this.allowlist.has(to)) return 'forbidden';
    if (this.active.size > 0) return 'active';
    const recent = (this.history.get(to) ?? []).filter((time) => this.now() - time < 3_600_000);
    if (recent.length >= 3) return 'rate';
    recent.push(this.now()); this.history.set(to, recent); this.active.add(to);
    return 'allowed';
  }
  release(to: string): void { this.active.delete(to); }
  failed(to: string): void {
    this.release(to);
    const times = this.history.get(to);
    times?.pop();
  }
  issue(to: string): string {
    const nonce = randomBytes(24).toString('base64url');
    const expires = this.now() + 60_000;
    const payload = nonce + '.' + expires;
    const signature = createHmac('sha256', this.secret).update(payload).digest('base64url');
    this.tokens.set(nonce, { to, expires, used: false });
    return payload + '.' + signature;
  }
  bind(token: string, sid: string): void {
    const nonce = token.split('.')[0]; const value = this.tokens.get(nonce ?? '');
    if (value) value.callSid = sid;
  }
  consume(token: string, sid: string): string | null {
    const [nonce, expiresText, signature, extra] = token.split('.');
    if (!nonce || !expiresText || !signature || extra) return null;
    const item = this.tokens.get(nonce);
    if (!item || item.used || item.expires < this.now() || item.callSid && item.callSid !== sid) return null;
    const expected = createHmac('sha256', this.secret).update(nonce + '.' + expiresText).digest('base64url');
    if (!secretMatches(signature, expected) || Number(expiresText) !== item.expires) return null;
    item.used = true; this.tokens.delete(nonce);
    return item.to;
  }
}
