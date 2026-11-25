import { describe, it, expect } from 'vitest';
import { constructEvent, verifySignature } from '../src/index';

// BH-069 / #2569: the event type, delivery id, test flag and replay-of id
// travelled in unsigned headers, so a captured delivery could be re-sent
// within the 5-minute tolerance under another event type or a fresh delivery
// id. The v2 signature (`X-Signature-V2`) covers all of them, and the SDK
// requires it.

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return `sha256=${Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

interface Signed {
  deliveryId: string;
  eventType: string;
  test?: boolean;
  replayOf?: string;
}

// Signs exactly like apps/api/src/queues/deliver-webhook.ts: v1 over
// `${timestamp}.${payload}`, v2 over the LF-joined fields and the payload.
async function deliveryHeaders(secret: string, timestamp: string, payload: string, d: Signed) {
  const v2 = ['v2', timestamp, d.deliveryId, d.eventType, d.test ? '1' : '0', d.replayOf ?? '', payload].join('\n');
  const headers: Record<string, string> = {
    'X-Signature': await hmac(secret, `${timestamp}.${payload}`),
    'X-Signature-V2': await hmac(secret, v2),
    'X-Timestamp': timestamp,
    'X-Delivery-Id': d.deliveryId,
    'X-Chronary-Event-Type': d.eventType,
  };
  if (d.test) headers['X-Chronary-Test'] = '1';
  if (d.replayOf) headers['X-Chronary-Replay-Of'] = d.replayOf;
  return headers;
}

async function rejected(payload: string, headers: Record<string, string>, secret: string): Promise<unknown> {
  let result: unknown;
  let error: unknown;
  try {
    result = await constructEvent(payload, headers, secret);
  } catch (e) {
    error = e;
  }
  expect(result, `constructEvent accepted a forged delivery: ${JSON.stringify(result)}`).toBeUndefined();
  expect(error).toBeDefined();
  await expect(verifySignature(payload, headers, secret)).rejects.toThrow();
  return error;
}

describe('BH-069: the webhook event type and delivery metadata are covered by the signature', () => {
  const secret = 'whsec_bughunt_fixture';
  const timestamp = String(Math.floor(Date.now() / 1000));
  // Body as the API sends it for event.created / event.updated: no type inside.
  const payload = JSON.stringify({ calendar_id: 'cal_1', event: { id: 'evt_1', title: 'x' } });
  const original: Signed = { deliveryId: 'whd_original', eventType: 'event.created' };

  it('accepts the genuine delivery and returns its signed metadata', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    await expect(constructEvent(payload, headers, secret)).resolves.toEqual({
      type: 'event.created',
      data: JSON.parse(payload),
      deliveryId: 'whd_original',
      test: false,
      replayOf: null,
    });
  });

  it('rejects a captured delivery replayed with a relabelled X-Chronary-Event-Type', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    await rejected(payload, { ...headers, 'X-Chronary-Event-Type': 'event.updated' }, secret);
  });

  it('rejects the hold relabels the deep dive found (same body shape)', async () => {
    const holdBody = JSON.stringify({ calendar_id: 'cal_1', event_id: 'evt_1' });
    const released = await deliveryHeaders(secret, timestamp, holdBody, { deliveryId: 'whd_h', eventType: 'event.hold_released' });
    await rejected(holdBody, { ...released, 'X-Chronary-Event-Type': 'event.deleted' }, secret);
  });

  it('rejects a captured delivery replayed with a fresh X-Delivery-Id (defeats dedupe)', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    await rejected(payload, { ...headers, 'X-Delivery-Id': 'whd_attacker_fresh' }, secret);
  });

  it('rejects a test send with X-Chronary-Test stripped (passes as live)', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, { ...original, test: true });
    const { 'X-Chronary-Test': _stripped, ...live } = headers;
    await rejected(payload, live, secret);
  });

  it('rejects a live delivery with X-Chronary-Test added', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    await rejected(payload, { ...headers, 'X-Chronary-Test': '1' }, secret);
    await rejected(payload, { ...headers, 'X-Chronary-Test': 'true' }, secret);
  });

  it('rejects a changed, added or stripped X-Chronary-Replay-Of', async () => {
    const replay = await deliveryHeaders(secret, timestamp, payload, { deliveryId: 'whd_r', eventType: 'event.created', replayOf: 'whd_original' });
    await rejected(payload, { ...replay, 'X-Chronary-Replay-Of': 'whd_other' }, secret);
    const { 'X-Chronary-Replay-Of': _stripped, ...notReplay } = replay;
    await rejected(payload, notReplay, secret);
    const live = await deliveryHeaders(secret, timestamp, payload, original);
    await rejected(payload, { ...live, 'X-Chronary-Replay-Of': 'whd_original' }, secret);
  });

  it('does not fall back to v1 when X-Signature-V2 is stripped', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    const { 'X-Signature-V2': _stripped, ...v1Only } = headers;
    const error = await rejected(payload, { ...v1Only, 'X-Chronary-Event-Type': 'event.updated' }, secret);
    expect(String(error)).toContain('X-Signature-V2');
    await rejected(payload, v1Only, secret);
  });

  it('rejects a v1 signature pasted into X-Signature-V2', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    await rejected(payload, { ...headers, 'X-Signature-V2': headers['X-Signature'] }, secret);
  });

  it('rejects a header value with CR or LF, so no field can shift a boundary', async () => {
    const headers = await deliveryHeaders(secret, timestamp, payload, original);
    // Rejected by the CR/LF guard itself, not only by the signature mismatch.
    const error = await rejected(payload, { ...headers, 'X-Delivery-Id': 'whd_original\nevent.created' }, secret);
    expect(String(error)).toContain('CR or LF');
    for (const name of ['X-Timestamp', 'X-Chronary-Event-Type', 'X-Chronary-Replay-Of']) {
      await expect(verifySignature(payload, { ...headers, [name]: `${headers[name] ?? 'whd_0'}\r` }, secret)).rejects.toThrow(
        'CR or LF',
      );
    }
  });

  it('rotation: the X-Signature-V2-Previous twin verifies with the old secret and covers the same fields', async () => {
    const current = await deliveryHeaders('whsec_new', timestamp, payload, original);
    const previous = await deliveryHeaders('whsec_old', timestamp, payload, original);
    const headers = { ...current, 'X-Signature-V2-Previous': previous['X-Signature-V2'] };

    await expect(constructEvent(payload, headers, 'whsec_old')).resolves.toMatchObject({ type: 'event.created' });
    await expect(constructEvent(payload, headers, 'whsec_new')).resolves.toMatchObject({ type: 'event.created' });
    await rejected(payload, { ...headers, 'X-Chronary-Event-Type': 'event.updated' }, 'whsec_old');
  });

  it('matches the shared v2 known-answer vectors (API, Python and Go use the same ones)', async () => {
    const realNow = Date.now;
    const ts = '1745784205';
    const body = '{"calendar_id":"cal_1","event":{"id":"evt_1"}}';
    const vectors: Array<[Signed, string]> = [
      [{ deliveryId: 'whd_vector1', eventType: 'event.created' }, 'sha256=5ee321bd30e58aef4e26fb8cb10850982d8d11531e767983737f346908a88560'],
      [{ deliveryId: 'whd_vector1', eventType: 'event.created', test: true }, 'sha256=d81393f416bf1894fb8ddd17eb2527fd74104cf57f9e5b1d5b7eeb6d2c00048d'],
      [{ deliveryId: 'whd_vector2', eventType: 'event.created', replayOf: 'whd_vector1' }, 'sha256=cc34c8c295b86e898ce7675a34c9ca16ab1e843459ebcaa74d56dae5b8e0df88'],
    ];
    Date.now = () => Number(ts) * 1000;
    try {
      for (const [d, sig] of vectors) {
        const headers = { ...(await deliveryHeaders('whsec_v2_test_vector', ts, body, d)), 'X-Signature-V2': sig };
        await expect(verifySignature(body, headers, 'whsec_v2_test_vector')).resolves.toBeUndefined();
      }
    } finally {
      Date.now = realNow;
    }
  });
});
