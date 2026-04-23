// Ensure `globalThis.crypto` is available in the test environment.
// Node 19+ and Cloudflare Workers expose it natively; Node 18 only exposes
// it via `node:crypto` as `webcrypto`. CI runs Node 22 where this is a no-op.
import { webcrypto } from 'node:crypto';

if (!('crypto' in globalThis) || typeof (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
