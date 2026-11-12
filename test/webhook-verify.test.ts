import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Chronary, verifySignature, constructEvent, ChronaryError } from '../src/index';

// Replicate the signing logic from the API
async function sign(secret: string, timestamp: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

describe('Webhook verification', () => {
  const secret = 'whsec_test_fixture_not_a_real_secret';
  const payload = JSON.stringify({ event: { id: 'evt_1' } });
  const nowSec = Math.floor(Date.now() / 1000);
  const timestamp = String(nowSec);

  it('verifySignature succeeds with valid signature', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('verifySignature fails with wrong signature', async () => {
    const headers = { 'X-Signature': 'sha256=0000000000000000', 'X-Timestamp': timestamp };

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('signature verification failed');
  });

  it('verifySignature fails with wrong secret', async () => {
    const wrongSecret = 'whsec_wrong';
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    await expect(verifySignature(payload, headers, wrongSecret)).rejects.toThrow('signature verification failed');
  });

  it('verifySignature fails with missing X-Signature header', async () => {
    const headers = { 'X-Timestamp': timestamp };

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Signature');
  });

  it('verifySignature fails with missing X-Timestamp header', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature };

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Timestamp');
  });

  it('verifySignature rejects old timestamps', async () => {
    const oldTimestamp = String(nowSec - 600); // 10 minutes ago
    const signature = await sign(secret, oldTimestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': oldTimestamp };

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Webhook timestamp too old');
  });

  it('verifySignature accepts timestamps within tolerance', async () => {
    const recentTimestamp = String(nowSec - 60); // 1 minute ago
    const signature = await sign(secret, recentTimestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': recentTimestamp };

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('verifySignature with custom tolerance', async () => {
    const oldTimestamp = String(nowSec - 30);
    const signature = await sign(secret, oldTimestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': oldTimestamp };

    // 10 second tolerance — should reject a 30-second-old timestamp
    await expect(verifySignature(payload, headers, secret, { tolerance: 10_000 })).rejects.toThrow('timestamp too old');
  });

  it('verifySignature works with Headers object', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = new Headers({ 'x-signature': signature, 'x-timestamp': timestamp });

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('constructEvent returns parsed event', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = {
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Chronary-Event-Type': 'event.created',
    };

    const event = await constructEvent(payload, headers, secret);
    expect(event.type).toBe('event.created');
    expect(event.data).toEqual({ event: { id: 'evt_1' } });
  });

  it('constructEvent reads event type from Headers object', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = new Headers({
      'x-signature': signature,
      'x-timestamp': timestamp,
      'x-chronary-event-type': 'event.created',
    });

    const event = await constructEvent(payload, headers, secret);
    expect(event).toEqual({ type: 'event.created', data: { event: { id: 'evt_1' } } });
  });

  it('constructEvent rejects missing event-type header', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    await expect(constructEvent(payload, headers, secret)).rejects.toThrow('Missing X-Chronary-Event-Type');
  });

  it('constructEvent rejects invalid signature', async () => {
    const headers = {
      'X-Signature': 'sha256=bad',
      'X-Timestamp': timestamp,
      'X-Chronary-Event-Type': 'event.created',
    };

    await expect(constructEvent(payload, headers, secret)).rejects.toThrow(ChronaryError);
  });

  it('static Chronary.webhooks.verifySignature works', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    await expect(Chronary.webhooks.verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('static Chronary.webhooks.constructEvent works', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = {
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Chronary-Event-Type': 'event.created',
    };

    const event = await Chronary.webhooks.constructEvent(payload, headers, secret);
    expect(event.type).toBe('event.created');
  });

  it('rejects non-string rawBody with helpful message', async () => {
    const headers = { 'X-Signature': 'sha256=abc', 'X-Timestamp': timestamp };

    await expect(verifySignature({ parsed: true } as unknown as string, headers, secret))
      .rejects.toThrow('rawBody must be a string');
  });
});

describe('Webhook verification during a secret rotation (#594)', () => {
  const oldSecret = 'whsec_old';
  const newSecret = 'whsec_new';
  const payload = JSON.stringify({ event: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));

  async function rotatedHeaders(): Promise<Record<string, string>> {
    return {
      'X-Signature': await sign(newSecret, timestamp, payload),
      'X-Signature-Previous': await sign(oldSecret, timestamp, payload),
      'X-Timestamp': timestamp,
    };
  }

  it('accepts the new secret via X-Signature', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), newSecret)).resolves.toBeUndefined();
  });

  it('accepts the old secret via X-Signature-Previous', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), oldSecret)).resolves.toBeUndefined();
  });

  it('reads X-Signature-Previous case-insensitively and from a Headers object', async () => {
    const lower = Object.fromEntries(Object.entries(await rotatedHeaders()).map(([k, v]) => [k.toLowerCase(), v]));
    await expect(verifySignature(payload, lower, oldSecret)).resolves.toBeUndefined();
    await expect(verifySignature(payload, new Headers(await rotatedHeaders()), oldSecret)).resolves.toBeUndefined();
  });

  it('rejects when neither header matches the secret', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), 'whsec_other')).rejects.toThrow(
      'signature verification failed',
    );
  });

  it('rejects the old secret once X-Signature-Previous is no longer sent', async () => {
    const headers = await rotatedHeaders();
    delete headers['X-Signature-Previous'];
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('signature verification failed');
  });

  it('still requires X-Signature even when X-Signature-Previous matches', async () => {
    const headers = await rotatedHeaders();
    delete headers['X-Signature'];
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('Missing X-Signature header');
  });

  it('does not let a valid previous signature bypass the timestamp check', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    const headers = {
      'X-Signature': await sign(newSecret, stale, payload),
      'X-Signature-Previous': await sign(oldSecret, stale, payload),
      'X-Timestamp': stale,
    };
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('timestamp too old');
  });

  it('constructEvent works with the old secret during the window', async () => {
    const headers = { ...(await rotatedHeaders()), 'X-Chronary-Event-Type': 'event.created' };
    const event = await constructEvent(payload, headers, oldSecret);
    expect(event.type).toBe('event.created');
  });
});
