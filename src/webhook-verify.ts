import type { WebhookEvent, WebhookEventType, VerifyOptions } from './types';
import { ChronaryError } from './error';

const DEFAULT_TOLERANCE = 5 * 60 * 1000; // 5 minutes

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return `sha256=${bufToHex(sig)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  if (aBuf.length !== bBuf.length) return false;
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) diff |= aBuf[i] ^ bBuf[i];
  return diff === 0;
}

function getHeader(headers: Headers | Record<string, string>, name: string): string | null {
  if (headers instanceof Headers) return headers.get(name);

  const record = headers as Record<string, string>;
  const direct = record[name] ?? record[name.toLowerCase()];
  if (direct !== undefined) return direct;

  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  return null;
}

/** The delivery metadata a v2 signature covers, read from the headers. */
interface SignedDelivery {
  signature: string;
  previousSignature: string | null;
  timestamp: string;
  deliveryId: string;
  eventType: string;
  test: boolean;
  replayOf: string | null;
}

/**
 * Reads the headers the v2 signature covers (#2569). `X-Signature` (v1) is
 * never read: it does not cover the delivery id, event type, test flag or
 * replay id, so accepting it would let a stripped `X-Signature-V2` downgrade
 * the check.
 */
function extractHeaders(headers: Headers | Record<string, string>): SignedDelivery {
  const signature = getHeader(headers, 'X-Signature-V2');
  // Sent during a secret rotation's grace window, signed with the replaced secret.
  const previousSignature = getHeader(headers, 'X-Signature-V2-Previous');
  const timestamp = getHeader(headers, 'X-Timestamp');
  const deliveryId = getHeader(headers, 'X-Delivery-Id');
  const eventType = getHeader(headers, 'X-Chronary-Event-Type');
  const testHeader = getHeader(headers, 'X-Chronary-Test');
  const replayOf = getHeader(headers, 'X-Chronary-Replay-Of');

  if (!signature) {
    throw new ChronaryError(
      'Missing X-Signature-V2 header. This SDK verifies only v2-signed deliveries; X-Signature (v1) is not accepted.',
      0,
    );
  }
  if (!timestamp) throw new ChronaryError('Missing X-Timestamp header', 0);
  if (!deliveryId) throw new ChronaryError('Missing X-Delivery-Id header', 0);
  if (!eventType) throw new ChronaryError('Missing X-Chronary-Event-Type header', 0);
  // Absent (or empty) means a live delivery; Chronary sends exactly `1` on a test.
  if (testHeader && testHeader !== '1') {
    throw new ChronaryError('Invalid X-Chronary-Test header: expected 1 or no header', 0);
  }
  for (const value of [timestamp, deliveryId, eventType, replayOf ?? '']) {
    if (/[\r\n]/.test(value)) throw new ChronaryError('Webhook header contains CR or LF', 0);
  }

  return {
    signature,
    previousSignature: previousSignature || null,
    timestamp,
    deliveryId,
    eventType,
    test: testHeader === '1',
    replayOf: replayOf || null,
  };
}

/**
 * The v2 signed message: `v2`, the timestamp, delivery id, event type, test
 * flag (`1` / `0`), replay-of id (empty when none) and the raw body, joined
 * by LF. No header field can hold an LF, so the fields cannot shift.
 */
function v2Message(d: SignedDelivery, rawBody: string): string {
  return ['v2', d.timestamp, d.deliveryId, d.eventType, d.test ? '1' : '0', d.replayOf ?? '', rawBody].join('\n');
}

async function verifyV2(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  options?: VerifyOptions,
): Promise<SignedDelivery> {
  if (typeof rawBody !== 'string') {
    throw new ChronaryError(
      'rawBody must be a string. If you parsed the JSON body, pass the raw string instead.',
      0,
    );
  }

  const delivery = extractHeaders(headers);
  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE;

  // Timestamp tolerance check for replay prevention
  const tsMs = parseInt(delivery.timestamp, 10) * 1000;
  const now = Date.now();
  if (Math.abs(now - tsMs) > tolerance) {
    throw new ChronaryError(
      `Webhook timestamp too old. Received ${delivery.timestamp}, current time ${Math.floor(now / 1000)}. Tolerance: ${tolerance / 1000}s`,
      0,
    );
  }

  // After a rotation, deliveries carry X-Signature-V2 (new secret) and, until
  // the old secret expires, X-Signature-V2-Previous (old secret). Accept the
  // configured secret matching either, so a receiver can switch secrets at
  // any point in the window. Both comparisons always run (constant time).
  const expected = await hmacSha256(secret, v2Message(delivery, rawBody));
  const matchesCurrent = constantTimeEqual(expected, delivery.signature);
  const matchesPrevious =
    delivery.previousSignature !== null && constantTimeEqual(expected, delivery.previousSignature);
  if (!matchesCurrent && !matchesPrevious) {
    throw new ChronaryError('Webhook signature verification failed', 0);
  }
  return delivery;
}

/**
 * Verifies a delivery's `X-Signature-V2` (or, during a secret rotation,
 * `X-Signature-V2-Previous`). The signature covers the raw body and the
 * `X-Timestamp`, `X-Delivery-Id`, `X-Chronary-Event-Type`, `X-Chronary-Test`
 * and `X-Chronary-Replay-Of` headers, so once this resolves those headers
 * can be trusted. Throws a `ChronaryError` on a missing or bad signature, a
 * stale timestamp, or a v1-only delivery.
 */
export async function verifySignature(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  options?: VerifyOptions,
): Promise<void> {
  await verifyV2(rawBody, headers, secret, options);
}

/**
 * Verifies the delivery (see {@link verifySignature}) and returns its
 * signed metadata with the parsed body.
 */
export async function constructEvent(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  options?: VerifyOptions,
): Promise<WebhookEvent> {
  const delivery = await verifyV2(rawBody, headers, secret, options);
  const data = JSON.parse(rawBody);
  return {
    type: delivery.eventType as WebhookEventType,
    data,
    deliveryId: delivery.deliveryId,
    test: delivery.test,
    replayOf: delivery.replayOf,
  };
}
