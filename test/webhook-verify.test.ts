import { describe, it, expect } from 'vitest';
import { Chronary, verifySignature, constructEvent, ChronaryError } from '../src/index';

async function hmac(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `sha256=${hex}`;
}

interface Delivery {
  deliveryId?: string;
  eventType?: string;
  test?: boolean;
  replayOf?: string;
}

// Replicate the API's v2 signing (apps/api/src/lib/hmac.ts, #2569).
function signV2(secret: string, timestamp: string, payload: string, d: Delivery = {}): Promise<string> {
  const message = [
    'v2',
    timestamp,
    d.deliveryId ?? 'whd_1',
    d.eventType ?? 'event.created',
    d.test ? '1' : '0',
    d.replayOf ?? '',
    payload,
  ].join('\n');
  return hmac(secret, message);
}

/** The headers of one delivery, signed the way the API signs it. */
async function signedHeaders(
  secret: string,
  timestamp: string,
  payload: string,
  d: Delivery = {},
): Promise<Record<string, string>> {
  return {
    'X-Signature-V2': await signV2(secret, timestamp, payload, d),
    'X-Signature': await hmac(secret, `${timestamp}.${payload}`),
    'X-Timestamp': timestamp,
    'X-Delivery-Id': d.deliveryId ?? 'whd_1',
    'X-Chronary-Event-Type': d.eventType ?? 'event.created',
    ...(d.test ? { 'X-Chronary-Test': '1' } : {}),
    ...(d.replayOf ? { 'X-Chronary-Replay-Of': d.replayOf } : {}),
  };
}

describe('Webhook verification', () => {
  const secret = 'whsec_test_fixture_not_a_real_secret';
  const payload = JSON.stringify({ event: { id: 'evt_1' } });
  const nowSec = Math.floor(Date.now() / 1000);
  const timestamp = String(nowSec);

  it('verifySignature succeeds with valid signature', async () => {
    const headers = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('verifySignature fails with wrong signature', async () => {
    const headers = { ...(await signedHeaders(secret, timestamp, payload)), 'X-Signature-V2': 'sha256=0000000000000000' };

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('signature verification failed');
  });

  it('verifySignature fails with wrong secret', async () => {
    const headers = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, 'whsec_wrong')).rejects.toThrow('signature verification failed');
  });

  it('verifySignature fails with missing X-Signature-V2 header, even with a valid v1 X-Signature', async () => {
    const { 'X-Signature-V2': _v2, ...headers } = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Signature-V2');
  });

  it('verifySignature fails with missing X-Timestamp header', async () => {
    const { 'X-Timestamp': _ts, ...headers } = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Timestamp');
  });

  it('verifySignature fails with missing X-Delivery-Id header', async () => {
    const { 'X-Delivery-Id': _id, ...headers } = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Delivery-Id');
  });

  it('verifySignature fails with missing X-Chronary-Event-Type header', async () => {
    const { 'X-Chronary-Event-Type': _type, ...headers } = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Missing X-Chronary-Event-Type');
  });

  it('verifySignature rejects old timestamps', async () => {
    const oldTimestamp = String(nowSec - 600); // 10 minutes ago
    const headers = await signedHeaders(secret, oldTimestamp, payload);

    await expect(verifySignature(payload, headers, secret)).rejects.toThrow('Webhook timestamp too old');
  });

  it('verifySignature accepts timestamps within tolerance', async () => {
    const recentTimestamp = String(nowSec - 60); // 1 minute ago
    const headers = await signedHeaders(secret, recentTimestamp, payload);

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('verifySignature with custom tolerance', async () => {
    const oldTimestamp = String(nowSec - 30);
    const headers = await signedHeaders(secret, oldTimestamp, payload);

    // 10 second tolerance — should reject a 30-second-old timestamp
    await expect(verifySignature(payload, headers, secret, { tolerance: 10_000 })).rejects.toThrow('timestamp too old');
  });

  it('verifySignature works with Headers object', async () => {
    const headers = new Headers(await signedHeaders(secret, timestamp, payload));

    await expect(verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('verifySignature reads headers case-insensitively from a plain object', async () => {
    const lower = Object.fromEntries(
      Object.entries(await signedHeaders(secret, timestamp, payload)).map(([k, v]) => [k.toLowerCase(), v]),
    );

    await expect(verifySignature(payload, lower, secret)).resolves.toBeUndefined();
  });

  it('constructEvent returns parsed event with its signed metadata', async () => {
    const headers = await signedHeaders(secret, timestamp, payload, { deliveryId: 'whd_abc' });

    const event = await constructEvent(payload, headers, secret);
    expect(event).toEqual({
      type: 'event.created',
      data: { event: { id: 'evt_1' } },
      deliveryId: 'whd_abc',
      test: false,
      replayOf: null,
    });
  });

  it('constructEvent reads the test flag and replay id from a Headers object', async () => {
    const headers = new Headers(
      await signedHeaders(secret, timestamp, payload, { deliveryId: 'whd_2', test: true, replayOf: 'whd_1' }),
    );

    const event = await constructEvent(payload, headers, secret);
    expect(event).toEqual({
      type: 'event.created',
      data: { event: { id: 'evt_1' } },
      deliveryId: 'whd_2',
      test: true,
      replayOf: 'whd_1',
    });
  });

  it('constructEvent rejects missing event-type header', async () => {
    const { 'X-Chronary-Event-Type': _type, ...headers } = await signedHeaders(secret, timestamp, payload);

    await expect(constructEvent(payload, headers, secret)).rejects.toThrow('Missing X-Chronary-Event-Type');
  });

  it('constructEvent rejects invalid signature', async () => {
    const headers = { ...(await signedHeaders(secret, timestamp, payload)), 'X-Signature-V2': 'sha256=bad' };

    await expect(constructEvent(payload, headers, secret)).rejects.toThrow(ChronaryError);
  });

  it('static Chronary.webhooks.verifySignature works', async () => {
    const headers = await signedHeaders(secret, timestamp, payload);

    await expect(Chronary.webhooks.verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('static Chronary.webhooks.constructEvent works', async () => {
    const headers = await signedHeaders(secret, timestamp, payload);

    const event = await Chronary.webhooks.constructEvent(payload, headers, secret);
    expect(event.type).toBe('event.created');
  });

  it('rejects non-string rawBody with helpful message', async () => {
    const headers = await signedHeaders(secret, timestamp, payload);

    await expect(verifySignature({ parsed: true } as unknown as string, headers, secret))
      .rejects.toThrow('rawBody must be a string');
  });
});

describe('Webhook verification during a secret rotation (#594)', () => {
  const oldSecret = 'whsec_old';
  const newSecret = 'whsec_new';
  const payload = JSON.stringify({ event: { id: 'evt_1' } });
  const timestamp = String(Math.floor(Date.now() / 1000));

  async function rotatedHeaders(ts = timestamp): Promise<Record<string, string>> {
    const current = await signedHeaders(newSecret, ts, payload);
    const previous = await signedHeaders(oldSecret, ts, payload);
    return {
      ...current,
      'X-Signature-Previous': previous['X-Signature'],
      'X-Signature-V2-Previous': previous['X-Signature-V2'],
    };
  }

  it('accepts the new secret via X-Signature-V2', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), newSecret)).resolves.toBeUndefined();
  });

  it('accepts the old secret via X-Signature-V2-Previous', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), oldSecret)).resolves.toBeUndefined();
  });

  it('reads X-Signature-V2-Previous case-insensitively and from a Headers object', async () => {
    const lower = Object.fromEntries(Object.entries(await rotatedHeaders()).map(([k, v]) => [k.toLowerCase(), v]));
    await expect(verifySignature(payload, lower, oldSecret)).resolves.toBeUndefined();
    await expect(verifySignature(payload, new Headers(await rotatedHeaders()), oldSecret)).resolves.toBeUndefined();
  });

  it('rejects when neither header matches the secret', async () => {
    await expect(verifySignature(payload, await rotatedHeaders(), 'whsec_other')).rejects.toThrow(
      'signature verification failed',
    );
  });

  it('rejects the old secret once X-Signature-V2-Previous is no longer sent', async () => {
    const headers = await rotatedHeaders();
    delete headers['X-Signature-V2-Previous'];
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('signature verification failed');
  });

  it('never accepts the old secret through the v1 X-Signature-Previous', async () => {
    const headers = await rotatedHeaders();
    delete headers['X-Signature-V2-Previous'];
    expect(headers['X-Signature-Previous']).toBeDefined();
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('signature verification failed');
  });

  it('still requires X-Signature-V2 even when X-Signature-V2-Previous matches', async () => {
    const headers = await rotatedHeaders();
    delete headers['X-Signature-V2'];
    await expect(verifySignature(payload, headers, oldSecret)).rejects.toThrow('Missing X-Signature-V2 header');
  });

  it('does not let a valid previous signature bypass the timestamp check', async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 3600);
    await expect(verifySignature(payload, await rotatedHeaders(stale), oldSecret)).rejects.toThrow('timestamp too old');
  });

  it('constructEvent works with the old secret during the window', async () => {
    const event = await constructEvent(payload, await rotatedHeaders(), oldSecret);
    expect(event.type).toBe('event.created');
  });
});
