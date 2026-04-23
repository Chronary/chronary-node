import type { WebhookEvent, VerifyOptions } from './types';
import { ChronaryError } from './error';

const DEFAULT_TOLERANCE = 5 * 60 * 1000; // 5 minutes

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSignature(secret: string, timestamp: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const message = encoder.encode(`${timestamp}.${payload}`);
  const sig = await crypto.subtle.sign('HMAC', key, message);
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

function extractHeaders(headers: Headers | Record<string, string>): { signature: string; timestamp: string } {
  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    return (headers as Record<string, string>)[name] ?? (headers as Record<string, string>)[name.toLowerCase()] ?? null;
  };

  const signature = get('X-Signature') ?? get('x-signature');
  const timestamp = get('X-Timestamp') ?? get('x-timestamp');

  if (!signature) throw new ChronaryError('Missing X-Signature header', 0);
  if (!timestamp) throw new ChronaryError('Missing X-Timestamp header', 0);

  return { signature, timestamp };
}

export async function verifySignature(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  options?: VerifyOptions,
): Promise<void> {
  if (typeof rawBody !== 'string') {
    throw new ChronaryError(
      'rawBody must be a string. If you parsed the JSON body, pass the raw string instead.',
      0,
    );
  }

  const { signature, timestamp } = extractHeaders(headers);
  const tolerance = options?.tolerance ?? DEFAULT_TOLERANCE;

  // Timestamp tolerance check for replay prevention
  const tsMs = parseInt(timestamp, 10) * 1000;
  const now = Date.now();
  if (Math.abs(now - tsMs) > tolerance) {
    throw new ChronaryError(
      `Webhook timestamp too old. Received ${timestamp}, current time ${Math.floor(now / 1000)}. Tolerance: ${tolerance / 1000}s`,
      0,
    );
  }

  const expected = await computeSignature(secret, timestamp, rawBody);
  if (!constantTimeEqual(expected, signature)) {
    throw new ChronaryError('Webhook signature verification failed', 0);
  }
}

export async function constructEvent(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  options?: VerifyOptions,
): Promise<WebhookEvent> {
  await verifySignature(rawBody, headers, secret, options);
  const parsed = JSON.parse(rawBody);
  return parsed as WebhookEvent;
}
