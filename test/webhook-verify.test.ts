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
  const secret = 'whsec_abcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
  const payload = JSON.stringify({ type: 'event.created', data: { event: { id: 'evt_1' } } });
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
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    const event = await constructEvent(payload, headers, secret);
    expect(event.type).toBe('event.created');
    expect(event.data).toBeDefined();
  });

  it('constructEvent rejects invalid signature', async () => {
    const headers = { 'X-Signature': 'sha256=bad', 'X-Timestamp': timestamp };

    await expect(constructEvent(payload, headers, secret)).rejects.toThrow(ChronaryError);
  });

  it('static Chronary.webhooks.verifySignature works', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    await expect(Chronary.webhooks.verifySignature(payload, headers, secret)).resolves.toBeUndefined();
  });

  it('static Chronary.webhooks.constructEvent works', async () => {
    const signature = await sign(secret, timestamp, payload);
    const headers = { 'X-Signature': signature, 'X-Timestamp': timestamp };

    const event = await Chronary.webhooks.constructEvent(payload, headers, secret);
    expect(event.type).toBe('event.created');
  });

  it('rejects non-string rawBody with helpful message', async () => {
    const headers = { 'X-Signature': 'sha256=abc', 'X-Timestamp': timestamp };

    await expect(verifySignature({ parsed: true } as unknown as string, headers, secret))
      .rejects.toThrow('rawBody must be a string');
  });
});
